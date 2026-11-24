import { todayInKarachi } from './dates';
import { staysOverlap } from './rooms';

/**
 * The room board answers three questions for Karam staff: which rooms are taken now, who is in
 * them and until when, and which rooms are promised ahead. Everything here is plain arithmetic
 * on rows the API fetched, so the same numbers can be tested without a database.
 */

/** Hotel check-out is at noon unless staff set another time when the guest moves in. */
export const STANDARD_CHECK_OUT_TIME = '12:00';

/** A room sleeps two guests unless the administrator says otherwise. */
export const DEFAULT_ROOM_CAPACITY = 2;
export const MAX_ROOM_CAPACITY = 20;

/** How many days the calendar can show at once. */
export const BOARD_DAY_CHOICES = [7, 14, 30] as const;
export const DEFAULT_BOARD_DAYS = 14;

/** Asia/Karachi has no daylight saving, so noon is always +05:00. */
const KARACHI_OFFSET = '+05:00';

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface GuestCounts {
  male: number;
  female: number;
  children: number;
}

export function guestTotal(guests: GuestCounts): number {
  return guests.male + guests.female + guests.children;
}

export function noGuests(): GuestCounts {
  return { male: 0, female: 0, children: 0 };
}

export function roomCapacityError(capacity: number): string | null {
  if (!Number.isInteger(capacity) || capacity < 1) return 'A room sleeps at least one guest.';
  if (capacity > MAX_ROOM_CAPACITY) return `A room sleeps at most ${MAX_ROOM_CAPACITY} guests.`;
  return null;
}

export function checkOutTimeError(value: string): string | null {
  if (!TIME.test(value)) return 'Enter the check-out time as HH:MM, such as 12:00.';
  return null;
}

/** Each count is a whole number, at least one guest moves in, and the room is not over capacity. */
export function guestCountsError(guests: GuestCounts, capacity: number): string | null {
  for (const count of [guests.male, guests.female, guests.children]) {
    if (!Number.isInteger(count) || count < 0 || count > MAX_ROOM_CAPACITY) {
      return 'Guest counts are whole numbers, from 0 up.';
    }
  }
  const total = guestTotal(guests);
  if (total < 1) return 'Enter at least one guest for each room.';
  if (total > capacity) {
    const noun = capacity === 1 ? 'guest' : 'guests';
    return `This room sleeps ${capacity} ${noun}. Enter ${total} only after the room's capacity is raised.`;
  }
  return null;
}

/** The instant a guest is due out: the check-out date at the agreed time, Karachi time. */
export function plannedCheckOutAt(checkOutDate: string, time: string): string {
  const safeTime = TIME.test(time) ? time : STANDARD_CHECK_OUT_TIME;
  return new Date(`${checkOutDate}T${safeTime}:00${KARACHI_OFFSET}`).toISOString();
}

/** The Karachi calendar day an instant falls on, YYYY-MM-DD. */
export function karachiDay(instant: Date | string): string {
  return todayInKarachi(typeof instant === 'string' ? new Date(instant) : instant);
}

/** HH:MM in Karachi for an instant. */
export function karachiClock(instant: Date | string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(typeof instant === 'string' ? new Date(instant) : instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '00';
  return `${part('hour')}:${part('minute')}`;
}

/** A date moved by whole days. Dates are YYYY-MM-DD and so is the answer. */
export function addDays(isoDate: string, days: number): string {
  const match = ISO_DATE.exec(isoDate);
  if (!match) return isoDate;
  const moved = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return moved.toISOString().slice(0, 10);
}

/** The first date, then one more date for each following day. */
export function dayRange(from: string, days: number): string[] {
  return Array.from({ length: Math.max(0, days) }, (_, offset) => addDays(from, offset));
}

/** Whole days from one date to the next. Later minus earlier. */
export function daysBetween(from: string, to: string): number {
  const first = ISO_DATE.exec(from);
  const second = ISO_DATE.exec(to);
  if (!first || !second) return 0;
  const start = Date.UTC(Number(first[1]), Number(first[2]) - 1, Number(first[3]));
  const end = Date.UTC(Number(second[1]), Number(second[2]) - 1, Number(second[3]));
  return Math.round((end - start) / 86_400_000);
}

export function boardDaysError(days: number): string | null {
  if (!(BOARD_DAY_CHOICES as readonly number[]).includes(days)) {
    return `Show ${BOARD_DAY_CHOICES.join(', ')} days.`;
  }
  return null;
}

// ------------------------------------------------------------------ holding a room

/** Nights a room is spoken for. `to` is the check-out morning, so the room is free again that day. */
export interface RoomHold {
  from: string;
  to: string;
}

/**
 * The nights a guest who is in a room holds it. A guest who has overstayed still holds tonight,
 * so the room cannot be promised to someone else until they are checked out.
 */
export function openStayHold(
  checkedInAt: Date | string,
  checkOutDate: string,
  today: string,
): RoomHold {
  const tomorrow = addDays(today, 1);
  return {
    from: karachiDay(checkedInAt),
    to: checkOutDate >= tomorrow ? checkOutDate : tomorrow,
  };
}

/** A room can take a stay when none of its holds shares a night with it. */
export function roomIsFreeFor(holds: RoomHold[], from: string, to: string): boolean {
  return holds.every((hold) => !staysOverlap(from, to, hold.from, hold.to));
}

// ------------------------------------------------------------------ the board

export type RoomState = 'FREE' | 'RESERVED' | 'OCCUPIED' | 'DUE_OUT' | 'OVERDUE';

export type RoomStateTone = 'free' | 'reserved' | 'occupied' | 'due' | 'overdue';

export function roomStateTone(state: RoomState): RoomStateTone {
  switch (state) {
    case 'FREE':
      return 'free';
    case 'RESERVED':
      return 'reserved';
    case 'OCCUPIED':
      return 'occupied';
    case 'DUE_OUT':
      return 'due';
    default:
      return 'overdue';
  }
}

export type RoomBookingKind = 'STAY' | 'RESERVED' | 'DONE';

/** One bar on a room's row: a guest in the room, a room promised ahead, or a stay that ended. */
export interface RoomBoardBooking {
  kind: RoomBookingKind;
  requestId: string;
  requestNumber: string;
  airlineName: string;
  /** First day of the bar, YYYY-MM-DD. */
  from: string;
  /** Check-out day, YYYY-MM-DD. The room is free again after the check-out time. */
  to: string;
  checkOutTime: string;
  /** The instant the guest is due out, or left. */
  plannedCheckOutAt: string;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  guests: GuestCounts | null;
}

export interface RoomBoardRoom {
  id: string;
  name: string;
  floorId: string;
  floorName: string;
  roomTypeId: string;
  roomTypeName: string;
  capacity: number;
  state: RoomState;
  /** Guests in the room right now. */
  guests: GuestCounts;
  current: RoomBoardBooking | null;
  /** The instant the room is free to use: now when it is free, the check-out time when it is not. */
  freeFrom: string;
  /** The next promise for this room that has not started, or null. */
  nextBooking: RoomBoardBooking | null;
  /** The day the next promise starts while the room is free, or null when nothing is booked. */
  freeUntil: string | null;
  /** Everything that touches the days on the board, earliest first. */
  bookings: RoomBoardBooking[];
}

export interface RoomBoardFloor {
  id: string;
  name: string;
  rooms: RoomBoardRoom[];
}

export interface RoomBoardDay {
  date: string;
  /** Rooms of this type promised to accepted requests that night. */
  promised: number;
  free: number;
}

export interface RoomBoardType {
  roomTypeId: string;
  name: string;
  rooms: number;
  occupied: number;
  free: number;
  days: RoomBoardDay[];
}

export interface RoomBoardSummary {
  rooms: number;
  occupied: number;
  dueOut: number;
  overdue: number;
  free: number;
  /** Free now, but promised to a stay that has not started. */
  reserved: number;
  capacityTotal: number;
  capacityFree: number;
  capacityUsed: number;
  guests: GuestCounts & { total: number };
  /** Rooms accepted stays still have to check in, for stays that begin today. */
  arrivalsToday: number;
  /** Guests due out today who have not left yet. */
  departuresToday: number;
}

export interface RoomBoardRecord {
  branchId: string;
  branchName: string;
  today: string;
  now: string;
  from: string;
  days: string[];
  summary: RoomBoardSummary;
  types: RoomBoardType[];
  floors: RoomBoardFloor[];
}

export interface BoardRoomInput {
  id: string;
  name: string;
  floorId: string;
  floorName: string;
  floorOrder: number;
  roomTypeId: string;
  roomTypeName: string;
  capacity: number;
}

export interface BoardStayInput {
  id: string;
  hotelRoomId: string;
  requestId: string;
  requestNumber: string;
  airlineName: string;
  /** The stay's agreed check-out date. */
  checkOutDate: string;
  checkOutTime: string;
  checkedInAt: string;
  checkedOutAt: string | null;
  guests: GuestCounts;
}

export interface BoardReservationInput {
  id: string;
  hotelRoomId: string;
  requestId: string;
  requestNumber: string;
  airlineName: string;
  checkInDate: string;
  checkOutDate: string;
}

/** What an accepted request has promised of one room type. */
export interface BoardPromiseInput {
  roomTypeId: string;
  checkInDate: string;
  checkOutDate: string;
  rooms: number;
  /** Rooms of this line that still wait for a guest. */
  toCheckIn: number;
}

export interface BoardInput {
  branchId: string;
  branchName: string;
  now: Date;
  from: string;
  days: number;
  rooms: BoardRoomInput[];
  stays: BoardStayInput[];
  reservations: BoardReservationInput[];
  promises: BoardPromiseInput[];
}

export function buildRoomBoard(input: BoardInput): RoomBoardRecord {
  const today = karachiDay(input.now);
  const nowIso = input.now.toISOString();
  const dates = dayRange(input.from, input.days);
  const last = dates[dates.length - 1] ?? input.from;
  const dayAfterToday = addDays(today, 1);

  const staysByRoom = groupBy(input.stays, (stay) => stay.hotelRoomId);
  const reservationsByRoom = groupBy(input.reservations, (row) => row.hotelRoomId);

  const rooms = [...input.rooms]
    .sort(
      (left, right) =>
        left.floorOrder - right.floorOrder ||
        left.floorName.localeCompare(right.floorName) ||
        left.name.localeCompare(right.name, undefined, { numeric: true }),
    )
    .map((room) => {
      const stays = staysByRoom.get(room.id) ?? [];
      const reservations = reservationsByRoom.get(room.id) ?? [];
      const bookings: RoomBoardBooking[] = [];

      let current: RoomBoardBooking | null = null;
      for (const stay of stays) {
        const checkedInDay = karachiDay(stay.checkedInAt);
        const planned = plannedCheckOutAt(stay.checkOutDate, stay.checkOutTime);
        if (stay.checkedOutAt === null) {
          // An overdue guest still holds the room today, so the bar reaches at least today.
          const to =
            planned < nowIso ? maxDate(stay.checkOutDate, dayAfterToday) : stay.checkOutDate;
          const booking: RoomBoardBooking = {
            kind: 'STAY',
            requestId: stay.requestId,
            requestNumber: stay.requestNumber,
            airlineName: stay.airlineName,
            from: checkedInDay,
            to,
            checkOutTime: stay.checkOutTime,
            plannedCheckOutAt: planned,
            checkedInAt: stay.checkedInAt,
            checkedOutAt: null,
            guests: stay.guests,
          };
          current = booking;
          bookings.push(booking);
        } else {
          const leftDay = karachiDay(stay.checkedOutAt);
          bookings.push({
            kind: 'DONE',
            requestId: stay.requestId,
            requestNumber: stay.requestNumber,
            airlineName: stay.airlineName,
            from: checkedInDay,
            to: leftDay > checkedInDay ? leftDay : addDays(checkedInDay, 1),
            checkOutTime: karachiClock(stay.checkedOutAt),
            plannedCheckOutAt: stay.checkedOutAt,
            checkedInAt: stay.checkedInAt,
            checkedOutAt: stay.checkedOutAt,
            guests: stay.guests,
          });
        }
      }

      const promised = reservations
        .map<RoomBoardBooking>((row) => ({
          kind: 'RESERVED',
          requestId: row.requestId,
          requestNumber: row.requestNumber,
          airlineName: row.airlineName,
          from: row.checkInDate,
          to: row.checkOutDate,
          checkOutTime: STANDARD_CHECK_OUT_TIME,
          plannedCheckOutAt: plannedCheckOutAt(row.checkOutDate, STANDARD_CHECK_OUT_TIME),
          checkedInAt: null,
          checkedOutAt: null,
          guests: null,
        }))
        .sort((left, right) => left.from.localeCompare(right.from));
      bookings.push(...promised);

      const upcoming = promised.filter((booking) => booking.to > today);
      const nextBooking = upcoming[0] ?? null;

      let state: RoomState = 'FREE';
      if (current) {
        if (current.plannedCheckOutAt < nowIso) state = 'OVERDUE';
        else if (karachiDay(current.plannedCheckOutAt) === today) state = 'DUE_OUT';
        else state = 'OCCUPIED';
      } else if (nextBooking) {
        state = 'RESERVED';
      }

      return {
        room,
        record: {
          id: room.id,
          name: room.name,
          floorId: room.floorId,
          floorName: room.floorName,
          roomTypeId: room.roomTypeId,
          roomTypeName: room.roomTypeName,
          capacity: room.capacity,
          state,
          guests: current?.guests ?? noGuests(),
          current,
          freeFrom: current && state !== 'OVERDUE' ? current.plannedCheckOutAt : nowIso,
          nextBooking,
          freeUntil: current ? null : (nextBooking?.from ?? null),
          bookings: bookings
            .filter((booking) => booking.to > input.from && booking.from <= last)
            .sort((left, right) => left.from.localeCompare(right.from)),
        } satisfies RoomBoardRoom,
      };
    });

  const floors: RoomBoardFloor[] = [];
  for (const { room, record } of rooms) {
    let floor = floors.find((row) => row.id === room.floorId);
    if (!floor) {
      floor = { id: room.floorId, name: room.floorName, rooms: [] };
      floors.push(floor);
    }
    floor.rooms.push(record);
  }

  const records = rooms.map((row) => row.record);
  const taken = records.filter((room) => room.current !== null);
  const guests = taken.reduce<GuestCounts>(
    (sum, room) => ({
      male: sum.male + room.guests.male,
      female: sum.female + room.guests.female,
      children: sum.children + room.guests.children,
    }),
    noGuests(),
  );
  const capacityTotal = records.reduce((sum, room) => sum + room.capacity, 0);
  const capacityTaken = taken.reduce((sum, room) => sum + room.capacity, 0);

  const types: RoomBoardType[] = [];
  for (const record of records) {
    let type = types.find((row) => row.roomTypeId === record.roomTypeId);
    if (!type) {
      type = {
        roomTypeId: record.roomTypeId,
        name: record.roomTypeName,
        rooms: 0,
        occupied: 0,
        free: 0,
        days: [],
      };
      types.push(type);
    }
    type.rooms += 1;
    if (record.current) type.occupied += 1;
    else type.free += 1;
  }
  types.sort((left, right) => left.name.localeCompare(right.name));
  for (const type of types) {
    type.days = dates.map((date) => {
      const promised = input.promises
        .filter(
          (promise) =>
            promise.roomTypeId === type.roomTypeId &&
            promise.checkInDate <= date &&
            date < promise.checkOutDate,
        )
        .reduce((sum, promise) => sum + promise.rooms, 0);
      return { date, promised, free: Math.max(0, type.rooms - promised) };
    });
  }

  return {
    branchId: input.branchId,
    branchName: input.branchName,
    today,
    now: nowIso,
    from: input.from,
    days: dates,
    summary: {
      rooms: records.length,
      occupied: taken.length,
      dueOut: records.filter((room) => room.state === 'DUE_OUT').length,
      overdue: records.filter((room) => room.state === 'OVERDUE').length,
      free: records.length - taken.length,
      reserved: records.filter((room) => room.state === 'RESERVED').length,
      capacityTotal,
      capacityFree: capacityTotal - capacityTaken,
      capacityUsed: capacityTaken,
      guests: { ...guests, total: guestTotal(guests) },
      arrivalsToday: input.promises
        .filter((promise) => promise.checkInDate === today)
        .reduce((sum, promise) => sum + promise.toCheckIn, 0),
      departuresToday: records.filter(
        (room) => room.current !== null && (room.state === 'DUE_OUT' || room.state === 'OVERDUE'),
      ).length,
    },
    types,
    floors,
  };
}

/** Guests who are only booked ahead are shown arriving at 14:00, the usual hotel check-in. */
const BOOKED_ARRIVAL_CLOCK = '14:00';

/** A time of day as part of a day: 12:00 is 0.5. */
export function clockFraction(clock: string): number {
  const match = TIME.exec(clock);
  if (!match) return 0.5;
  return (Number(match[1]) * 60 + Number(match[2])) / 1440;
}

/** Where a bar sits on the calendar, in days from the first day of the window. */
export interface BookingSpan {
  start: number;
  end: number;
  /** The booking began before the window, so its left edge is cut off. */
  cutStart: boolean;
  /** The booking runs on past the window, so its right edge is cut off. */
  cutEnd: boolean;
}

/**
 * A bar starts when the guest moves in and ends at the check-out time, so a room that turns over the
 * same day shows two bars that meet in the middle. An overdue guest's bar reaches to now. Returns
 * null when the booking is outside the window.
 */
export function bookingSpan(
  booking: RoomBoardBooking,
  from: string,
  days: number,
  now: Date | string,
): BookingSpan | null {
  const nowDate = typeof now === 'string' ? new Date(now) : now;
  const arrival = booking.checkedInAt
    ? clockFraction(karachiClock(booking.checkedInAt))
    : clockFraction(BOOKED_ARRIVAL_CLOCK);
  const rawStart = daysBetween(from, booking.from) + arrival;

  let rawEnd: number;
  if (booking.checkedOutAt) {
    rawEnd =
      daysBetween(from, karachiDay(booking.checkedOutAt)) +
      clockFraction(karachiClock(booking.checkedOutAt));
  } else if (booking.kind === 'STAY' && booking.plannedCheckOutAt < nowDate.toISOString()) {
    rawEnd = daysBetween(from, karachiDay(nowDate)) + clockFraction(karachiClock(nowDate));
  } else {
    rawEnd = daysBetween(from, booking.to) + clockFraction(booking.checkOutTime);
  }

  if (rawEnd <= 0 || rawStart >= days) return null;
  const start = Math.max(0, rawStart);
  const end = Math.min(days, Math.max(rawEnd, rawStart + 0.1));
  return { start, end, cutStart: rawStart < 0, cutEnd: rawEnd > days };
}

function maxDate(left: string, right: string): string {
  return left >= right ? left : right;
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const id = key(row);
    const group = groups.get(id);
    if (group) group.push(row);
    else groups.set(id, [row]);
  }
  return groups;
}
