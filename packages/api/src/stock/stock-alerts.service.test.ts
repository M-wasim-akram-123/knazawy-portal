import { Prisma } from '@prisma/client';

import { StockAlertsService } from './stock-alerts.service';

const flour = {
  id: 'item-1',
  name: 'Wheat flour',
  baseUnit: 'KG' as const,
  reorderLevel: new Prisma.Decimal('10'),
};

function setup(options: { after?: string | null; items?: unknown[] } = {}) {
  const { after = '4', items = [flour] } = options;
  const tx = {
    stockLayer: {
      groupBy: jest
        .fn()
        .mockResolvedValue(
          after === null
            ? []
            : [{ itemId: 'item-1', _sum: { quantityBase: new Prisma.Decimal(after) } }],
        ),
    },
    item: { findMany: jest.fn().mockResolvedValue(items) },
    branch: { findUnique: jest.fn().mockResolvedValue({ name: 'Karam Restaurant' }) },
  };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const service = new StockAlertsService(notifications as never);
  return { tx, notifications, service };
}

const crossing = (before: string) => ({
  organisationId: 'org-1',
  branchId: 'branch-1',
  before: new Map([['item-1', before]]),
});

describe('StockAlertsService', () => {
  it('tells the administrator and head chef when an item falls through its reorder level', async () => {
    const { tx, notifications, service } = setup({ after: '4' });

    await service.notifyCrossed(tx as never, crossing('25'));

    expect(notifications.notify).toHaveBeenCalledTimes(2);
    const roles = notifications.notify.mock.calls.map(
      (call: [unknown, { role: string }]) => call[1].role,
    );
    expect(roles).toEqual(['ADMINISTRATOR', 'HEAD_CHEF']);
    expect(notifications.notify).toHaveBeenCalledWith(tx, {
      organisationId: 'org-1',
      role: 'HEAD_CHEF',
      branchId: 'branch-1',
      title: 'Wheat flour is running low',
      body: '4 kg left at Karam Restaurant. Restock at or below 10 kg.',
      entity: 'Item',
      entityId: 'item-1',
    });
  });

  it('says none is left when an item runs out from above the level', async () => {
    const { tx, notifications, service } = setup({ after: null });

    await service.notifyCrossed(tx as never, crossing('25'));

    expect(notifications.notify).toHaveBeenCalledTimes(2);
    const body = notifications.notify.mock.calls[0]?.[1].body as string;
    expect(body).toBe('0 kg left at Karam Restaurant. Restock at or below 10 kg.');
  });

  it('stays quiet while the item was already low, so nobody is told twice', async () => {
    const { tx, notifications, service } = setup({ after: '2' });

    await service.notifyCrossed(tx as never, crossing('6'));

    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('stays quiet while stock is still above the level', async () => {
    const { tx, notifications, service } = setup({ after: '15' });

    await service.notifyCrossed(tx as never, crossing('25'));

    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('ignores an item with no reorder level set', async () => {
    const { tx, notifications, service } = setup({ after: '0', items: [] });

    await service.notifyCrossed(tx as never, crossing('25'));

    expect(tx.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ reorderLevel: { gt: 0 }, active: true }),
      }),
    );
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('reads nothing when no item was involved', async () => {
    const { tx, notifications, service } = setup();

    await service.notifyCrossed(tx as never, {
      organisationId: 'org-1',
      branchId: 'branch-1',
      before: new Map(),
    });

    expect(tx.stockLayer.groupBy).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('counts stock in the one branch only, and reads zero for an item with no layers', async () => {
    const { tx, service } = setup({ after: null });

    const levels = await service.levels(tx as never, 'org-1', 'branch-1', ['item-1', 'item-1']);

    expect(levels).toEqual(new Map([['item-1', '0']]));
    expect(tx.stockLayer.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: 'org-1',
          location: { branchId: 'branch-1' },
          itemId: { in: ['item-1'] },
        }),
      }),
    );
  });
});
