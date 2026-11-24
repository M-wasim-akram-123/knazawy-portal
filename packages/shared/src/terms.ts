import { formatDisplayDate } from './dates';
import type { Role } from './enums';
import { addIsoDays } from './forecast';
import { isMoney, subtractMoney } from './rates';
import { can, isKaramRole } from './rbac';

/**
 * Commercial terms Karam agrees with each airline: how many days it has to pay, and a discount
 * taken off every invoice. An invoice copies the terms when it is issued, so changing them later
 * never changes a bill already sent.
 */

export const MAX_PAYMENT_TERMS_DAYS = 180;

export interface AirlineTermsRecord {
  airlineId: string;
  airlineCode: string;
  airlineName: string;
  paymentTermsDays: number;
  /** Percent with up to two decimals, such as "5" or "2.50". */
  discountPercent: string;
}

export interface AirlineTermsInput {
  paymentTermsDays: number;
  discountPercent: string;
}

/** Finance sets the terms. An administrator may correct them. Airlines only read their own. */
export function canSetAirlineTerms(role: Role): boolean {
  return isKaramRole(role) && can(role, 'service_rates', 'U');
}

export function termsLabel(days: number): string {
  return days === 0 ? 'Due on receipt' : `Net ${days}`;
}

/** Null when the terms are valid. */
export function airlineTermsError(input: AirlineTermsInput): string | null {
  if (
    !Number.isInteger(input.paymentTermsDays) ||
    input.paymentTermsDays < 0 ||
    input.paymentTermsDays > MAX_PAYMENT_TERMS_DAYS
  ) {
    return `Payment days must be a whole number from 0 to ${MAX_PAYMENT_TERMS_DAYS}.`;
  }
  const percent = parseBasisPoints(input.discountPercent);
  if (percent === null || percent > 10000n) {
    return 'Discount must be a percent from 0 to 100, with up to two decimals.';
  }
  return null;
}

/** The date an invoice issued on `issuedOn` (YYYY-MM-DD) must be paid by. */
export function invoiceDueOn(issuedOn: string, paymentTermsDays: number): string {
  return addIsoDays(issuedOn, paymentTermsDays);
}

/** True when an unpaid amount is past its due date. */
export function isOverdue(dueOn: string | null, today: string, amountDue: string): boolean {
  return dueOn !== null && dueOn < today && amountDue !== '0.00';
}

/**
 * Subtotal less the discount, in SAR to 2 dp. The discount rounds half up to the paisa.
 * Null when the subtotal is not money or the percent is not valid.
 */
export function applyDiscount(
  subtotal: string,
  discountPercent: string,
): { discount: string; total: string } | null {
  if (!isMoney(subtotal)) return null;
  const basisPoints = parseBasisPoints(discountPercent);
  if (basisPoints === null || basisPoints > 10000n) return null;
  const [whole, fraction = ''] = subtotal.trim().split('.');
  const paisa = BigInt(whole + fraction.padEnd(2, '0'));
  const discountPaisa = (paisa * basisPoints + 5000n) / 10000n;
  const discount = formatPaisa(discountPaisa);
  const total = subtractMoney(subtotal, discount);
  return total === null ? null : { discount, total };
}

/** "5" or "2.5" or "2.50" percent to basis points. */
function parseBasisPoints(value: string): bigint | null {
  const trimmed = value.trim();
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ''] = trimmed.split('.');
  return BigInt(whole + fraction.padEnd(2, '0'));
}

function formatPaisa(value: bigint): string {
  return `${(value / 100n).toString()}.${(value % 100n).toString().padStart(2, '0')}`;
}

/**
 * One line both apps show under an invoice, such as
 * "Subtotal 13000.00 SAR, less 5% discount 650.00 SAR. Total 12350.00 SAR. Amount due 12350.00 SAR. Net 30, due 17/12/2026."
 */
export function invoiceSummary(
  invoice: {
    subtotal: string;
    discountPercent: string;
    discount: string;
    total: string;
    amountDue: string;
    paymentTermsDays: number | null;
    dueOn: string | null;
    kind: string;
  },
  today: string,
): string {
  const parts: string[] = [];
  if (invoice.discount !== '0.00') {
    parts.push(
      `Subtotal ${invoice.subtotal} SAR, less ${invoice.discountPercent}% discount ${invoice.discount} SAR.`,
    );
  }
  parts.push(`Total ${invoice.total} SAR.`);
  if (invoice.kind !== 'CREDIT_NOTE') parts.push(`Amount due ${invoice.amountDue} SAR.`);
  if (invoice.dueOn && invoice.paymentTermsDays !== null) {
    const overdue = isOverdue(invoice.dueOn, today, invoice.amountDue);
    parts.push(
      `${termsLabel(invoice.paymentTermsDays)}, due ${formatDisplayDate(invoice.dueOn)}${
        overdue ? '. Overdue' : ''
      }.`,
    );
  }
  return parts.join(' ');
}
