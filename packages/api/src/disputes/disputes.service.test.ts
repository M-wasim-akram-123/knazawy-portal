import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';

import { DisputesService } from './disputes.service';

const airlineFinance = {
  id: 'user-4',
  email: 'finance@sample.local',
  name: 'Airline Finance',
  role: 'AIRLINE_FINANCE' as const,
  organisationId: 'air-1',
};

const finance = {
  id: 'user-5',
  email: 'finance@karam.local',
  name: 'Karam Finance',
  role: 'FINANCE_OFFICER' as const,
  organisationId: 'org-karam',
};

function serviceFor(tx: Record<string, unknown>): DisputesService {
  const prisma = {
    ...tx,
    $transaction: (run: (client: object) => Promise<unknown>) => run(tx),
  };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  return new DisputesService(prisma as never, new AuditService(), notifications as never);
}

describe('DisputesService', () => {
  it('refuses an operations manager opening a dispute', async () => {
    const service = serviceFor({});
    await expect(
      service.open(
        { ...finance, role: 'OPERATIONS_MANAGER' },
        { invoiceId: 'in-1', reason: 'Portions were short' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('opens one dispute on an issued invoice', async () => {
    const mocks = {
      organisation: { findFirst: jest.fn().mockResolvedValue({ id: 'org-karam' }) },
      documentSequence: { upsert: jest.fn().mockResolvedValue({ lastNumber: 1 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      invoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'in-1',
          number: 'IN-00001',
          organisationId: 'air-1',
          kind: 'INVOICE',
          status: 'ISSUED',
          dispute: null,
        }),
      },
      dispute: {
        create: jest.fn().mockResolvedValue({ id: 'dp-1' }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'dp-1',
          number: 'DP-00001',
          status: 'OPEN',
          organisationId: 'air-1',
          organisation: { name: 'Sample Air' },
          invoiceId: 'in-1',
          invoice: { number: 'IN-00001', lines: [{ amount: { toFixed: () => '13000.00' } }] },
          reason: 'Portions were short',
          resolution: null,
          openedBy: { name: 'Airline Finance' },
          decidedBy: null,
          decidedAt: null,
          createdAt: new Date('2026-12-01T00:00:00.000Z'),
        }),
      },
    };
    const service = serviceFor(mocks);
    const opened = await service.open(airlineFinance, {
      invoiceId: 'in-1',
      reason: 'Portions were short',
    });
    expect(opened.number).toBe('DP-00001');
    expect(mocks.dispute.create).toHaveBeenCalled();
  });

  it('will not open a second dispute on the same invoice', async () => {
    const mocks = {
      organisation: { findFirst: jest.fn().mockResolvedValue({ id: 'org-karam' }) },
      invoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'in-1',
          number: 'IN-00001',
          organisationId: 'air-1',
          kind: 'INVOICE',
          status: 'ISSUED',
          dispute: { number: 'DP-00001' },
        }),
      },
    };
    const service = serviceFor(mocks);
    await expect(
      service.open(airlineFinance, { invoiceId: 'in-1', reason: 'Still short' }),
    ).rejects.toThrow('DP-00001 already covers this invoice.');
  });

  it('accepts an open dispute without changing the invoice', async () => {
    const mocks = {
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      dispute: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'dp-1',
            number: 'DP-00001',
            status: 'OPEN',
            organisationId: 'air-1',
            invoice: { number: 'IN-00001' },
          })
          .mockResolvedValueOnce({
            id: 'dp-1',
            number: 'DP-00001',
            status: 'ACCEPTED',
            organisationId: 'air-1',
            organisation: { name: 'Sample Air' },
            invoiceId: 'in-1',
            invoice: { number: 'IN-00001', lines: [{ amount: { toFixed: () => '13000.00' } }] },
            reason: 'Portions were short',
            resolution: 'A credit note will follow',
            openedBy: { name: 'Airline Finance' },
            decidedBy: { name: 'Karam Finance' },
            decidedAt: new Date('2026-12-02T00:00:00.000Z'),
            createdAt: new Date('2026-12-01T00:00:00.000Z'),
          }),
        update: jest.fn().mockResolvedValue({}),
      },
      invoice: { update: jest.fn() },
    };
    const service = serviceFor(mocks);
    const decided = await service.accept(finance, 'dp-1', {
      resolution: 'A credit note will follow',
    });
    expect(decided.status).toBe('ACCEPTED');
    expect(mocks.invoice.update).not.toHaveBeenCalled();
  });

  it('opens one dispute on a room bill and refuses a second', async () => {
    const mocks = {
      organisation: { findFirst: jest.fn().mockResolvedValue({ id: 'org-karam' }) },
      documentSequence: { upsert: jest.fn().mockResolvedValue({ lastNumber: 4 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      roomInvoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ri-1',
          number: 'IN-00004',
          organisationId: 'air-1',
          kind: 'INVOICE',
          dispute: null,
        }),
      },
      dispute: {
        create: jest.fn().mockResolvedValue({ id: 'dp-4' }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'dp-4',
          number: 'DP-00004',
          status: 'OPEN',
          organisationId: 'air-1',
          organisation: { name: 'Sample Air' },
          invoiceId: null,
          invoice: null,
          roomInvoiceId: 'ri-1',
          roomInvoice: { number: 'IN-00004', lines: [{ amount: { toFixed: () => '17000.00' } }] },
          reason: 'The stay was billed twice',
          resolution: null,
          openedBy: { name: 'Airline Finance' },
          decidedBy: null,
          decidedAt: null,
          createdAt: new Date('2026-12-01T00:00:00.000Z'),
        }),
      },
    };
    const service = serviceFor(mocks);
    const opened = await service.open(airlineFinance, {
      roomInvoiceId: 'ri-1',
      reason: 'The stay was billed twice',
    });
    expect(opened.source).toBe('ROOM_INVOICE');
    expect(opened.invoiceNumber).toBe('IN-00004');
    expect(opened.invoiceTotal).toBe('17000.00');
    expect(mocks.dispute.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ invoiceId: null, roomInvoiceId: 'ri-1' }),
      }),
    );

    mocks.roomInvoice.findUnique.mockResolvedValue({
      id: 'ri-1',
      number: 'IN-00004',
      organisationId: 'air-1',
      kind: 'INVOICE',
      dispute: { number: 'DP-00004' },
    });
    await expect(
      service.open(airlineFinance, { roomInvoiceId: 'ri-1', reason: 'Still wrong' }),
    ).rejects.toThrow('DP-00004 already covers this room bill.');
  });

  it('needs a reason before a dispute can be rejected', async () => {
    const service = serviceFor({});
    await expect(service.reject(finance, 'dp-1', { resolution: '  ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
