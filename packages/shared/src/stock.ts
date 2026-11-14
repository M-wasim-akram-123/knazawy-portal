import type { BaseUnit, CountStatus, StockIssueReason, TransferStatus } from './enums';
import type { StatusTone } from './status';

export const STOCK_ISSUE_REASON_LABELS: Record<StockIssueReason, string> = {
  KITCHEN_USE: 'Kitchen use',
  WASTAGE: 'Wastage',
  SPOILAGE: 'Spoilage',
  DAMAGE: 'Damage',
};

export interface StockIssueLineRecord {
  itemName: string;
  baseUnit: BaseUnit;
  quantityBase: string;
  cost: string;
}

export interface StockIssueRecord {
  id: string;
  number: string;
  locationId: string;
  locationName: string;
  issuedOn: string;
  reason: StockIssueReason;
  note: string | null;
  lines: StockIssueLineRecord[];
}

export const TRANSFER_STATUS_LABELS: Record<TransferStatus, string> = {
  SENT: 'On the way',
  RECEIVED: 'Received',
};

export function transferStatusTone(status: TransferStatus): StatusTone {
  return status === 'RECEIVED' ? 'done' : 'progress';
}

export interface StockTransferLineRecord {
  itemName: string;
  baseUnit: BaseUnit;
  quantityBase: string;
  cost: string;
}

export interface StockTransferRecord {
  id: string;
  number: string;
  fromLocationId: string;
  fromLocationName: string;
  toLocationId: string;
  toLocationName: string;
  status: TransferStatus;
  sentOn: string;
  receivedOn: string | null;
  lines: StockTransferLineRecord[];
}

export const COUNT_STATUS_LABELS: Record<CountStatus, string> = {
  COUNTING: 'Counting',
  WAITING: 'Waiting for approval',
  POSTED: 'Posted',
};

export function countStatusTone(status: CountStatus): StatusTone {
  if (status === 'POSTED') return 'done';
  if (status === 'WAITING') return 'progress';
  return 'draft';
}

export interface StockCountLineRecord {
  itemId: string;
  itemName: string;
  baseUnit: BaseUnit;
  bookQuantity: string;
  countedQuantity: string | null;
  varianceCost: string | null;
}

export interface StockCountRecord {
  id: string;
  number: string;
  locationId: string;
  locationName: string;
  countedOn: string;
  status: CountStatus;
  note: string | null;
  lines: StockCountLineRecord[];
}
