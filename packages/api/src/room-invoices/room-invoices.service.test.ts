import { AuditService } from '../audit/audit.service';

import { RoomInvoicesService } from './room-invoices.service';

const finance = {
  id: 'user-finance',
  email: 'finance@karam.local',
  name: 'Finance',
  role: 'FINANCE_OFFICER' as const,
  organisationId: 'org-karam',
  branchId: 'branch-main',
};

const requester = {
  id: 'user-airline',
  email: 'requester@sample.local',
  name: 'Requester',
  role: 'AIRLINE_REQUESTER' as const,
  organisationId: 'org-pia',
};

const accepted = {
  id: 'rr-1',
  organisationId: 'org-pia',
  number: 'RR-00001',
  status: 'ACCEPTED' as const,
  checkIn: new Date('2026-12-20T00:00:00.000Z'),
  checkOut: new Date('2026-12-22T00:00:00.000Z'),
  organisation: { name: 'Sample Air' },
  roomInvoices: [],
  lines: [
    {
      roomTypeId: 'type-1',
      quantity: 2,
      nightlyQuoted: { toFixed: () => '8500.00' },
      roomType: { name: 'Single' },
    },
  ],
};

const issuedBill = {
  id: 'ri-1',
  organisationId: 'org-pia',
  number: 'IN-00001',
  kind: 'INVOICE' as const,
  roomRequestId: 'rr-1',
  roomRequest: {
    number: 'RR-00001',
    checkIn: new Date('2026-12-20T00:00:00.000Z'),
    checkOut: new Date('2026-12-22T00:00:00.000Z'),
  },
  organisation: { name: 'Sample Air' },
  sourceInvoice: null,
  creditNotes: [],
  reason: null,
  issuedAt: new Date('2026-12-14T06:00:00.000Z'),
  lines: [
    {
      roomTypeName: 'Single',
      rooms: 2,
      nights: 2,
      nightly: { toFixed: () => '8500.00' },
      amount: { toFixed: () => '34000.00' },
    },
  ],
};

function serviceFor(tx: Record<string, unknown>) {
  const prisma = {
    ...tx,
    $transaction: (run: (client: object) => Promise<unknown>) => run(tx),
  };
  const ledger = { post: jest.fn().mockResolvedValue(undefined) };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const service = new RoomInvoicesService(
    prisma as never,
    new AuditService(),
    ledger as never,
    notifications as never,
  );
  return { service, ledger };
}

type Tables = Record<string, Record<string, jest.Mock>>;

function karamTables(overrides: Tables = {}): Tables {
  return {
    organisation: { findFirst: jest.fn().mockResolvedValue({ id: 'org-karam' }) },
    documentSequence: { upsert: jest.fn().mockResolvedValue({ lastNumber: 1 }) },
    auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    ...overrides,
  };
}

describe('RoomInvoicesService', () => {
  it('refuses a room bill raised by the airline', async () => {
    const { service } = serviceFor(karamTables());
    await expect(service.raise(requester, 'rr-1')).rejects.toThrow('You cannot raise a room bill.');
  });

  it('bills every booked night at the nightly price fixed on acceptance', async () => {
    const tx = karamTables({
      roomRequest: { findUnique: jest.fn().mockResolvedValue(accepted) },
      roomInvoice: {
        create: jest.fn().mockResolvedValue({ id: 'ri-1' }),
        findUnique: jest.fn().mockResolvedValue(issuedBill),
      },
    });
    const { service, ledger } = serviceFor(tx);

    const bill = await service.raise(finance, 'rr-1');

    expect(bill.number).toBe('IN-00001');
    expect(bill.total).toBe('34000.00');
    expect(bill.nights).toBe(2);
    expect(tx.roomInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: 'INVOICE',
          roomRequestId: 'rr-1',
          openRequestId: 'rr-1',
          lines: {
            create: [
              expect.objectContaining({
                roomTypeName: 'Single',
                rooms: 2,
                nights: 2,
                nightly: '8500.00',
                amount: '34000.00',
              }),
            ],
          },
        }),
      }),
    );
    expect(ledger.post).toHaveBeenCalledWith(
      expect.anything(),
      finance,
      expect.objectContaining({
        sourceId: 'ri-1',
        memo: 'Room bill IN-00001 for RR-00001',
      }),
    );
  });

  it('refuses to bill a stay that is not accepted', async () => {
    const tx = karamTables({
      roomRequest: {
        findUnique: jest.fn().mockResolvedValue({ ...accepted, status: 'SUBMITTED' }),
      },
      roomInvoice: { create: jest.fn() },
    });
    const { service } = serviceFor(tx);
    await expect(service.raise(finance, 'rr-1')).rejects.toThrow(
      'Only an accepted room stay can be billed.',
    );
    expect(tx.roomInvoice.create).not.toHaveBeenCalled();
  });

  it('refuses to bill a stay that has no fixed price', async () => {
    const tx = karamTables({
      roomRequest: {
        findUnique: jest.fn().mockResolvedValue({
          ...accepted,
          lines: [{ ...accepted.lines[0], nightlyQuoted: null }],
        }),
      },
      roomInvoice: { create: jest.fn() },
    });
    const { service } = serviceFor(tx);
    await expect(service.raise(finance, 'rr-1')).rejects.toThrow(
      'This stay has no fixed price to bill.',
    );
    expect(tx.roomInvoice.create).not.toHaveBeenCalled();
  });

  it('bills a stay once', async () => {
    const tx = karamTables({
      roomRequest: {
        findUnique: jest.fn().mockResolvedValue({ ...accepted, roomInvoices: [{ id: 'ri-0' }] }),
      },
      roomInvoice: { create: jest.fn() },
    });
    const { service } = serviceFor(tx);
    await expect(service.raise(finance, 'rr-1')).rejects.toThrow('This stay is already billed.');
    expect(tx.roomInvoice.create).not.toHaveBeenCalled();
  });

  it('credits a whole room bill once, and a credit note is never credited', async () => {
    const source = {
      id: 'ri-1',
      organisationId: 'org-pia',
      number: 'IN-00001',
      kind: 'INVOICE' as const,
      roomRequestId: 'rr-1',
      creditNotes: [],
      lines: issuedBill.lines.map((line) => ({
        roomTypeId: 'type-1',
        roomTypeName: line.roomTypeName,
        rooms: line.rooms,
        nights: line.nights,
        nightly: line.nightly,
        amount: line.amount,
      })),
    };
    const credit = {
      ...issuedBill,
      id: 'ri-2',
      number: 'CN-00001',
      kind: 'CREDIT_NOTE' as const,
      sourceInvoice: { number: 'IN-00001' },
      reason: 'Guests left early and the stay was re-priced.',
    };
    const tx = karamTables({
      roomInvoice: {
        findUnique: jest.fn().mockResolvedValueOnce(source).mockResolvedValueOnce(credit),
        create: jest.fn().mockResolvedValue({ id: 'ri-2', number: 'CN-00001' }),
        update: jest.fn().mockResolvedValue({}),
      },
    });
    const { service, ledger } = serviceFor(tx);

    const note = await service.credit(finance, 'ri-1', {
      reason: 'Guests left early and the stay was re-priced.',
    });

    expect(note.kind).toBe('CREDIT_NOTE');
    expect(note.sourceInvoiceNumber).toBe('IN-00001');
    expect(tx.roomInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: 'CREDIT_NOTE', sourceInvoiceId: 'ri-1' }),
      }),
    );
    expect(tx.roomInvoice.update).toHaveBeenCalledWith({
      where: { id: 'ri-1' },
      data: { openRequestId: null },
    });
    expect(ledger.post).toHaveBeenCalledWith(
      expect.anything(),
      finance,
      expect.objectContaining({ sourceId: 'ri-2' }),
    );

    const twice = karamTables({
      roomInvoice: {
        findUnique: jest.fn().mockResolvedValue({
          ...source,
          creditNotes: [{ id: 'ri-2' }],
        }),
        create: jest.fn(),
      },
    });
    await expect(
      serviceFor(twice).service.credit(finance, 'ri-1', { reason: 'Second attempt.' }),
    ).rejects.toThrow('This room bill is already credited.');
    expect(twice.roomInvoice.create).not.toHaveBeenCalled();

    const creditOfCredit = karamTables({
      roomInvoice: {
        findUnique: jest.fn().mockResolvedValue({ ...source, kind: 'CREDIT_NOTE' }),
        create: jest.fn(),
      },
    });
    await expect(
      serviceFor(creditOfCredit).service.credit(finance, 'ri-1', { reason: 'Not allowed.' }),
    ).rejects.toThrow('Only a room bill can be credited.');
  });
});
