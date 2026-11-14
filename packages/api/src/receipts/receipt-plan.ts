import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface OrderedLine {
  id: string;
  quantity: Prisma.Decimal;
  receivedQuantity: Prisma.Decimal;
  conversionToBase: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
}

export interface RequestedReceiptLine {
  purchaseLineId: string;
  quantity: Prisma.Decimal;
}

export interface PlannedReceiptLine {
  purchaseLineId: string;
  quantity: Prisma.Decimal;
  quantityBase: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  receivedQuantity: Prisma.Decimal;
}

/** Turn a receipt into base quantity and a FIFO unit cost. Prices stay on the purchase line. */
export function planReceipt(
  ordered: OrderedLine[],
  requested: RequestedReceiptLine[],
): { lines: PlannedReceiptLine[]; status: 'PART_RECEIVED' | 'RECEIVED' } {
  if (requested.length === 0) {
    throw new BadRequestException('Enter a quantity to receive.');
  }

  const byId = new Map(ordered.map((line) => [line.id, line]));
  const seen = new Set<string>();
  const planned: PlannedReceiptLine[] = [];
  const receivedAfter = new Map(ordered.map((line) => [line.id, line.receivedQuantity]));

  for (const request of requested) {
    if (seen.has(request.purchaseLineId)) {
      throw new BadRequestException('Receive each line once.');
    }
    seen.add(request.purchaseLineId);
    const line = byId.get(request.purchaseLineId);
    if (!line) throw new BadRequestException('Choose a line from this purchase.');
    if (request.quantity.lte(0)) {
      throw new BadRequestException('Enter a quantity above zero.');
    }
    const remaining = line.quantity.minus(line.receivedQuantity);
    if (request.quantity.gt(remaining)) {
      throw new BadRequestException('Receive no more than the quantity still on order.');
    }
    const receivedQuantity = line.receivedQuantity.plus(request.quantity);
    receivedAfter.set(line.id, receivedQuantity);
    planned.push({
      purchaseLineId: line.id,
      quantity: request.quantity,
      quantityBase: request.quantity.mul(line.conversionToBase).toDecimalPlaces(4),
      unitCost: line.unitPrice.div(line.conversionToBase).toDecimalPlaces(4),
      receivedQuantity,
    });
  }

  const complete = ordered.every((line) => receivedAfter.get(line.id)?.eq(line.quantity));
  return { lines: planned, status: complete ? 'RECEIVED' : 'PART_RECEIVED' };
}
