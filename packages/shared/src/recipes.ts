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

export type RecipeStockYieldResult =
  | { ok: true; portions: string; limitingIngredients: string[] }
  | { ok: false; reason: 'ingredients' | 'quantity' | 'available' | 'wastage' };

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

/** Maximum whole portions a recipe can make from stock at one location. */
export function recipeStockYield(input: {
  wastagePercent: string;
  lines: Array<{ itemName: string; quantityPerPortion: string; available: string }>;
}): RecipeStockYieldResult {
  if (input.lines.length === 0) return { ok: false, reason: 'ingredients' };
  const wastage = parseScaled(input.wastagePercent, 2);
  if (wastage === null || wastage > 10000n) return { ok: false, reason: 'wastage' };
  const factor = 10000n + wastage;
  const capacities: Array<{ itemName: string; portions: bigint }> = [];
  for (const line of input.lines) {
    const quantity = parseScaled(line.quantityPerPortion, 3);
    const available = parseScaled(line.available, 4);
    if (quantity === null || quantity <= 0n) return { ok: false, reason: 'quantity' };
    if (available === null) return { ok: false, reason: 'available' };
    const availableMilli = available / 10n;
    const denominator = quantity * factor;
    const maxNumerator = (availableMilli + 1n) * 10000n - 5000n - 1n;
    capacities.push({
      itemName: line.itemName,
      portions: maxNumerator < 0n ? 0n : maxNumerator / denominator,
    });
  }
  const portions = capacities.reduce(
    (minimum, capacity) => (capacity.portions < minimum ? capacity.portions : minimum),
    capacities[0]!.portions,
  );
  return {
    ok: true,
    portions: portions.toString(),
    limitingIngredients: capacities
      .filter((capacity) => capacity.portions === portions)
      .map((capacity) => capacity.itemName)
      .sort((left, right) => left.localeCompare(right)),
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
