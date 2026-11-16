import {
  BASE_UNIT_LABELS,
  recipeIngredientQuantity,
  type Actor,
  type ProductionRecord,
} from '@knazawy/shared';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { assertCan } from '../auth/permissions';
import { formatIsoDate, parseIsoDate } from '../common/date';
import { parsePositiveDecimal } from '../common/decimal';
import { nextDocumentNumber } from '../common/document-number';
import { PrismaService } from '../prisma/prisma.service';
import { drawFifo } from '../stock/fifo';

import type { CreateProductionDto } from './production.dto';

const recipeInclude = {
  lines: { include: { item: true } },
} satisfies Prisma.RecipeInclude;

const productionInclude = {
  recipe: true,
  location: true,
  lines: { include: { item: true } },
} satisfies Prisma.ProductionBatchInclude;

type BatchRow = Prisma.ProductionBatchGetPayload<{ include: typeof productionInclude }>;
type BatchLineRow = BatchRow['lines'][number];

@Injectable()
export class ProductionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: Actor): Promise<ProductionRecord[]> {
    assertCan(actor, 'recipes', 'R', 'view production');
    const rows = await this.prisma.productionBatch.findMany({
      where: { organisationId: actor.organisationId },
      include: productionInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toBatch);
  }

  async create(actor: Actor, input: CreateProductionDto): Promise<ProductionRecord> {
    assertCan(actor, 'recipes', 'C', 'record a production batch');
    const producedOn = parseIsoDate(input.producedOn);
    const planned = parseWholePortions(
      input.plannedPortions,
      'Enter the planned portions as a whole number above zero.',
    );
    const actual = parseWholePortions(
      input.actualPortions,
      'Enter the portions made as a whole number above zero.',
    );
    const note = input.note?.trim() || null;

    const batchId = await this.prisma.$transaction(async (tx) => {
      const recipe = await tx.recipe.findFirst({
        where: { id: input.recipeId, organisationId: actor.organisationId },
        include: recipeInclude,
      });
      if (!recipe) throw new BadRequestException('Choose a recipe that exists.');
      if (!recipe.active) throw new BadRequestException('This recipe is archived.');
      if (recipe.status !== 'APPROVED') {
        throw new BadRequestException('Only an approved recipe can be cooked.');
      }

      const location = await tx.stockLocation.findFirst({
        where: { id: input.locationId, organisationId: actor.organisationId, active: true },
      });
      if (!location) throw new BadRequestException('Choose an open location.');

      const needs = recipe.lines.map((line) => {
        if (!line.item.active) throw new BadRequestException('Choose an item that exists.');
        const checked = recipeIngredientQuantity({
          quantityPerPortion: line.quantityPerPortion.toString(),
          portions: actual.toString(),
          wastagePercent: recipe.wastagePercent.toString(),
        });
        if (!checked.ok) throw new BadRequestException('This recipe cannot be scaled.');
        return { line, quantity: new Prisma.Decimal(checked.batch) };
      });

      const number = await nextDocumentNumber(tx, actor.organisationId, 'PRODUCTION');
      const batch = await tx.productionBatch.create({
        data: {
          organisationId: actor.organisationId,
          number,
          recipeId: recipe.id,
          locationId: location.id,
          producedOn,
          plannedPortions: planned,
          actualPortions: actual,
          totalCost: new Prisma.Decimal(0),
          costPerPortion: new Prisma.Decimal(0),
          note,
        },
      });

      let total = new Prisma.Decimal(0);
      for (const need of needs) {
        const layers = await tx.stockLayer.findMany({
          where: {
            organisationId: actor.organisationId,
            itemId: need.line.itemId,
            locationId: location.id,
            quantityBase: { gt: 0 },
          },
          orderBy: [{ receivedOn: 'asc' }, { createdAt: 'asc' }],
        });
        const plan = drawFifo(layers, need.quantity, {
          item: need.line.item.name,
          location: location.name,
          unit: BASE_UNIT_LABELS[need.line.item.baseUnit],
        });

        const batchLine = await tx.productionLine.create({
          data: {
            batchId: batch.id,
            itemId: need.line.itemId,
            quantityBase: need.quantity,
            cost: plan.cost,
          },
        });

        for (const draw of plan.draws) {
          const taken = await tx.stockLayer.updateMany({
            where: { id: draw.layerId, quantityBase: { gte: draw.quantityBase } },
            data: { quantityBase: { decrement: draw.quantityBase } },
          });
          if (taken.count !== 1) {
            throw new ConflictException(
              'Stock changed while you were cooking. Check the quantities and try again.',
            );
          }
          await tx.stockMovement.create({
            data: {
              organisationId: actor.organisationId,
              itemId: need.line.itemId,
              locationId: location.id,
              layerId: draw.layerId,
              productionBatchId: batch.id,
              productionLineId: batchLine.id,
              type: 'PRODUCTION_USE',
              quantityBase: draw.quantityBase.neg(),
              unitCost: draw.unitCost,
            },
          });
        }
        total = total.plus(plan.cost);
      }

      await tx.productionBatch.update({
        where: { id: batch.id },
        data: {
          totalCost: total,
          costPerPortion: total.div(actual).toDecimalPlaces(2),
        },
      });

      const full = await tx.productionBatch.findUnique({
        where: { id: batch.id },
        include: productionInclude,
      });
      if (!full) throw new NotFoundException('That batch was not found.');
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'ProductionBatch',
        entityId: batch.id,
        action: 'create',
        after: toBatch(full),
      });
      return batch.id;
    });

    const row = await this.prisma.productionBatch.findUnique({
      where: { id: batchId },
      include: productionInclude,
    });
    if (!row) throw new NotFoundException('That batch was not found.');
    return toBatch(row);
  }
}

function parseWholePortions(value: string, message: string): Prisma.Decimal {
  const portions = parsePositiveDecimal(value, message);
  if (!portions.isInteger()) throw new BadRequestException(message);
  return portions;
}

function toBatch(row: BatchRow): ProductionRecord {
  return {
    id: row.id,
    number: row.number,
    recipeId: row.recipeId,
    recipeName: row.recipe.name,
    locationId: row.locationId,
    locationName: row.location.name,
    producedOn: formatIsoDate(row.producedOn),
    plannedPortions: row.plannedPortions.toString(),
    actualPortions: row.actualPortions.toString(),
    totalCost: row.totalCost.toString(),
    costPerPortion: row.costPerPortion.toString(),
    note: row.note,
    lines: [...row.lines]
      .sort((left, right) => left.item.name.localeCompare(right.item.name))
      .map((line: BatchLineRow) => ({
        itemName: line.item.name,
        baseUnit: line.item.baseUnit,
        quantityBase: line.quantityBase.toString(),
        cost: line.cost.toString(),
      })),
  };
}
