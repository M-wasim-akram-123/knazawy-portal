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
