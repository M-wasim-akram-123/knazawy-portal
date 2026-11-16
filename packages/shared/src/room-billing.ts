import type { Role } from './enums';
import { canRaiseInvoice } from './invoices';
import type { RoomRequestStatus } from './rooms';

export const ROOM_INVOICE_KINDS = ['INVOICE', 'CREDIT_NOTE'] as const;

export type RoomInvoiceKind = (typeof ROOM_INVOICE_KINDS)[number];

export const ROOM_INVOICE_KIND_LABELS: Record<RoomInvoiceKind, string> = {
  INVOICE: 'Room bill',
  CREDIT_NOTE: 'Room credit note',
};

/** Raising a room bill belongs to Karam finance, the same people who raise other bills. */
export function canRaiseRoomInvoice(role: Role): boolean {
  return canRaiseInvoice(role);
}

/**
 * A stay is billed once it is accepted, for every booked night at the nightly price fixed on acceptance.
 * An early departure is still billed for the booked nights.
 * alreadyBilled means a bill is still in force. A credited bill does not count, so the stay can be billed again.
 */
export function roomBillError(
  status: RoomRequestStatus,
  alreadyBilled: boolean,
  allPriced: boolean,
): string | null {
  if (status !== 'ACCEPTED') return 'Only an accepted room stay can be billed.';
  if (alreadyBilled) return 'This stay is already billed.';
  if (!allPriced) return 'This stay has no fixed price to bill.';
  return null;
}

/** A credit note reverses a whole room bill, once. A credit note is never credited again. */
export function roomCreditError(kind: RoomInvoiceKind, alreadyCredited: boolean): string | null {
  if (kind !== 'INVOICE') return 'Only a room bill can be credited.';
  if (alreadyCredited) return 'This room bill is already credited.';
  return null;
}

export interface RoomInvoiceLineRecord {
  roomTypeName: string;
  rooms: number;
  nights: number;
  nightly: string;
  amount: string;
}

export interface RoomInvoiceRecord {
  id: string;
  number: string;
  kind: RoomInvoiceKind;
  airlineId: string;
  airlineName: string;
  roomRequestId: string;
  roomRequestNumber: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  sourceInvoiceNumber: string | null;
  creditNumber: string | null;
  reason: string | null;
  issuedAt: string;
  total: string;
  lines: RoomInvoiceLineRecord[];
}

/** An accepted stay that has not been billed yet, with what it would bill. */
export interface RoomBillableRecord {
  roomRequestId: string;
  number: string;
  airlineName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  total: string;
}
