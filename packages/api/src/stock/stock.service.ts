import type { Actor, StockOnHandRecord } from '@knazawy/shared';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { assertCan } from '../auth/permissions';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async onHand(actor: Actor): Promise<StockOnHandRecord[]> {
    assertCan(actor, 'stock', 'R', 'view stock');
    const layers = await this.prisma.stockLayer.findMany({
      where: {
        organisationId: actor.organisationId,
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
}
