import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface OpenLayer {
  id: string;
  quantityBase: Prisma.Decimal;
  unitCost: Prisma.Decimal;
}

export interface LayerDraw {
  layerId: string;
  quantityBase: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  cost: Prisma.Decimal;
}

export interface FifoDraw {
  draws: LayerDraw[];
  cost: Prisma.Decimal;
}

export interface ShortageNames {
  item: string;
  location: string;
  unit: string;
}

/**
 * Take quantity from the oldest open layers first. `layers` must be ordered oldest first
 * and contain only layers with stock left. Cost is rounded to paisa per layer draw.
 */
export function drawFifo(
  layers: OpenLayer[],
  quantity: Prisma.Decimal,
  names: ShortageNames,
): FifoDraw {
  const available = layers.reduce(
    (sum, layer) => sum.plus(layer.quantityBase),
    new Prisma.Decimal(0),
  );
  if (quantity.gt(available)) {
    throw new BadRequestException(
      `Only ${available.toString()} ${names.unit} of ${names.item} is in ${names.location}.`,
    );
  }

  let remaining = quantity;
  const draws: LayerDraw[] = [];
  for (const layer of layers) {
    if (remaining.lte(0)) break;
    if (layer.quantityBase.lte(0)) continue;
    const take = layer.quantityBase.lt(remaining) ? layer.quantityBase : remaining;
    draws.push({
      layerId: layer.id,
      quantityBase: take,
      unitCost: layer.unitCost,
      cost: take.mul(layer.unitCost).toDecimalPlaces(2),
    });
    remaining = remaining.minus(take);
  }

  const cost = draws.reduce((sum, draw) => sum.plus(draw.cost), new Prisma.Decimal(0));
  return { draws, cost };
}
