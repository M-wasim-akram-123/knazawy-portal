import { recipeIngredientQuantity, type Actor, type RecipeKind, type RecipeRecord } from '@knazawy/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { assertCan } from '../auth/permissions';
import { rethrowUnique } from '../common/prisma-error';
import { PrismaService } from '../prisma/prisma.service';

import type { CreateRecipeDto, RecipeLineDto, UpdateRecipeDto } from './recipes.dto';

const recipeInclude = {
  lines: { include: { item: true } },
} satisfies Prisma.RecipeInclude;

type RecipeRow = Prisma.RecipeGetPayload<{ include: typeof recipeInclude }>;

const MESSAGES = {
  quantity: 'Enter a quantity above zero, with up to 3 decimal places.',
  portions: 'Enter the portions above zero, with up to 3 decimal places.',
  wastage: 'Enter a wastage percent from 0 to 100, with up to 2 decimal places.',
} as const;

@Injectable()
export class RecipesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: Actor, includeArchived: boolean): Promise<RecipeRecord[]> {
    assertCan(actor, 'recipes', 'R', 'view recipes');
    const rows = await this.prisma.recipe.findMany({
      where: {
        organisationId: actor.organisationId,
        ...(includeArchived ? {} : { active: true }),
      },
      include: recipeInclude,
      orderBy: { name: 'asc' },
    });
    return rows.map(toRecipe);
  }

  async create(actor: Actor, input: CreateRecipeDto): Promise<RecipeRecord> {
    assertCan(actor, 'recipes', 'C', 'add a recipe');
    const code = requiredText(input.code, 'Enter a recipe code.');
    const name = requiredText(input.name, 'Enter the recipe name.');
    const portions = headerPortions(input.portions, input.wastagePercent);
    const lines = await this.ingredientLines(
      actor.organisationId,
      input.lines,
      input.portions,
      input.wastagePercent,
    );

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const recipe = await tx.recipe.create({
          data: {
            organisationId: actor.organisationId,
            code,
            name,
            kind: input.kind,
            portions: portions.portions,
            wastagePercent: portions.wastagePercent,
            lines: { create: lines },
          },
          include: recipeInclude,
        });
        await this.audit.record(tx, {
          userId: actor.id,
          entity: 'Recipe',
          entityId: recipe.id,
          action: 'create',
          after: toRecipe(recipe),
        });
        return recipe;
      });
      return toRecipe(created);
    } catch (error) {
      rethrowUnique(error, 'A recipe with this code already exists.');
    }
  }

  async update(actor: Actor, id: string, input: UpdateRecipeDto): Promise<RecipeRecord> {
    assertCan(actor, 'recipes', 'U', 'change a recipe');
    const existing = await this.load(actor.organisationId, id);
    const contentKeys: (keyof UpdateRecipeDto)[] = [
      'code',
      'name',
      'kind',
      'portions',
      'wastagePercent',
      'lines',
    ];
    const changesContent = contentKeys.some((key) => input[key] !== undefined);
    if (!existing.active && changesContent) {
      throw new BadRequestException('This recipe is archived.');
    }

    const portionsText = input.portions ?? existing.portions.toString();
    const wastageText = input.wastagePercent ?? existing.wastagePercent.toString();
    const portions =
      input.portions !== undefined || input.wastagePercent !== undefined
        ? headerPortions(portionsText, wastageText)
        : null;
    const lines =
      input.lines === undefined
        ? undefined
        : await this.ingredientLines(actor.organisationId, input.lines, portionsText, wastageText);

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (lines) {
          await tx.recipeLine.deleteMany({ where: { recipeId: existing.id } });
        }
        const recipe = await tx.recipe.update({
          where: { id: existing.id },
          data: {
            ...(input.code === undefined ? {} : { code: requiredText(input.code, 'Enter a recipe code.') }),
            ...(input.name === undefined ? {} : { name: requiredText(input.name, 'Enter the recipe name.') }),
            ...(input.kind === undefined ? {} : { kind: input.kind }),
            ...(portions === null
              ? {}
              : { portions: portions.portions, wastagePercent: portions.wastagePercent }),
            ...(input.active === undefined ? {} : { active: input.active }),
            ...(changesContent && existing.status === 'APPROVED' ? { status: 'DRAFT' } : {}),
            ...(lines ? { lines: { create: lines } } : {}),
          },
          include: recipeInclude,
        });
        await this.audit.record(tx, {
          userId: actor.id,
          entity: 'Recipe',
          entityId: recipe.id,
          action: 'update',
          before: toRecipe(existing),
          after: toRecipe(recipe),
        });
        return recipe;
      });
      return toRecipe(updated);
    } catch (error) {
      rethrowUnique(error, 'A recipe with this code already exists.');
    }
  }

  async approve(actor: Actor, id: string): Promise<RecipeRecord> {
    assertCan(actor, 'recipes', 'A', 'approve a recipe');
    const existing = await this.load(actor.organisationId, id);
    if (!existing.active) throw new BadRequestException('This recipe is archived.');
    if (existing.status === 'APPROVED') {
      throw new BadRequestException('This recipe is already approved.');
    }
    if (existing.lines.length === 0) throw new BadRequestException('Add an ingredient.');

    const updated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.recipe.updateMany({
        where: { id: existing.id, status: 'DRAFT', active: true },
        data: { status: 'APPROVED' },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException('This recipe is not waiting for approval.');
      }
      const recipe = await tx.recipe.findUnique({ where: { id: existing.id }, include: recipeInclude });
      if (!recipe) throw new NotFoundException('That recipe was not found.');
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'Recipe',
        entityId: recipe.id,
        action: 'approve',
        before: toRecipe(existing),
        after: toRecipe(recipe),
      });
      return recipe;
    });
    return toRecipe(updated);
  }

  private async load(organisationId: string, id: string): Promise<RecipeRow> {
    const recipe = await this.prisma.recipe.findFirst({
      where: { id, organisationId },
      include: recipeInclude,
    });
    if (!recipe) throw new NotFoundException('That recipe was not found.');
    return recipe;
  }

  private async ingredientLines(
    organisationId: string,
    lines: RecipeLineDto[],
    portions: string,
    wastagePercent: string,
  ): Promise<Array<{ itemId: string; quantityPerPortion: Prisma.Decimal }>> {
    if (lines.length === 0) throw new BadRequestException('Add an ingredient.');
    if (lines.length > 40) throw new BadRequestException('Enter up to 40 ingredients.');
    const seen = new Set<string>();
    const prepared = lines.map((line) => {
      if (seen.has(line.itemId)) throw new BadRequestException('Use each ingredient once.');
      seen.add(line.itemId);
      const checked = recipeIngredientQuantity({
        quantityPerPortion: line.quantity,
        portions,
        wastagePercent,
      });
      if (!checked.ok) throw new BadRequestException(MESSAGES[checked.reason]);
      return { itemId: line.itemId, quantityPerPortion: new Prisma.Decimal(checked.perPortion) };
    });
    const items = await this.prisma.item.findMany({
      where: { organisationId, id: { in: [...seen] }, active: true },
      select: { id: true },
    });
    if (items.length !== seen.size) throw new BadRequestException('Choose an item that exists.');
    return prepared;
  }
}

function headerPortions(
  portions: string,
  wastagePercent: string,
): { portions: Prisma.Decimal; wastagePercent: Prisma.Decimal } {
  const checked = recipeIngredientQuantity({
    quantityPerPortion: '1',
    portions,
    wastagePercent,
  });
  if (!checked.ok && checked.reason !== 'quantity') {
    throw new BadRequestException(MESSAGES[checked.reason]);
  }
  return {
    portions: new Prisma.Decimal(portions.trim()),
    wastagePercent: new Prisma.Decimal(wastagePercent.trim()),
  };
}

function requiredText(value: string, message: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new BadRequestException(message);
  return trimmed;
}

function toRecipe(row: RecipeRow): RecipeRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    kind: row.kind as RecipeKind,
    portions: row.portions.toString(),
    wastagePercent: row.wastagePercent.toString(),
    status: row.status,
    active: row.active,
    lines: [...row.lines]
      .sort((left, right) => left.item.name.localeCompare(right.item.name))
      .map((line) => ({
        itemId: line.itemId,
        itemName: line.item.name,
        baseUnit: line.item.baseUnit,
        quantityPerPortion: line.quantityPerPortion.toString(),
      })),
  };
}
