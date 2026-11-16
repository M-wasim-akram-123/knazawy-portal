import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';

import { LedgerService } from './ledger.service';

const finance = {
  id: 'user-4',
  email: 'finance@karam.local',
  name: 'Finance',
  role: 'FINANCE_OFFICER' as const,
  organisationId: 'org-karam',
};

const airline = {
  id: 'user-5',
  email: 'finance@sample.local',
  name: 'Airline Finance',
  role: 'AIRLINE_FINANCE' as const,
  organisationId: 'air-1',
};

function serviceFor(tx: Record<string, unknown>): LedgerService {
  const prisma = {
    ...tx,
    $transaction: (run: (client: object) => Promise<unknown>) => run(tx),
  };
  return new LedgerService(prisma as never, new AuditService());
}

const balanced = [
  { account: '1100', side: 'DEBIT' as const, amount: '13000.00' },
  { account: '4000', side: 'CREDIT' as const, amount: '13000.00' },
];

describe('LedgerService', () => {
  it('refuses operations', async () => {
    const service = serviceFor({});
    await expect(service.list({ ...finance, role: 'OPERATIONS_MANAGER' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('shows an airline only its own entries', async () => {
    const mocks = { journalEntry: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = serviceFor(mocks);
    await service.list(airline);
    expect(mocks.journalEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organisationId: 'air-1' } }),
    );
  });

  it('posts a balanced entry once', async () => {
    const mocks = {
      journalEntry: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'je-1' }),
      },
      documentSequence: { upsert: jest.fn().mockResolvedValue({ lastNumber: 1 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = serviceFor(mocks);
    await service.post(mocks as never, finance, {
      organisationId: 'air-1',
      karamOrganisationId: 'org-karam',
      sourceId: 'in-1',
      memo: 'Invoice IN-00001',
      lines: balanced,
    });
    expect(mocks.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ number: 'JE-00001', sourceId: 'in-1' }),
      }),
    );
  });

  it('will not post the same document twice', async () => {
    const mocks = {
      journalEntry: {
        findUnique: jest.fn().mockResolvedValue({ number: 'JE-00001' }),
        create: jest.fn(),
      },
    };
    const service = serviceFor(mocks);
    await expect(
      service.post(mocks as never, finance, {
        organisationId: 'air-1',
        karamOrganisationId: 'org-karam',
        sourceId: 'in-1',
        memo: 'Invoice IN-00001',
        lines: balanced,
      }),
    ).rejects.toThrow('JE-00001 already posts this document.');
    expect(mocks.journalEntry.create).not.toHaveBeenCalled();
  });

  it('refuses an entry that does not balance', async () => {
    const service = serviceFor({});
    await expect(
      service.post({} as never, finance, {
        organisationId: 'air-1',
        karamOrganisationId: 'org-karam',
        sourceId: 'in-1',
        memo: 'Invoice IN-00001',
        lines: [{ account: '1100', side: 'DEBIT', amount: '10.00' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
