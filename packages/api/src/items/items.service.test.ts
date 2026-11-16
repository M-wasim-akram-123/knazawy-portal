import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';

import { ItemsService } from './items.service';

const actor = {
  id: 'user-1',
  email: 'admin@karam.local',
  name: 'Karam Administrator',
  role: 'ADMINISTRATOR' as const,
  organisationId: 'org-1',
};

describe('ItemsService', () => {
  it('blocks an airline from the item list', async () => {
    const service = new ItemsService({} as never, new AuditService());
    await expect(
      service.list({ ...actor, role: 'AIRLINE_REQUESTER' }, false),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('turns a duplicate code into a plain message', async () => {
    const tx = {
      item: { create: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    tx.item.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: '5.22.0',
      }),
    );
    const prisma = {
      supplier: { findMany: jest.fn() },
      $transaction: jest.fn((run: (client: typeof tx) => Promise<unknown>) => run(tx)),
    };
    const service = new ItemsService(prisma as never, new AuditService());

    await expect(
      service.create(actor, {
        code: 'RICE',
        name: 'Rice',
        category: 'Dry goods',
        baseUnit: 'KG',
        purchaseUnit: 'bag',
        conversionToBase: '25',
        reorderLevel: '10',
        shelfLifeDays: 180,
        storageType: 'DRY',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
