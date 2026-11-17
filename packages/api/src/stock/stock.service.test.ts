import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { StockService } from './stock.service';

const storekeeper = {
  id: 'user-5',
  email: 'store@karam.local',
  name: 'Store',
  role: 'STOREKEEPER' as const,
  organisationId: 'org-karam',
  branchId: 'branch-1',
};

describe('low stock', () => {
  it('lists items at or below their reorder level in this branch, including none left', async () => {
    const prisma = {
      item: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'rice', name: 'Rice', baseUnit: 'KG', reorderLevel: new Prisma.Decimal('10') },
          { id: 'oil', name: 'Oil', baseUnit: 'LITRE', reorderLevel: new Prisma.Decimal('5') },
          { id: 'salt', name: 'Salt', baseUnit: 'KG', reorderLevel: new Prisma.Decimal('1') },
        ]),
      },
      stockLayer: {
        groupBy: jest.fn().mockResolvedValue([
          { itemId: 'rice', _sum: { quantityBase: new Prisma.Decimal('8.5') } },
          { itemId: 'salt', _sum: { quantityBase: new Prisma.Decimal('3') } },
        ]),
      },
    };
    const rows = await new StockService(prisma as never).lowStock(storekeeper as never);

    expect(rows.map((row) => [row.itemName, row.onHand])).toEqual([
      ['Rice', '8.5'],
      ['Oil', '0'],
    ]);
    expect(prisma.stockLayer.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ location: { branchId: 'branch-1' } }),
      }),
    );
  });

  it('refuses a role without stock access', async () => {
    await expect(
      new StockService({} as never).lowStock({
        ...storekeeper,
        role: 'AIRLINE_REQUESTER',
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
