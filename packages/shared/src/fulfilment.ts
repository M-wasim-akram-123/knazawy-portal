import type { BaseUnit, RecipeKind } from './enums';

/**
 * Can Karam take this order from the stock it has?
 *
 * An order needs the ingredients of every line, after wastage. Stock already promised to other
 * accepted orders that have not reached the kitchen yet is held back, so two orders cannot both
 * count the same rice.
 */

export interface FulfilmentRecipe {
  recipeId: string;
  recipeName: string;
  kind: RecipeKind;
  wastagePercent: string;
  ingredients: Array<{
    itemId: string;
    itemName: string;
    baseUnit: BaseUnit;
    quantityPerPortion: string;
  }>;
}

export interface FulfilmentLineInput {
  recipeId: string;
  quantity: number;
}

export interface FulfilmentIngredient {
  itemId: string;
  itemName: string;
  baseUnit: BaseUnit;
  /** What this order needs, after wastage. */
  needed: string;
  /** Everything in stock across Karam's locations. */
  onHand: string;
  /** Held for other accepted orders that are not in production yet. */
  promised: string;
  /** On hand less promised, never below zero. */
  free: string;
  /** How much more is needed to take this order. Zero when there is enough. */
  short: string;
}

export interface FulfilmentLine {
  recipeId: string;
  recipeName: string;
  kind: RecipeKind;
  quantity: number;
  /** Whole portions free stock could make of this item alone. */
  canMake: number;
  /** False when the recipe has no ingredients, so stock cannot be checked. */
  checked: boolean;
}

export interface FulfilmentRecord {
  requestId: string;
  /** True when free stock covers every ingredient of every line. */
  canFulfil: boolean;
  lines: FulfilmentLine[];
  ingredients: FulfilmentIngredient[];
}

const SCALE = 4;
const ONE = 10n ** BigInt(SCALE);

/** Ingredient needs of a set of order lines, in base units at four decimals. */
export function ingredientNeeds(
  lines: readonly FulfilmentLineInput[],
  recipes: ReadonlyMap<string, FulfilmentRecipe>,
): Map<string, bigint> {
  const needs = new Map<string, bigint>();
  for (const line of lines) {
    const recipe = recipes.get(line.recipeId);
    if (!recipe || line.quantity <= 0) continue;
    const factor = 10000n + parseScaled(recipe.wastagePercent, 2);
    for (const ingredient of recipe.ingredients) {
      const perPortion = parseScaled(ingredient.quantityPerPortion, SCALE);
      const need = divCeil(perPortion * BigInt(line.quantity) * factor, 10000n);
      needs.set(ingredient.itemId, (needs.get(ingredient.itemId) ?? 0n) + need);
    }
  }
  return needs;
}

export function checkFulfilment(input: {
  requestId: string;
  lines: readonly FulfilmentLineInput[];
  recipes: ReadonlyMap<string, FulfilmentRecipe>;
  /** itemId to quantity on hand, base units. */
  onHand: ReadonlyMap<string, string>;
  /** Lines of other accepted orders not yet in production. */
  promisedLines: readonly FulfilmentLineInput[];
}): FulfilmentRecord {
  const needs = ingredientNeeds(input.lines, input.recipes);
  const promised = ingredientNeeds(input.promisedLines, input.recipes);

  const itemInfo = new Map<string, { itemName: string; baseUnit: BaseUnit }>();
  for (const line of input.lines) {
    for (const ingredient of input.recipes.get(line.recipeId)?.ingredients ?? []) {
      itemInfo.set(ingredient.itemId, {
        itemName: ingredient.itemName,
        baseUnit: ingredient.baseUnit,
      });
    }
  }

  const freeOf = (itemId: string): bigint => {
    const left = parseScaled(input.onHand.get(itemId) ?? '0', SCALE) - (promised.get(itemId) ?? 0n);
    return left > 0n ? left : 0n;
  };

  const ingredients: FulfilmentIngredient[] = [...needs.entries()]
    .map(([itemId, needed]) => {
      const onHand = parseScaled(input.onHand.get(itemId) ?? '0', SCALE);
      const held = promised.get(itemId) ?? 0n;
      const free = freeOf(itemId);
      const info = itemInfo.get(itemId)!;
      return {
        itemId,
        itemName: info.itemName,
        baseUnit: info.baseUnit,
        needed: formatScaled(needed),
        onHand: formatScaled(onHand),
        promised: formatScaled(held),
        free: formatScaled(free),
        short: formatScaled(needed > free ? needed - free : 0n),
      };
    })
    .sort((left, right) => left.itemName.localeCompare(right.itemName));

  const lines: FulfilmentLine[] = input.lines
    .map((line) => {
      const recipe = input.recipes.get(line.recipeId);
      const checked = Boolean(recipe && recipe.ingredients.length > 0);
      let canMake = 0;
      if (recipe && checked) {
        const factor = 10000n + parseScaled(recipe.wastagePercent, 2);
        let most: bigint | null = null;
        for (const ingredient of recipe.ingredients) {
          const perPortion = divCeil(
            parseScaled(ingredient.quantityPerPortion, SCALE) * factor,
            10000n,
          );
          const portions = perPortion > 0n ? freeOf(ingredient.itemId) / perPortion : 0n;
          most = most === null || portions < most ? portions : most;
        }
        canMake = Number(most ?? 0n);
      }
      return {
        recipeId: line.recipeId,
        recipeName: recipe?.recipeName ?? 'Unknown item',
        kind: recipe?.kind ?? 'MEAL',
        quantity: line.quantity,
        canMake,
        checked,
      };
    })
    .sort((left, right) => left.recipeName.localeCompare(right.recipeName));

  const canFulfil =
    lines.every((line) => line.checked) && ingredients.every((row) => row.short === '0');

  return { requestId: input.requestId, canFulfil, lines, ingredients };
}

/** Accepts plain decimals and database decimals such as "12.5000". Anything else counts as zero. */
function parseScaled(value: string, scale: number): bigint {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) return 0n;
  const [whole, fraction = ''] = trimmed.split('.');
  const kept = fraction.slice(0, scale).padEnd(scale, '0');
  return BigInt(whole + kept);
}

function divCeil(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - 1n) / denominator;
}

function formatScaled(value: bigint): string {
  const whole = value / ONE;
  const fraction = (value % ONE).toString().padStart(SCALE, '0').replace(/0+$/, '');
  return fraction ? `${whole.toString()}.${fraction}` : whole.toString();
}
