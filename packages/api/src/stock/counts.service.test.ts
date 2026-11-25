import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';

import { CountsService } from './counts.service';

const actor = {
  id: 'user-1',
  email: 'admin@karam.local',
  name: 'Karam Administrator',
  role: 'ADMINISTRATOR' as const,
  organisationId: 'org-1',
  branchId: 'branch-1',
};

function noAlerts() {
  return {
    levels: jest.fn().mockResolvedValue(new Map()),
    notifyCrossed: jest.fn().mockResolvedValue(undefined),
  };
}

function serviceFor(tx: Record<string, unknown>, alerts = noAlerts()): CountsService {
  const prisma = {
    ...tx,
    $transaction: (run: (client: object) => Promise<unknown>) => run(tx),
  };
  return new CountsService(prisma as never, new AuditService(), alerts as never);
}

function line(book: string, counted: string | null = null) {
  return {
    id: 'line-1',
    itemId: 'item-1',
    bookQuantity: new Prisma.Decimal(book),
    countedQuantity: counted === null ? null : new Prisma.Decimal(counted),
    varianceCost: null,
    item: { name: 'Wheat flour', baseUnit: 'KG' as const },
  };
}

function countRow(status: string, book: string, counted: string | null = null) {
  return {
    id: 'count-1',
    number: 'SC-00001',
    locationId: 'loc-1',
    location: { name: 'Dry store', branchId: 'branch-1' },
    countedOn: new Date('2026-11-13T00:00:00.000Z'),
    status,
    note: null,
    lines: [line(book, counted)],
  };
}

describe('CountsService', () => {
  it('refuses an airline user', async () => {
    const service = serviceFor({});
    await expect(
      service.create(
        { ...actor, role: 'AIRLINE_REQUESTER' },
        { locationId: 'loc-1', countedOn: '2026-11-13' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses a second count while one is still open', async () => {
    const tx = {
      stockLocation: { findFirst: jest.fn().mockResolvedValue({ id: 'loc-1', name: 'Dry store' }) },
      stockCount: { findFirst: jest.fn().mockResolvedValue({ id: 'open' }), create: jest.fn() },
    };
    const service = serviceFor(tx);
    await expect(
      service.create(actor, { locationId: 'loc-1', countedOn: '2026-11-13' }),
    ).rejects.toThrow(new BadRequestException('Dry store already has a count in progress.'));
    expect(tx.stockCount.create).not.toHaveBeenCalled();
  });

  it('refuses the storekeeper when they try to approve', async () => {
    const tx = { stockCount: { findFirst: jest.fn() } };
    const service = serviceFor(tx);
    await expect(
      service.approve({ ...actor, role: 'STOREKEEPER' }, 'count-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.stockCount.findFirst).not.toHaveBeenCalled();
  });

  it('submits the counted quantities and waits for approval', async () => {
    const tx = {
      stockCount: {
        findFirst: jest.fn().mockResolvedValue(countRow('COUNTING', '110')),
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue(countRow('WAITING', '110', '105')),
      },
      stockLayer: {
        groupBy: jest
          .fn()
          .mockResolvedValue([
            { itemId: 'item-1', _sum: { quantityBase: new Prisma.Decimal('110') } },
          ]),
      },
      stockCountLine: { update: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const service = serviceFor(tx);
    const saved = await service.submit(actor, 'count-1', {
      lines: [{ itemId: 'item-1', counted: '105' }],
    });
    expect(tx.stockCount.update).toHaveBeenCalledWith({
      where: { id: 'count-1' },
      data: { status: 'WAITING' },
    });
    expect(saved.status).toBe('WAITING');
    expect(saved.lines[0]?.countedQuantity).toBe('105');
  });

  it('refreshes the book and stays open when stock moves during the count', async () => {
    const tx = {
      stockCount: {
        findFirst: jest.fn().mockResolvedValue(countRow('COUNTING', '110')),
        update: jest.fn(),
      },
      stockLayer: {
        groupBy: jest
          .fn()
          .mockResolvedValue([
            { itemId: 'item-1', _sum: { quantityBase: new Prisma.Decimal('100') } },
          ]),
      },
      stockCountLine: { update: jest.fn().mockResolvedValue({}) },
    };
    const service = serviceFor(tx);
    await expect(
      service.submit(actor, 'count-1', { lines: [{ itemId: 'item-1', counted: '105' }] }),
    ).rejects.toThrow(
      new ConflictException(
        'Stock changed while you were counting. The sheet now shows the current quantities. Check them and submit again.',
      ),
    );
    expect(tx.stockCountLine.update).toHaveBeenCalledWith({
      where: { id: 'line-1' },
      data: {
        bookQuantity: new Prisma.Decimal('100'),
        countedQuantity: new Prisma.Decimal('105'),
      },
    });
    expect(tx.stockCount.update).not.toHaveBeenCalled();
  });

  it('posts a shortage from the oldest layer and records the cost removed', async () => {
    const tx = {
      stockCount: {
        findFirst: jest.fn().mockResolvedValue(countRow('WAITING', '30', '0')),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(countRow('POSTED', '30', '0')),
      },
      stockLayer: {
        groupBy: jest
          .fn()
          .mockResolvedValue([
            { itemId: 'item-1', _sum: { quantityBase: new Prisma.Decimal('30') } },
          ]),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'old',
            quantityBase: new Prisma.Decimal('25'),
            unitCost: new Prisma.Decimal('200'),
          },
          { id: 'new', quantityBase: new Prisma.Decimal('5'), unitCost: new Prisma.Decimal('220') },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      stockMovement: { create: jest.fn().mockResolvedValue({ id: 'move-1' }) },
      stockCountLine: { update: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const alerts = noAlerts();
    const before = new Map([['item-1', '30']]);
    alerts.levels.mockResolvedValue(before);
    const service = serviceFor(tx, alerts);
    await service.approve(actor, 'count-1');
    expect(alerts.levels).toHaveBeenCalledWith(expect.anything(), 'org-1', 'branch-1', ['item-1']);
    expect(alerts.notifyCrossed).toHaveBeenCalledWith(expect.anything(), {
      organisationId: 'org-1',
      branchId: 'branch-1',
      before,
    });
    expect(tx.stockCountLine.update).toHaveBeenCalledWith({
      where: { id: 'line-1' },
      data: { varianceCost: new Prisma.Decimal('-6100') },
    });
    const movements = tx.stockMovement.create.mock.calls.map(
      (
        call: [{ data: { quantityBase: Prisma.Decimal; unitCost: Prisma.Decimal; type: string } }],
      ) => [
        call[0].data.type,
        call[0].data.quantityBase.toString(),
        call[0].data.unitCost.toString(),
      ],
    );
    expect(movements).toEqual([
      ['COUNT', '-25', '200'],
      ['COUNT', '-5', '220'],
    ]);
  });

  it('adds extra stock at the latest cost in that location', async () => {
    const tx = {
      stockCount: {
        findFirst: jest.fn().mockResolvedValue(countRow('WAITING', '10', '15')),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(countRow('POSTED', '10', '15')),
      },
      stockLayer: {
        groupBy: jest
          .fn()
          .mockResolvedValue([
            { itemId: 'item-1', _sum: { quantityBase: new Prisma.Decimal('10') } },
          ]),
        findFirst: jest.fn().mockResolvedValue({ unitCost: new Prisma.Decimal('200') }),
        create: jest.fn().mockResolvedValue({ id: 'layer-new' }),
      },
      stockMovement: { create: jest.fn().mockResolvedValue({ id: 'move-1' }) },
      stockCountLine: { update: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const service = serviceFor(tx);
    await service.approve(actor, 'count-1');
    expect(tx.stockLayer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        quantityBase: new Prisma.Decimal('5'),
        unitCost: new Prisma.Decimal('200'),
        countLineId: 'line-1',
        locationId: 'loc-1',
      }),
    });
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'COUNT',
        quantityBase: new Prisma.Decimal('5'),
        unitCost: new Prisma.Decimal('200'),
      }),
    });
  });

  it('does not post when stock moved while the count was waiting', async () => {
    const tx = {
      stockCount: {
        findFirst: jest.fn().mockResolvedValue(countRow('WAITING', '30', '0')),
        updateMany: jest.fn(),
      },
      stockLayer: {
        groupBy: jest
          .fn()
          .mockResolvedValue([
            { itemId: 'item-1', _sum: { quantityBase: new Prisma.Decimal('20') } },
          ]),
        findMany: jest.fn(),
      },
      stockMovement: { create: jest.fn() },
    };
    const service = serviceFor(tx);
    await expect(service.approve(actor, 'count-1')).rejects.toThrow(
      new ConflictException(
        'Stock changed while this count was waiting. Send it back and count again.',
      ),
    );
    expect(tx.stockCount.updateMany).not.toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it('refuses extra stock that has never had a cost', async () => {
    const tx = {
      stockCount: {
        findFirst: jest.fn().mockResolvedValue(countRow('WAITING', '0', '2')),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      stockLayer: {
        groupBy: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      goodsReceiptLine: { findFirst: jest.fn().mockResolvedValue(null) },
      stockMovement: { create: jest.fn() },
    };
    const service = serviceFor(tx);
    await expect(service.approve(actor, 'count-1')).rejects.toThrow(
      new BadRequestException('Wheat flour has no cost yet. Receive it before you count extra in.'),
    );
    expect(tx.stockLayer.create).not.toHaveBeenCalled();
  });
});
