import type { Role } from './enums';
import type { InvoiceKind, InvoiceStatus } from './invoices';
import { can, isKaramRole } from './rbac';
import type { StatusTone } from './status';

export const DISPUTE_STATUSES = ['OPEN', 'ACCEPTED', 'REJECTED'] as const;

export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export type DisputeAction = 'accept' | 'reject';

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  OPEN: 'Open',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
};

const NEXT_STATUS: Partial<Record<DisputeStatus, Partial<Record<DisputeAction, DisputeStatus>>>> = {
  OPEN: { accept: 'ACCEPTED', reject: 'REJECTED' },
};

/** The status a dispute moves to, or null when that decision is not allowed. */
export function nextDisputeStatus(
  from: DisputeStatus,
  action: DisputeAction,
): DisputeStatus | null {
  return NEXT_STATUS[from]?.[action] ?? null;
}

export function disputeStatusTone(status: DisputeStatus): StatusTone {
  if (status === 'OPEN') return 'progress';
  if (status === 'REJECTED') return 'problem';
  return 'done';
}

/** Opening a dispute belongs to the airline's finance user. */
export function canOpenDispute(role: Role): boolean {
  return !isKaramRole(role) && can(role, 'disputes', 'C');
}

/** Deciding a dispute belongs to Karam finance. Accepting one does not change the invoice. */
export function canDecideDispute(role: Role): boolean {
  return isKaramRole(role) && can(role, 'disputes', 'A');
}

/** A credit note is itself a correction, so it is not disputed. A draft is not visible to the airline. */
export function canDisputeInvoice(kind: InvoiceKind, status: InvoiceStatus): boolean {
  return status === 'ISSUED' && kind !== 'CREDIT_NOTE';
}

export interface DisputeRecord {
  id: string;
  number: string;
  status: DisputeStatus;
  airlineId: string;
  airlineName: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceTotal: string;
  reason: string;
  resolution: string | null;
  openedByName: string;
  decidedByName: string | null;
  decidedAt: string | null;
  createdAt: string;
}
