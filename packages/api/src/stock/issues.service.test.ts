import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';

import { IssuesService } from './issues.service';

const actor = {
  id: 'user-1',
  email: 'admin@karam.local',
  name: 'Karam Administrator',
  role: 'ADMINISTRATOR' as const,
  organisationId: 'org-1',
};

const input = {
  locationId: 'loc-1',
  issuedOn: '2026-11-13',
  reason: 'KITCHEN_USE' as const,
  lines: [{ itemId: 'item-1', quantity: '30' }],
};

function serviceFor(tx: Record<string, unknown>): IssuesService {
  const prisma = {
    ...tx,
    $transaction: (run: (client: object) => Promise<unknown>) => run(tx),
  };
  return new IssuesService(prisma as never, new AuditService());
}

function baseMocks(layers: unknown[]) {
  return {
    stockLocation: {
      findFirst: jest.fn().mockResolvedValue({ id: 'loc-1', name: 'Dry store' }),
    },
    item: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'item-1', name: 'Wheat flour', baseUnit: 'KG' },
      ]),
    },
    documentSequence: { upsert: jest.fn().mockResolvedValue({ lastNumber: 1 }) },
    stockIssue: {
      create: jest.fn().mockResolvedValue({ id: 'issue-1' }),
      findUnique: jest.fn().mockResolvedValue({
        id: 'issue-1',
        number: 'IS-00001',
        locationId: 'loc-1',
        location: { name: 'Dry store' },
        issuedOn: new Date('2026-11-13T00:00:00.000Z'),
        reason: 'KITCHEN_USE',
        note: null,
        lines: [],
      }),
    },
    stockIssueLine: {
      create: jest.fn().mockResolvedValue({ id: 'line-1' }),
    },
    stockLayer: {
      findMany: jest.fn().mockResolvedValue(layers),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    stockMovement: { create: jest.fn().mockResolvedValue({ id: 'move-1' }) },
    auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
  };
}

describe('IssuesService', () => {
  it('refuses an airline user', async () => {
    const service = serviceFor(baseMocks([]));
    await expect(
      service.create({ ...actor, role: 'AIRLINE_REQUESTER' }, input),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses more than the location holds and posts nothing', async () => {
    const mocks = baseMocks([
      { id: 'old', quantityBase: new Prisma.Decimal('25'), unitCost: new Prisma.Decimal('200') },
    ]);
    const service = serviceFor(mocks);

    await expect(service.create(actor, input)).rejects.toThrow(
      new BadRequestException('Only 25 kg of Wheat flour is in Dry store.'),
    );
    expect(mocks.stockIssue.create).toHaveBeenCalled();
    expect(mocks.stockMovement.create).not.toHaveBeenCalled();
  });

  it('takes from the oldest layer first and records negative movements at each layer cost', async () => {
    const mocks = baseMocks([
      { id: 'old', quantityBase: new Prisma.Decimal('25'), unitCost: new Prisma.Decimal('200') },
      { id: 'new', quantityBase: new Prisma.Decimal('75'), unitCost: new Prisma.Decimal('220') },
    ]);
    const service = serviceFor(mocks);

    await service.create(actor, input);

    expect(mocks.stockIssueLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ quantityBase: new Prisma.Decimal('30'), cost: new Prisma.Decimal('6100') }),
    });
    expect(mocks.stockLayer.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'old', quantityBase: { gte: new Prisma.Decimal('25') } },
      data: { quantityBase: { decrement: new Prisma.Decimal('25') } },
    });
    expect(mocks.stockLayer.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'new', quantityBase: { gte: new Prisma.Decimal('5') } },
      data: { quantityBase: { decrement: new Prisma.Decimal('5') } },
    });
    const movements = mocks.stockMovement.create.mock.calls.map(
      (call: [{ data: { quantityBase: Prisma.Decimal; unitCost: Prisma.Decimal } }]) => [
        call[0].data.quantityBase.toString(),
        call[0].data.unitCost.toString(),
      ],
    );
    expect(movements).toEqual([
      ['-25', '200'],
      ['-5', '220'],
    ]);
  });
});
