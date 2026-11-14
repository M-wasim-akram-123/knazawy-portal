import type { Actor, GoodsReceiptRecord } from '@knazawy/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { assertCan } from '../auth/permissions';
import { requireBranch } from '../common/branch';
import { parseIsoDate } from '../common/date';
import { parsePositiveDecimal } from '../common/decimal';
import { nextDocumentNumber } from '../common/document-number';
import { PrismaService } from '../prisma/prisma.service';

import { planReceipt } from './receipt-plan';
import { receiptInclude, toReceipt } from './receipt-record';
import type { CreateReceiptDto } from './receipts.dto';

@Injectable()
export class ReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: Actor): Promise<GoodsReceiptRecord[]> {
    assertCan(actor, 'stock', 'R', 'view goods received');
    const rows = await this.prisma.goodsReceipt.findMany({
      where: { organisationId: actor.organisationId, location: { branchId: requireBranch(actor) } },
      include: receiptInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toReceipt);
  }

  async create(actor: Actor, input: CreateReceiptDto): Promise<GoodsReceiptRecord> {
    assertCan(actor, 'stock', 'C', 'receive goods');
    const receivedOn = parseIsoDate(input.receivedOn);
    const requested = input.lines.map((line) => ({
      purchaseLineId: line.purchaseLineId,
      quantity: parsePositiveDecimal(line.quantity, 'Enter a quantity above zero.'),
    }));

    const created = await this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findFirst({
        where: {
          id: input.purchaseId,
          organisationId: actor.organisationId,
          branchId: requireBranch(actor),
        },
        include: { lines: { include: { item: true } } },
      });
      if (!purchase) throw new NotFoundException('That purchase was not found.');
      if (purchase.status !== 'SENT' && purchase.status !== 'PART_RECEIVED') {
        throw new BadRequestException('Send the purchase before receiving goods.');
      }
      const location = await tx.stockLocation.findFirst({
        where: {
          id: input.locationId,
          organisationId: actor.organisationId,
          branchId: requireBranch(actor),
          active: true,
        },
      });
      if (!location) throw new BadRequestException('Choose an open location.');

      const plan = planReceipt(
        purchase.lines.map((line) => ({
          id: line.id,
          quantity: line.quantity,
          receivedQuantity: line.receivedQuantity,
          conversionToBase: line.item.conversionToBase,
          unitPrice: line.unitPrice,
        })),
        requested,
      );
      const itemsByLine = new Map(purchase.lines.map((line) => [line.id, line.itemId]));
      const number = await nextDocumentNumber(tx, actor.organisationId, 'GOODS_RECEIPT');
      const receipt = await tx.goodsReceipt.create({
        data: {
          organisationId: actor.organisationId,
          number,
          purchaseId: purchase.id,
          supplierId: purchase.supplierId,
          locationId: location.id,
          receivedOn,
          lines: {
            create: plan.lines.map((line) => {
              const itemId = itemsByLine.get(line.purchaseLineId);
              if (!itemId) throw new BadRequestException('Choose a line from this purchase.');
              return {
                purchaseLineId: line.purchaseLineId,
                itemId,
                quantity: line.quantity,
                quantityBase: line.quantityBase,
                unitCost: line.unitCost,
              };
            }),
          },
        },
        include: receiptInclude,
      });

      for (const line of receipt.lines) {
        const purchaseLineId = line.purchaseLineId;
        if (!purchaseLineId) throw new BadRequestException('Choose a line from this purchase.');
        const planned = plan.lines.find((entry) => entry.purchaseLineId === purchaseLineId);
        const itemId = itemsByLine.get(purchaseLineId);
        if (!planned || !itemId) {
          throw new BadRequestException('Choose a line from this purchase.');
        }
        await tx.purchaseLine.update({
          where: { id: purchaseLineId },
          data: { receivedQuantity: planned.receivedQuantity },
        });
        const layer = await tx.stockLayer.create({
          data: {
            organisationId: actor.organisationId,
            itemId,
            locationId: location.id,
            receiptLineId: line.id,
            quantityBase: line.quantityBase,
            unitCost: line.unitCost,
            receivedOn,
          },
        });
        await tx.stockMovement.create({
          data: {
            organisationId: actor.organisationId,
            itemId: layer.itemId,
            locationId: location.id,
            layerId: layer.id,
            receiptLineId: line.id,
            type: 'RECEIPT',
            quantityBase: line.quantityBase,
            unitCost: line.unitCost,
          },
        });
      }

      await tx.purchase.update({
        where: { id: purchase.id },
        data: { status: plan.status },
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
  }
}
