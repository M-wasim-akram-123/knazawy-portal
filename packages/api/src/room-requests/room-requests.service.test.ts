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
  branchId: 'branch-main',
};

const submitted = {
  id: 'rr-1',
  organisationId: 'org-pia',
  branchId: 'branch-main',
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
  branch: { name: 'Main' },
  createdBy: { name: 'Requester' },
  lines: [
    {
      id: 'line-1',
      roomTypeId: 'type-1',
      quantity: 2,
      nightlyQuoted: null,
      stays: [],
      reservations: [],
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
  guestsMale: 1,
  guestsFemale: 1,
  guestsChildren: 0,
  checkOutTime: '12:00',
  hotelRoom: { name: '101', floor: { name: 'Ground' } },
};

/** A room as the database returns it with its guests and the rooms set aside on it. */
function roomRow(over: Record<string, unknown> = {}) {
  return {
    id: 'room-101',
    name: '101',
    roomTypeId: 'type-1',
    capacity: 2,
    floor: { name: 'Ground', sortOrder: 0 },
    roomType: { name: 'Single' },
    stays: [],
    reservations: [],
    ...over,
  };
}

/** The request lines as check-in and reserving count them. */
function lineCounts(stays = 0, reservations = 0) {
  return [
    {
      id: 'line-1',
      roomTypeId: 'type-1',
      quantity: 2,
      roomType: { name: 'Single' },
      _count: { stays, reservations },
    },
  ];
}

/** Another stay's room set aside on these nights, as it is stored on the room. */
function setAside(over: Record<string, unknown> = {}) {
  return {
    id: 'res-other',
    requestLine: {
      requestId: 'rr-other',
      request: {
        number: 'RR-00009',
        checkIn: new Date('2026-12-21T00:00:00.000Z'),
        checkOut: new Date('2026-12-24T00:00:00.000Z'),
      },
    },
    ...over,
  };
}

const guestsInRoom = { male: 1, female: 1, children: 0 };

function serviceFor(tx: Record<string, unknown>): RoomRequestsService {
  // Row locks (SELECT ... FOR UPDATE) are a database concern; the mock just records them.
  tx.$executeRaw ??= jest.fn().mockResolvedValue(1);
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
        branchId: 'branch-main',
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
      service.checkIn(operations, 'rr-1', {
        rooms: [{ hotelRoomId: 'room-101', ...guestsInRoom }],
      }),
    ).rejects.toThrow('Check-in opens on the first night of the stay.');
  });

  /** The mocks every check-in and reserve test needs, with the room list and request line counts. */
  function stayMocks(rooms: unknown[], counts = lineCounts(), request: unknown = accepted) {
    return {
      roomRequest: { findFirst: jest.fn().mockResolvedValue(request) },
      organisation: { findFirst: jest.fn().mockResolvedValue({ id: 'org-karam' }) },
      $queryRaw: jest.fn().mockResolvedValue([]),
      hotelRoom: { findMany: jest.fn().mockResolvedValue(rooms) },
      roomRequestLine: { findMany: jest.fn().mockResolvedValue(counts) },
      roomStay: { create: jest.fn().mockResolvedValue({ id: 'stay-1' }) },
      roomReservation: {
        create: jest.fn().mockResolvedValue({ id: 'res-1' }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
  }

  it('refuses a room that already has a guest', async () => {
    setClockDuringStay();
    const mocks = stayMocks([roomRow({ stays: [{ id: 'other-stay' }] })]);
    const service = serviceFor(mocks);
    await expect(
      service.checkIn(operations, 'rr-1', {
        rooms: [{ hotelRoomId: 'room-101', ...guestsInRoom }],
      }),
    ).rejects.toThrow('Room 101 already has a guest.');
  });

  it('refuses a room of a type this stay does not need', async () => {
    setClockDuringStay();
    const mocks = stayMocks([
      roomRow({ id: 'room-201', name: '201', roomTypeId: 'type-2', roomType: { name: 'Double' } }),
    ]);
    const service = serviceFor(mocks);
    await expect(
      service.checkIn(operations, 'rr-1', {
        rooms: [{ hotelRoomId: 'room-201', ...guestsInRoom }],
      }),
    ).rejects.toThrow('Room 201 is not one of the room types on this stay.');
  });

  it('refuses more guests than the room sleeps, and a room with no guests', async () => {
    setClockDuringStay();
    const service = serviceFor(stayMocks([roomRow({ capacity: 1 })]));
    await expect(
      service.checkIn(operations, 'rr-1', {
        rooms: [{ hotelRoomId: 'room-101', male: 1, female: 1, children: 0 }],
      }),
    ).rejects.toThrow('Room 101: This room sleeps 1 guest.');
    await expect(
      service.checkIn(operations, 'rr-1', {
        rooms: [{ hotelRoomId: 'room-101', male: 0, female: 0, children: 0 }],
      }),
    ).rejects.toThrow('Room 101: Enter at least one guest for each room.');
  });

  it('refuses a check-out time that is not a time', async () => {
    setClockDuringStay();
    const service = serviceFor(stayMocks([roomRow()]));
    await expect(
      service.checkIn(operations, 'rr-1', {
        rooms: [{ hotelRoomId: 'room-101', ...guestsInRoom, checkOutTime: '25:99' }],
      }),
    ).rejects.toThrow('Enter the check-out time as HH:MM');
  });

  it('refuses a room that is set aside for another stay on these nights', async () => {
    setClockDuringStay();
    const service = serviceFor(stayMocks([roomRow({ reservations: [setAside()] })]));
    await expect(
      service.checkIn(operations, 'rr-1', {
        rooms: [{ hotelRoomId: 'room-101', ...guestsInRoom }],
      }),
    ).rejects.toThrow(
      'Room 101 is set aside 21/12/2026 to 24/12/2026 (RR-00009). Pick another room.',
    );
  });

  it('allows a room that is set aside for a later stay that starts after check-out', async () => {
    setClockDuringStay();
    const later = setAside({
      requestLine: {
        requestId: 'rr-other',
        request: {
          number: 'RR-00010',
          checkIn: new Date('2026-12-22T00:00:00.000Z'),
          checkOut: new Date('2026-12-25T00:00:00.000Z'),
        },
      },
    });
    const withStay = {
      ...accepted,
      lines: [{ ...accepted.lines[0], stays: [oneStay], reservations: [] }],
    };
    const mocks = stayMocks([roomRow({ reservations: [later] })]);
    (mocks.roomRequest as Record<string, unknown>).findUnique = jest
      .fn()
      .mockResolvedValue(withStay);
    const service = serviceFor(mocks);
    await service.checkIn(operations, 'rr-1', {
      rooms: [{ hotelRoomId: 'room-101', ...guestsInRoom }],
    });
    expect(mocks.roomStay.create).toHaveBeenCalledTimes(1);
  });

  it('checks a free room in, records who is staying and when they are due out', async () => {
    setClockDuringStay();
    const withStay = {
      ...accepted,
      lines: [{ ...accepted.lines[0], stays: [oneStay] }],
    };
    const mocks = stayMocks([roomRow()]);
    (mocks.roomRequest as Record<string, unknown>).findUnique = jest
      .fn()
      .mockResolvedValue(withStay);
    const service = serviceFor(mocks);
    const record = await service.checkIn(operations, 'rr-1', {
      rooms: [{ hotelRoomId: 'room-101', male: 1, female: 1, children: 0, checkOutTime: '14:30' }],
    });
    expect(mocks.roomStay.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organisationId: 'org-karam',
        requestLineId: 'line-1',
        hotelRoomId: 'room-101',
        checkedInById: 'user-ops',
        guestsMale: 1,
        guestsFemale: 1,
        guestsChildren: 0,
        checkOutTime: '14:30',
      }),
    });
    // Moving in uses up the room that was set aside for this stay.
    expect(mocks.roomReservation.deleteMany).toHaveBeenCalledWith({
      where: { requestLineId: 'line-1', hotelRoomId: 'room-101' },
    });
    expect(record.lines[0]?.checkedIn).toBe(1);
    expect(record.stays).toHaveLength(1);
    expect(record.stays[0]?.roomName).toBe('101');
    expect(record.stays[0]?.guests).toEqual({ male: 1, female: 1, children: 0 });
    expect(record.stays[0]?.plannedCheckOutAt).toBe('2026-12-22T07:00:00.000Z');
  });

  it('defaults the check-out time to noon', async () => {
    setClockDuringStay();
    const mocks = stayMocks([roomRow()]);
    (mocks.roomRequest as Record<string, unknown>).findUnique = jest
      .fn()
      .mockResolvedValue(accepted);
    const service = serviceFor(mocks);
    await service.checkIn(operations, 'rr-1', {
      rooms: [{ hotelRoomId: 'room-101', ...guestsInRoom }],
    });
    expect(mocks.roomStay.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ checkOutTime: '12:00' }),
    });
  });

  describe('setting rooms aside ahead of arrival', () => {
    /** 20/12/2026 in Karachi, a day before the stay starts. */
    function setClockBeforeStay(): void {
      jest.useFakeTimers().setSystemTime(new Date('2026-12-19T05:00:00.000Z'));
    }

    it('sets a free room aside for the stay', async () => {
      setClockBeforeStay();
      const mocks = stayMocks([roomRow()]);
      (mocks.roomRequest as Record<string, unknown>).findUnique = jest
        .fn()
        .mockResolvedValue(accepted);
      const service = serviceFor(mocks);
      await service.reserve(operations, 'rr-1', { hotelRoomIds: ['room-101'] });
      expect(mocks.roomReservation.create).toHaveBeenCalledWith({
        data: {
          organisationId: 'org-karam',
          requestLineId: 'line-1',
          hotelRoomId: 'room-101',
          createdById: 'user-ops',
        },
      });
    });

    it('refuses a room already taken on any of those nights', async () => {
      setClockBeforeStay();
      const service = serviceFor(stayMocks([roomRow({ reservations: [setAside()] })]));
      await expect(
        service.reserve(operations, 'rr-1', { hotelRoomIds: ['room-101'] }),
      ).rejects.toThrow('Room 101 is already taken 21/12/2026 to 24/12/2026 (RR-00009).');
    });

    it('refuses a room with a guest who stays into those nights', async () => {
      setClockBeforeStay();
      const guest = {
        id: 'busy',
        checkedInAt: new Date('2026-12-18T05:00:00.000Z'),
        requestLine: {
          request: {
            number: 'RR-00007',
            checkIn: new Date('2026-12-18T00:00:00.000Z'),
            checkOut: new Date('2026-12-21T00:00:00.000Z'),
          },
        },
      };
      const service = serviceFor(stayMocks([roomRow({ stays: [guest] })]));
      await expect(
        service.reserve(operations, 'rr-1', { hotelRoomIds: ['room-101'] }),
      ).rejects.toThrow('Room 101 is already taken 18/12/2026 to 21/12/2026 (RR-00007).');
    });

    it('lets a room that is free by check-out morning be set aside', async () => {
      setClockBeforeStay();
      const leavingMorning = {
        id: 'busy',
        checkedInAt: new Date('2026-12-18T05:00:00.000Z'),
        requestLine: {
          request: {
            number: 'RR-00007',
            checkIn: new Date('2026-12-18T00:00:00.000Z'),
            checkOut: new Date('2026-12-20T00:00:00.000Z'),
          },
        },
      };
      const mocks = stayMocks([roomRow({ stays: [leavingMorning] })]);
      (mocks.roomRequest as Record<string, unknown>).findUnique = jest
        .fn()
        .mockResolvedValue(accepted);
      const service = serviceFor(mocks);
      await service.reserve(operations, 'rr-1', { hotelRoomIds: ['room-101'] });
      expect(mocks.roomReservation.create).toHaveBeenCalledTimes(1);
    });

    it('refuses a room already set aside for this stay, and more rooms than were asked for', async () => {
      setClockBeforeStay();
      const mine = setAside({
        id: 'res-mine',
        requestLine: { requestId: 'rr-1', request: setAside().requestLine.request },
      });
      const service = serviceFor(stayMocks([roomRow({ reservations: [mine] })]));
      await expect(
        service.reserve(operations, 'rr-1', { hotelRoomIds: ['room-101'] }),
      ).rejects.toThrow('Room 101 is already set aside for this stay.');

      const full = serviceFor(stayMocks([roomRow()], lineCounts(0, 2)));
      await expect(
        full.reserve(operations, 'rr-1', { hotelRoomIds: ['room-101'] }),
      ).rejects.toThrow('All the Single rooms on this stay already have a room or a guest.');
    });

    it('refuses a request that has not been accepted', async () => {
      setClockBeforeStay();
      const service = serviceFor(stayMocks([roomRow()], lineCounts(), submitted));
      await expect(
        service.reserve(operations, 'rr-1', { hotelRoomIds: ['room-101'] }),
      ).rejects.toThrow('Only an accepted request can have rooms set aside.');
    });

    it('refuses an airline setting rooms aside', async () => {
      const service = serviceFor({});
      await expect(
        service.reserve(requester, 'rr-1', { hotelRoomIds: ['room-101'] }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('frees a room that was set aside', async () => {
      setClockBeforeStay();
      const withReservation = {
        ...accepted,
        lines: [
          {
            ...accepted.lines[0],
            reservations: [
              {
                id: 'res-1',
                hotelRoomId: 'room-101',
                hotelRoom: { name: '101', capacity: 2, floor: { name: 'Ground' } },
              },
            ],
          },
        ],
      };
      const mocks = stayMocks([], lineCounts(), withReservation);
      (mocks.roomRequest as Record<string, unknown>).findUnique = jest
        .fn()
        .mockResolvedValue(accepted);
      const service = serviceFor(mocks);
      const record = await service.release(operations, 'rr-1', 'res-1');
      expect(mocks.roomReservation.deleteMany).toHaveBeenCalledWith({ where: { id: 'res-1' } });
      expect(record.reservations).toEqual([]);
      await expect(service.release(operations, 'rr-1', 'nope')).rejects.toThrow(
        'That room was not found on this stay.',
      );
    });

    it('lists the rooms that are free for the stay, marking the ones already set aside', async () => {
      setClockBeforeStay();
      const mine = setAside({
        id: 'res-mine',
        requestLine: { requestId: 'rr-1', request: setAside().requestLine.request },
      });
      const rooms = [
        roomRow({ id: 'room-103', name: '103' }),
        roomRow({ id: 'room-102', name: '102', reservations: [setAside()] }),
        roomRow({ id: 'room-101', name: '101', reservations: [mine] }),
        roomRow({ id: 'room-110', name: '110' }),
      ];
      const service = serviceFor(stayMocks(rooms));
      const free = await service.freeRooms(operations, 'rr-1');
      expect(free.map((room) => [room.name, room.reserved])).toEqual([
        ['101', true],
        ['103', false],
        ['110', false],
      ]);
    });
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
