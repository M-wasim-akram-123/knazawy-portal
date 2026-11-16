import type { GoodsReceiptRecord } from '@knazawy/shared';
import { Prisma } from '@prisma/client';

import { formatIsoDate } from '../common/date';

export const receiptInclude = {
  purchase: true,
  supplier: true,
  location: true,
  lines: { include: { item: true } },
} satisfies Prisma.GoodsReceiptInclude;

export type ReceiptRow = Prisma.GoodsReceiptGetPayload<{ include: typeof receiptInclude }>;

export function toReceipt(row: ReceiptRow): GoodsReceiptRecord {
  return {
    id: row.id,
    number: row.number,
    purchaseId: row.purchaseId,
    purchaseNumber: row.purchase?.number ?? null,
    supplierName: row.supplier.name,
    billNumber: row.billNumber,
    billTotal: row.billTotal?.toString() ?? null,
    billTax: row.billTax.toString(),
    billDiscount: row.billDiscount.toString(),
    hasBillFile: row.billStoredAs !== null,
    locationId: row.locationId,
    locationName: row.location.name,
    receivedOn: formatIsoDate(row.receivedOn),
    lines: row.lines.map((line) => ({
      itemName: line.item.name,
      purchaseUnit: line.item.purchaseUnit,
      baseUnit: line.item.baseUnit,
      quantity: line.quantity.toString(),
      quantityBase: line.quantityBase.toString(),
      unitCost: line.unitCost.toString(),
    })),
  };
}
