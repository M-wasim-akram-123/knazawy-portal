import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { MealCostsService } from './meal-costs.service';

const actor = {
  id: 'user-1',
  email: 'finance@karam.local',
  name: 'Finance Officer',
  role: 'FINANCE_OFFICER' as const,
  organisationId: 'org-1',
};

function recipeRow() {
  return {
    id: 'recipe-1',
    code: 'BIRYANI',
    name: 'Chicken biryani',
    kind: 'MEAL',
    status: 'APPROVED',
    wastagePercent: new Prisma.Decimal('10'),
    lines: [
      {
        itemId: 'item-1',
        quantityPerPortion: new Prisma.Decimal('0.15'),
        item: { name: 'Wheat flour', baseUnit: 'KG' },
      },
    ],
  };
}

function serviceFor(prisma: Record<string, unknown>): MealCostsService {
  return new MealCostsService(prisma as never);
}

describe('MealCostsService', () => {
  it('refuses the storekeeper', async () => {
    const service = serviceFor({});
    await expect(service.list({ ...actor, role: 'STOREKEEPER' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('prices a portion from the latest layer and compares it with what was cooked', async () => {
    const prisma = {
      recipe: { findMany: jest.fn().mockResolvedValue([recipeRow()]) },
      productionBatch: {
        groupBy: jest.fn().mockResolvedValue([
          {
            recipeId: 'recipe-1',
            _sum: {
              totalCost: new Prisma.Decimal('330'),
              actualPortions: new Prisma.Decimal('10'),
            },
            _count: { _all: 1 },
          },
        ]),
      },
      stockLayer: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ itemId: 'item-1', unitCost: new Prisma.Decimal('200') }]),
      },
      goodsReceiptLine: { findMany: jest.fn() },
    };
    const service = serviceFor(prisma);
    const [cost] = await service.list(actor);
    expect(cost).toMatchObject({
      name: 'Chicken biryani',
      standardCost: '33',
      actualCost: '33',
      difference: '0',
      batches: 1,
      portionsCooked: '10',
    });
    expect(cost?.lines[0]).toMatchObject({
      quantityWithWastage: '0.165',
      unitCost: '200',
      lineCost: '33',
    });
    expect(prisma.goodsReceiptLine.findMany).not.toHaveBeenCalled();
  });

  it('uses the latest receipt when the item has never been in stock', async () => {
    const row = recipeRow();
    row.wastagePercent = new Prisma.Decimal('0');
    const prisma = {
      recipe: { findMany: jest.fn().mockResolvedValue([row]) },
      productionBatch: { groupBy: jest.fn().mockResolvedValue([]) },
      stockLayer: { findMany: jest.fn().mockResolvedValue([]) },
      goodsReceiptLine: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ itemId: 'item-1', unitCost: new Prisma.Decimal('200.5') }]),
      },
    };
    const service = serviceFor(prisma);
    const [cost] = await service.list(actor);
    expect(cost?.standardCost).toBe('30.08');
    expect(cost?.actualCost).toBeNull();
    expect(cost?.difference).toBeNull();
    expect(cost?.batches).toBe(0);
  });

  it('keeps the standard cost open when nothing has a price', async () => {
    const prisma = {
      recipe: { findMany: jest.fn().mockResolvedValue([recipeRow()]) },
      productionBatch: {
        groupBy: jest.fn().mockResolvedValue([
          {
            recipeId: 'recipe-1',
            _sum: {
              totalCost: new Prisma.Decimal('330'),
              actualPortions: new Prisma.Decimal('10'),
            },
            _count: { _all: 1 },
          },
        ]),
      },
      stockLayer: { findMany: jest.fn().mockResolvedValue([]) },
      goodsReceiptLine: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = serviceFor(prisma);
    const [cost] = await service.list(actor);
    expect(cost?.standardCost).toBeNull();
    expect(cost?.actualCost).toBe('33');
    expect(cost?.difference).toBeNull();
    expect(cost?.lines[0]?.lineCost).toBeNull();
  });
});
