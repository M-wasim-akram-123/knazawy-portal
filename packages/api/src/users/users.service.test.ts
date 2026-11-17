import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';

import { UsersService } from './users.service';

const admin = {
  id: 'admin-1',
  email: 'admin@karam.local',
  name: 'Admin',
  role: 'ADMINISTRATOR' as const,
  organisationId: 'org-karam',
};

function userRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'store-1',
    organisationId: 'org-karam',
    branchId: null,
    name: 'Storekeeper',
    email: 'store@karam.local',
    role: 'STOREKEEPER',
    status: 'ACTIVE',
    passwordHash: 'x',
    lastLoginAt: null,
    passwordChangedAt: null,
    createdAt: new Date('2026-11-01T00:00:00Z'),
    updatedAt: new Date('2026-11-01T00:00:00Z'),
    organisation: { name: 'Karam', type: 'KARAM' },
    branch: null,
    ...overrides,
  };
}

function serviceFor(tx: Record<string, unknown>): UsersService {
  const prisma = { ...tx, $transaction: (run: (client: object) => Promise<unknown>) => run(tx) };
  return new UsersService(prisma as never, new AuditService());
}

describe('UsersService', () => {
  it('lets only an administrator manage accounts', async () => {
    await expect(
      serviceFor({}).list({ ...admin, role: 'OPERATIONS_MANAGER' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses a staff role on an airline account', async () => {
    const tx = {
      organisation: { findUnique: jest.fn().mockResolvedValue({ id: 'air-1', type: 'AIRLINE' }) },
    };
    await expect(
      serviceFor(tx).create(admin, {
        name: 'Sneaky',
        email: 'sneaky@air.example',
        role: 'ADMINISTRATOR',
        organisationId: 'air-1',
        password: 'long-enough-password',
      }),
    ).rejects.toThrow('Choose an airline role.');
  });

  it('will not let an administrator revoke their own account', async () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue(userRow({ id: 'admin-1', role: 'ADMINISTRATOR' })),
        count: jest.fn().mockResolvedValue(3),
      },
    };
    await expect(serviceFor(tx).setStatus(admin, 'admin-1', 'DISABLED')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('signs a person out everywhere when their password changes', async () => {
    const update = jest.fn().mockResolvedValue({});
    const tx = {
      user: { findUnique: jest.fn().mockResolvedValue(userRow()), update },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    await serviceFor(tx).setPassword(admin, 'store-1', 'a-new-long-password');
    const data = update.mock.calls[0][0].data as { passwordChangedAt: Date; passwordHash: string };
    expect(data.passwordChangedAt.getTime()).toBeGreaterThan(Date.now());
    expect(data.passwordHash).not.toBe('a-new-long-password');
  });

  it('keeps an account that has history, and says to revoke it', async () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue(userRow()),
        count: jest.fn().mockResolvedValue(2),
        delete: jest
          .fn()
          .mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError('fk', { code: 'P2003', clientVersion: '5' }),
          ),
      },
      notification: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    await expect(serviceFor(tx).remove(admin, 'store-1')).rejects.toBeInstanceOf(ConflictException);
  });
});
