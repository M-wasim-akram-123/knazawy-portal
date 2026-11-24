import type { roomBoardCopy } from '@knazawy/i18n';
import { formatKarachiDateTime, karachiClock, type RoomState } from '@knazawy/shared';

export type RoomBoardText = (typeof roomBoardCopy)['en'];

type StateKey = 'stateFree' | 'stateReserved' | 'stateOccupied' | 'stateDueOut' | 'stateOverdue';

const STATE_KEYS: Record<RoomState, StateKey> = {
  FREE: 'stateFree',
  RESERVED: 'stateReserved',
  OCCUPIED: 'stateOccupied',
  DUE_OUT: 'stateDueOut',
  OVERDUE: 'stateOverdue',
};

export function stateText(t: RoomBoardText, state: RoomState): string {
  return t[STATE_KEYS[state]];
}

/** DD/MM/YYYY HH:MM in Asia/Karachi. */
export function moment(instant: string): string {
  return formatKarachiDateTime(new Date(instant));
}

/** HH:MM in Asia/Karachi. */
export function clockOf(instant: string): string {
  return karachiClock(instant);
}

/** Short weekday for a YYYY-MM-DD day, in the chosen language. */
export function weekdayShort(isoDate: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(
    new Date(`${isoDate}T00:00:00Z`),
  );
}

/** Day of the month without a leading zero. */
export function dayOfMonth(isoDate: string): string {
  return String(Number(isoDate.slice(8, 10)));
}

/** DD/MM from YYYY-MM-DD. */
export function shortDate(isoDate: string): string {
  return `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}`;
}

export function percent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}
