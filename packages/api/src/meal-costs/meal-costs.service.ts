import { costDifference, costOnePortion, type Actor, type MealCostRecord } from '@knazawy/shared';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { assertCan } from '../auth/permissions';
import { PrismaService } from '../prisma/prisma.service';

const recipeInclude = {
  lines: { include: { item: true } },
} satisfies Prisma.RecipeInclude;

type RecipeRow = Prisma.RecipeGetPayload<{ include: typeof recipeInclude }>;

@Injectable()
export class MealCostsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: Actor): Promise<MealCostRecord[]> {
    assertCan(actor, 'meal_cost', 'R', 'view meal cost');
    const recipes = await this.prisma.recipe.findMany({
      where: { organisationId: actor.organisationId, active: true },
      include: recipeInclude,
      orderBy: { name: 'asc' },
    });
    const [cooked, prices] = await Promise.all([
      this.cookedByRecipe(actor.organisationId),
      this.latestUnitCosts(actor.organisationId, itemIdsOf(recipes)),
    ]);
    return recipes.map((recipe) => toMealCost(recipe, prices, cooked.get(recipe.id)));
  }

  private async cookedByRecipe(organisationId: string) {
    const rows = await this.prisma.productionBatch.groupBy({
      by: ['recipeId'],
      where: { organisationId },
      _sum: { totalCost: true, actualPortions: true },
      _count: { _all: true },
    });
    return new Map(rows.map((row) => [row.recipeId, row]));
  }

  private async latestUnitCosts(
    organisationId: string,
    itemIds: string[],
  ): Promise<Map<string, Prisma.Decimal>> {
    const prices = new Map<string, Prisma.Decimal>();
    if (itemIds.length === 0) return prices;
    const layers = await this.prisma.stockLayer.findMany({
      where: { organisationId, itemId: { in: itemIds } },
      orderBy: [{ receivedOn: 'desc' }, { createdAt: 'desc' }],
      select: { itemId: true, unitCost: true },
    });
    for (const layer of layers) {
      if (!prices.has(layer.itemId)) prices.set(layer.itemId, layer.unitCost);
    }
    const missing = itemIds.filter((itemId) => !prices.has(itemId));
    if (missing.length === 0) return prices;
    const received = await this.prisma.goodsReceiptLine.findMany({
      where: { itemId: { in: missing }, receipt: { organisationId } },
      orderBy: [{ receipt: { receivedOn: 'desc' } }, { id: 'desc' }],
      select: { itemId: true, unitCost: true },
    });
    for (const line of received) {
      if (!prices.has(line.itemId)) prices.set(line.itemId, line.unitCost);
    }
    return prices;
  }
}

function itemIdsOf(recipes: RecipeRow[]): string[] {
  return [...new Set(recipes.flatMap((recipe) => recipe.lines.map((line) => line.itemId)))];
}

function toMealCost(
  recipe: RecipeRow,
  prices: Map<string, Prisma.Decimal>,
  cooked:
    | {
        _sum: { totalCost: Prisma.Decimal | null; actualPortions: Prisma.Decimal | null };
        _count: { _all: number };
      }
    | undefined,
): MealCostRecord {
  const priced = costOnePortion({
    wastagePercent: recipe.wastagePercent.toString(),
    lines: recipe.lines.map((line) => ({
      quantityPerPortion: line.quantityPerPortion.toString(),
      unitCost: prices.get(line.itemId)?.toString() ?? null,
    })),
  });
  const portions = cooked?._sum.actualPortions;
  const total = cooked?._sum.totalCost;
  const actualCost =
    portions && total && portions.gt(0) ? total.div(portions).toDecimalPlaces(2).toString() : null;
  const standardCost = priced.standardCost;
  return {
    recipeId: recipe.id,
    code: recipe.code,
    name: recipe.name,
    kind: recipe.kind,
    status: recipe.status,
    wastagePercent: recipe.wastagePercent.toString(),
    standardCost,
    actualCost,
    difference:
      actualCost !== null && standardCost !== null
        ? costDifference(actualCost, standardCost)
        : null,
    batches: cooked?._count._all ?? 0,
    portionsCooked: portions?.toString() ?? '0',
    lines: recipe.lines.map((line, index) => ({
      itemName: line.item.name,
      baseUnit: line.item.baseUnit,
      quantityPerPortion: line.quantityPerPortion.toString(),
      quantityWithWastage: priced.lines[index]?.quantityWithWastage ?? null,
      unitCost: prices.get(line.itemId)?.toString() ?? null,
      lineCost: priced.lines[index]?.lineCost ?? null,
    })),
  };
}
