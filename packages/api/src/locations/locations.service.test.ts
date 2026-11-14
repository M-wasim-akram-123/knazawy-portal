import { BadRequestException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';

import { LocationsService } from './locations.service';

const actor = {
  id: 'user-1',
  email: 'store@karam.local',
  name: 'Storekeeper',
  role: 'STOREKEEPER' as const,
  organisationId: 'org-1',
  branchId: 'branch-1',
};

function serviceFor(tx: Record<string, unknown>): LocationsService {
  const prisma = {
    ...tx,
    $transaction: (run: (client: object) => Promise<unknown>) => run(tx),
  };
  return new LocationsService(prisma as never, new AuditService());
}

describe('LocationsService', () => {
  it('refuses stock work with no branch', async () => {
    const service = serviceFor({});
    await expect(service.list({ ...actor, branchId: null }, false)).rejects.toThrow(
      'Choose a branch before working with stock.',
    );
  });

  it('creates a location on the branch the user is working in', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'loc-1',
      name: 'Dry store',
      type: 'STORE',
      parentId: null,
      active: true,
    });
    const service = serviceFor({ stockLocation: { create }, auditLog: { create: jest.fn() } });
    await service.create(actor, { name: 'Dry store', type: 'STORE' });
    expect(create.mock.calls[0][0].data.branchId).toBe('branch-1');
  });

  it('lists only the current branch', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = serviceFor({ stockLocation: { findMany } });
    await service.list(actor, false);
    expect(findMany.mock.calls[0][0].where).toMatchObject({ branchId: 'branch-1', active: true });
  });

  it('rejects a parent from another branch', async () => {
    const service = serviceFor({
      stockLocation: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    await expect(
      service.create(actor, { name: 'Bin', type: 'BIN', parentId: 'other-branch-location' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
