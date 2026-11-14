import { ForbiddenException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';

import { PurchasesService } from './purchases.service';

const actor = {
  id: 'user-1',
  email: 'desk@airline.local',
  name: 'Airline desk',
  role: 'AIRLINE_REQUESTER' as const,
  organisationId: 'airline-1',
};

describe('PurchasesService', () => {
  it('keeps an airline off the purchase list', async () => {
    const service = new PurchasesService({} as never, new AuditService());
    await expect(service.list(actor)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lists purchases for the branch the user is working in', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new PurchasesService({ purchase: { findMany } } as never, new AuditService());
    await service.list({
      ...actor,
      role: 'STOREKEEPER',
      organisationId: 'org-1',
      branchId: 'branch-1',
    });
    expect(findMany.mock.calls[0][0].where).toMatchObject({
      organisationId: 'org-1',
      branchId: 'branch-1',
    });
  });
});
