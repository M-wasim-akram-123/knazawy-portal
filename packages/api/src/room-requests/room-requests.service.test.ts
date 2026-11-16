import { ForbiddenException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

import { RoomRequestsService } from './room-requests.service';

const requester = {
  id: 'user-airline',
  email: 'requester@sample.local',
  name: 'Requester',
  role: 'AIRLINE_REQUESTER' as const,
  organisationId: 'org-pia',
};

const operations = {
  id: 'user-ops',
  email: 'ops@karam.local',
  name: 'Operations',
  role: 'OPERATIONS_MANAGER' as const,
  organisationId: 'org-karam',
};

const submitted = {
  id: 'rr-1',
  organisationId: 'org-pia',
  number: 'RR-00001',
  status: 'SUBMITTED' as const,
  checkIn: new Date('2026-12-20T00:00:00.000Z'),
  checkOut: new Date('2026-12-22T00:00:00.000Z'),
  party: 'Crew',
  note: null,
  decisionNote: null,
  submittedAt: new Date('2026-12-01T00:00:00.000Z'),
  decidedAt: null,
  organisation: { name: 'Sample Air' },
  createdBy: { name: 'Requester' },
  lines: [
    {
      id: 'line-1',
      roomTypeId: 'type-1',
      quantity: 2,
      nightlyQuoted: null,
      stays: [],
      roomType: {
        name: 'Single',
        charges: [{ amountPerNight: { toFixed: () => '8500.00' }, active: true }],
      },
    },
  ],
};

const accepted = {
  ...submitted,
  status: 'ACCEPTED' as const,
  lines: [
    {
      ...submitted.lines[0],
      nightlyQuoted: { toFixed: () => '8500.00' },
    },
  ],
};

const oneStay = {
  id: 'stay-1',
  checkedInAt: new Date('2026-12-21T05:00:00.000Z'),
  checkedOutAt: null,
  hotelRoom: { name: '101', floor: { name: 'Ground' } },
};

function serviceFor(tx: Record<string, unknown>): RoomRequestsService {
  const prisma = {
    ...tx,
    $transaction: (run: (client: object) => Promise<unknown>) => run(tx),
  };
  return new RoomRequestsService(
    prisma as never,
    new AuditService(),
    new NotificationsService(prisma as never),
  );
}

/** Mid-stay: 21 December in Karachi, inside the 20 to 22 December stay. */
function setClockDuringStay(): void {
  jest.useFakeTimers().setSystemTime(new Date('2026-12-21T05:00:00.000Z'));
}

afterEach(() => {
  jest.useRealTimers();
});

describe('RoomRequestsService', () => {
  it('refuses operations asking for rooms', async () => {
    const service = serviceFor({});
    await expect(
      service.create(operations, {
        checkIn: '2026-12-20',
        checkOut: '2026-12-22',
        lines: [{ roomTypeId: 'type-1', rooms: 1 }],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses an airline accepting a request', async () => {
    const service = serviceFor({});
    await expect(service.accept(requester, 'rr-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('will not accept a stay when those nights are already taken', async () => {
    const mocks = {
      roomRequest: { findFirst: jest.fn().mockResolvedValue(submitted) },
      organisation: { findFirst: jest.fn().mockResolvedValue({ id: 'org-karam' }) },
      roomType: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'type-1', name: 'Single', _count: { rooms: 2 } }]),
      },
      hotelRoom: { count: jest.fn().mockResolvedValue(2) },
      roomRequestLine: { findMany: jest.fn().mockResolvedValue([{ quantity: 1 }]) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    const service = serviceFor(mocks);
    await expect(service.accept(operations, 'rr-1')).rejects.toThrow(
      'Only 1 Single room is free for those nights.',
    );
  });

  it('fixes the nightly price when the rooms are free', async () => {
    const mocks = {
      roomRequest: {
        findFirst: jest.fn().mockResolvedValue(submitted),
        findUnique: jest.fn().mockResolvedValue(accepted),
        update: jest.fn().mockResolvedValue({}),
      },
      organisation: { findFirst: jest.fn().mockResolvedValue({ id: 'org-karam' }) },
      roomType: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'type-1', name: 'Single', _count: { rooms: 2 } }]),
        findFirst: jest.fn().mockResolvedValue({
          id: 'type-1',
          charges: [{ amountPerNight: { toFixed: () => '8500.00' }, active: true }],
        }),
      },
      hotelRoom: { count: jest.fn().mockResolvedValue(2) },
      roomRequestLine: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = serviceFor(mocks);
    const saved = await service.accept(operations, 'rr-1');
    expect(mocks.roomRequestLine.update).toHaveBeenCalledWith({
      where: { id: 'line-1' },
      data: { nightlyQuoted: '8500.00' },
    });
    expect(mocks.roomRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACCEPTED', decidedById: 'user-ops' }),
      }),
    );
    expect(saved.total).toBe('34000.00');
    expect(saved.lines[0]?.quoted).toBe(true);
  });

  it('refuses a guest check-in before the first night', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-12-19T05:00:00.000Z'));
    const mocks = {
      roomRequest: { findFirst: jest.fn().mockResolvedValue(accepted) },
      organisation: { findFirst: jest.fn().mockResolvedValue({ id: 'org-karam' }) },
    };
    const service = serviceFor(mocks);
    await expect(
      service.checkIn(operations, 'rr-1', { hotelRoomIds: ['room-101'] }),
    ).rejects.toThrow('Check-in opens on the first night of the stay.');
  });

  it('refuses a room that already has a guest', async () => {
    setClockDuringStay();
    const mocks = {
      roomRequest: { findFirst: jest.fn().mockResolvedValue(accepted) },
      organisation: { findFirst: jest.fn().mockResolvedValue({ id: 'org-karam' }) },
      $queryRaw: jest.fn().mockResolvedValue([]),
      hotelRoom: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'room-101',
            name: '101',
            roomTypeId: 'type-1',
            roomType: { id: 'type-1', name: 'Single' },
            stays: [{ id: 'other-stay' }],
          },
        ]),
      },
    };
    const service = serviceFor(mocks);
    await expect(
      service.checkIn(operations, 'rr-1', { hotelRoomIds: ['room-101'] }),
    ).rejects.toThrow('Room 101 already has a guest.');
  });

  it('refuses a room of a type this stay does not need', async () => {
    setClockDuringStay();
    const mocks = {
      roomRequest: { findFirst: jest.fn().mockResolvedValue(accepted) },
      organisation: { findFirst: jest.fn().mockResolvedValue({ id: 'org-karam' }) },
      $queryRaw: jest.fn().mockResolvedValue([]),
      hotelRoom: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'room-201',
            name: '201',
            roomTypeId: 'type-2',
            roomType: { id: 'type-2', name: 'Double' },
            stays: [],
          },
        ]),
      },
    };
    const service = serviceFor(mocks);
    await expect(
      service.checkIn(operations, 'rr-1', { hotelRoomIds: ['room-201'] }),
    ).rejects.toThrow('Room 201 is not one of the room types on this stay.');
  });

  it('checks a free room in, records the stay, and shows Karam the room', async () => {
    setClockDuringStay();
    const withStay = {
      ...accepted,
      lines: [{ ...accepted.lines[0], stays: [oneStay] }],
    };
    const mocks = {
      roomRequest: {
        findFirst: jest.fn().mockResolvedValue(accepted),
        findUnique: jest.fn().mockResolvedValue(withStay),
      },
      organisation: { findFirst: jest.fn().mockResolvedValue({ id: 'org-karam' }) },
      $queryRaw: jest.fn().mockResolvedValue([]),
      hotelRoom: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'room-101',
            name: '101',
            roomTypeId: 'type-1',
            roomType: { id: 'type-1', name: 'Single' },
            stays: [],
          },
        ]),
      },
      roomStay: { create: jest.fn().mockResolvedValue({ id: 'stay-1' }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = serviceFor(mocks);
    const record = await service.checkIn(operations, 'rr-1', { hotelRoomIds: ['room-101'] });
    expect(mocks.roomStay.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organisationId: 'org-karam',
        requestLineId: 'line-1',
        hotelRoomId: 'room-101',
        checkedInById: 'user-ops',
      }),
    });
    expect(record.lines[0]?.checkedIn).toBe(1);
    expect(record.stays).toHaveLength(1);
    expect(record.stays[0]?.roomName).toBe('101');
  });

  it('checks a guest out once, and refuses a second check-out', async () => {
    setClockDuringStay();
    const withStay = {
      ...accepted,
      lines: [{ ...accepted.lines[0], stays: [oneStay] }],
    };
    const mocks = {
      roomRequest: {
        findFirst: jest.fn().mockResolvedValue(withStay),
        findUnique: jest.fn().mockResolvedValue(withStay),
      },
      roomStay: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = serviceFor(mocks);
    await service.checkOut(operations, 'rr-1', 'stay-1');
    expect(mocks.roomStay.updateMany).toHaveBeenCalledWith({
      where: { id: 'stay-1', checkedOutAt: null },
      data: expect.objectContaining({ checkedOutById: 'user-ops' }),
    });

    const gone = {
      ...accepted,
      lines: [{ ...accepted.lines[0], stays: [{ ...oneStay, checkedOutAt: new Date() }] }],
    };
    const second = serviceFor({
      roomRequest: { findFirst: jest.fn().mockResolvedValue(gone) },
    });
    await expect(second.checkOut(operations, 'rr-1', 'stay-1')).rejects.toThrow(
      'This room has already been checked out.',
    );
  });
});
