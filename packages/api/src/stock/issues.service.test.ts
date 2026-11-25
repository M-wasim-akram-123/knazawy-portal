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
  branchId: 'branch-1',
};

const input = {
  locationId: 'loc-1',
  issuedOn: '2026-11-13',
  reason: 'KITCHEN_USE' as const,
  lines: [{ itemId: 'item-1', quantity: '30' }],
};

function noAlerts() {
  return {
    levels: jest.fn().mockResolvedValue(new Map()),
    notifyCrossed: jest.fn().mockResolvedValue(undefined),
  };
}

function serviceFor(tx: Record<string, unknown>, alerts = noAlerts()): IssuesService {
  const prisma = {
    ...tx,
    $transaction: (run: (client: object) => Promise<unknown>) => run(tx),
  };
  return new IssuesService(prisma as never, new AuditService(), alerts as never);
}

function baseMocks(layers: unknown[]) {
  return {
    stockLocation: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: 'loc-1', name: 'Dry store', branchId: 'branch-1' }),
    },
    item: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: 'item-1', name: 'Wheat flour', baseUnit: 'KG' }]),
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
    const alerts = noAlerts();
    const service = serviceFor(mocks, alerts);

    await expect(service.create(actor, input)).rejects.toThrow(
      new BadRequestException('Only 25 kg of Wheat flour is in Dry store.'),
    );
    expect(mocks.stockIssue.create).toHaveBeenCalled();
    expect(mocks.stockMovement.create).not.toHaveBeenCalled();
    expect(alerts.notifyCrossed).not.toHaveBeenCalled();
  });

  it('reads stock before taking it out, then checks the reorder level for the branch', async () => {
    const mocks = baseMocks([
      { id: 'old', quantityBase: new Prisma.Decimal('100'), unitCost: new Prisma.Decimal('200') },
    ]);
    const alerts = noAlerts();
    const before = new Map([['item-1', '100']]);
    alerts.levels.mockResolvedValue(before);
    const service = serviceFor(mocks, alerts);

    await service.create(actor, input);

    expect(alerts.levels).toHaveBeenCalledWith(expect.anything(), 'org-1', 'branch-1', ['item-1']);
    expect(alerts.notifyCrossed).toHaveBeenCalledWith(expect.anything(), {
      organisationId: 'org-1',
      branchId: 'branch-1',
      before,
    });
    expect(alerts.levels.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.stockLayer.updateMany.mock.invocationCallOrder[0] ?? Infinity,
    );
  });

  it('takes from the oldest layer first and records negative movements at each layer cost', async () => {
    const mocks = baseMocks([
      { id: 'old', quantityBase: new Prisma.Decimal('25'), unitCost: new Prisma.Decimal('200') },
      { id: 'new', quantityBase: new Prisma.Decimal('75'), unitCost: new Prisma.Decimal('220') },
    ]);
    const service = serviceFor(mocks);

    await service.create(actor, input);

    expect(mocks.stockIssueLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        quantityBase: new Prisma.Decimal('30'),
        cost: new Prisma.Decimal('6100'),
      }),
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
