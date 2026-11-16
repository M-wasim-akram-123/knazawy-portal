import type { RecipeKind, RequestStatus, Role } from './enums';
import { billedQuantity, chargeFor, subtractMoney, sumMoney } from './rates';
import { can, isKaramRole } from './rbac';
import type { StatusTone } from './status';

export const INVOICE_KINDS = ['INVOICE', 'CANCELLATION', 'CREDIT_NOTE'] as const;

export type InvoiceKind = (typeof INVOICE_KINDS)[number];

export const INVOICE_KIND_LABELS: Record<InvoiceKind, string> = {
  INVOICE: 'Invoice',
  CANCELLATION: 'Cancellation',
  CREDIT_NOTE: 'Credit note',
};

export const INVOICE_STATUSES = ['DRAFT', 'ISSUED'] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Draft',
  ISSUED: 'Issued',
};

export function invoiceStatusTone(status: InvoiceStatus): StatusTone {
  return status === 'ISSUED' ? 'done' : 'draft';
}

/** Raising a bill belongs to Karam finance. An airline's create permission is not this. */
export function canRaiseInvoice(role: Role): boolean {
  return isKaramRole(role) && can(role, 'invoices', 'C');
}

/** Issuing a bill belongs to Karam finance. */
export function canIssueInvoice(role: Role): boolean {
  return isKaramRole(role) && can(role, 'invoices', 'A');
}

/** A delivered request becomes invoiced once its bill is issued. */
export function requestStatusAfterInvoice(status: RequestStatus): RequestStatus | null {
  return status === 'DELIVERED' ? 'INVOICED' : null;
}

export interface InvoicePriceInput {
  recipeId: string;
  recipeName: string;
  kind: RecipeKind;
  deliveredQuantity: number;
  minimumQuantity: number;
  unitPrice: string;
}

export interface InvoicePricedLine extends InvoicePriceInput {
  billedQuantity: number;
  amount: string;
}

/** Portions delivered, but never fewer than the minimum, at the card's price. */
export function priceInvoiceLines(
  lines: InvoicePriceInput[],
): { lines: InvoicePricedLine[]; total: string } | null {
  const priced: InvoicePricedLine[] = [];
  for (const line of lines) {
    const quantity = billedQuantity(line.deliveredQuantity, line.minimumQuantity);
    const amount = chargeFor(quantity, line.unitPrice);
    if (amount === null) return null;
    priced.push({ ...line, billedQuantity: quantity, amount });
  }
  const total = sumMoney(priced.map((line) => line.amount));
  if (total === null) return null;
  return { lines: priced, total };
}

/** What is still open to credit on one line. */
export function remainingBillable(billed: number, alreadyCredited: number): number {
  return Math.max(0, billed - alreadyCredited);
}

/** Null when the credit is within what was billed. */
export function creditQuantityError(
  billed: number,
  alreadyCredited: number,
  next: number,
): string | null {
  if (!Number.isInteger(next) || next < 1) return 'Credit at least one portion.';
  if (next > remainingBillable(billed, alreadyCredited)) return 'Credit no more than was billed.';
  return null;
}

/** Invoice total minus the credit notes already issued. */
export function amountDue(total: string, credits: string[]): string | null {
  const credited = sumMoney(credits);
  if (credited === null) return null;
  return subtractMoney(total, credited);
}

export interface InvoiceLineRecord {
  recipeId: string;
  recipeName: string;
  kind: RecipeKind;
  deliveredQuantity: number;
  minimumQuantity: number;
  billedQuantity: number;
  creditedQuantity: number;
  unitPrice: string;
  amount: string;
}

export interface InvoiceCreditRecord {
  id: string;
  number: string;
  reason: string | null;
  total: string;
}

export interface BillableRequestOption {
  id: string;
  number: string;
  airlineName: string;
  flightNumber: string;
}

export interface InvoiceRecord {
  id: string;
  number: string;
  kind: InvoiceKind;
  status: InvoiceStatus;
  airlineId: string;
  airlineName: string;
  airlineTaxNumber: string | null;
  requestId: string | null;
  requestNumber: string | null;
  flightNumber: string | null;
  serviceDate: string | null;
  rateCardNumber: string | null;
  sourceInvoiceNumber: string | null;
  note: string | null;
  reason: string | null;
  issuedAt: string | null;
  total: string;
  amountDue: string;
  lines: InvoiceLineRecord[];
  credits: InvoiceCreditRecord[];
}
