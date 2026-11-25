import { BASE_UNIT_LABELS, crossedReorderLevel, type Role } from '@knazawy/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { NotificationsService } from '../notifications/notifications.service';

/** The people told to restock. The store and the kitchen both see it on the Running low list. */
const RESTOCK_ROLES: readonly Role[] = ['ADMINISTRATOR', 'HEAD_CHEF'];

export interface StockCrossing {
  organisationId: string;
  branchId: string;
  /** On hand per item, read with `levels` before the stock was taken out. */
  before: Map<string, string>;
}

/**
 * Tells the administrator and head chef when an item falls through its reorder level. Stock
 * movements read the level before they take stock out, then call `notifyCrossed` once they have.
 * Both run inside the movement's own transaction, so a movement that fails tells nobody.
 */
@Injectable()
export class StockAlertsService {
  constructor(private readonly notifications: NotificationsService) {}

  /** What is on hand now for each item, across the branch's locations. */
  async levels(
    tx: Prisma.TransactionClient,
    organisationId: string,
    branchId: string,
    itemIds: readonly string[],
  ): Promise<Map<string, string>> {
    const unique = [...new Set(itemIds)];
    if (unique.length === 0) return new Map();
    const totals = await tx.stockLayer.groupBy({
      by: ['itemId'],
      where: {
        organisationId,
        itemId: { in: unique },
        location: { branchId },
        quantityBase: { gt: 0 },
      },
      _sum: { quantityBase: true },
    });
    const sums = new Map(totals.map((row) => [row.itemId, row._sum.quantityBase?.toString()]));
    return new Map(unique.map((id) => [id, sums.get(id) ?? '0']));
  }

  async notifyCrossed(tx: Prisma.TransactionClient, crossing: StockCrossing): Promise<void> {
    const { organisationId, branchId, before } = crossing;
    if (before.size === 0) return;
    const itemIds = [...before.keys()];
    const [after, items] = await Promise.all([
      this.levels(tx, organisationId, branchId, itemIds),
      tx.item.findMany({
        where: { organisationId, id: { in: itemIds }, active: true, reorderLevel: { gt: 0 } },
        select: { id: true, name: true, baseUnit: true, reorderLevel: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const low = items.filter((item) =>
      crossedReorderLevel(
        before.get(item.id) ?? '0',
        after.get(item.id) ?? '0',
        item.reorderLevel.toString(),
      ),
    );
    if (low.length === 0) return;

    const branch = await tx.branch.findUnique({ where: { id: branchId }, select: { name: true } });
    for (const item of low) {
      const unit = BASE_UNIT_LABELS[item.baseUnit];
      const left = after.get(item.id) ?? '0';
      for (const role of RESTOCK_ROLES) {
        await this.notifications.notify(tx, {
          organisationId,
          role,
          branchId,
          title: `${item.name} is running low`,
          body: `${left} ${unit} left${branch ? ` at ${branch.name}` : ''}. Restock at or below ${item.reorderLevel.toString()} ${unit}.`,
          entity: 'Item',
          entityId: item.id,
        });
      }
    }
  }
}
