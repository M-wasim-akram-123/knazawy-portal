import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';

import { DeliveriesService } from './deliveries.service';

const operations = {
  id: 'user-3',
  email: 'ops@karam.local',
  name: 'Operations',
  role: 'OPERATIONS_MANAGER' as const,
  organisationId: 'org-karam',
};

const airline = {
  id: 'user-2',
  email: 'requester@sample.local',
  name: 'Portal Requester',
  role: 'AIRLINE_REQUESTER' as const,
  organisationId: 'air-1',
};

function deliveryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dn-1',
    organisationId: 'air-1',
    requestId: 'rq-1',
    number: 'DN-00001',
    vehicleNote: null,
    receivedBy: null,
    note: null,
    dispatchedAt: null,
    deliveredAt: null,
    organisation: { name: 'Sample Air' },
    request: {
      number: 'RQ-00001',
      status: 'IN_PRODUCTION',
      flightNumber: 'PK301',
      route: 'KHI-DXB',
      serviceDate: new Date('2026-12-01T00:00:00.000Z'),
      deliveryPoint: 'GATE',
    },
    lines: [
      {
        id: 'line-1',
        recipeId: 'recipe-1',
        ordered: 10,
        dispatched: null,
        delivered: null,
        recipe: { name: 'Chicken biryani', kind: 'MEAL' },
      },
    ],
    ...overrides,
  };
}

function serviceFor(tx: Record<string, unknown>): DeliveriesService {
  // Row locks (SELECT ... FOR UPDATE) are a database concern; the mock just records them.
  tx.$executeRaw ??= jest.fn().mockResolvedValue(1);
  const prisma = {
    ...tx,
    $transaction: (run: (client: object) => Promise<unknown>) => run(tx),
  };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  return new DeliveriesService(prisma as never, new AuditService(), notifications as never);
}

describe('DeliveriesService', () => {
  it('refuses the head chef', async () => {
    const service = serviceFor({});
    await expect(
      service.start({ ...operations, role: 'HEAD_CHEF' }, { requestId: 'rq-1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('shows an airline only its own deliveries', async () => {
    const mocks = { delivery: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = serviceFor(mocks);
    await service.list(airline);
    expect(mocks.delivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organisationId: 'air-1' } }),
    );
  });

  it('starts a delivery only for an accepted request and numbers it', async () => {
    const mocks = {
      organisation: { findFirst: jest.fn().mockResolvedValue({ id: 'org-karam' }) },
      documentSequence: { upsert: jest.fn().mockResolvedValue({ lastNumber: 1 }) },
      serviceRequest: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'rq-1',
          organisationId: 'air-1',
          status: 'ACCEPTED',
          lines: [{ recipeId: 'recipe-1', quantity: 10 }],
          delivery: null,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      delivery: {
        create: jest.fn().mockResolvedValue({ id: 'dn-1' }),
        findUnique: jest.fn().mockResolvedValue(deliveryRow()),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = serviceFor(mocks);
    const delivery = await service.start(operations, { requestId: 'rq-1' });
    expect(mocks.delivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ number: 'DN-00001', requestId: 'rq-1' }),
      }),
    );
    expect(mocks.serviceRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'IN_PRODUCTION' } }),
    );
    expect(delivery.lines[0]?.ordered).toBe(10);
    expect(delivery.status).toBe('IN_PRODUCTION');
  });

  it('will not start a delivery for a request that is still submitted', async () => {
    const mocks = {
      serviceRequest: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'rq-1',
          status: 'SUBMITTED',
          lines: [{ recipeId: 'recipe-1', quantity: 10 }],
          delivery: null,
        }),
      },
    };
    const service = serviceFor(mocks);
    await expect(service.start(operations, { requestId: 'rq-1' })).rejects.toThrow(
      'Only an accepted request can go into production.',
    );
  });

  it('refuses to send more than was ordered', async () => {
    const mocks = { delivery: { findUnique: jest.fn().mockResolvedValue(deliveryRow()) } };
    const service = serviceFor(mocks);
    await expect(
      service.dispatch(operations, 'dn-1', {
        lines: [{ recipeId: 'recipe-1', quantity: 11 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sends the delivery and moves the request on', async () => {
    const mocks = {
      delivery: {
        findUnique: jest.fn().mockResolvedValue(deliveryRow()),
        update: jest.fn().mockResolvedValue({}),
      },
      deliveryLine: { update: jest.fn().mockResolvedValue({}) },
      serviceRequest: { update: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = serviceFor(mocks);
    await service.dispatch(operations, 'dn-1', {
      vehicleNote: 'Van 2',
      lines: [{ recipeId: 'recipe-1', quantity: 8 }],
    });
    expect(mocks.deliveryLine.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { dispatched: 8 } }),
    );
    expect(mocks.serviceRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'DISPATCHED' } }),
    );
  });

  it('asks why when nothing arrived', async () => {
    const mocks = {
      delivery: {
        findUnique: jest.fn().mockResolvedValue(
          deliveryRow({
            request: { ...deliveryRow().request, status: 'DISPATCHED' },
            lines: [{ ...deliveryRow().lines[0], dispatched: 8 }],
          }),
        ),
      },
    };
    const service = serviceFor(mocks);
    await expect(
      service.deliver(operations, 'dn-1', { lines: [{ recipeId: 'recipe-1', quantity: 0 }] }),
    ).rejects.toThrow('Say why nothing arrived.');
  });

  it('records what arrived and will not record more than was sent', async () => {
    const sent = deliveryRow({
      request: { ...deliveryRow().request, status: 'DISPATCHED' },
      lines: [{ ...deliveryRow().lines[0], dispatched: 8 }],
    });
    const mocks = {
      delivery: {
        findUnique: jest.fn().mockResolvedValue(sent),
        update: jest.fn().mockResolvedValue({}),
      },
      deliveryLine: { update: jest.fn().mockResolvedValue({}) },
      serviceRequest: { update: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = serviceFor(mocks);
    await expect(
      service.deliver(operations, 'dn-1', { lines: [{ recipeId: 'recipe-1', quantity: 9 }] }),
    ).rejects.toThrow('Record no more than was sent.');
    await service.deliver(operations, 'dn-1', {
      receivedBy: 'Gate staff',
      lines: [{ recipeId: 'recipe-1', quantity: 8 }],
    });
    expect(mocks.serviceRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'DELIVERED' } }),
    );
  });
});
