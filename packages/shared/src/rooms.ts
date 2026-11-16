import type { Role } from './enums';
import { chargeFor, isMoney, sumMoney } from './rates';
import { can, isKaramRole } from './rbac';
import type { StatusTone } from './status';

/**
 * Karam owns the rooms it offers. An airline asks for rooms for a crew or passengers
 * on a stay, and Karam accepts or rejects against its own availability.
 */
export const ROOM_REQUEST_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'ACCEPTED',
  'REJECTED',
  'CANCELLED',
] as const;

export type RoomRequestStatus = (typeof ROOM_REQUEST_STATUSES)[number];

export const ROOM_REQUEST_STATUS_LABELS: Record<RoomRequestStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

export function roomRequestStatusTone(status: RoomRequestStatus): StatusTone {
  switch (status) {
    case 'DRAFT':
      return 'draft';
    case 'REJECTED':
    case 'CANCELLED':
      return 'problem';
    case 'ACCEPTED':
      return 'done';
    default:
      return 'progress';
  }
}

export type RoomRequestAction = 'submit' | 'cancel' | 'accept' | 'reject';

const NEXT_STATUS: Partial<
  Record<RoomRequestStatus, Partial<Record<RoomRequestAction, RoomRequestStatus>>>
> = {
  DRAFT: { submit: 'SUBMITTED', cancel: 'CANCELLED' },
  SUBMITTED: { accept: 'ACCEPTED', reject: 'REJECTED', cancel: 'CANCELLED' },
};

/** The status a room request moves to, or null when the action is not allowed from here. */
export function nextRoomRequestStatus(
  from: RoomRequestStatus,
  action: RoomRequestAction,
): RoomRequestStatus | null {
  return NEXT_STATUS[from]?.[action] ?? null;
}

/** Only a draft can change its details or its room lines. */
export function isRoomRequestEditable(status: RoomRequestStatus): boolean {
  return status === 'DRAFT';
}

/** Karam sees a room request once the airline has sent it. */
export function isRoomRequestVisibleToKaram(status: RoomRequestStatus): boolean {
  return status !== 'DRAFT';
}

/** A stay is counted in nights: check-out is later than check-in, dates are YYYY-MM-DD. */
export function roomNights(checkIn: string, checkOut: string): number | null {
  const start = dayNumber(checkIn);
  const end = dayNumber(checkOut);
  if (start === null || end === null || end <= start) return null;
  return end - start;
}

function dayNumber(isoDate: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  const time = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const date = new Date(time);
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  ) {
    return null;
  }
  return Math.round(time / 86_400_000);
}

/** Two stays share a night when one begins before the other ends. Checkout morning is free. */
export function staysOverlap(
  checkIn: string,
  checkOut: string,
  otherIn: string,
  otherOut: string,
): boolean {
  const start = dayNumber(checkIn);
  const end = dayNumber(checkOut);
  const otherStart = dayNumber(otherIn);
  const otherEnd = dayNumber(otherOut);
  if (start === null || end === null || otherStart === null || otherEnd === null) return false;
  return start < otherEnd && otherStart < end;
}

/** Rooms of one type still free after accepted stays are taken off the active rooms. */
export function roomsStillFree(activeRooms: number, bookedRooms: number): number {
  const active = Number.isInteger(activeRooms) && activeRooms > 0 ? activeRooms : 0;
  const booked = Number.isInteger(bookedRooms) && bookedRooms > 0 ? bookedRooms : 0;
  return Math.max(0, active - booked);
}

export interface BookedStay {
  checkIn: string;
  checkOut: string;
  rooms: number;
}

/**
 * The most rooms of one type that accepted stays still need on any single night from `today` on.
 * A night that has already passed is ignored, and so is a stay that has ended.
 */
export function peakRoomsNeeded(stays: BookedStay[], today: string): number {
  const from = dayNumber(today);
  if (from === null) return 0;
  const perNight = new Map<number, number>();
  for (const stay of stays) {
    const start = dayNumber(stay.checkIn);
    const end = dayNumber(stay.checkOut);
    if (start === null || end === null) continue;
    for (let night = Math.max(start, from); night < end; night++) {
      perNight.set(night, (perNight.get(night) ?? 0) + stay.rooms);
    }
  }
  return Math.max(0, ...perNight.values());
}

/** Archiving or moving a room is refused when accepted stays would be left short of rooms of that type. */
export function roomRemovalError(
  typeName: string,
  roomsLeft: number,
  peakNeeded: number,
): string | null {
  if (roomsLeft >= peakNeeded) return null;
  const noun = peakNeeded === 1 ? 'room' : 'rooms';
  return `Accepted stays need ${peakNeeded} ${typeName} ${noun}. Keep this room, or move those stays first.`;
}

/** Asking for more rooms than Karam has of that type. */
export function roomStockError(
  typeName: string,
  activeRooms: number,
  asked: number,
): string | null {
  if (asked <= activeRooms) return null;
  if (activeRooms < 1) return `Karam has no ${typeName} rooms.`;
  const noun = activeRooms === 1 ? 'room' : 'rooms';
  return `Karam has only ${activeRooms} ${typeName} ${noun}.`;
}

/** Asking for more rooms than are free on those nights. */
export function roomAvailabilityError(
  typeName: string,
  freeRooms: number,
  asked: number,
): string | null {
  if (asked <= freeRooms) return null;
  if (freeRooms < 1) return `No ${typeName} rooms are free for those nights.`;
  const noun = freeRooms === 1 ? 'room is' : 'rooms are';
  return `Only ${freeRooms} ${typeName} ${noun} free for those nights.`;
}

/** What one line costs for the whole stay: rooms times nights times the nightly price. */
export function stayLineAmount(rooms: number, nights: number, nightly: string): string | null {
  if (roomLineError(rooms, nights)) return null;
  return chargeFor(rooms * nights, nightly);
}

/** The stay total, or null when a line cannot be priced. */
export function stayTotal(
  lines: Array<{ rooms: number; nightly: string }>,
  nights: number,
): string | null {
  const amounts: string[] = [];
  for (const line of lines) {
    const amount = stayLineAmount(line.rooms, nights, line.nightly);
    if (amount === null) return null;
    amounts.push(amount);
  }
  return sumMoney(amounts);
}

/** Rooms and nights must each be at least one, and the room count stays sensible. */
export function roomLineError(rooms: number, nights: number): string | null {
  if (!Number.isInteger(rooms) || rooms < 1) return 'Ask for at least one room.';
  if (rooms > 99) return 'Ask for no more than 99 rooms.';
  if (!Number.isInteger(nights) || nights < 1) return 'A stay is at least one night.';
  return null;
}

/** Airline requesters ask for rooms. Karam operations accepts or rejects them. */
export function canRequestRooms(role: Role): boolean {
  return !isKaramRole(role) && can(role, 'room_requests', 'C');
}

export function canDecideRoomRequest(role: Role): boolean {
  return isKaramRole(role) && can(role, 'room_requests', 'A');
}

/**
 * The building is not fixed in code. An administrator names the floors, the rooms on each
 * floor, the room types, and every charge that makes up a night's price.
 */
export function setupNameError(value: string, label: string): string | null {
  const name = value.trim();
  if (name.length < 1) return `Enter a ${label}.`;
  if (name.length > 80) return `Use a shorter ${label}.`;
  return null;
}

/** A charge is an amount in PKR for one night. Zero is allowed. */
export function chargeAmountError(value: string): string | null {
  if (!isMoney(value.trim())) {
    return 'Enter the charge per night in PKR, such as 8000 or 8000.50.';
  }
  return null;
}

/** What one night of a room type costs: the active charges added together. */
export function nightlyChargeTotal(
  charges: Array<{ amountPerNight: string; active: boolean }>,
): string | null {
  return sumMoney(charges.filter((charge) => charge.active).map((charge) => charge.amountPerNight));
}

export interface RoomChargeRecord {
  id: string;
  name: string;
  amountPerNight: string;
  active: boolean;
}

export interface RoomTypeRecord {
  id: string;
  name: string;
  note: string | null;
  active: boolean;
  nightlyTotal: string;
  charges: RoomChargeRecord[];
}

export interface RoomFloorRecord {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
}

export interface HotelRoomRecord {
  id: string;
  name: string;
  floorId: string;
  floorName: string;
  roomTypeId: string;
  roomTypeName: string;
  active: boolean;
}

/** A room type an airline can ask for. Floor and room names stay with Karam. */
export interface RoomOfferRecord {
  id: string;
  name: string;
  nightlyTotal: string;
  rooms: number;
}

export interface RoomRequestLineRecord {
  roomTypeId: string;
  roomTypeName: string;
  rooms: number;
  nightly: string;
  amount: string;
  /** True once Karam has accepted and the nightly price is fixed. */
  quoted: boolean;
  /** How many rooms of this type have a guest checked in. */
  checkedIn: number;
}

export interface RoomRequestRecord {
  id: string;
  number: string;
  airlineId: string;
  airlineName: string;
  status: RoomRequestStatus;
  checkIn: string;
  checkOut: string;
  nights: number;
  party: string | null;
  note: string | null;
  decisionNote: string | null;
  createdByName: string;
  submittedAt: string | null;
  decidedAt: string | null;
  total: string;
  lines: RoomRequestLineRecord[];
  /** Karam's view of which rooms guests are in. An airline is sent an empty list. */
  stays: RoomStayRecord[];
}

/** A room a guest has been checked in to on an accepted stay. */
export interface RoomStayRecord {
  id: string;
  roomName: string;
  floorName: string;
  roomTypeName: string;
  checkedInAt: string;
  checkedOutAt: string | null;
}

/** A room Karam can check a guest in to right now. */
export interface FreeRoomRecord {
  id: string;
  name: string;
  floorName: string;
  roomTypeId: string;
  roomTypeName: string;
}

/** Only Karam operations checks guests in and out. */
export function canManageRoomStays(role: Role): boolean {
  return isKaramRole(role) && can(role, 'room_requests', 'U');
}

/** A guest can be checked in from the first night until the morning the stay ends. Dates are YYYY-MM-DD. */
export function roomStayWindowError(
  today: string,
  checkIn: string,
  checkOut: string,
): string | null {
  if (today < checkIn) return 'Check-in opens on the first night of the stay.';
  if (today >= checkOut) return 'This stay has ended.';
  return null;
}

/** Rooms on a line that still wait for a guest. */
export function roomsToCheckIn(quantity: number, checkedIn: number): number {
  return Math.max(0, quantity - checkedIn);
}
