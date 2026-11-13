import type { RequestStatus } from './enums';

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
