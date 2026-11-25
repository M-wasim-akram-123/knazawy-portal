'use client';

import {
  formatDisplayDate,
  type RoomBoardRecord,
  type RoomBoardRoom,
  type RoomState,
  roomStateTone,
} from '@knazawy/shared';
import { useState } from 'react';

import { fill } from '../../lib/i18n';

import {
  clockOf,
  percent,
  shortDate,
  stateText,
  typeColour,
  type RoomBoardText,
} from './boardView';
import { Pips } from './Pips';

type Filter = 'ALL' | RoomState;

const STATES: RoomState[] = ['FREE', 'RESERVED', 'OCCUPIED', 'DUE_OUT', 'OVERDUE'];

interface FloorPlanProps {
  board: RoomBoardRecord;
  t: RoomBoardText;
  selectedId: string | null;
  onSelect: (roomId: string) => void;
}

/** The building, top floor first, with every room as a card that shows its state at a glance. */
export function RoomFloorPlan({ board, t, selectedId, onSelect }: FloorPlanProps) {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [typeId, setTypeId] = useState('');
  const [search, setSearch] = useState('');

  const rooms = board.floors.flatMap((floor) => floor.rooms);
  const needle = search.trim().toLowerCase();
  const filtering = filter !== 'ALL' || typeId !== '' || needle !== '';
  const matches = (room: RoomBoardRoom): boolean =>
    (filter === 'ALL' || room.state === filter) &&
    (typeId === '' || room.roomTypeId === typeId) &&
    (needle === '' || room.name.toLowerCase().includes(needle));
  const matchCount = rooms.filter(matches).length;
  const nowMs = new Date(board.now).getTime();

  const filters: Array<{ id: Filter; label: string; count: number }> = [
    { id: 'ALL', label: t.planFilterAll, count: rooms.length },
    ...STATES.map((state) => ({
      id: state,
      label: stateText(t, state),
      count: rooms.filter((room) => room.state === state).length,
    })),
  ];

  // The top floor is drawn first, like looking at the front of the building.
  const floors = [...board.floors].reverse();

  return (
    <section className="kz-panel kz-stack kz-rb-plan-panel">
      <div className="kz-rb-toolbar">
        <div>
          <h3>{t.floorsTitle}</h3>
          <p className="kz-help">{t.floorsHelp}</p>
        </div>
        <div className="kz-rb-controls">
          <label className="kz-rb-filter">
            <span>{t.planSearch}</span>
            <input
              type="search"
              value={search}
              placeholder={t.planSearchPlaceholder}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
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

      <div className="kz-rb-chips" role="group" aria-label={t.planFilterLabel}>
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`kz-rb-chip kz-rb-chip-${item.id === 'ALL' ? 'all' : roomStateTone(item.id)}${
              filter === item.id ? ' kz-rb-chip-on' : ''
            }`}
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
          >
            {item.id === 'ALL' ? null : <span className="kz-rb-chip-dot" aria-hidden="true" />}
            {item.label}
            <b>{item.count}</b>
          </button>
        ))}
        {filtering ? (
          <span className="kz-rb-matches" role="status">
            {fill(t.planMatches, { count: matchCount })}
          </span>
        ) : null}
      </div>

      {board.floors.length === 0 ? <p className="kz-empty">{t.noRooms}</p> : null}
      {filtering && matchCount === 0 ? <p className="kz-empty">{t.planNoMatch}</p> : null}

      <div className="kz-rb-building">
        {floors.map((floor) => {
          const total = floor.rooms.length;
          const count = (state: RoomState): number =>
            floor.rooms.filter((room) => room.state === state).length;
          return (
            <div key={floor.id} className="kz-rb-storey">
              <div className="kz-rb-storey-label">
                <strong>{floor.name}</strong>
                <span>{fill(t.floorFree, { free: count('FREE'), rooms: total })}</span>
                <div className="kz-rb-mini" aria-hidden="true">
                  {STATES.map((state) => (
                    <span
                      key={state}
                      className={`kz-rb-mini-${roomStateTone(state)}`}
                      style={{ width: `${percent(count(state), total)}%` }}
                    />
                  ))}
                </div>
              </div>
              <div className="kz-rb-cards">
                {floor.rooms.map((room) => (
                  <PlanRoom
                    key={room.id}
                    room={room}
                    t={t}
                    nowMs={nowMs}
                    selected={room.id === selectedId}
                    dim={filtering && !matches(room)}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            </div>
          );
        })}
        <div className="kz-rb-ground" aria-hidden="true" />
      </div>
    </section>
  );
}

function PlanRoom({
  room,
  t,
  nowMs,
  selected,
  dim,
  onSelect,
}: {
  room: RoomBoardRoom;
  t: RoomBoardText;
  nowMs: number;
  selected: boolean;
  dim: boolean;
  onSelect: (roomId: string) => void;
}) {
  const tone = roomStateTone(room.state);
  const current = room.current;
  const guests = room.guests.male + room.guests.female + room.guests.children;
  const who = current?.airlineName ?? room.nextBooking?.airlineName ?? '';

  let progress = 0;
  if (current?.checkedInAt) {
    const start = new Date(current.checkedInAt).getTime();
    const end = new Date(current.plannedCheckOutAt).getTime();
    if (end > start) progress = Math.min(1, Math.max(0, (nowMs - start) / (end - start)));
  }

  let line: string;
  if (current) {
    const due = `${shortDate(current.to)} ${clockOf(current.plannedCheckOutAt)}`;
    line =
      room.state === 'OVERDUE' ? `${t.stateOverdue} · ${due}` : fill(t.outAtTime, { time: due });
  } else if (room.freeUntil) {
    line = fill(t.freeUntilDate, { date: formatDisplayDate(room.freeUntil) });
  } else {
    line = t.freeFromNow;
  }

  const chips = [
    { key: 'men', text: t.chipMen, title: t.guestsMen, count: room.guests.male },
    { key: 'women', text: t.chipWomen, title: t.guestsWomen, count: room.guests.female },
    { key: 'children', text: t.chipChildren, title: t.guestsChildren, count: room.guests.children },
  ].filter((chip) => chip.count > 0);

  return (
    <button
      type="button"
      className={`kz-rb-card kz-rb-card-${tone}${selected ? ' kz-rb-card-selected' : ''}${
        dim ? ' kz-rb-card-dim' : ''
      }`}
      onClick={() => onSelect(room.id)}
      aria-pressed={selected}
      title={`${room.name} · ${stateText(t, room.state)}`}
    >
      <span className="kz-rb-card-head">
        <b>{room.name}</b>
        <span className="kz-rb-pill">{stateText(t, room.state)}</span>
      </span>
      <span
        className="kz-rb-card-type"
        style={{ ['--kz-rb-type' as string]: typeColour(room.roomTypeName) }}
      >
        <i aria-hidden="true" />
        {room.roomTypeName}
      </span>
      <Pips capacity={room.capacity} filled={Math.min(guests, room.capacity)} />
      <span className="kz-rb-card-chips">
        {chips.length > 0 ? (
          chips.map((chip) => (
            <span
              key={chip.key}
              className={`kz-rb-gchip kz-rb-guest-${chip.key}`}
              title={chip.title}
            >
              {chip.text} {chip.count}
            </span>
          ))
        ) : (
          <span className="kz-rb-card-sleeps">{fill(t.sleeps, { count: room.capacity })}</span>
        )}
      </span>
      {who ? <span className="kz-rb-card-who">{who}</span> : null}
      <span className="kz-rb-card-foot">{line}</span>
      {current?.checkedInAt ? (
        <span
          className="kz-rb-progress"
          role="img"
          aria-label={fill(t.stayProgress, { percent: Math.round(progress * 100) })}
        >
          <span style={{ width: `${progress * 100}%` }} />
        </span>
      ) : null}
    </button>
  );
}
