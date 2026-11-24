import { todayInKarachi } from '@knazawy/shared';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';

import type { ServiceRequestDto } from './requests.dto';
import { RequestsService } from './requests.service';

const airline = {
  id: 'user-2',
  email: 'requester@sample.local',
  name: 'Ayesha Khan',
  role: 'AIRLINE_REQUESTER' as const,
  organisationId: 'air-1',
};

const operations = {
  id: 'user-3',
  email: 'ops@karam.local',
  name: 'Operations',
  role: 'OPERATIONS_MANAGER' as const,
  organisationId: 'org-karam',
};

function requestRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rq-1',
    organisationId: 'air-1',
    number: 'RQ-00001',
    status: 'DRAFT',
    flightNumber: 'PK301',
    route: 'KHI-DXB',
    serviceDate: new Date('2099-01-01T00:00:00.000Z'),
    deliveryTime: '11:30',
    deliveryPoint: 'GATE',
    deliveryDetail: null,
    adults: 120,
    children: 10,
    infants: 2,
    crew: 8,
    specialDiets: 5,
    specialDietNote: null,
    note: null,
    decisionNote: null,
    submittedAt: null,
    decidedAt: null,
    createdBy: { name: 'Ayesha Khan' },
    organisation: { name: 'Sample Air' },
    amendments: [],
    lines: [
      { recipeId: 'recipe-1', quantity: 10, recipe: { name: 'Chicken biryani', kind: 'MEAL' } },
    ],
    ...overrides,
  };
}

function input(overrides: Partial<ServiceRequestDto> = {}): ServiceRequestDto {
  return {
    flightNumber: 'pk301',
    route: 'KHI-DXB',
    serviceDate: '2099-01-01',
    deliveryTime: '11:30',
    deliveryPoint: 'GATE',
    adults: 120,
    children: 10,
    infants: 2,
    crew: 8,
    specialDiets: 5,
    lines: [{ recipeId: 'recipe-1', quantity: 10 }],
    ...overrides,
  };
}

function serviceFor(tx: Record<string, unknown>): RequestsService {
  // Row locks (SELECT ... FOR UPDATE) are a database concern; the mock just records them.
  tx.$executeRaw ??= jest.fn().mockResolvedValue(1);
  const prisma = {
    ...tx,
    $transaction: (run: (client: object) => Promise<unknown>) => run(tx),
  };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const ledger = { postFromDocument: jest.fn().mockResolvedValue(undefined) };
  return new RequestsService(
    prisma as never,
    new AuditService(),
    notifications as never,
    ledger as never,
  );
}

function karamSequence() {
  return {
    organisation: { findFirst: jest.fn().mockResolvedValue({ id: 'org-karam' }) },
    documentSequence: {
      upsert: jest.fn().mockResolvedValue({ lastNumber: 1 }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
  };
}

describe('RequestsService', () => {
  it('refuses an operations manager creating a request', async () => {
    const service = serviceFor({});
    await expect(service.create(operations, input())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('opens a draft for the airline and numbers it from the restaurant sequence', async () => {
    const mocks = {
      ...karamSequence(),
      recipe: { findMany: jest.fn().mockResolvedValue([{ id: 'recipe-1' }]) },
      serviceRequest: {
        create: jest.fn().mockResolvedValue({ id: 'rq-1' }),
        findUnique: jest.fn().mockResolvedValue(requestRow()),
      },
      serviceRequestLine: {},
    };
    const service = serviceFor(mocks);
    const created = await service.create(airline, input());

    expect(mocks.documentSequence.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organisationId_kind: { organisationId: 'org-karam', kind: 'SERVICE_REQUEST' } },
      }),
    );
    expect(mocks.serviceRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organisationId: 'air-1',
          number: 'RQ-00001',
          createdById: 'user-2',
          flightNumber: 'PK301',
          specialDietNote: null,
        }),
      }),
    );
    expect(created.airlineName).toBe('Sample Air');
    expect(created.passengers.specialDiets).toBe(5);
    expect(created.lines[0]?.recipeName).toBe('Chicken biryani');
  });

  it('refuses a service date that has already passed', async () => {
    const mocks = { ...karamSequence(), recipe: { findMany: jest.fn() } };
    const service = serviceFor(mocks);
    await expect(service.create(airline, input({ serviceDate: '2000-01-01' }))).rejects.toThrow(
      'Pick a service date from today on.',
    );
    expect(mocks.documentSequence.upsert).not.toHaveBeenCalled();
  });

  it('refuses more special diets than passengers', async () => {
    const service = serviceFor(karamSequence());
    await expect(
      service.create(
        airline,
        input({ adults: 1, children: 0, infants: 0, crew: 0, specialDiets: 2 }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a menu item that is not approved and active', async () => {
    const mocks = {
      ...karamSequence(),
      recipe: { findMany: jest.fn().mockResolvedValue([]) },
      serviceRequest: { create: jest.fn() },
    };
    const service = serviceFor(mocks);
    await expect(service.create(airline, input())).rejects.toThrow(
      'One of the menu items is not available. Choose it again.',
    );
    expect(mocks.serviceRequest.create).not.toHaveBeenCalled();
  });

  it('will not send a draft with no menu items', async () => {
    const mocks = {
      serviceRequest: {
        findUnique: jest.fn().mockResolvedValue(requestRow({ lines: [] })),
      },
    };
    const service = serviceFor(mocks);
    await expect(service.submit(airline, 'rq-1')).rejects.toThrow(
      'Add a menu item before you send the request.',
    );
  });

  it('sends a draft to Karam as submitted', async () => {
    const mocks = {
      ...karamSequence(),
      recipe: { findMany: jest.fn().mockResolvedValue([{ id: 'recipe-1' }]) },
      serviceRequest: {
        findUnique: jest.fn().mockResolvedValue(requestRow()),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = serviceFor(mocks);
    await service.submit(airline, 'rq-1');
    expect(mocks.serviceRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rq-1' },
        data: expect.objectContaining({ status: 'SUBMITTED' }),
      }),
    );
  });

  it('keeps one airline out of another airline request', async () => {
    const mocks = {
      serviceRequest: {
        findUnique: jest.fn().mockResolvedValue(requestRow({ organisationId: 'air-2' })),
      },
    };
    const service = serviceFor(mocks);
    await expect(service.cancel(airline, 'rq-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses to accept a request that is still a draft', async () => {
    const mocks = {
      serviceRequest: {
        findUnique: jest.fn().mockResolvedValue(requestRow({ status: 'DRAFT' })),
      },
    };
    const service = serviceFor(mocks);
    await expect(service.accept(operations, 'rq-1')).rejects.toThrow(
      'Only a submitted request can be accepted.',
    );
  });

  it('needs a reason before a request is rejected', async () => {
    const mocks = { serviceRequest: { findUnique: jest.fn() } };
    const service = serviceFor(mocks);
    await expect(service.reject(operations, 'rq-1', { reason: '  ' })).rejects.toThrow(
      'Give a reason for rejecting this request.',
    );
    expect(mocks.serviceRequest.findUnique).not.toHaveBeenCalled();
  });

  it('accepts a submitted request and records who decided', async () => {
    const mocks = {
      serviceRequest: {
        findUnique: jest.fn().mockResolvedValue(requestRow({ status: 'SUBMITTED' })),
        update: jest.fn().mockResolvedValue({}),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      organisation: { findFirst: jest.fn().mockResolvedValue({ id: 'org-karam' }) },
    };
    const service = serviceFor(mocks);
    await service.accept(operations, 'rq-1');
    expect(mocks.serviceRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACCEPTED', decidedById: 'user-3' }),
      }),
    );
  });

  it('rejects a submitted request and keeps the reason', async () => {
    const mocks = {
      serviceRequest: {
        findUnique: jest.fn().mockResolvedValue(requestRow({ status: 'SUBMITTED' })),
        update: jest.fn().mockResolvedValue({}),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      organisation: { findFirst: jest.fn().mockResolvedValue({ id: 'org-karam' }) },
    };
    const service = serviceFor(mocks);
    await service.reject(operations, 'rq-1', { reason: '  Aircraft swapped  ' });
    expect(mocks.serviceRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'REJECTED',
          decisionNote: 'Aircraft swapped',
        }),
      }),
    );
  });

  it('shows an airline only its own requests and Karam every sent request', async () => {
    const mocks = { serviceRequest: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = serviceFor(mocks);

    await service.list(airline);
    expect(mocks.serviceRequest.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { organisationId: 'air-1' } }),
    );

    await service.list(operations);
    expect(mocks.serviceRequest.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { status: { not: 'DRAFT' } } }),
    );
  });

  it('will not send a request inside the 24-hour cut-off', async () => {
    const mocks = {
      serviceRequest: {
        findUnique: jest.fn().mockResolvedValue(
          requestRow({
            serviceDate: new Date(`${todayInKarachi()}T00:00:00.000Z`),
            deliveryTime: '00:00',
          }),
        ),
      },
    };
    const service = serviceFor(mocks);
    await expect(service.submit(airline, 'rq-1')).rejects.toThrow(
      'Send the request at least 24 hours before delivery.',
    );
  });

  it('stops an airline changing a request after the cut-off', async () => {
    const mocks = {
      serviceRequest: {
        findUnique: jest.fn().mockResolvedValue(
          requestRow({
            status: 'SUBMITTED',
            serviceDate: new Date('2020-01-01T00:00:00.000Z'),
          }),
        ),
      },
    };
    const service = serviceFor(mocks);
    await expect(
      service.amend(airline, 'rq-1', { ...input(), reason: 'Add more meals' }),
    ).rejects.toThrow('The cut-off has passed. Ask Karam to change this request.');
  });

  it('lets operations change a request after the cut-off and keeps the reason', async () => {
    const mocks = {
      ...karamSequence(),
      recipe: { findMany: jest.fn().mockResolvedValue([{ id: 'recipe-1' }]) },
      serviceRequest: {
        findUnique: jest.fn().mockResolvedValue(
          requestRow({
            status: 'ACCEPTED',
            serviceDate: new Date('2020-01-01T00:00:00.000Z'),
          }),
        ),
        update: jest.fn().mockResolvedValue({}),
      },
      serviceRequestLine: {
        deleteMany: jest.fn().mockResolvedValue({}),
        createMany: jest.fn().mockResolvedValue({}),
      },
      requestAmendment: { create: jest.fn().mockResolvedValue({ id: 'am-1' }) },
    };
    const service = serviceFor(mocks);
    await service.amend(operations, 'rq-1', { ...input(), reason: 'Aircraft swapped' });
    expect(mocks.requestAmendment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ number: 'AM-00001', reason: 'Aircraft swapped' }),
      }),
    );
  });

  it('asks the airline to confirm a cancellation charge after the cut-off', async () => {
    const mocks = {
      serviceRequest: {
        findUnique: jest.fn().mockResolvedValue(
          requestRow({
            status: 'ACCEPTED',
            serviceDate: new Date('2020-01-01T00:00:00.000Z'),
          }),
        ),
      },
      rateCard: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'rc-1',
          lines: [
            {
              recipeId: 'recipe-1',
              unitPrice: { toFixed: () => '650.00' },
              minimumQuantity: 20,
            },
          ],
        }),
      },
      invoice: { create: jest.fn() },
    };
    const service = serviceFor(mocks);
    await expect(service.cancel(airline, 'rq-1')).rejects.toThrow(
      'Cancelling now costs 13000.00 SAR. Confirm the charge.',
    );
    expect(mocks.invoice.create).not.toHaveBeenCalled();
  });

  it('bills the cancellation when the airline confirms the charge', async () => {
    const mocks = {
      ...karamSequence(),
      serviceRequest: {
        findUnique: jest.fn().mockResolvedValue(
          requestRow({
            status: 'ACCEPTED',
            serviceDate: new Date('2020-01-01T00:00:00.000Z'),
          }),
        ),
        update: jest.fn().mockResolvedValue({}),
      },
      rateCard: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'rc-1',
          lines: [
            {
              recipeId: 'recipe-1',
              unitPrice: { toFixed: () => '650.00' },
              minimumQuantity: 20,
            },
          ],
        }),
      },
      invoice: { create: jest.fn().mockResolvedValue({ id: 'in-1' }) },
    };
    const service = serviceFor(mocks);
    await service.cancel(airline, 'rq-1', { acceptCharge: true });
    expect(mocks.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: 'CANCELLATION',
          status: 'ISSUED',
          number: 'IN-00001',
        }),
      }),
    );
    expect(mocks.serviceRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CANCELLED' }),
      }),
    );
  });
});

describe('stock check for a request', () => {
  function stockTx() {
    return {
      organisation: { findFirst: jest.fn().mockResolvedValue({ id: 'org-karam' }) },
      serviceRequest: {
        findUnique: jest.fn().mockResolvedValue(requestRow({ status: 'SUBMITTED' })),
      },
      serviceRequestLine: {
        findMany: jest.fn().mockResolvedValue([{ recipeId: 'recipe-1', quantity: 4 }]),
      },
      recipe: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'recipe-1',
            name: 'Chicken biryani',
            kind: 'MEAL',
            wastagePercent: { toString: () => '0.00' },
            lines: [
              {
                itemId: 'rice',
                quantityPerPortion: { toString: () => '0.150' },
                item: { name: 'Rice', baseUnit: 'KG' },
              },
            ],
          },
        ]),
      },
      stockLayer: {
        groupBy: jest
          .fn()
          .mockResolvedValue([{ itemId: 'rice', _sum: { quantityBase: { toString: () => '2' } } }]),
      },
    };
  }

  it('holds back stock for other accepted requests, then says how short this one is', async () => {
    const tx = stockTx();
    const result = await serviceFor(tx).fulfilment(operations, 'rq-1');
    expect(tx.serviceRequestLine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { request: { status: 'ACCEPTED', id: { not: 'rq-1' } } },
      }),
    );
    // 2 kg on hand, 0.6 kg promised, 1.5 kg needed for 10 portions.
    expect(result.ingredients[0]).toMatchObject({ free: '1.4', short: '0.1' });
    expect(result.lines[0]).toMatchObject({ quantity: 10, canMake: 9 });
    expect(result.canFulfil).toBe(false);
  });

  it('never shows stock to an airline', async () => {
    await expect(serviceFor(stockTx()).fulfilment(airline, 'rq-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
