import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';

import type { RateCardDto } from './rate-cards.dto';
import { RateCardsService } from './rate-cards.service';

const finance = {
  id: 'user-4',
  email: 'finance@karam.local',
  name: 'Finance',
  role: 'FINANCE_OFFICER' as const,
  organisationId: 'org-karam',
};

const airline = {
  id: 'user-2',
  email: 'requester@sample.local',
  name: 'Portal Requester',
  role: 'AIRLINE_REQUESTER' as const,
  organisationId: 'air-1',
};

function cardRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rc-1',
    organisationId: 'air-1',
    number: 'RC-00002',
    status: 'DRAFT',
    validFrom: new Date('2099-01-01T00:00:00.000Z'),
    validTo: null,
    note: null,
    approvedAt: null,
    organisation: { name: 'Sample Air' },
    createdBy: { name: 'Finance' },
    approvedBy: null,
    lines: [
      {
        recipeId: 'recipe-1',
        unitPrice: new Prisma.Decimal('650'),
        minimumQuantity: 20,
        recipe: { name: 'Chicken biryani', kind: 'MEAL' },
      },
    ],
    ...overrides,
  };
}

function input(overrides: Partial<RateCardDto> = {}): RateCardDto {
  return {
    airlineId: 'air-1',
    validFrom: '2099-01-01',
    lines: [{ recipeId: 'recipe-1', unitPrice: '650', minimumQuantity: 20 }],
    ...overrides,
  };
}

function organisations() {
  return {
    findFirst: jest.fn(({ where }: { where: { type: string } }) =>
      Promise.resolve(where.type === 'KARAM' ? { id: 'org-karam' } : { id: 'air-1' }),
    ),
  };
}

function serviceFor(tx: Record<string, unknown>): RateCardsService {
  const prisma = {
    ...tx,
    $transaction: (run: (client: object) => Promise<unknown>) => run(tx),
  };
  return new RateCardsService(prisma as never, new AuditService());
}

describe('RateCardsService', () => {
  it('refuses an airline user creating a card', async () => {
    const service = serviceFor({});
    await expect(service.create(airline, input())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('shows an airline only its own approved cards', async () => {
    const mocks = { rateCard: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = serviceFor(mocks);
    await service.list(airline, 'air-2');
    expect(mocks.rateCard.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organisationId: 'air-1', status: 'APPROVED' } }),
    );
  });

  it('refuses a price with more than 2 decimal places', async () => {
    const service = serviceFor({ organisation: organisations() });
    await expect(
      service.create(
        finance,
        input({ lines: [{ recipeId: 'recipe-1', unitPrice: '12.345', minimumQuantity: 0 }] }),
      ),
    ).rejects.toThrow('Enter each price in PKR, such as 650 or 650.50.');
  });

  it('refuses an end date before the start date', async () => {
    const service = serviceFor({ organisation: organisations() });
    await expect(
      service.create(finance, input({ validFrom: '2099-02-01', validTo: '2099-01-31' })),
    ).rejects.toThrow('The end date must be on or after the start date.');
  });

  it('opens a draft card numbered from the restaurant sequence', async () => {
    const mocks = {
      organisation: organisations(),
      recipe: { findMany: jest.fn().mockResolvedValue([{ id: 'recipe-1' }]) },
      documentSequence: { upsert: jest.fn().mockResolvedValue({ lastNumber: 2 }) },
      rateCard: {
        create: jest.fn().mockResolvedValue({ id: 'rc-1' }),
        findUnique: jest.fn().mockResolvedValue(cardRow()),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = serviceFor(mocks);
    const card = await service.create(finance, input());
    expect(mocks.rateCard.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organisationId: 'air-1', number: 'RC-00002' }),
      }),
    );
    expect(card.lines[0]?.unitPrice).toBe('650.00');
  });

  it('refuses to approve a card that overlaps an approved one', async () => {
    const mocks = {
      rateCard: {
        findUnique: jest.fn().mockResolvedValue(cardRow()),
        findMany: jest
          .fn()
          .mockResolvedValue([
            { number: 'RC-00001', validFrom: new Date('2026-01-01T00:00:00.000Z'), validTo: null },
          ]),
        update: jest.fn(),
      },
    };
    const service = serviceFor(mocks);
    await expect(service.approve(finance, 'rc-1')).rejects.toThrow(
      'RC-00001 already covers some of these dates. End it first or change the dates.',
    );
    expect(mocks.rateCard.update).not.toHaveBeenCalled();
  });

  it('approves a card once the earlier one has ended', async () => {
    const mocks = {
      rateCard: {
        findUnique: jest.fn().mockResolvedValue(cardRow()),
        findMany: jest.fn().mockResolvedValue([
          {
            number: 'RC-00001',
            validFrom: new Date('2026-01-01T00:00:00.000Z'),
            validTo: new Date('2098-12-31T00:00:00.000Z'),
          },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = serviceFor(mocks);
    await service.approve(finance, 'rc-1');
    expect(mocks.rateCard.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'APPROVED', approvedById: 'user-4' }),
      }),
    );
  });

  it('will not end a card in the past', async () => {
    const mocks = {
      rateCard: {
        findUnique: jest
          .fn()
          .mockResolvedValue(
            cardRow({ status: 'APPROVED', validFrom: new Date('2000-01-01T00:00:00.000Z') }),
          ),
      },
    };
    const service = serviceFor(mocks);
    await expect(service.end(finance, 'rc-1', { validTo: '2000-06-30' })).rejects.toThrow(
      'Pick an end date from today on. Past days keep their prices.',
    );
  });

  it('keeps an approved card unchanged', async () => {
    const mocks = {
      rateCard: { findUnique: jest.fn().mockResolvedValue(cardRow({ status: 'APPROVED' })) },
    };
    const service = serviceFor(mocks);
    await expect(service.update(finance, 'rc-1', input())).rejects.toThrow(
      'Only a draft rate card can be changed.',
    );
  });
});
