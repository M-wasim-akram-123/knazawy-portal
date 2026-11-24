import {
  addDays,
  boardDaysError,
  bookingSpan,
  buildRoomBoard,
  clockFraction,
  checkOutTimeError,
  dayRange,
  daysBetween,
  guestCountsError,
  guestTotal,
  karachiClock,
  karachiDay,
  openStayHold,
  plannedCheckOutAt,
  roomCapacityError,
  roomIsFreeFor,
  roomStateTone,
  type BoardInput,
} from './room-board';

// 25/11/2026 13:00 in Karachi.
const NOW = new Date('2026-11-25T08:00:00.000Z');

const ROOMS = [
  { floor: 'f1', order: 0, name: '101', type: 'single', typeName: 'Single', capacity: 1 },
  { floor: 'f1', order: 0, name: '102', type: 'double', typeName: 'Double', capacity: 2 },
  { floor: 'f1', order: 0, name: '103', type: 'double', typeName: 'Double', capacity: 2 },
  { floor: 'f1', order: 0, name: '104', type: 'double', typeName: 'Double', capacity: 3 },
  { floor: 'f1', order: 0, name: '105', type: 'single', typeName: 'Single', capacity: 1 },
].map((room) => ({
  id: `room-${room.name}`,
  name: room.name,
  floorId: room.floor,
  floorName: 'Ground',
  floorOrder: room.order,
  roomTypeId: room.type,
  roomTypeName: room.typeName,
  capacity: room.capacity,
}));

function board(overrides: Partial<BoardInput> = {}) {
  return buildRoomBoard({
    branchId: 'b1',
    branchName: 'Main',
    now: NOW,
    from: '2026-11-25',
    days: 7,
    rooms: ROOMS,
    stays: [],
    reservations: [],
    promises: [],
    ...overrides,
  });
}

function stay(room: string, over: Record<string, unknown> = {}) {
  return {
    id: `stay-${room}`,
    hotelRoomId: `room-${room}`,
    requestId: 'req-1',
    requestNumber: 'RM-00001',
    airlineName: 'Sample Air',
    checkOutDate: '2026-11-28',
    checkOutTime: '12:00',
    checkedInAt: '2026-11-24T06:00:00.000Z',
    checkedOutAt: null,
    guests: { male: 1, female: 1, children: 0 },
    ...over,
  };
}

describe('room dates and times', () => {
  it('works out the Karachi day and clock of an instant', () => {
    expect(karachiDay('2026-11-25T20:00:00.000Z')).toBe('2026-11-26');
    expect(karachiClock('2026-11-25T08:05:00.000Z')).toBe('13:05');
  });

  it('turns a check-out date and time into an instant', () => {
    expect(plannedCheckOutAt('2026-11-27', '12:00')).toBe('2026-11-27T07:00:00.000Z');
    expect(plannedCheckOutAt('2026-11-27', 'nonsense')).toBe('2026-11-27T07:00:00.000Z');
  });

  it('moves and counts days', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(dayRange('2026-11-29', 3)).toEqual(['2026-11-29', '2026-11-30', '2026-12-01']);
    expect(daysBetween('2026-11-25', '2026-12-02')).toBe(7);
  });

  it('accepts only the day counts the calendar can show', () => {
    expect(boardDaysError(14)).toBeNull();
    expect(boardDaysError(10)).not.toBeNull();
  });

  it('wants a 24-hour HH:MM check-out time', () => {
    expect(checkOutTimeError('12:00')).toBeNull();
    expect(checkOutTimeError('23:59')).toBeNull();
    expect(checkOutTimeError('24:00')).not.toBeNull();
    expect(checkOutTimeError('9:30')).not.toBeNull();
  });
});

describe('guests in a room', () => {
  it('needs at least one guest and no more than the room sleeps', () => {
    expect(guestCountsError({ male: 1, female: 1, children: 0 }, 2)).toBeNull();
    expect(guestCountsError({ male: 0, female: 0, children: 0 }, 2)).toMatch(/at least one/);
    expect(guestCountsError({ male: 2, female: 1, children: 0 }, 2)).toMatch(/sleeps 2 guests/);
    expect(guestCountsError({ male: 1, female: 0, children: 1 }, 1)).toMatch(/sleeps 1 guest\./);
  });

  it('refuses counts that are not whole numbers', () => {
    expect(guestCountsError({ male: -1, female: 1, children: 0 }, 2)).toMatch(/whole numbers/);
    expect(guestCountsError({ male: 1.5, female: 0, children: 0 }, 2)).toMatch(/whole numbers/);
  });

  it('adds the three counts', () => {
    expect(guestTotal({ male: 2, female: 3, children: 1 })).toBe(6);
  });

  it('keeps a room capacity between one and twenty', () => {
    expect(roomCapacityError(2)).toBeNull();
    expect(roomCapacityError(0)).not.toBeNull();
    expect(roomCapacityError(21)).not.toBeNull();
  });
});

describe('where a booking sits on the calendar', () => {
  const base = {
    requestId: 'r',
    requestNumber: 'RM-1',
    airlineName: 'Air',
    checkOutTime: '12:00',
    checkedOutAt: null,
    guests: null,
  };

  it('starts at the arrival time and ends at the check-out time', () => {
    const span = bookingSpan(
      {
        ...base,
        kind: 'STAY',
        from: '2026-11-26',
        to: '2026-11-28',
        plannedCheckOutAt: '2026-11-28T07:00:00.000Z',
        // 14:00 Karachi on the 26th.
        checkedInAt: '2026-11-26T09:00:00.000Z',
      },
      '2026-11-25',
      7,
      NOW,
    );
    expect(span?.start).toBeCloseTo(1 + 14 / 24, 5);
    expect(span?.end).toBeCloseTo(3.5, 5);
    expect(span?.cutStart).toBe(false);
  });

  it('shows a booked-ahead room arriving at 14:00', () => {
    const span = bookingSpan(
      {
        ...base,
        kind: 'RESERVED',
        from: '2026-11-27',
        to: '2026-11-29',
        plannedCheckOutAt: '2026-11-29T07:00:00.000Z',
        checkedInAt: null,
      },
      '2026-11-25',
      7,
      NOW,
    );
    expect(span?.start).toBeCloseTo(2 + 14 / 24, 5);
    expect(span?.end).toBeCloseTo(4.5, 5);
  });

  it('cuts a bar at the edges of the window and says so', () => {
    const span = bookingSpan(
      {
        ...base,
        kind: 'STAY',
        from: '2026-11-20',
        to: '2026-12-10',
        plannedCheckOutAt: '2026-12-10T07:00:00.000Z',
        checkedInAt: '2026-11-20T09:00:00.000Z',
      },
      '2026-11-25',
      7,
      NOW,
    );
    expect(span).toMatchObject({ start: 0, end: 7, cutStart: true, cutEnd: true });
  });

  it('draws nothing for a booking outside the window', () => {
    const outside = {
      ...base,
      kind: 'RESERVED' as const,
      from: '2026-12-20',
      to: '2026-12-22',
      plannedCheckOutAt: '2026-12-22T07:00:00.000Z',
      checkedInAt: null,
    };
    expect(bookingSpan(outside, '2026-11-25', 7, NOW)).toBeNull();
  });

  it('runs an overdue guest to now', () => {
    const span = bookingSpan(
      {
        ...base,
        kind: 'STAY',
        from: '2026-11-23',
        to: '2026-11-25',
        plannedCheckOutAt: '2026-11-25T07:00:00.000Z',
        checkedInAt: '2026-11-23T09:00:00.000Z',
      },
      '2026-11-25',
      7,
      NOW,
    );
    // Now is 13:00 on the first day of the window.
    expect(span?.end).toBeCloseTo(13 / 24, 5);
  });

  it('ends a finished stay when the guest actually left', () => {
    const span = bookingSpan(
      {
        ...base,
        kind: 'DONE',
        from: '2026-11-24',
        to: '2026-11-25',
        plannedCheckOutAt: '2026-11-25T05:00:00.000Z',
        checkedInAt: '2026-11-24T06:00:00.000Z',
        // 10:00 Karachi on the 25th.
        checkedOutAt: '2026-11-25T05:00:00.000Z',
      },
      '2026-11-24',
      7,
      NOW,
    );
    expect(span?.end).toBeCloseTo(1 + 10 / 24, 5);
  });

  it('reads a time of day as part of a day', () => {
    expect(clockFraction('12:00')).toBe(0.5);
    expect(clockFraction('06:00')).toBe(0.25);
    expect(clockFraction('bad')).toBe(0.5);
  });
});

describe('a guest holding a room', () => {
  it('holds the room from the Karachi day they moved in until check-out', () => {
    expect(openStayHold('2026-11-24T06:00:00.000Z', '2026-11-28', '2026-11-25')).toEqual({
      from: '2026-11-24',
      to: '2026-11-28',
    });
  });

  it('still holds tonight when the guest has overstayed', () => {
    expect(openStayHold('2026-11-22T06:00:00.000Z', '2026-11-24', '2026-11-25')).toEqual({
      from: '2026-11-22',
      to: '2026-11-26',
    });
  });

  it('holds tonight for a guest due out today, until they are checked out', () => {
    expect(openStayHold('2026-11-23T06:00:00.000Z', '2026-11-25', '2026-11-25').to).toBe(
      '2026-11-26',
    );
  });
});

describe('holding a room', () => {
  const holds = [{ from: '2026-11-27', to: '2026-11-30' }];

  it('is free on nights that share nothing with a hold', () => {
    expect(roomIsFreeFor(holds, '2026-11-25', '2026-11-27')).toBe(true);
    expect(roomIsFreeFor(holds, '2026-11-30', '2026-12-02')).toBe(true);
  });

  it('is taken when a night is shared', () => {
    expect(roomIsFreeFor(holds, '2026-11-26', '2026-11-28')).toBe(false);
    expect(roomIsFreeFor(holds, '2026-11-28', '2026-11-29')).toBe(false);
  });
});

describe('room board', () => {
  it('shows every room free on an empty board', () => {
    const empty = board();
    expect(empty.summary.rooms).toBe(5);
    expect(empty.summary.free).toBe(5);
    expect(empty.summary.occupied).toBe(0);
    expect(empty.summary.capacityTotal).toBe(9);
    expect(empty.summary.capacityFree).toBe(9);
    expect(empty.floors[0]?.rooms.map((room) => room.state)).toEqual(Array(5).fill('FREE'));
    expect(empty.days).toHaveLength(7);
  });

  it('marks an occupied room with its guests and when it is due out', () => {
    const result = board({ stays: [stay('102')] });
    const room = result.floors[0]?.rooms.find((row) => row.name === '102');
    expect(room?.state).toBe('OCCUPIED');
    expect(room?.guests).toEqual({ male: 1, female: 1, children: 0 });
    expect(room?.current?.plannedCheckOutAt).toBe('2026-11-28T07:00:00.000Z');
    expect(room?.freeFrom).toBe('2026-11-28T07:00:00.000Z');
    expect(result.summary.occupied).toBe(1);
    expect(result.summary.free).toBe(4);
  });

  it('flags a guest due out today until the check-out time passes, then overdue', () => {
    const dueToday = board({
      stays: [stay('102', { checkOutDate: '2026-11-25', checkOutTime: '18:00' })],
    });
    expect(dueToday.floors[0]?.rooms[1]?.state).toBe('DUE_OUT');
    expect(dueToday.summary.dueOut).toBe(1);
    expect(dueToday.summary.departuresToday).toBe(1);

    const late = board({
      stays: [stay('102', { checkOutDate: '2026-11-25', checkOutTime: '12:00' })],
    });
    const room = late.floors[0]?.rooms[1];
    expect(room?.state).toBe('OVERDUE');
    expect(room?.freeFrom).toBe(NOW.toISOString());
    expect(late.summary.overdue).toBe(1);
    // The bar still covers today, so the room cannot be promised to someone else tonight.
    expect(room?.current?.to).toBe('2026-11-26');
  });

  it('marks a free room that is promised ahead, and says until when it is free', () => {
    const result = board({
      reservations: [
        {
          id: 'res-1',
          hotelRoomId: 'room-103',
          requestId: 'req-2',
          requestNumber: 'RM-00002',
          airlineName: 'Other Air',
          checkInDate: '2026-11-27',
          checkOutDate: '2026-11-29',
        },
      ],
    });
    const room = result.floors[0]?.rooms.find((row) => row.name === '103');
    expect(room?.state).toBe('RESERVED');
    expect(room?.freeUntil).toBe('2026-11-27');
    expect(room?.nextBooking?.requestNumber).toBe('RM-00002');
    expect(result.summary.reserved).toBe(1);
    // Reserved is still free today.
    expect(result.summary.free).toBe(5);
  });

  it('keeps an occupied room occupied even when it is also promised later', () => {
    const result = board({
      stays: [stay('102')],
      reservations: [
        {
          id: 'res-1',
          hotelRoomId: 'room-102',
          requestId: 'req-2',
          requestNumber: 'RM-00002',
          airlineName: 'Other Air',
          checkInDate: '2026-11-29',
          checkOutDate: '2026-12-01',
        },
      ],
    });
    const room = result.floors[0]?.rooms.find((row) => row.name === '102');
    expect(room?.state).toBe('OCCUPIED');
    expect(room?.freeUntil).toBeNull();
    expect(room?.nextBooking?.from).toBe('2026-11-29');
    expect(room?.bookings.map((booking) => booking.kind)).toEqual(['STAY', 'RESERVED']);
  });

  it('adds up guests and capacity across occupied rooms', () => {
    const result = board({
      stays: [
        stay('102', { guests: { male: 1, female: 1, children: 0 } }),
        stay('104', { guests: { male: 1, female: 1, children: 1 } }),
        stay('101', { guests: { male: 1, female: 0, children: 0 } }),
      ],
    });
    expect(result.summary.guests).toEqual({ male: 3, female: 2, children: 1, total: 6 });
    expect(result.summary.occupied).toBe(3);
    expect(result.summary.capacityUsed).toBe(6);
    expect(result.summary.capacityFree).toBe(3);
  });

  it('keeps a finished stay as history without counting it as occupied', () => {
    const result = board({
      stays: [
        stay('105', {
          checkedInAt: '2026-11-23T06:00:00.000Z',
          checkedOutAt: '2026-11-25T05:00:00.000Z',
        }),
      ],
      from: '2026-11-24',
    });
    const room = result.floors[0]?.rooms.find((row) => row.name === '105');
    expect(room?.state).toBe('FREE');
    expect(room?.bookings).toHaveLength(1);
    expect(room?.bookings[0]?.kind).toBe('DONE');
    expect(result.summary.occupied).toBe(0);
  });

  it('counts rooms of each type that accepted stays promise, night by night', () => {
    const result = board({
      promises: [
        {
          roomTypeId: 'double',
          checkInDate: '2026-11-26',
          checkOutDate: '2026-11-28',
          rooms: 2,
          toCheckIn: 2,
        },
        {
          roomTypeId: 'double',
          checkInDate: '2026-11-27',
          checkOutDate: '2026-11-29',
          rooms: 1,
          toCheckIn: 1,
        },
      ],
    });
    const doubles = result.types.find((type) => type.roomTypeId === 'double');
    expect(doubles?.rooms).toBe(3);
    const free = Object.fromEntries((doubles?.days ?? []).map((day) => [day.date, day.free]));
    expect(free['2026-11-25']).toBe(3);
    expect(free['2026-11-26']).toBe(1);
    expect(free['2026-11-27']).toBe(0);
    expect(free['2026-11-28']).toBe(2);
    expect(free['2026-11-29']).toBe(3);
  });

  it('counts the rooms still to check in for stays that begin today', () => {
    const result = board({
      promises: [
        {
          roomTypeId: 'double',
          checkInDate: '2026-11-25',
          checkOutDate: '2026-11-27',
          rooms: 2,
          toCheckIn: 1,
        },
        {
          roomTypeId: 'single',
          checkInDate: '2026-11-26',
          checkOutDate: '2026-11-27',
          rooms: 4,
          toCheckIn: 4,
        },
      ],
    });
    expect(result.summary.arrivalsToday).toBe(1);
  });

  it('lists rooms in floor order and numbers in natural order', () => {
    const result = buildRoomBoard({
      branchId: 'b1',
      branchName: 'Main',
      now: NOW,
      from: '2026-11-25',
      days: 7,
      rooms: [
        { ...ROOMS[0]!, id: 'a', name: '10', floorId: 'f2', floorName: 'Second', floorOrder: 1 },
        { ...ROOMS[0]!, id: 'b', name: '9', floorId: 'f2', floorName: 'Second', floorOrder: 1 },
        { ...ROOMS[0]!, id: 'c', name: '2', floorId: 'f1', floorName: 'Ground', floorOrder: 0 },
      ],
      stays: [],
      reservations: [],
      promises: [],
    });
    expect(result.floors.map((floor) => floor.name)).toEqual(['Ground', 'Second']);
    expect(result.floors[1]?.rooms.map((room) => room.name)).toEqual(['9', '10']);
  });

  it('gives each state a tone for the screen', () => {
    expect(roomStateTone('FREE')).toBe('free');
    expect(roomStateTone('RESERVED')).toBe('reserved');
    expect(roomStateTone('OCCUPIED')).toBe('occupied');
    expect(roomStateTone('DUE_OUT')).toBe('due');
    expect(roomStateTone('OVERDUE')).toBe('overdue');
  });
});
