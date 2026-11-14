import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';

import { BranchesService } from './branches.service';

const admin = {
  id: 'user-1',
  email: 'admin@karam.local',
  name: 'Administrator',
  role: 'ADMINISTRATOR' as const,
  organisationId: 'org-karam',
  branchId: 'branch-main',
};

function serviceFor(tx: Record<string, unknown>): BranchesService {
  const prisma = {
    ...tx,
    $transaction: (run: (client: object) => Promise<unknown>) => run(tx),
  };
  return new BranchesService(prisma as never, new AuditService());
}

describe('BranchesService', () => {
  it('refuses operations viewing branches', async () => {
    const service = serviceFor({});
    await expect(service.list({ ...admin, role: 'OPERATIONS_MANAGER' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses a code with a symbol', async () => {
    const service = serviceFor({});
    await expect(service.create(admin, { code: 'KHI-1', name: 'Karachi' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('stores the code in capitals', async () => {
    const create = jest
      .fn()
      .mockResolvedValue({ id: 'b-2', code: 'LHE', name: 'Lahore', active: true });
    const service = serviceFor({ branch: { create }, auditLog: { create: jest.fn() } });
    const created = await service.create(admin, { code: ' lhe ', name: ' Lahore ' });
    expect(create.mock.calls[0][0].data).toMatchObject({ code: 'LHE', name: 'Lahore' });
    expect(created.code).toBe('LHE');
  });

  it('refuses closing the last open branch', async () => {
    const tx = {
      branch: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'b-1', code: 'MAIN', name: 'Main', active: true }),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const service = serviceFor(tx);
    await expect(service.update(admin, 'b-1', { active: false })).rejects.toThrow(
      'Keep at least one branch open.',
    );
  });

  it('refuses an airline changing branch', async () => {
    const service = serviceFor({});
    await expect(
      service.use({ ...admin, role: 'AIRLINE_REQUESTER', branchId: null }, 'b-2'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('moves a Karam user onto an open branch', async () => {
    const update = jest.fn().mockResolvedValue({});
    const service = serviceFor({
      branch: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'b-2', code: 'LHE', name: 'Lahore', active: true }),
      },
      user: { update },
    });
    const used = await service.use(admin, 'b-2');
    expect(update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { branchId: 'b-2' } });
    expect(used.name).toBe('Lahore');
  });

  it('refuses a closed or unknown branch', async () => {
    const service = serviceFor({ branch: { findFirst: jest.fn().mockResolvedValue(null) } });
    await expect(service.use(admin, 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('closes a branch while another stays open', async () => {
    const update = jest
      .fn()
      .mockResolvedValue({ id: 'b-1', code: 'LHE', name: 'Lahore', active: false });
    const tx = {
      branch: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'b-1', code: 'LHE', name: 'Lahore', active: true }),
        count: jest.fn().mockResolvedValue(1),
        update,
      },
      auditLog: { create: jest.fn() },
    };
    const service = serviceFor(tx);
    const closed = await service.update(admin, 'b-1', { active: false });
    expect(update.mock.calls[0][0].data).toEqual({ name: 'Lahore', active: false });
    expect(closed.active).toBe(false);
  });
});
