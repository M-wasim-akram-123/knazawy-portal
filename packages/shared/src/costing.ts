import type { BaseUnit, RecipeKind, RecipeStatus } from './enums';
import { recipeIngredientQuantity } from './recipes';

/** One ingredient's share of a single portion, at a known unit cost. */
export interface MealCostLineRecord {
  itemName: string;
  baseUnit: BaseUnit;
  quantityPerPortion: string;
  quantityWithWastage: string | null;
  unitCost: string | null;
  lineCost: string | null;
}

/**
 * Standard cost is today's price for one portion. Actual cost is what cooked
 * batches used. The difference is actual minus standard.
 */
export interface MealCostRecord {
  recipeId: string;
  code: string;
  name: string;
  kind: RecipeKind;
  status: RecipeStatus;
  wastagePercent: string;
  standardCost: string | null;
  actualCost: string | null;
  difference: string | null;
  batches: number;
  portionsCooked: string;
  lines: MealCostLineRecord[];
}

export interface PortionCostLine {
  quantityPerPortion: string;
  /** Latest unit cost in the item's base unit, up to 4 decimal places. Null when none is known. */
  unitCost: string | null;
}

export interface PortionCostLineResult {
  quantityWithWastage: string | null;
  lineCost: string | null;
}

export interface PortionCostResult {
  lines: PortionCostLineResult[];
  /** Null when any ingredient has no price, or a quantity cannot be scaled. */
  standardCost: string | null;
}

/** Cost of one portion, wastage included, from each ingredient's latest unit cost. */
export function costOnePortion(input: {
  wastagePercent: string;
  lines: PortionCostLine[];
}): PortionCostResult {
  let complete = true;
  let total = 0n;
  const lines = input.lines.map((line) => {
    const usage = recipeIngredientQuantity({
      quantityPerPortion: line.quantityPerPortion,
      portions: '1',
      wastagePercent: input.wastagePercent,
    });
    if (!usage.ok) {
      complete = false;
      return { quantityWithWastage: null, lineCost: null };
    }
    if (line.unitCost === null) {
      complete = false;
      return { quantityWithWastage: usage.batch, lineCost: null };
    }
    const lineCost = multiplyMoney(usage.batch, 3, line.unitCost, 4);
    if (lineCost === null) {
      complete = false;
      return { quantityWithWastage: usage.batch, lineCost: null };
    }
    total += lineCost;
    return { quantityWithWastage: usage.batch, lineCost: formatScaled(lineCost, 2) };
  });
  return {
    lines,
    standardCost: complete ? formatScaled(total, 2) : null,
  };
}

/** Actual minus standard, in PKR to 2 decimal places. */
export function costDifference(actual: string, standard: string): string | null {
  const left = parseScaled(actual, 2);
  const right = parseScaled(standard, 2);
  if (left === null || right === null) return null;
  return formatSigned(left - right, 2);
}

function multiplyMoney(
  quantity: string,
  quantityScale: number,
  unitCost: string,
  costScale: number,
): bigint | null {
  const qty = parseScaled(quantity, quantityScale);
  const cost = parseScaled(unitCost, costScale);
  if (qty === null || cost === null) return null;
  const extra = quantityScale + costScale - 2;
  return divRound(qty * cost, 10n ** BigInt(extra));
}

function parseScaled(value: string, scale: number): bigint | null {
  const trimmed = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(trimmed)) return null;
  const [whole, fraction = ''] = trimmed.split('.');
  if (fraction.length > scale) return null;
  return BigInt(whole + fraction.padEnd(scale, '0'));
}

function divRound(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / 2n) / denominator;
}

function formatScaled(value: bigint, scale: number): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const factor = 10n ** BigInt(scale);
  const whole = abs / factor;
  const fraction = (abs % factor).toString().padStart(scale, '0').replace(/0+$/, '');
  const text = fraction ? `${whole.toString()}.${fraction}` : whole.toString();
  return negative ? `-${text}` : text;
}

function formatSigned(value: bigint, scale: number): string {
  return formatScaled(value, scale);
}
