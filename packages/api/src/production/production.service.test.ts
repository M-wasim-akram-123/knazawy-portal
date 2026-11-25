import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';

import { ProductionService } from './production.service';

const actor = {
  id: 'user-1',
  email: 'kitchen@karam.local',
  name: 'Head Chef',
  role: 'HEAD_CHEF' as const,
  organisationId: 'org-1',
  branchId: 'branch-1',
};

const input = {
  recipeId: 'recipe-1',
  locationId: 'loc-1',
  producedOn: '2026-11-14',
  plannedPortions: '10',
  actualPortions: '10',
};

function noAlerts() {
  return {
    levels: jest.fn().mockResolvedValue(new Map()),
    notifyCrossed: jest.fn().mockResolvedValue(undefined),
  };
}

function serviceFor(tx: Record<string, unknown>, alerts = noAlerts()): ProductionService {
  const prisma = {
    ...tx,
    $transaction: (run: (client: object) => Promise<unknown>) => run(tx),
  };
  return new ProductionService(prisma as never, new AuditService(), alerts as never);
}

function recipeRow(status = 'APPROVED') {
  return {
    id: 'recipe-1',
    name: 'Chicken biryani',
    active: true,
    status,
    wastagePercent: new Prisma.Decimal('0'),
    lines: [
      {
        itemId: 'item-1',
        quantityPerPortion: new Prisma.Decimal('0.15'),
        item: { id: 'item-1', name: 'Wheat flour', baseUnit: 'KG', active: true },
      },
    ],
  };
}

function batchRow(totalCost: string, costPerPortion: string) {
  return {
    id: 'batch-1',
    number: 'PB-00001',
    recipeId: 'recipe-1',
    recipe: { name: 'Chicken biryani' },
    locationId: 'loc-1',
    location: { name: 'Dry store' },
    producedOn: new Date('2026-11-14T00:00:00.000Z'),
    plannedPortions: new Prisma.Decimal('10'),
    actualPortions: new Prisma.Decimal('10'),
    totalCost: new Prisma.Decimal(totalCost),
    costPerPortion: new Prisma.Decimal(costPerPortion),
    note: null,
    lines: [
      {
        quantityBase: new Prisma.Decimal('1.5'),
        cost: new Prisma.Decimal(totalCost),
        item: { name: 'Wheat flour', baseUnit: 'KG' },
      },
    ],
  };
}

function baseMocks(recipe = recipeRow(), layers: unknown[] = []) {
  return {
    recipe: { findFirst: jest.fn().mockResolvedValue(recipe) },
    stockLocation: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: 'loc-1', name: 'Dry store', branchId: 'branch-1' }),
    },
    documentSequence: { upsert: jest.fn().mockResolvedValue({ lastNumber: 1 }) },
    productionBatch: {
      create: jest.fn().mockResolvedValue({ id: 'batch-1' }),
      update: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(batchRow('300', '30')),
    },
    productionLine: { create: jest.fn().mockResolvedValue({ id: 'line-1' }) },
    stockLayer: {
      findMany: jest.fn().mockResolvedValue(layers),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    stockMovement: { create: jest.fn().mockResolvedValue({ id: 'move-1' }) },
    auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
  };
}

describe('ProductionService', () => {
  it('refuses the storekeeper', async () => {
    const service = serviceFor({});
    await expect(service.create({ ...actor, role: 'STOREKEEPER' }, input)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('keeps batch costs from a chef, who may read recipes but not stock', async () => {
    const tx = { productionBatch: { findMany: jest.fn() } };
    const service = serviceFor(tx);
    await expect(service.list({ ...actor, role: 'CHEF' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(tx.productionBatch.findMany).not.toHaveBeenCalled();
  });

  it('refuses a chef who tries to record a batch', async () => {
    const service = serviceFor({});
    await expect(service.create({ ...actor, role: 'CHEF' }, input)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses a recipe that is not approved yet', async () => {
    const mocks = baseMocks(recipeRow('DRAFT'));
    const service = serviceFor(mocks);
    await expect(service.create(actor, input)).rejects.toThrow(
      new BadRequestException('Only an approved recipe can be cooked.'),
    );
    expect(mocks.productionBatch.create).not.toHaveBeenCalled();
  });

  it('wants whole portions', async () => {
    const service = serviceFor(baseMocks());
    await expect(service.create(actor, { ...input, actualPortions: '10.5' })).rejects.toThrow(
      new BadRequestException('Enter the portions made as a whole number above zero.'),
    );
  });

  it('posts nothing when stock cannot cover the ingredients', async () => {
    const mocks = baseMocks(recipeRow(), [
      { id: 'old', quantityBase: new Prisma.Decimal('1'), unitCost: new Prisma.Decimal('200') },
    ]);
    const alerts = noAlerts();
    const service = serviceFor(mocks, alerts);
    await expect(service.create(actor, input)).rejects.toThrow(
      new BadRequestException('Only 1 kg of Wheat flour is in Dry store.'),
    );
    expect(alerts.notifyCrossed).not.toHaveBeenCalled();
    expect(mocks.productionLine.create).not.toHaveBeenCalled();
    expect(mocks.stockMovement.create).not.toHaveBeenCalled();
    expect(mocks.productionBatch.update).not.toHaveBeenCalled();
  });

  it('takes the ingredients from the oldest layer first and works out the cost per portion', async () => {
    const mocks = baseMocks(recipeRow(), [
      { id: 'old', quantityBase: new Prisma.Decimal('1'), unitCost: new Prisma.Decimal('200') },
      { id: 'new', quantityBase: new Prisma.Decimal('5'), unitCost: new Prisma.Decimal('220') },
    ]);
    const alerts = noAlerts();
    const before = new Map([['item-1', '6']]);
    alerts.levels.mockResolvedValue(before);
    const service = serviceFor(mocks, alerts);
    await service.create(actor, input);

    expect(alerts.levels).toHaveBeenCalledWith(expect.anything(), 'org-1', 'branch-1', ['item-1']);
    expect(alerts.notifyCrossed).toHaveBeenCalledWith(expect.anything(), {
      organisationId: 'org-1',
      branchId: 'branch-1',
      before,
    });
    expect(mocks.productionLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        quantityBase: new Prisma.Decimal('1.5'),
        cost: new Prisma.Decimal('310'),
      }),
    });
    const movements = mocks.stockMovement.create.mock.calls.map(
      (
        call: [{ data: { quantityBase: Prisma.Decimal; unitCost: Prisma.Decimal; type: string } }],
      ) => [
        call[0].data.type,
        call[0].data.quantityBase.toString(),
        call[0].data.unitCost.toString(),
      ],
    );
    expect(movements).toEqual([
      ['PRODUCTION_USE', '-1', '200'],
      ['PRODUCTION_USE', '-0.5', '220'],
    ]);
    expect(mocks.productionBatch.update).toHaveBeenCalledWith({
      where: { id: 'batch-1' },
      data: {
        totalCost: new Prisma.Decimal('310'),
        costPerPortion: new Prisma.Decimal('31'),
      },
    });
  });
});
