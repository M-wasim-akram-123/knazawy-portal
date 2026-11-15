import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { LedgerService } from '../ledger/ledger.service';

import { InvoicesService } from './invoices.service';

const finance = {
  id: 'user-4',
  email: 'finance@karam.local',
  name: 'Finance',
  role: 'FINANCE_OFFICER' as const,
  organisationId: 'org-karam',
};

const operations = {
  id: 'user-3',
  email: 'ops@karam.local',
  name: 'Operations',
  role: 'OPERATIONS_MANAGER' as const,
  organisationId: 'org-karam',
};

const airlineFinance = { ...finance, role: 'AIRLINE_FINANCE' as const, organisationId: 'air-1' };

function requestRow() {
  return {
    id: 'rq-1',
    organisationId: 'air-1',
    status: 'DELIVERED',
    serviceDate: new Date('2026-12-01T00:00:00.000Z'),
    delivery: {
      lines: [
        {
          recipeId: 'recipe-1',
          delivered: 8,
          recipe: { name: 'Chicken biryani', kind: 'MEAL' },
        },
      ],
    },
  };
}

function invoiceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'in-1',
    organisationId: 'air-1',
    number: 'IN-00001',
    kind: 'INVOICE',
    status: 'DRAFT',
    requestId: 'rq-1',
    note: null,
    reason: null,
    issuedAt: null,
    organisation: { name: 'Sample Air', taxNumber: null },
    request: {
      number: 'RQ-00001',
      flightNumber: 'PK301',
      serviceDate: new Date('2026-12-01T00:00:00.000Z'),
      status: 'DELIVERED',
    },
    rateCard: { number: 'RC-00001' },
    sourceInvoice: null,
    creditNotes: [],
    lines: [
      {
        recipeId: 'recipe-1',
        recipeName: 'Chicken biryani',
        kind: 'MEAL',
        deliveredQuantity: 8,
        minimumQuantity: 20,
        billedQuantity: 20,
        unitPrice: new Prisma.Decimal('650'),
        amount: new Prisma.Decimal('13000'),
      },
    ],
    ...overrides,
  };
}

function priced() {
  return {
    organisation: { findFirst: jest.fn().mockResolvedValue({ id: 'org-karam' }) },
    serviceRequest: { findUnique: jest.fn().mockResolvedValue(requestRow()), update: jest.fn() },
    invoice: { findFirst: jest.fn().mockResolvedValue(null) },
    rateCard: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'rc-1',
        number: 'RC-00001',
        lines: [
          { recipeId: 'recipe-1', minimumQuantity: 20, unitPrice: new Prisma.Decimal('650') },
        ],
      }),
    },
    documentSequence: { upsert: jest.fn().mockResolvedValue({ lastNumber: 1 }) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
}

function serviceFor(tx: Record<string, unknown>): InvoicesService {
  const prisma = {
    ...tx,
    $transaction: (run: (client: object) => Promise<unknown>) => run(tx),
  };
  const audit = new AuditService();
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  return new InvoicesService(
    prisma as never,
    audit,
    new LedgerService(prisma as never, audit),
    notifications as never,
  );
}

describe('InvoicesService', () => {
  it('refuses operations and an airline finance user', async () => {
    const service = serviceFor({});
    await expect(service.create(operations, { requestId: 'rq-1' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.create(airlineFinance, { requestId: 'rq-1' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('lists only delivered, unbilled requests for invoice creators', async () => {
    const request = {
      id: 'rq-2',
      number: 'RQ-00002',
      flightNumber: 'PK302',
      organisation: { name: 'Sample Air' },
    };
    const mocks = {
      serviceRequest: { findMany: jest.fn().mockResolvedValue([request]) },
    };
    const service = serviceFor(mocks);
    await expect(service.billableRequests(finance)).resolves.toEqual([
      { id: 'rq-2', number: 'RQ-00002', flightNumber: 'PK302', airlineName: 'Sample Air' },
    ]);
    expect(mocks.serviceRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'DELIVERED', invoices: { none: { kind: 'INVOICE' } } },
      }),
    );
    await expect(service.billableRequests(operations)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('bills the delivered portions and at least the minimum', async () => {
    const mocks = {
      ...priced(),
      invoice: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'in-1' }),
        findUnique: jest.fn().mockResolvedValue(invoiceRow()),
      },
    };
    const service = serviceFor(mocks);
    const invoice = await service.create(finance, { requestId: 'rq-1' });
    expect(mocks.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          number: 'IN-00001',
          lines: {
            create: [expect.objectContaining({ billedQuantity: 20, amount: '13000.00' })],
          },
        }),
      }),
    );
    expect(invoice.total).toBe('13000.00');
    expect(invoice.lines[0]?.creditedQuantity).toBe(0);
  });

  it('prepares an itemized invoice for an unregistered airline without a portal user', async () => {
    const manual = invoiceRow({
      organisationId: 'one-off-1',
      requestId: null,
      request: null,
      rateCard: null,
      organisation: { name: 'Guest Air', taxNumber: 'TAX-1' },
      lines: [
        {
          recipeId: 'recipe-1',
          recipeName: 'Chicken biryani',
          kind: 'MEAL',
          deliveredQuantity: 3,
          minimumQuantity: 0,
          billedQuantity: 3,
          unitPrice: new Prisma.Decimal('700'),
          amount: new Prisma.Decimal('2100'),
        },
      ],
    });
    const mocks = {
      organisation: {
        findFirst: jest.fn().mockResolvedValue({ id: 'org-karam' }),
        create: jest.fn().mockResolvedValue({ id: 'one-off-1' }),
      },
      recipe: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'recipe-1', name: 'Chicken biryani', kind: 'MEAL' }]),
      },
      documentSequence: { upsert: jest.fn().mockResolvedValue({ lastNumber: 2 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      invoice: {
        create: jest.fn().mockResolvedValue({ id: 'in-2' }),
        findUnique: jest.fn().mockResolvedValue(manual),
      },
    };
    const service = serviceFor(mocks);
    const invoice = await service.createManual(finance, {
      airlineName: 'Guest Air',
      taxNumber: 'TAX-1',
      lines: [{ recipeId: 'recipe-1', quantity: 3, unitPrice: '700' }],
    });

    expect(mocks.organisation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'ONE_OFF_AIRLINE',
          name: 'Guest Air',
          taxNumber: 'TAX-1',
        }),
      }),
    );
    expect(mocks.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organisationId: 'one-off-1',
          lines: { create: [expect.objectContaining({ billedQuantity: 3, amount: '2100.00' })] },
        }),
      }),
    );
    expect(invoice.requestId).toBeNull();
    expect(invoice.airlineTaxNumber).toBe('TAX-1');
  });

  it('will not invoice a request that has not been delivered', async () => {
    const mocks = priced();
    mocks.serviceRequest.findUnique.mockResolvedValue({ ...requestRow(), status: 'DISPATCHED' });
    const service = serviceFor(mocks);
    await expect(service.create(finance, { requestId: 'rq-1' })).rejects.toThrow(
      'Only a delivered request can be invoiced.',
    );
  });

  it('issues a draft and marks the request invoiced', async () => {
    const mocks = {
      ...priced(),
      invoice: {
        findUnique: jest.fn().mockResolvedValue(invoiceRow()),
        update: jest.fn().mockResolvedValue({}),
      },
      invoiceLine: { deleteMany: jest.fn().mockResolvedValue({}), createMany: jest.fn() },
      journalEntry: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'je-1' }),
      },
    };
    const service = serviceFor(mocks);
    await service.issue(finance, 'in-1');
    expect(mocks.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ISSUED', issuedById: 'user-4' }),
      }),
    );
    expect(mocks.serviceRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'INVOICED' } }),
    );
  });

  it('issues a one-off invoice without changing a service request', async () => {
    const manual = invoiceRow({
      organisationId: 'one-off-1',
      requestId: null,
      request: null,
      rateCard: null,
      lines: [
        {
          recipeId: 'recipe-1',
          recipeName: 'Chicken biryani',
          kind: 'MEAL',
          deliveredQuantity: 3,
          minimumQuantity: 0,
          billedQuantity: 3,
          unitPrice: new Prisma.Decimal('700'),
          amount: new Prisma.Decimal('2100'),
        },
      ],
    });
    const mocks = {
      ...priced(),
      invoice: {
        findUnique: jest.fn().mockResolvedValue(manual),
        update: jest.fn().mockResolvedValue({}),
      },
      journalEntry: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'je-3' }),
      },
    };
    const service = serviceFor(mocks);
    await service.issue(finance, 'in-2');

    expect(mocks.serviceRequest.update).not.toHaveBeenCalled();
    expect(mocks.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organisationId: 'one-off-1' }),
      }),
    );
  });

  it('refuses a credit larger than the bill, then credits the price that was charged', async () => {
    const issued = invoiceRow({ status: 'ISSUED' });
    const mocks = {
      ...priced(),
      invoice: {
        findUnique: jest.fn().mockResolvedValue(issued),
        create: jest.fn().mockResolvedValue({ id: 'cn-1' }),
      },
      journalEntry: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'je-2' }),
      },
    };
    const service = serviceFor(mocks);
    await expect(
      service.credit(finance, 'in-1', {
        reason: 'Short on the day',
        lines: [{ recipeId: 'recipe-1', quantity: 21 }],
      }),
    ).rejects.toThrow('Credit no more than was billed.');
    await service.credit(finance, 'in-1', {
      reason: 'Short on the day',
      lines: [{ recipeId: 'recipe-1', quantity: 2 }],
    });
    expect(mocks.documentSequence.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organisationId_kind: { organisationId: 'org-karam', kind: 'CREDIT_NOTE' } },
      }),
    );
    expect(mocks.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          number: 'CN-00001',
          kind: 'CREDIT_NOTE',
          status: 'ISSUED',
          lines: { create: [expect.objectContaining({ billedQuantity: 2, amount: '1300.00' })] },
        }),
      }),
    );
  });

  it('shows an airline only its issued invoices', async () => {
    const mocks = { invoice: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = serviceFor(mocks);
    await service.list({ ...airlineFinance, role: 'AIRLINE_REQUESTER' });
    expect(mocks.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organisationId: 'air-1', status: 'ISSUED' } }),
    );
  });
});
