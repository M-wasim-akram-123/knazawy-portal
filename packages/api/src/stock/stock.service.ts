import {
  needsReorder,
  type Actor,
  type LowStockRecord,
  type StockOnHandRecord,
} from '@knazawy/shared';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { assertCan } from '../auth/permissions';
import { requireBranch } from '../common/branch';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async onHand(actor: Actor): Promise<StockOnHandRecord[]> {
    assertCan(actor, 'stock', 'R', 'view stock');
    const layers = await this.prisma.stockLayer.findMany({
      where: {
        organisationId: actor.organisationId,
        location: { branchId: requireBranch(actor) },
        quantityBase: { gt: 0 },
      },
      include: { item: true, location: true },
      orderBy: [{ receivedOn: 'asc' }, { createdAt: 'asc' }],
    });

    const grouped = new Map<string, StockOnHandRecord & { quantity: Prisma.Decimal }>();
    for (const layer of layers) {
      const key = `${layer.itemId}:${layer.locationId}`;
      const current = grouped.get(key);
      if (current) {
        current.quantity = current.quantity.plus(layer.quantityBase);
        continue;
      }
      grouped.set(key, {
        itemId: layer.itemId,
        itemName: layer.item.name,
        locationId: layer.locationId,
        locationName: layer.location.name,
        baseUnit: layer.item.baseUnit,
        quantityBase: '',
        quantity: layer.quantityBase,
      });
    }

    return [...grouped.values()]
      .map(({ quantity, ...row }) => ({ ...row, quantityBase: quantity.toString() }))
      .sort((left, right) => left.itemName.localeCompare(right.itemName));
  }

  /** Active items at or below their reorder level across this branch's locations. */
  async lowStock(actor: Actor): Promise<LowStockRecord[]> {
    assertCan(actor, 'stock', 'R', 'view stock');
    const branchId = requireBranch(actor);
    const [items, totals] = await Promise.all([
      this.prisma.item.findMany({
        where: { organisationId: actor.organisationId, active: true, reorderLevel: { gt: 0 } },
        select: { id: true, name: true, baseUnit: true, reorderLevel: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.stockLayer.groupBy({
        by: ['itemId'],
        where: {
          organisationId: actor.organisationId,
          location: { branchId },
          quantityBase: { gt: 0 },
        },
        _sum: { quantityBase: true },
      }),
    ]);
    const onHand = new Map(
      totals.map((row) => [row.itemId, row._sum.quantityBase?.toString() ?? '0']),
    );
    return items
      .map((item) => ({
        itemId: item.id,
        itemName: item.name,
        baseUnit: item.baseUnit,
        onHand: onHand.get(item.id) ?? '0',
        reorderLevel: item.reorderLevel.toString(),
      }))
      .filter((row) => needsReorder(row.onHand, row.reorderLevel));
  }
}
