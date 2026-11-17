import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';

import { AirlinesService } from './airlines.service';

const actor = {
  id: 'user-1',
  email: 'admin@karam.local',
  name: 'Karam Administrator',
  role: 'ADMINISTRATOR' as const,
  organisationId: 'org-karam',
};

function airlineRow() {
  return {
    id: 'air-1',
    code: 'PIA',
    name: 'Pakistan International Airlines',
    taxNumber: null,
    users: [
      {
        id: 'user-2',
        name: 'Ayesha Khan',
        email: 'ayesha@pia.example',
        role: 'AIRLINE_REQUESTER',
        status: 'ACTIVE',
      },
    ],
  };
}

function serviceFor(tx: Record<string, unknown>): AirlinesService {
  const prisma = {
    ...tx,
    $transaction: (run: (client: object) => Promise<unknown>) => run(tx),
  };
  return new AirlinesService(prisma as never, new AuditService());
}

describe('AirlinesService', () => {
  it('refuses the kitchen lead', async () => {
    const service = serviceFor({});
    await expect(service.list({ ...actor, role: 'KITCHEN_LEAD' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses an airline user', async () => {
    const service = serviceFor({});
    await expect(
      service.create({ ...actor, role: 'AIRLINE_REQUESTER' }, { code: 'PIA', name: 'PIA' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('opens an airline and keeps the code in capitals', async () => {
    const created = { id: 'air-1' };
    const mocks = {
      organisation: {
        create: jest.fn().mockResolvedValue(created),
        findFirst: jest.fn().mockResolvedValue(airlineRow()),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const service = serviceFor(mocks);
    const airline = await service.create(actor, {
      code: 'pia',
      name: 'Pakistan International Airlines',
    });
    expect(mocks.organisation.create).toHaveBeenCalledWith({
      data: {
        code: 'PIA',
        type: 'AIRLINE',
        name: 'Pakistan International Airlines',
        taxNumber: null,
      },
    });
    expect(airline.users[0]?.email).toBe('ayesha@pia.example');
  });

  it('refuses a Karam role on an airline user', async () => {
    const mocks = {
      organisation: { findFirst: jest.fn().mockResolvedValue(airlineRow()) },
      user: { create: jest.fn() },
    };
    const service = serviceFor(mocks);
    await expect(
      service.createUser(actor, 'air-1', {
        name: 'Store',
        email: 'store@pia.example',
        role: 'STOREKEEPER' as never,
        password: '1234',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mocks.user.create).not.toHaveBeenCalled();
  });

  it('turns a duplicate code into a plain message', async () => {
    const mocks = {
      organisation: {
        create: jest.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('duplicate', {
            code: 'P2002',
            clientVersion: '5.22.0',
          }),
        ),
      },
    };
    const service = serviceFor(mocks);
    await expect(
      service.create(actor, { code: 'PIA', name: 'Pakistan International Airlines' }),
    ).rejects.toThrow('An airline with this code already exists.');
  });
});

describe('airline terms', () => {
  const finance = { ...actor, role: 'FINANCE_OFFICER' as const };
  const airlineFinance = {
    ...actor,
    role: 'AIRLINE_FINANCE' as const,
    organisationId: 'air-1',
  };
  const termsRow = {
    id: 'air-1',
    code: 'PIA',
    name: 'Pakistan International Airlines',
    paymentTermsDays: 30,
    discountPercent: new Prisma.Decimal('0'),
  };

  it('shows an airline only its own terms', async () => {
    const mocks = { organisation: { findMany: jest.fn().mockResolvedValue([termsRow]) } };
    const [terms] = await serviceFor(mocks).terms(airlineFinance);
    expect(mocks.organisation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { type: 'AIRLINE', id: 'air-1' } }),
    );
    expect(terms).toMatchObject({ paymentTermsDays: 30, discountPercent: '0' });
  });

  it('lets finance set Net 45 and 2.5% off, and records who did it', async () => {
    const mocks = {
      organisation: {
        findFirst: jest.fn().mockResolvedValue(termsRow),
        update: jest.fn().mockResolvedValue({
          ...termsRow,
          paymentTermsDays: 45,
          discountPercent: new Prisma.Decimal('2.5'),
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const terms = await serviceFor(mocks).setTerms(finance, 'air-1', {
      paymentTermsDays: 45,
      discountPercent: '2.5',
    });
    expect(terms).toMatchObject({ paymentTermsDays: 45, discountPercent: '2.5' });
    expect(mocks.auditLog.create).toHaveBeenCalled();
  });

  it('never lets an airline change its own terms', async () => {
    await expect(
      serviceFor({}).setTerms(airlineFinance, 'air-1', {
        paymentTermsDays: 90,
        discountPercent: '50',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses a discount over 100%', async () => {
    await expect(
      serviceFor({}).setTerms(finance, 'air-1', { paymentTermsDays: 30, discountPercent: '101' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
