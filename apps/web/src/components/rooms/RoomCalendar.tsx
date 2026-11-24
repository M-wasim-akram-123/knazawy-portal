'use client';

import {
  BOARD_DAY_CHOICES,
  bookingSpan,
  formatDisplayDate,
  type RoomBoardBooking,
  type RoomBoardRecord,
  type RoomBoardRoom,
} from '@knazawy/shared';
import { useState } from 'react';

import { fill } from '../../lib/i18n';

import { clockOf, dayOfMonth, weekdayShort, type RoomBoardText } from './boardView';

interface CalendarProps {
  board: RoomBoardRecord;
  t: RoomBoardText;
  days: number;
  onDays: (days: number) => void;
  /** Move the window by this many days. */
  onShift: (days: number) => void;
  onToday: () => void;
  onSelect: (roomId: string) => void;
}

/** A row per room and a column per day, with a bar for every stay and every room booked ahead. */
export function RoomCalendar({
  board,
  t,
  days,
  onDays,
  onShift,
  onToday,
  onSelect,
}: CalendarProps) {
  const [typeId, setTypeId] = useState('');
  const nowMs = new Date(board.now);
  const todayIndex = board.days.indexOf(board.today);
  const columns = board.days.length;

  const floors = board.floors
    .map((floor) => ({
      ...floor,
      rooms: floor.rooms.filter((room) => !typeId || room.roomTypeId === typeId),
    }))
    .filter((floor) => floor.rooms.length > 0);

  return (
    <div className="kz-stack kz-rb">
      <section className="kz-panel kz-stack">
        <div className="kz-rb-toolbar">
          <div>
            <h3>{t.calendarTitle}</h3>
            <p className="kz-help">
              {formatDisplayDate(board.days[0] ?? board.from)} –{' '}
              {formatDisplayDate(board.days[columns - 1] ?? board.from)}
            </p>
          </div>
          <div className="kz-rb-controls">
            <div className="kz-rb-segment" role="group" aria-label={t.showDays}>
              {BOARD_DAY_CHOICES.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  className={choice === days ? 'kz-rb-segment-on' : ''}
                  aria-pressed={choice === days}
                  onClick={() => onDays(choice)}
                >
                  {fill(t.daysCount, { count: choice })}
                </button>
              ))}
            </div>
            <div className="kz-rb-segment" role="group">
              <button type="button" onClick={() => onShift(-Math.max(1, Math.floor(days / 2)))}>
                ‹ {t.earlier}
              </button>
              <button type="button" onClick={onToday}>
                {t.jumpToday}
              </button>
              <button type="button" onClick={() => onShift(Math.max(1, Math.floor(days / 2)))}>
                {t.later} ›
              </button>
            </div>
            <label className="kz-rb-filter">
              <span>{t.typeFilter}</span>
              <select value={typeId} onChange={(event) => setTypeId(event.target.value)}>
                <option value="">{t.allTypes}</option>
                {board.types.map((type) => (
                  <option key={type.roomTypeId} value={type.roomTypeId}>
                    {type.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <p className="kz-help">{t.calendarHelp}</p>
        <ul className="kz-rb-legend kz-rb-legend-row">
          <li>
            <span className="kz-rb-swatch kz-rb-bar-stay" aria-hidden="true" />
            {t.legendStay}
          </li>
          <li>
            <span className="kz-rb-swatch kz-rb-bar-reserved" aria-hidden="true" />
            {t.legendReserved}
          </li>
          <li>
            <span className="kz-rb-swatch kz-rb-bar-done" aria-hidden="true" />
            {t.legendDone}
          </li>
          <li>
            <span className="kz-rb-swatch kz-rb-bar-overdue" aria-hidden="true" />
            {t.legendOverdue}
          </li>
          <li>
            <span className="kz-rb-swatch kz-rb-swatch-free" aria-hidden="true" />
            {t.legendFree}
          </li>
        </ul>

        <div className="kz-rb-scroll">
          <div className="kz-rb-grid" style={{ ['--kz-rb-days' as string]: columns }}>
            <div className="kz-rb-row kz-rb-head">
              <div className="kz-rb-label">{t.roomColumn}</div>
              <div className="kz-rb-track kz-rb-days">
                {board.days.map((day) => (
                  <div
                    key={day}
                    className={`kz-rb-day${day === board.today ? ' kz-rb-day-today' : ''}`}
                  >
                    <small>{weekdayShort(day, t.weekdayFormat)}</small>
                    <b>{dayOfMonth(day)}</b>
                  </div>
                ))}
              </div>
            </div>

            <div className="kz-rb-row kz-rb-free-title">
              <div className="kz-rb-label">{t.availabilityTitle}</div>
              <div className="kz-rb-track" />
            </div>
            {board.types
              .filter((type) => !typeId || type.roomTypeId === typeId)
              .map((type) => (
                <div className="kz-rb-row" key={type.roomTypeId}>
                  <div className="kz-rb-label">
                    {type.name}
                    <small> · {type.rooms}</small>
                  </div>
                  <div className="kz-rb-track kz-rb-days">
                    {type.days.map((day) => {
                      const share = type.rooms === 0 ? 0 : day.free / type.rooms;
                      const tone = day.free === 0 ? 'none' : share <= 0.34 ? 'few' : 'many';
                      return (
                        <div
                          key={day.date}
                          className={`kz-rb-avail kz-rb-avail-${tone}${
                            day.date === board.today ? ' kz-rb-day-today' : ''
                          }`}
                          title={`${type.name} · ${formatDisplayDate(day.date)} · ${day.free}`}
                        >
                          {day.free}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

            {floors.length === 0 ? <p className="kz-empty">{t.nothingToShow}</p> : null}
            {floors.map((floor) => (
              <div key={floor.id} className="kz-rb-floor-block">
                <div className="kz-rb-row kz-rb-floor-title">
                  <div className="kz-rb-label">{floor.name}</div>
                  <div className="kz-rb-track" />
                </div>
                {floor.rooms.map((room) => (
                  <div className="kz-rb-row" key={room.id}>
                    <button
                      type="button"
                      className={`kz-rb-label kz-rb-room-label kz-rb-room-label-${room.state.toLowerCase()}`}
                      onClick={() => onSelect(room.id)}
                    >
                      <b>{room.name}</b>
                      <small>
                        {room.roomTypeName} · {fill(t.sleeps, { count: room.capacity })}
                      </small>
                    </button>
                    <div className="kz-rb-track">
                      {todayIndex >= 0 ? (
                        <span
                          className="kz-rb-today-line"
                          style={{ left: `${((todayIndex + 0.5) / columns) * 100}%` }}
                          aria-hidden="true"
                        />
                      ) : null}
                      {room.bookings.map((booking) => (
                        <Bar
                          key={`${booking.kind}-${booking.requestId}-${booking.from}-${booking.checkedInAt ?? ''}`}
                          booking={booking}
                          room={room}
                          board={board}
                          now={nowMs}
                          t={t}
                          onSelect={onSelect}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function Bar({
  booking,
  room,
  board,
  now,
  t,
  onSelect,
}: {
  booking: RoomBoardBooking;
  room: RoomBoardRoom;
  board: RoomBoardRecord;
  now: Date;
  t: RoomBoardText;
  onSelect: (roomId: string) => void;
}) {
  const span = bookingSpan(booking, board.from, board.days.length, now);
  if (!span) return null;
  const overdue =
    booking.kind === 'STAY' && room.state === 'OVERDUE' && booking.checkedOutAt === null;
  const tone = overdue ? 'overdue' : booking.kind.toLowerCase();
  const columns = board.days.length;
  const guests = booking.guests
    ? booking.guests.male + booking.guests.female + booking.guests.children
    : 0;
  const title = fill(t.barTitle, {
    airline: booking.airlineName,
    number: booking.requestNumber,
    from: formatDisplayDate(booking.from),
    to: formatDisplayDate(booking.to),
    time: clockOf(booking.plannedCheckOutAt),
  });
  return (
    <button
      type="button"
      className={`kz-rb-booking kz-rb-bar-${tone}${span.cutStart ? ' kz-rb-cut-start' : ''}${
        span.cutEnd ? ' kz-rb-cut-end' : ''
      }`}
      style={{
        left: `${(span.start / columns) * 100}%`,
        width: `${((span.end - span.start) / columns) * 100}%`,
      }}
      title={title}
      onClick={() => onSelect(room.id)}
    >
      <span className="kz-rb-booking-text">
        {fill(t.barLabel, { number: booking.requestNumber, airline: booking.airlineName })}
        {guests > 0 ? ` · ${guests}` : ''}
      </span>
      {span.end - span.start >= 2.2 ? (
        <small className="kz-rb-booking-out">
          {fill(t.outAtTime, { time: clockOf(booking.plannedCheckOutAt) })}
        </small>
      ) : null}
    </button>
  );
}
