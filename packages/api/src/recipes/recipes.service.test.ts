import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';

import { RecipesService } from './recipes.service';

const actor = {
  id: 'user-1',
  email: 'admin@karam.local',
  name: 'Karam Administrator',
  role: 'ADMINISTRATOR' as const,
  organisationId: 'org-1',
};

const input = {
  code: 'BIRYANI',
  name: 'Chicken biryani',
  kind: 'MEAL' as const,
  portions: '10',
  wastagePercent: '5',
  lines: [{ itemId: 'item-1', quantity: '0.15' }],
};

function serviceFor(tx: Record<string, unknown>): RecipesService {
  const prisma = {
    ...tx,
    $transaction: (run: (client: object) => Promise<unknown>) => run(tx),
  };
  return new RecipesService(prisma as never, new AuditService());
}

function recipeRow(status = 'DRAFT') {
  return {
    id: 'recipe-1',
    code: 'BIRYANI',
    name: 'Chicken biryani',
    kind: 'MEAL',
    portions: new Prisma.Decimal('10'),
    wastagePercent: new Prisma.Decimal('5'),
    status,
    active: true,
    lines: [
      {
        itemId: 'item-1',
        quantityPerPortion: new Prisma.Decimal('0.15'),
        item: { name: 'Rice', baseUnit: 'KG' },
      },
    ],
  };
}

describe('RecipesService', () => {
  it('refuses the storekeeper', async () => {
    const service = serviceFor({});
    await expect(service.create({ ...actor, role: 'STOREKEEPER' }, input)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses the kitchen lead when they try to approve', async () => {
    const tx = { recipe: { findFirst: jest.fn() } };
    const service = serviceFor(tx);
    await expect(service.approve({ ...actor, role: 'KITCHEN_LEAD' }, 'recipe-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(tx.recipe.findFirst).not.toHaveBeenCalled();
  });

  it('uses each ingredient once', async () => {
    const service = serviceFor({ item: { findMany: jest.fn() } });
    await expect(
      service.create(actor, {
        ...input,
        lines: [
          { itemId: 'item-1', quantity: '0.15' },
          { itemId: 'item-1', quantity: '0.02' },
        ],
      }),
    ).rejects.toThrow(new BadRequestException('Use each ingredient once.'));
  });

  it('saves a draft with the ingredient quantity for one portion', async () => {
    const tx = {
      item: { findMany: jest.fn().mockResolvedValue([{ id: 'item-1' }]) },
      recipe: { create: jest.fn().mockResolvedValue(recipeRow()) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const service = serviceFor(tx);
    const saved = await service.create(actor, input);
    expect(tx.recipe.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: 'BIRYANI',
        kind: 'MEAL',
        portions: new Prisma.Decimal('10'),
        wastagePercent: new Prisma.Decimal('5'),
        lines: { create: [{ itemId: 'item-1', quantityPerPortion: new Prisma.Decimal('0.15') }] },
      }),
      include: expect.any(Object),
    });
    expect(saved.status).toBe('DRAFT');
    expect(saved.lines[0]?.quantityPerPortion).toBe('0.15');
  });

  it('approves a draft', async () => {
    const tx = {
      recipe: {
        findFirst: jest.fn().mockResolvedValue(recipeRow('DRAFT')),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(recipeRow('APPROVED')),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const service = serviceFor(tx);
    const saved = await service.approve(actor, 'recipe-1');
    expect(saved.status).toBe('APPROVED');
  });

  it('sends an approved recipe back to draft when an ingredient changes', async () => {
    const tx = {
      recipe: {
        findFirst: jest.fn().mockResolvedValue(recipeRow('APPROVED')),
        update: jest.fn().mockResolvedValue(recipeRow('DRAFT')),
      },
      recipeLine: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      item: { findMany: jest.fn().mockResolvedValue([{ id: 'item-1' }]) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const service = serviceFor(tx);
    await service.update(actor, 'recipe-1', { lines: [{ itemId: 'item-1', quantity: '0.2' }] });
    expect(tx.recipe.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'DRAFT' }),
      }),
    );
  });
});
