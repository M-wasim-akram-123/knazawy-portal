import type { RecipeKind } from './enums';
import type { StatusTone } from './status';

export const RATE_CARD_STATUSES = ['DRAFT', 'APPROVED'] as const;

export type RateCardStatus = (typeof RATE_CARD_STATUSES)[number];

export const RATE_CARD_STATUS_LABELS: Record<RateCardStatus, string> = {
  DRAFT: 'Draft',
  APPROVED: 'Approved',
};

export function rateCardStatusTone(status: RateCardStatus): StatusTone {
  return status === 'APPROVED' ? 'done' : 'draft';
}

/** Dates are YYYY-MM-DD. An open card has no end date. */
export interface RateCardPeriod {
  validFrom: string;
  validTo: string | null;
}

const OPEN_END = '9999-12-31';

/** True when the card's dates include the service date. */
export function rateCardCovers(card: RateCardPeriod, serviceDate: string): boolean {
  return card.validFrom <= serviceDate && serviceDate <= (card.validTo ?? OPEN_END);
}

export function rateCardsOverlap(left: RateCardPeriod, right: RateCardPeriod): boolean {
  return (
    left.validFrom <= (right.validTo ?? OPEN_END) && right.validFrom <= (left.validTo ?? OPEN_END)
  );
}

/** The airline pays for what was delivered, but never fewer than the card's minimum. */
export function billedQuantity(delivered: number, minimum: number): number {
  return Math.max(delivered, minimum);
}

/** A price in SAR with up to 2 decimal places. */
export function isMoney(value: string): boolean {
  return /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value.trim());
}

/** Portions times price, in SAR to 2 dp. Null when the price is not money. */
export function chargeFor(quantity: number, unitPrice: string): string | null {
  const price = toPaisa(unitPrice);
  if (price === null || !Number.isInteger(quantity) || quantity < 0) return null;
  return fromPaisa(price * BigInt(quantity));
}

/** Left minus right, in SAR to 2 dp. Null when either value is not money, or the result is negative. */
export function subtractMoney(left: string, right: string): string | null {
  const from = toPaisa(left);
  const taken = toPaisa(right);
  if (from === null || taken === null || taken > from) return null;
  return fromPaisa(from - taken);
}

export function sumMoney(values: string[]): string | null {
  let total = 0n;
  for (const value of values) {
    const paisa = toPaisa(value);
    if (paisa === null) return null;
    total += paisa;
  }
  return fromPaisa(total);
}

/** Enough to choose an airline for a card. Users and contacts stay with the administrator. */
export interface AirlineOption {
  id: string;
  code: string;
  name: string;
}

export interface RateCardLineRecord {
  recipeId: string;
  recipeName: string;
  kind: RecipeKind;
  unitPrice: string;
  minimumQuantity: number;
}

export interface RateCardRecord extends RateCardPeriod {
  id: string;
  number: string;
  airlineId: string;
  airlineName: string;
  status: RateCardStatus;
  note: string | null;
  createdByName: string;
  approvedAt: string | null;
  approvedByName: string | null;
  lines: RateCardLineRecord[];
}

export interface ChargePreviewLine {
  recipeId: string;
  quantity: number;
  unitPrice: string | null;
  billedQuantity: number;
  amount: string | null;
}

export interface ChargePreview {
  lines: ChargePreviewLine[];
  /** Null when there is no card, or any item has no price on it. */
  total: string | null;
}

/** What a request would cost on a card, before delivery changes the quantities. */
export function previewCharges(
  lines: Array<{ recipeId: string; quantity: number }>,
  card: Pick<RateCardRecord, 'lines'> | null,
): ChargePreview {
  let complete = card !== null;
  const priced = lines.map((line) => {
    const rate = card?.lines.find((row) => row.recipeId === line.recipeId);
    if (!rate) {
      complete = false;
      return {
        recipeId: line.recipeId,
        quantity: line.quantity,
        unitPrice: null,
        billedQuantity: line.quantity,
        amount: null,
      };
    }
    const billed = billedQuantity(line.quantity, rate.minimumQuantity);
    const amount = chargeFor(billed, rate.unitPrice);
    if (amount === null) complete = false;
    return {
      recipeId: line.recipeId,
      quantity: line.quantity,
      unitPrice: rate.unitPrice,
      billedQuantity: billed,
      amount,
    };
  });
  const total = complete ? sumMoney(priced.map((line) => line.amount ?? '0')) : null;
  return { lines: priced, total };
}

function toPaisa(value: string): bigint | null {
  const trimmed = value.trim();
  if (!isMoney(trimmed)) return null;
  const [whole, fraction = ''] = trimmed.split('.');
  return BigInt(whole + fraction.padEnd(2, '0'));
}

function fromPaisa(value: bigint): string {
  const whole = value / 100n;
  const fraction = (value % 100n).toString().padStart(2, '0');
  return `${whole.toString()}.${fraction}`;
}
