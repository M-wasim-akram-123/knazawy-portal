import type { PurchaseStatus, RequestStatus } from './enums';

export type StatusTone = 'draft' | 'progress' | 'done' | 'problem';

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  IN_PRODUCTION: 'In production',
  DISPATCHED: 'Dispatched',
  DELIVERED: 'Delivered',
  INVOICED: 'Invoiced',
  CANCELLED: 'Cancelled',
};

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  PART_RECEIVED: 'Part received',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
};

export function purchaseStatusTone(status: PurchaseStatus): StatusTone {
  switch (status) {
    case 'DRAFT':
      return 'draft';
    case 'CANCELLED':
      return 'problem';
    case 'RECEIVED':
      return 'done';
    default:
      return 'progress';
  }
}

export function statusTone(status: RequestStatus): StatusTone {
  switch (status) {
    case 'DRAFT':
      return 'draft';
    case 'REJECTED':
    case 'CANCELLED':
      return 'problem';
    case 'DELIVERED':
    case 'INVOICED':
      return 'done';
    default:
      return 'progress';
  }
}
