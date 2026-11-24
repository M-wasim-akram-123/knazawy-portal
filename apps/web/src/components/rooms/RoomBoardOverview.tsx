'use client';

import {
  formatDisplayDate,
  type RoomBoardRecord,
  type RoomBoardRoom,
  roomStateTone,
} from '@knazawy/shared';

import { fill } from '../../lib/i18n';

import { clockOf, percent, shortDate, stateText, type RoomBoardText } from './boardView';

interface OverviewProps {
  board: RoomBoardRecord;
  t: RoomBoardText;
  selectedId: string | null;
  onSelect: (roomId: string) => void;
}

/** Counts, charts, and a floor plan: the whole hotel at a glance. */
export function RoomBoardOverview({ board, t, selectedId, onSelect }: OverviewProps) {
  const { summary } = board;
  const calm = summary.occupied - summary.dueOut - summary.overdue;
  const open = summary.free - summary.reserved;
  const occupancy = percent(summary.occupied, summary.rooms);

  // The donut is cut into slices that start where the last one stopped.
  const slices = [
    { tone: 'occupied', count: calm },
    { tone: 'due', count: summary.dueOut },
    { tone: 'overdue', count: summary.overdue },
    { tone: 'reserved', count: summary.reserved },
    { tone: 'free', count: open },
  ];
  let offset = 0;
  const stops = slices
    .filter((slice) => slice.count > 0)
    .map((slice) => {
      const start = (offset / Math.max(1, summary.rooms)) * 100;
      offset += slice.count;
      const end = (offset / Math.max(1, summary.rooms)) * 100;
      return `var(--kz-rb-${slice.tone}) ${start}% ${end}%`;
    });
  const donut =
    stops.length > 0 ? `conic-gradient(${stops.join(', ')})` : 'conic-gradient(#e5e7eb 0 100%)';

  const guests = summary.guests;
  const guestParts = [
    { key: 'men', label: t.guestsMen, count: guests.male },
    { key: 'women', label: t.guestsWomen, count: guests.female },
    { key: 'children', label: t.guestsChildren, count: guests.children },
  ];

  const tiles = [
    { tone: 'plain', label: t.summaryRooms, value: summary.rooms, hint: '' },
    { tone: 'occupied', label: t.summaryOccupied, value: summary.occupied, hint: '' },
    { tone: 'free', label: t.summaryFree, value: summary.free, hint: '' },
    {
      tone: 'reserved',
      label: t.summaryReserved,
      value: summary.reserved,
      hint: t.summaryReservedHint,
    },
    { tone: 'due', label: t.summaryDueOut, value: summary.departuresToday, hint: '' },
    {
      tone: 'plain',
      label: t.summaryArrivals,
      value: summary.arrivalsToday,
      hint: t.summaryArrivalsHint,
    },
  ];
  if (summary.overdue > 0) {
    tiles.push({ tone: 'overdue', label: t.summaryOverdue, value: summary.overdue, hint: '' });
  }

  return (
    <div className="kz-stack kz-rb">
      <div className="kz-rb-tiles">
        {tiles.map((tile) => (
          <div key={tile.label} className={`kz-rb-tile kz-rb-tile-${tile.tone}`}>
            <strong>{tile.value}</strong>
            <span>{tile.label}</span>
            {tile.hint ? <small>{tile.hint}</small> : null}
          </div>
        ))}
      </div>

      <div className="kz-rb-charts">
        <section className="kz-panel kz-rb-chart">
          <h3>{t.occupancyTitle}</h3>
          <div className="kz-rb-donut-row">
            <div
              className="kz-rb-donut"
              style={{ background: donut }}
              role="img"
              aria-label={fill(t.occupancyPercent, { percent: occupancy })}
            >
              <div className="kz-rb-donut-hole">
                <strong>{occupancy}%</strong>
                <small>
                  {fill(t.occupancyOf, { taken: summary.occupied, rooms: summary.rooms })}
                </small>
              </div>
            </div>
            <ul className="kz-rb-legend">
              {[
                ['occupied', t.stateOccupied, calm],
                ['due', t.stateDueOut, summary.dueOut],
                ['overdue', t.stateOverdue, summary.overdue],
                ['reserved', t.stateReserved, summary.reserved],
                ['free', t.stateFree, open],
              ].map(([tone, label, count]) => (
                <li key={String(tone)}>
                  <span className={`kz-rb-dot kz-rb-dot-${tone}`} aria-hidden="true" />
                  {label}
                  <b>{count}</b>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="kz-panel kz-rb-chart">
          <h3>{t.capacityTitle}</h3>
          <p className="kz-rb-big">
            {fill(t.capacityFree, { free: summary.capacityFree })}
            <small>{fill(t.capacityOf, { total: summary.capacityTotal })}</small>
          </p>
          <div
            className="kz-rb-bar"
            role="img"
            aria-label={fill(t.capacityFree, { free: summary.capacityFree })}
          >
            <span
              className="kz-rb-bar-part kz-rb-bar-used"
              style={{ width: `${percent(summary.capacityUsed, summary.capacityTotal)}%` }}
            />
            <span
              className="kz-rb-bar-part kz-rb-bar-open"
              style={{ width: `${percent(summary.capacityFree, summary.capacityTotal)}%` }}
            />
          </div>
          <p className="kz-help">{fill(t.capacityUsed, { used: summary.capacityUsed })}</p>
        </section>

        <section className="kz-panel kz-rb-chart">
          <h3>{t.guestsTitle}</h3>
          {guests.total === 0 ? (
            <p className="kz-empty">{t.guestsNone}</p>
          ) : (
            <>
              <p className="kz-rb-big">
                {fill(t.guestsTotal, { count: guests.total, rooms: summary.occupied })}
              </p>
              <div className="kz-rb-bar" role="img" aria-label={t.guestsTitle}>
                {guestParts.map((part) => (
                  <span
                    key={part.key}
                    className={`kz-rb-bar-part kz-rb-guest-${part.key}`}
                    style={{ width: `${percent(part.count, guests.total)}%` }}
                  />
                ))}
              </div>
            </>
          )}
          <ul className="kz-rb-legend kz-rb-legend-row">
            {guestParts.map((part) => (
              <li key={part.key}>
                <span className={`kz-rb-dot kz-rb-guest-${part.key}`} aria-hidden="true" />
                {part.label}
                <b>{part.count}</b>
              </li>
            ))}
          </ul>
        </section>

        <section className="kz-panel kz-rb-chart">
          <h3>{t.typesTitle}</h3>
          <ul className="kz-rb-types">
            {board.types.map((type) => (
              <li key={type.roomTypeId}>
                <div className="kz-rb-type-head">
                  <span>{type.name}</span>
                  <b>{fill(t.typeFree, { free: type.free, rooms: type.rooms })}</b>
                </div>
                <div className="kz-rb-bar">
                  <span
                    className="kz-rb-bar-part kz-rb-bar-used"
                    style={{ width: `${percent(type.occupied, type.rooms)}%` }}
                  />
                  <span
                    className="kz-rb-bar-part kz-rb-bar-open"
                    style={{ width: `${percent(type.free, type.rooms)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="kz-panel kz-stack">
        <h3>{t.floorsTitle}</h3>
        <p className="kz-help">{t.floorsHelp}</p>
        <ul className="kz-rb-legend kz-rb-legend-row">
          {[
            ['free', t.stateFree],
            ['reserved', t.stateReserved],
            ['occupied', t.stateOccupied],
            ['due', t.stateDueOut],
            ['overdue', t.stateOverdue],
          ].map(([tone, label]) => (
            <li key={tone}>
              <span className={`kz-rb-dot kz-rb-dot-${tone}`} aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
        {board.floors.length === 0 ? <p className="kz-empty">{t.noRooms}</p> : null}
        {board.floors.map((floor) => (
          <div key={floor.id} className="kz-rb-floor">
            <h4>{floor.name}</h4>
            <div className="kz-rb-plan">
              {floor.rooms.map((room) => (
                <RoomTile
                  key={room.id}
                  room={room}
                  t={t}
                  selected={room.id === selectedId}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function RoomTile({
  room,
  t,
  selected,
  onSelect,
}: {
  room: RoomBoardRoom;
  t: RoomBoardText;
  selected: boolean;
  onSelect: (roomId: string) => void;
}) {
  const tone = roomStateTone(room.state);
  const guests = room.guests.male + room.guests.female + room.guests.children;
  let line = '';
  if (room.current) {
    const due = `${shortDate(room.current.to)} ${clockOf(room.current.plannedCheckOutAt)}`;
    line =
      room.state === 'OVERDUE' ? `${t.stateOverdue} · ${due}` : fill(t.outAtTime, { time: due });
  } else if (room.nextBooking) {
    line = room.freeUntil
      ? fill(t.freeUntilDate, { date: formatDisplayDate(room.freeUntil) })
      : t.stateReserved;
  } else {
    line = t.freeFromNow;
  }
  return (
    <button
      type="button"
      className={`kz-rb-room kz-rb-room-${tone}${selected ? ' kz-rb-room-selected' : ''}`}
      onClick={() => onSelect(room.id)}
      aria-pressed={selected}
      title={`${room.name} · ${stateText(t, room.state)}`}
    >
      <span className="kz-rb-room-name">{room.name}</span>
      <span className="kz-rb-room-type">{room.roomTypeName}</span>
      <span className="kz-rb-room-guests">
        {guests > 0
          ? fill(t.guestsInRoom, { count: guests })
          : fill(t.sleeps, { count: room.capacity })}
      </span>
      <span className="kz-rb-room-line">{line}</span>
    </button>
  );
}
