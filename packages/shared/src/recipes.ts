import type { BaseUnit, RecipeKind, RecipeStatus } from './enums';
import type { StatusTone } from './status';

export const RECIPE_KIND_LABELS: Record<RecipeKind, string> = {
  MEAL: 'Meal',
  SNACK: 'Snack',
};

export const RECIPE_STATUS_LABELS: Record<RecipeStatus, string> = {
  DRAFT: 'Draft',
  APPROVED: 'Approved',
};

export function recipeStatusTone(status: RecipeStatus): StatusTone {
  return status === 'APPROVED' ? 'done' : 'draft';
}

export interface RecipeLineRecord {
  itemId: string;
  itemName: string;
  baseUnit: BaseUnit;
  quantityPerPortion: string;
}

export interface RecipeRecord {
  id: string;
  code: string;
  name: string;
  kind: RecipeKind;
  portions: string;
  wastagePercent: string;
  status: RecipeStatus;
  active: boolean;
  lines: RecipeLineRecord[];
}

export type RecipeQuantityResult =
  | { ok: true; perPortion: string; batch: string }
  | { ok: false; reason: 'quantity' | 'portions' | 'wastage' };

/** Ingredient for one portion, and for the whole recipe after wastage. */
export function recipeIngredientQuantity(input: {
  quantityPerPortion: string;
  portions: string;
  wastagePercent: string;
}): RecipeQuantityResult {
  const quantity = parseScaled(input.quantityPerPortion, 3);
  const portions = parseScaled(input.portions, 3);
  const wastage = parseScaled(input.wastagePercent, 2);
  if (quantity === null || quantity <= 0n) return { ok: false, reason: 'quantity' };
  if (portions === null || portions <= 0n) return { ok: false, reason: 'portions' };
  if (wastage === null || wastage > 10000n) return { ok: false, reason: 'wastage' };
  const factor = 10000n + wastage;
  const batchMilli = divRound(quantity * portions * factor, 10000000n);
  return {
    ok: true,
    perPortion: formatScaled(quantity, 3),
    batch: formatScaled(batchMilli, 3),
  };
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
  const factor = 10n ** BigInt(scale);
  const whole = value / factor;
  const fraction = (value % factor).toString().padStart(scale, '0').replace(/0+$/, '');
  return fraction ? `${whole.toString()}.${fraction}` : whole.toString();
}
