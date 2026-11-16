import type { Actor, PurchaseRecord } from '@knazawy/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { assertCan } from '../auth/permissions';
import { formatIsoDate, parseIsoDate } from '../common/date';
import { parseNonNegativeDecimal, parsePositiveDecimal } from '../common/decimal';
import { nextDocumentNumber } from '../common/document-number';
import { PrismaService } from '../prisma/prisma.service';

import type { CreatePurchaseDto, PurchaseLineDto } from './purchases.dto';

const purchaseInclude = {
  supplier: true,
  lines: { include: { item: true }, orderBy: { id: 'asc' as const } },
} satisfies Prisma.PurchaseInclude;

type PurchaseRow = Prisma.PurchaseGetPayload<{ include: typeof purchaseInclude }>;

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: Actor): Promise<PurchaseRecord[]> {
    assertCan(actor, 'purchases', 'R', 'view purchases');
    const rows = await this.prisma.purchase.findMany({
      where: { organisationId: actor.organisationId },
      include: purchaseInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toPurchase);
  }

  async get(actor: Actor, id: string): Promise<PurchaseRecord> {
    assertCan(actor, 'purchases', 'R', 'view purchases');
    return toPurchase(await this.requirePurchase(actor.organisationId, id));
  }

  async create(actor: Actor, input: CreatePurchaseDto): Promise<PurchaseRecord> {
    assertCan(actor, 'purchases', 'C', 'add purchases');
    const orderedOn = parseIsoDate(input.orderedOn);
    await this.requireSupplier(actor.organisationId, input.supplierId);
    const lines = await this.pricedLines(actor.organisationId, input.lines);

    const created = await this.prisma.$transaction(async (tx) => {
      const number = await nextDocumentNumber(tx, actor.organisationId, 'PURCHASE');
      const purchase = await tx.purchase.create({
        data: {
          organisationId: actor.organisationId,
          number,
          supplierId: input.supplierId,
          orderedOn,
          lines: { create: lines },
        },
        include: purchaseInclude,
      });
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'Purchase',
        entityId: purchase.id,
        action: 'create',
        after: toPurchase(purchase),
      });
      return purchase;
    });
    return toPurchase(created);
  }

  async addLine(actor: Actor, id: string, input: PurchaseLineDto): Promise<PurchaseRecord> {
    assertCan(actor, 'purchases', 'U', 'change purchases');
    const existing = await this.requirePurchase(actor.organisationId, id);
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('Only a draft purchase can be changed.');
    }
    const [line] = await this.pricedLines(actor.organisationId, [input]);
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.purchaseLine.create({ data: { purchaseId: id, ...line } });
      const purchase = await tx.purchase.findUniqueOrThrow({
        where: { id },
        include: purchaseInclude,
      });
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'Purchase',
        entityId: id,
        action: 'add-line',
        after: toPurchase(purchase),
      });
      return purchase;
    });
    return toPurchase(updated);
  }

  async send(actor: Actor, id: string): Promise<PurchaseRecord> {
    assertCan(actor, 'purchases', 'U', 'send purchases');
    const existing = await this.requirePurchase(actor.organisationId, id);
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('Only a draft purchase can be sent.');
    }
    return this.changeStatus(actor, existing, 'SENT', 'send');
  }

  async cancel(actor: Actor, id: string): Promise<PurchaseRecord> {
    assertCan(actor, 'purchases', 'U', 'cancel purchases');
    const existing = await this.requirePurchase(actor.organisationId, id);
    if (existing.lines.some((line) => line.receivedQuantity.gt(0))) {
      throw new BadRequestException('Goods have already been received on this purchase.');
    }
    if (existing.status !== 'DRAFT' && existing.status !== 'SENT') {
      throw new BadRequestException('This purchase cannot be cancelled.');
    }
    return this.changeStatus(actor, existing, 'CANCELLED', 'cancel');
  }

  private async changeStatus(
    actor: Actor,
    existing: PurchaseRow,
    status: 'SENT' | 'CANCELLED',
    action: string,
  ): Promise<PurchaseRecord> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.update({
        where: { id: existing.id },
        data: { status },
        include: purchaseInclude,
      });
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'Purchase',
        entityId: purchase.id,
        action,
        before: toPurchase(existing),
        after: toPurchase(purchase),
      });
      return purchase;
    });
    return toPurchase(updated);
  }

  private async requirePurchase(organisationId: string, id: string): Promise<PurchaseRow> {
    const purchase = await this.prisma.purchase.findFirst({
      where: { id, organisationId },
      include: purchaseInclude,
    });
    if (!purchase) throw new NotFoundException('That purchase was not found.');
    return purchase;
  }

  private async requireSupplier(organisationId: string, supplierId: string): Promise<void> {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, organisationId, active: true },
    });
    if (!supplier) throw new BadRequestException('Choose a supplier that exists.');
  }

  private async pricedLines(
    organisationId: string,
    lines: PurchaseLineDto[],
  ): Promise<Array<{ itemId: string; quantity: Prisma.Decimal; unitPrice: Prisma.Decimal }>> {
    const itemIds = [...new Set(lines.map((line) => line.itemId))];
    const items = await this.prisma.item.findMany({
      where: { organisationId, active: true, id: { in: itemIds } },
      select: { id: true },
    });
    if (items.length !== itemIds.length) {
      throw new BadRequestException('Choose an item that exists.');
    }
    return lines.map((line) => ({
      itemId: line.itemId,
      quantity: parsePositiveDecimal(line.quantity, 'Enter a quantity above zero.'),
      unitPrice: parseNonNegativeDecimal(line.unitPrice, 'Enter a price of zero or more.'),
    }));
  }
}

function toPurchase(row: PurchaseRow): PurchaseRecord {
  return {
    id: row.id,
    number: row.number,
    supplierId: row.supplierId,
    supplierName: row.supplier.name,
    status: row.status,
    orderedOn: formatIsoDate(row.orderedOn),
    lines: row.lines.map((line) => ({
      id: line.id,
      itemId: line.itemId,
      itemName: line.item.name,
      purchaseUnit: line.item.purchaseUnit,
      baseUnit: line.item.baseUnit,
      quantity: line.quantity.toString(),
      unitPrice: line.unitPrice.toString(),
      receivedQuantity: line.receivedQuantity.toString(),
    })),
  };
}
