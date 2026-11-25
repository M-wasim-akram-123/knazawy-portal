'use client';

import { formatDisplayDate, type RoomBoardRoom, roomStateTone } from '@knazawy/shared';
import { useEffect } from 'react';

import { fill } from '../../lib/i18n';

import { clockOf, moment, stateText, type RoomBoardText } from './boardView';

interface DetailProps {
  room: RoomBoardRoom;
  t: RoomBoardText;
  onClose: () => void;
}

/** A side panel for one room: who is in it, when it is free, and what is booked after. */
export function RoomDetail({ room, t, onClose }: DetailProps) {
  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tone = roomStateTone(room.state);
  const current = room.current;
  const kindText = {
    STAY: t.bookingStay,
    RESERVED: t.bookingReserved,
    DONE: t.bookingDone,
  } as const;

  return (
    <aside
      className="kz-rb-detail"
      role="dialog"
      aria-label={fill(t.detailTitle, { name: room.name })}
    >
      <header className="kz-rb-detail-head">
        <div>
          <h3>{fill(t.detailTitle, { name: room.name })}</h3>
          <p className="kz-help">
            {fill(t.detailFloorType, { floor: room.floorName, type: room.roomTypeName })} ·{' '}
            {fill(t.sleeps, { count: room.capacity })}
          </p>
        </div>
        <button type="button" className="kz-button-quiet" onClick={onClose}>
          {t.detailClose}
        </button>
      </header>
      <p className={`kz-rb-state kz-rb-state-${tone}`}>{stateText(t, room.state)}</p>

      <dl className="kz-rb-facts">
        {current ? (
          <>
            <dt>{t.detailAirline}</dt>
            <dd>{current.airlineName}</dd>
            <dt>{t.detailStay}</dt>
            <dd>{current.requestNumber}</dd>
            <dt>{t.detailGuests}</dt>
            <dd>
              {fill(t.detailGuestsLine, {
                male: room.guests.male,
                female: room.guests.female,
                children: room.guests.children,
              })}
            </dd>
            {current.checkedInAt ? (
              <>
                <dt>{t.detailMovedIn}</dt>
                <dd>{moment(current.checkedInAt)}</dd>
              </>
            ) : null}
            <dt>{t.detailDueOut}</dt>
            <dd className={room.state === 'OVERDUE' ? 'kz-rb-late' : ''}>
              {formatDisplayDate(current.to)} {clockOf(current.plannedCheckOutAt)}
            </dd>
          </>
        ) : null}
        <dt>{t.detailFree}</dt>
        <dd>{current ? moment(room.freeFrom) : t.detailNow}</dd>
        <dt>{t.detailNextBooking}</dt>
        <dd>
          {room.nextBooking
            ? `${room.nextBooking.airlineName} · ${room.nextBooking.requestNumber} · ${fill(
                t.bookingLine,
                {
                  from: formatDisplayDate(room.nextBooking.from),
                  to: formatDisplayDate(room.nextBooking.to),
                  time: clockOf(room.nextBooking.plannedCheckOutAt),
                },
              )}`
            : t.detailNothingAhead}
        </dd>
      </dl>

      {room.bookings.length > 0 ? (
        <section className="kz-stack">
          <h4>{t.detailBookings}</h4>
          <ul className="kz-rb-bookings">
            {room.bookings.map((booking) => (
              <li
                key={`${booking.kind}-${booking.requestId}-${booking.from}-${booking.checkedInAt ?? ''}`}
                className={`kz-rb-bookings-${booking.kind.toLowerCase()}`}
              >
                <b>{kindText[booking.kind]}</b>
                <span>
                  {booking.airlineName} · {booking.requestNumber}
                </span>
                <small>
                  {fill(t.bookingLine, {
                    from: formatDisplayDate(booking.from),
                    to: formatDisplayDate(booking.to),
                    time: clockOf(booking.plannedCheckOutAt),
                  })}
                </small>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}
