import type { BaseUnit, PurchaseStatus } from './enums';

export interface PurchaseLineRecord {
  id: string;
  itemId: string;
  itemName: string;
  purchaseUnit: string;
  baseUnit: BaseUnit;
  quantity: string;
  unitPrice: string;
  receivedQuantity: string;
}

export interface PurchaseRecord {
  id: string;
  number: string;
  supplierId: string;
  supplierName: string;
  status: PurchaseStatus;
  orderedOn: string;
  lines: PurchaseLineRecord[];
}

export interface GoodsReceiptLineRecord {
  itemName: string;
  purchaseUnit: string;
  baseUnit: BaseUnit;
  quantity: string;
  quantityBase: string;
  unitCost: string;
}

export interface GoodsReceiptRecord {
  id: string;
  number: string;
  purchaseId: string | null;
  purchaseNumber: string | null;
  supplierName: string;
  billNumber: string | null;
  billTotal: string | null;
  billTax: string;
  billDiscount: string;
  hasBillFile: boolean;
  locationId: string;
  locationName: string;
  receivedOn: string;
  lines: GoodsReceiptLineRecord[];
}

export interface StockOnHandRecord {
  itemId: string;
  itemName: string;
  locationId: string;
  locationName: string;
  baseUnit: BaseUnit;
  quantityBase: string;
}

/** An active item at or below its reorder level in this branch, including items with none left. */
export interface LowStockRecord {
  itemId: string;
  itemName: string;
  baseUnit: BaseUnit;
  onHand: string;
  reorderLevel: string;
}

/**
 * True when an item should be bought again: it has a reorder level, and stock is at or below it.
 * Both values are base-unit decimals, such as "12.5" or "12.5000".
 */
export function needsReorder(onHand: string, reorderLevel: string): boolean {
  const level = scaledQuantity(reorderLevel);
  const stock = scaledQuantity(onHand);
  if (level === null || stock === null || level === 0n) return false;
  return stock <= level;
}

function scaledQuantity(value: string): bigint | null {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) return null;
  const [whole, fraction = ''] = trimmed.split('.');
  return BigInt(whole + fraction.slice(0, 4).padEnd(4, '0'));
}
