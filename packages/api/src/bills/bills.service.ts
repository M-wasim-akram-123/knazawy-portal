import {
  moneyMatches,
  supplierBillOwed,
  type Actor,
  type GoodsReceiptRecord,
} from '@knazawy/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { assertCan } from '../auth/permissions';
import { requireBranch } from '../common/branch';
import { parseIsoDate } from '../common/date';
import { parseNonNegativeDecimal, parsePositiveDecimal } from '../common/decimal';
import { nextDocumentNumber } from '../common/document-number';
import { rethrowUnique } from '../common/prisma-error';
import { PrismaService } from '../prisma/prisma.service';
import { receiptInclude, toReceipt } from '../receipts/receipt-record';

import { BillFiles } from './bill-files';
import type { PostBillDto } from './bills.dto';

const BILL_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/pdf': '.pdf',
};

/** The first bytes of each allowed file type. The browser's claimed type is not trusted alone. */
const BILL_SIGNATURES: Record<string, number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'application/pdf': [0x25, 0x50, 0x44, 0x46, 0x2d],
};

/** True when the file's own bytes match the type it claims. */
export function matchesSignature(contentType: string, bytes: Buffer): boolean {
  const signature = BILL_SIGNATURES[contentType];
  if (!signature || bytes.length < signature.length) return false;
  return signature.every((byte, index) => bytes[index] === byte);
}

const MAX_BILL_BYTES = 8 * 1024 * 1024;

export interface IncomingBill {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

interface PostedLine {
  itemId: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
}

@Injectable()
export class BillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly files: BillFiles,
  ) {}

  async post(
    actor: Actor,
    input: PostBillDto,
    file: IncomingBill | undefined,
  ): Promise<GoodsReceiptRecord> {
    assertCan(actor, 'stock', 'C', 'post a supplier bill');
    const bill = requireBill(file);
    const receivedOn = parseIsoDate(input.billedOn);
    const billNumber = input.billNumber.trim();
    if (!billNumber || billNumber.length > 40) {
      throw new BadRequestException('Enter the bill number.');
    }
    const posted = parsePostedLines(input.lines);
    const tax = parseMoney(input.tax ?? '0', 'Enter tax and discount as zero or more.');
    const discount = parseMoney(input.discount ?? '0', 'Enter tax and discount as zero or more.');
    const total = parseMoney(input.billTotal, 'Enter the bill total.');
    if (total.lte(0)) throw new BadRequestException('Enter the bill total.');
    assertTotals(posted, tax, discount, total);

    let storedAs: string | undefined;
    try {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: input.supplierId, organisationId: actor.organisationId, active: true },
      });
      if (!supplier) throw new BadRequestException('Choose a supplier that exists.');
      const location = await this.prisma.stockLocation.findFirst({
        where: {
          id: input.locationId,
          organisationId: actor.organisationId,
          branchId: requireBranch(actor),
          active: true,
        },
      });
      if (!location) throw new BadRequestException('Choose an open location.');
      const itemIds = [...new Set(posted.map((line) => line.itemId))];
      const items = await this.prisma.item.findMany({
        where: { organisationId: actor.organisationId, id: { in: itemIds }, active: true },
      });
      if (items.length !== itemIds.length) {
        throw new BadRequestException('Choose an item that exists.');
      }
      const duplicate = await this.prisma.goodsReceipt.findFirst({
        where: {
          organisationId: actor.organisationId,
          supplierId: supplier.id,
          billNumber: { equals: billNumber, mode: 'insensitive' },
          billTotal: total,
        },
      });
      if (duplicate) throw new BadRequestException('This bill is already on file.');
      const prepared = {
        supplier,
        location,
        items: new Map(items.map((item) => [item.id, item])),
      };

      storedAs = await this.files.save(actor.organisationId, bill.extension, bill.buffer);
      const created = await this.prisma.$transaction(async (tx) => {
        const number = await nextDocumentNumber(tx, actor.organisationId, 'GOODS_RECEIPT');
        const receipt = await tx.goodsReceipt.create({
          data: {
            organisationId: actor.organisationId,
            number,
            supplierId: prepared.supplier.id,
            locationId: prepared.location.id,
            receivedOn,
            billNumber,
            billTotal: total,
            billTax: tax,
            billDiscount: discount,
            billFileName: bill.fileName,
            billStoredAs: storedAs,
            billContentType: bill.contentType,
            lines: {
              create: posted.map((line) => {
                const item = prepared.items.get(line.itemId);
                if (!item) throw new BadRequestException('Choose an item that exists.');
                return {
                  itemId: item.id,
                  quantity: line.quantity,
                  quantityBase: line.quantity.mul(item.conversionToBase).toDecimalPlaces(4),
                  unitCost: line.unitPrice.div(item.conversionToBase).toDecimalPlaces(4),
                };
              }),
            },
          },
          include: receiptInclude,
        });
        for (const line of receipt.lines) {
          const layer = await tx.stockLayer.create({
            data: {
              organisationId: actor.organisationId,
              itemId: line.itemId,
              locationId: prepared.location.id,
              receiptLineId: line.id,
              quantityBase: line.quantityBase,
              unitCost: line.unitCost,
              receivedOn,
            },
          });
          await tx.stockMovement.create({
            data: {
              organisationId: actor.organisationId,
              itemId: line.itemId,
              locationId: prepared.location.id,
              layerId: layer.id,
              receiptLineId: line.id,
              type: 'RECEIPT',
              quantityBase: line.quantityBase,
              unitCost: line.unitCost,
            },
          });
        }
        await tx.supplierPayable.create({
          data: {
            organisationId: actor.organisationId,
            supplierId: prepared.supplier.id,
            receiptId: receipt.id,
            amount: total,
          },
        });
        await this.audit.record(tx, {
          userId: actor.id,
          entity: 'GoodsReceipt',
          entityId: receipt.id,
          action: 'create',
          after: toReceipt(receipt),
        });
        return receipt;
      });
      return toReceipt(created);
    } catch (error) {
      if (storedAs) await this.files.remove(storedAs);
      rethrowUnique(error, 'This bill is already on file.');
    }
  }

  async readFile(
    actor: Actor,
    receiptId: string,
  ): Promise<{ fileName: string; contentType: string; bytes: Buffer }> {
    assertCan(actor, 'stock', 'R', 'view a supplier bill');
    const receipt = await this.prisma.goodsReceipt.findFirst({
      where: { id: receiptId, organisationId: actor.organisationId },
    });
    if (!receipt?.billStoredAs || !receipt.billContentType) {
      throw new NotFoundException('That bill was not found.');
    }
    try {
      const bytes = await this.files.read(receipt.billStoredAs);
      return {
        fileName: receipt.billFileName ?? 'bill',
        contentType: receipt.billContentType,
        bytes,
      };
    } catch {
      throw new NotFoundException('That bill was not found.');
    }
  }
}

function requireBill(file: IncomingBill | undefined): {
  buffer: Buffer;
  extension: string;
  contentType: string;
  fileName: string;
} {
  if (!file || file.size <= 0) throw new BadRequestException('Choose a bill photo or PDF.');
  if (file.size > MAX_BILL_BYTES) throw new BadRequestException('Choose a bill under 8 MB.');
  const extension = BILL_TYPES[file.mimetype];
  if (!extension || !matchesSignature(file.mimetype, file.buffer)) {
    throw new BadRequestException('Upload a JPG, PNG, or PDF.');
  }
  return {
    buffer: file.buffer,
    extension,
    contentType: file.mimetype,
    fileName: displayName(file.originalname),
  };
}

function parsePostedLines(raw: string): PostedLine[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new BadRequestException('Enter a line from the bill.');
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new BadRequestException('Enter a line from the bill.');
  }
  if (parsed.length > 40) throw new BadRequestException('Enter up to 40 lines.');
  return parsed.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      throw new BadRequestException('Enter a line from the bill.');
    }
    const line = entry as { itemId?: unknown; quantity?: unknown; unitPrice?: unknown };
    if (typeof line.itemId !== 'string' || line.itemId.length === 0) {
      throw new BadRequestException('Choose an item that exists.');
    }
    if (typeof line.quantity !== 'string' || typeof line.unitPrice !== 'string') {
      throw new BadRequestException('Enter a quantity above zero.');
    }
    const quantity = parsePositiveDecimal(line.quantity, 'Enter a quantity above zero.');
    const unitPrice = parsePositiveDecimal(line.unitPrice, 'Enter a price above zero.');
    if (quantity.decimalPlaces() > 3) {
      throw new BadRequestException('Enter a quantity above zero.');
    }
    if (unitPrice.decimalPlaces() > 2) {
      throw new BadRequestException('Enter a price above zero.');
    }
    return { itemId: line.itemId, quantity, unitPrice };
  });
}

function parseMoney(value: string, message: string): Prisma.Decimal {
  const decimal = parseNonNegativeDecimal(value, message);
  if (decimal.decimalPlaces() > 2) throw new BadRequestException(message);
  return decimal;
}

function assertTotals(
  lines: PostedLine[],
  tax: Prisma.Decimal,
  discount: Prisma.Decimal,
  total: Prisma.Decimal,
): void {
  const owed = supplierBillOwed({
    lines: lines.map((line) => ({
      quantity: line.quantity.toString(),
      unitPrice: line.unitPrice.toString(),
    })),
    tax: tax.toString(),
    discount: discount.toString(),
  });
  if (!owed.ok && owed.reason === 'discount') {
    throw new BadRequestException('The discount is larger than the bill.');
  }
  if (!owed.ok || !moneyMatches(owed.owed, total.toString())) {
    throw new BadRequestException('The lines do not add up to the bill total.');
  }
}

function displayName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? 'bill';
  const cleaned = base.replace(/[^\w.\- ()]/g, '').slice(0, 80);
  return cleaned || 'bill';
}
