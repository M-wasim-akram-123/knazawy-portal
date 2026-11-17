'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { staffRoomRequestsCopy } from '@knazawy/i18n';
import {
  ROOM_REQUEST_STATUS_LABELS,
  canDecideRoomRequest,
  canManageRoomStays,
  formatDisplayDate,
  formatKarachiDateTime,
  roomRequestStatusTone,
  roomStayWindowError,
  roomsToCheckIn,
  todayInKarachi,
  type FreeRoomRecord,
  type RoomAvailabilityRecord,
  type RoomRequestRecord,
} from '@knazawy/shared';
import {
  FormDialog,
  KaramLoader,
  Pagination,
  RequestFilters,
  usePage,
  useRequestFilters,
} from '@knazawy/ui-shell';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { fill, useCopy, useCommon, useLabel } from '../../lib/i18n';
import { api, readSessionUser } from '../../lib/session';
import { Field } from '../master/Field';

export function RoomRequestsScreen() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [requests, setRequests] = useState<RoomRequestRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [freeRooms, setFreeRooms] = useState<FreeRoomRecord[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const t = useCopy(staffRoomRequestsCopy);
  const common = useCommon();
  const label = useLabel();
  const [detailOpen, setDetailOpen] = useState(false);
  const [availability, setAvailability] = useState<RoomAvailabilityRecord | null>(null);
  const [availabilityError, setAvailabilityError] = useState('');
  const filters = useRequestFilters(requests, requestSearchText);
  const page = usePage(filters.shown, 10);

  useEffect(() => {
    const session = readSessionUser();
    setUser(session);
    setReady(true);
    if (!session) return;
    void api
      .listRoomRequests()
      .then((rows) => {
        setRequests(rows);
      })
      .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
  }, []);

  const selectedStatus = requests.find((row) => row.id === selectedId)?.status ?? null;
  // A sent stay shows whether its rooms are free before anyone decides, like the stock check
  // on airline orders. It is the same count the server uses when the stay is accepted.
  useEffect(() => {
    setAvailability(null);
    setAvailabilityError('');
    if (!selectedId || selectedStatus !== 'SUBMITTED') return;
    let current = true;
    api
      .roomRequestAvailability(selectedId)
      .then((record) => {
        if (current) setAvailability(record);
      })
      .catch((caught: unknown) => {
        if (current) setAvailabilityError(explainApiError(caught, setUser));
      });
    return () => {
      current = false;
    };
  }, [selectedId, selectedStatus]);

  if (!ready) return <KaramLoader label={t.loading} fullPage />;
  if (!user) {
    return (
      <p>
        <Link href="/login">{common.signIn}</Link> {t.signInSuffix}
      </p>
    );
  }

  const canDecide = canDecideRoomRequest(user.role);
  const canStay = canManageRoomStays(user.role);
  const selected = requests.find((row) => row.id === selectedId) ?? null;
  const windowHint =
    selected && roomStayWindowError(todayInKarachi(), selected.checkIn, selected.checkOut)
      ? todayInKarachi() < selected.checkIn
        ? t.checkInOpensLater
        : t.stayEnded
      : null;

  function loadFreeRooms(record: RoomRequestRecord | undefined, session: SessionUser): void {
    setFreeRooms([]);
    setPicked([]);
    if (!record || record.status !== 'ACCEPTED' || !canManageRoomStays(session.role)) return;
    if (roomStayWindowError(todayInKarachi(), record.checkIn, record.checkOut)) return;
    api
      .freeRoomsForRequest(record.id)
      .then((rows) => setFreeRooms(rows))
      .catch(() => setFreeRooms([]));
  }

  function replace(record: RoomRequestRecord): void {
    setRequests((current) => current.map((row) => (row.id === record.id ? record : row)));
  }

  async function decide(action: 'accept' | 'reject'): Promise<void> {
    if (!selected) return;
    setBusy(true);
    setError('');
    setSaved('');
    try {
      const record =
        action === 'accept'
          ? await api.acceptRoomRequest(selected.id)
          : await api.rejectRoomRequest(selected.id, reason.trim());
      replace(record);
      setReason('');
      setSaved(fill(action === 'accept' ? t.isAccepted : t.isRejected, { number: record.number }));
      if (user) loadFreeRooms(record, user);
    } catch (caught: unknown) {
      setError(explainApiError(caught, setUser));
    } finally {
      setBusy(false);
    }
  }

  async function checkIn(): Promise<void> {
    if (!selected || picked.length === 0) return;
    setBusy(true);
    setError('');
    setSaved('');
    try {
      const record = await api.checkInRoomRequest(selected.id, picked);
      replace(record);
      setSaved(
        fill(picked.length === 1 ? t.guestCheckedIn : t.guestsCheckedIn, { count: picked.length }),
      );
      if (user) loadFreeRooms(record, user);
    } catch (caught: unknown) {
      setError(explainApiError(caught, setUser));
    } finally {
      setBusy(false);
    }
  }

  async function checkOut(stayId: string): Promise<void> {
    if (!selected) return;
    setBusy(true);
    setError('');
    setSaved('');
    try {
      const record = await api.checkOutRoomStay(selected.id, stayId);
      replace(record);
      setSaved(t.roomCheckedOut);
      if (user) loadFreeRooms(record, user);
    } catch (caught: unknown) {
      setError(explainApiError(caught, setUser));
    } finally {
      setBusy(false);
    }
  }

  function togglePick(roomId: string): void {
    setPicked((current) =>
      current.includes(roomId) ? current.filter((id) => id !== roomId) : [...current, roomId],
    );
  }

  const stillToCheckIn = selected
    ? selected.lines.reduce((sum, line) => sum + roomsToCheckIn(line.rooms, line.checkedIn), 0)
    : 0;

  return (
    <section className="kz-stack">
      <div className="kz-page-head">
        <h1>{common.roomRequests}</h1>
        <p>{t.intro}</p>
      </div>
      <div className="kz-panel kz-table-wrap">
        <h2>{t.sentRequests}</h2>
        <RequestFilters
          filters={filters}
          copy={t}
          statusLabel={(status) =>
            label(ROOM_REQUEST_STATUS_LABELS[status as keyof typeof ROOM_REQUEST_STATUS_LABELS])
          }
          onChange={() => page.setPage(1)}
        />
        {requests.length > 0 && filters.shown.length === 0 ? (
          <p className="kz-empty">{t.noMatches}</p>
        ) : null}
        {requests.length === 0 ? (
          <p className="kz-empty">{t.noRequests}</p>
        ) : (
          <table className="kz-table">
            <thead>
              <tr>
                <th>{t.number}</th>
                <th>{t.airline}</th>
                <th>{t.checkInDate}</th>
                <th>{t.checkOutDate}</th>
                <th>{t.roomsColumn}</th>
                <th>{t.status}</th>
              </tr>
            </thead>
            <tbody>
              {page.rows.map((row) => (
                <tr
                  key={row.id}
                  className="kz-row-clickable"
                  aria-selected={row.id === selectedId}
                  onClick={() => {
                    setSelectedId(row.id);
                    setReason('');
                    setSaved('');
                    setError('');
                    loadFreeRooms(row, user);
                    setDetailOpen(true);
                  }}
                >
                  <td>
                    {/* The number stays a link so the row can be reached and opened from the keyboard. */}
                    <a
                      href={`#${row.id}`}
                      aria-current={row.id === selectedId ? 'true' : undefined}
                      onClick={(event) => event.preventDefault()}
                    >
                      {row.number}
                    </a>
                  </td>
                  <td>{row.airlineName}</td>
                  <td>{formatDisplayDate(row.checkIn)}</td>
                  <td>{formatDisplayDate(row.checkOut)}</td>
                  <td>{row.lines.reduce((sum, line) => sum + line.rooms, 0)}</td>
                  <td>
                    <span className="kz-status" data-tone={roomRequestStatusTone(row.status)}>
                      {label(ROOM_REQUEST_STATUS_LABELS[row.status])}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination
          page={page.page}
          pageCount={page.pageCount}
          total={page.total}
          from={page.from}
          to={page.to}
          onPage={page.setPage}
          labels={common}
        />
        {error && !detailOpen ? (
          <p className="kz-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <FormDialog
        buttonLabel={selected?.number ?? ''}
        title={selected?.number ?? ''}
        showTrigger={false}
        isOpen={detailOpen && selected !== null}
        onOpenChange={(open) => {
          if (!open) setDetailOpen(false);
        }}
      >
        {() => (
          <div className="kz-order">
            {selected ? (
              <>
                <div className="kz-order-head">
                  <span className="kz-status" data-tone={roomRequestStatusTone(selected.status)}>
                    {label(ROOM_REQUEST_STATUS_LABELS[selected.status])}
                  </span>
                  <strong className="kz-order-airline">{selected.airlineName}</strong>
                </div>

                <dl className="kz-order-facts">
                  <div>
                    <dt>{t.factStay}</dt>
                    <dd>
                      {formatDisplayDate(selected.checkIn)} → {formatDisplayDate(selected.checkOut)}
                    </dd>
                  </div>
                  <div>
                    <dt>{t.factNights}</dt>
                    <dd>{selected.nights}</dd>
                  </div>
                  <div>
                    <dt>{t.roomsColumn}</dt>
                    <dd>{selected.lines.reduce((sum, line) => sum + line.rooms, 0)}</dd>
                  </div>
                  <div>
                    <dt>{t.factTotal}</dt>
                    <dd>{selected.total} PKR</dd>
                  </div>
                  {selected.party ? (
                    <div>
                      <dt>{t.factParty}</dt>
                      <dd>{selected.party}</dd>
                    </div>
                  ) : null}
                </dl>

                <section className="kz-order-section">
                  <h3>{t.roomsRequested}</h3>
                  <div className="kz-table-wrap">
                    <table className="kz-table">
                      <thead>
                        <tr>
                          <th>{t.roomType}</th>
                          <th>{t.roomsColumn}</th>
                          <th>{t.nightly}</th>
                          <th>{t.amount}</th>
                          {selected.status === 'ACCEPTED' ? <th>{t.checkedIn}</th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {selected.lines.map((line) => (
                          <tr key={line.roomTypeId}>
                            <td>
                              {line.roomTypeName}
                              {line.quoted ? (
                                <span className="kz-help"> · {t.fixedPrice}</span>
                              ) : null}
                            </td>
                            <td>{line.rooms}</td>
                            <td>{line.nightly} PKR</td>
                            <td>{line.amount} PKR</td>
                            {selected.status === 'ACCEPTED' ? (
                              <td>
                                {fill(t.checkedInCount, {
                                  done: line.checkedIn,
                                  rooms: line.rooms,
                                })}
                              </td>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {selected.status === 'SUBMITTED' ? (
                  <section className="kz-order-section">
                    <h3>{t.availabilityTitle}</h3>
                    {availabilityError ? (
                      <p className="kz-error" role="alert">
                        {fill(t.availabilityFailed, { error: availabilityError })}
                      </p>
                    ) : availability?.requestId !== selected.id ? (
                      <p className="kz-help">{t.checkingRooms}</p>
                    ) : (
                      <>
                        <p>
                          <span
                            className="kz-status"
                            data-tone={availability.canAccept ? 'done' : 'problem'}
                          >
                            {availability.canAccept ? t.roomsFree : t.roomsShort}
                          </span>{' '}
                          {availability.canAccept ? t.roomsFreeText : t.roomsShortText}
                        </p>
                        <div className="kz-table-wrap">
                          <table className="kz-table">
                            <thead>
                              <tr>
                                <th>{t.roomType}</th>
                                <th>{t.asked}</th>
                                <th>{t.totalRooms}</th>
                                <th>{t.alreadyBooked}</th>
                                <th>{t.freeRooms}</th>
                                <th>{t.shortRooms}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {availability.lines.map((line) => (
                                <tr key={line.roomTypeId}>
                                  <td>{line.roomTypeName}</td>
                                  <td>{line.asked}</td>
                                  <td>{line.rooms}</td>
                                  <td>{line.booked}</td>
                                  <td>{line.free}</td>
                                  <td>
                                    <span
                                      className="kz-status"
                                      data-tone={line.short === 0 ? 'done' : 'problem'}
                                    >
                                      {line.short === 0 ? t.noneShort : line.short}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </section>
                ) : null}

                {selected.note || selected.decisionNote ? (
                  <section className="kz-order-section">
                    <h3>{t.notesTitle}</h3>
                    <ul className="kz-order-notes">
                      {selected.note ? <li>{selected.note}</li> : null}
                      {selected.decisionNote ? <li>{selected.decisionNote}</li> : null}
                    </ul>
                  </section>
                ) : null}

                {canStay && selected.status === 'ACCEPTED' ? (
                  <section className="kz-order-section">
                    <h3>{t.checkIn}</h3>
                    {windowHint ? (
                      <p className="kz-help">{windowHint}</p>
                    ) : stillToCheckIn === 0 ? (
                      <p className="kz-help">{t.allCheckedIn}</p>
                    ) : freeRooms.length === 0 ? (
                      <p className="kz-help">{t.noFreeRooms}</p>
                    ) : (
                      <>
                        <p className="kz-help">
                          {fill(t.stillToCheckIn, { count: stillToCheckIn })}
                        </p>
                        <div className="kz-check-grid">
                          {freeRooms.map((room) => (
                            <label key={room.id} className="kz-check">
                              <input
                                type="checkbox"
                                checked={picked.includes(room.id)}
                                onChange={() => togglePick(room.id)}
                              />
                              <span>
                                {room.name} · {room.floorName} · {room.roomTypeName}
                              </span>
                            </label>
                          ))}
                        </div>
                        <div className="kz-order-actions">
                          <button
                            type="button"
                            className="kz-button"
                            disabled={busy || picked.length === 0}
                            onClick={() => void checkIn()}
                          >
                            {picked.length > 0
                              ? fill(t.checkInCountSelected, { count: picked.length })
                              : t.checkInSelected}
                          </button>
                        </div>
                      </>
                    )}
                  </section>
                ) : null}

                {selected.stays.length > 0 ? (
                  <section className="kz-order-section">
                    <h3>{t.roomsInUse}</h3>
                    <div className="kz-table-wrap">
                      <table className="kz-table">
                        <thead>
                          <tr>
                            <th>{t.room}</th>
                            <th>{t.floor}</th>
                            <th>{t.type}</th>
                            <th>{t.checkedIn}</th>
                            <th>{t.status}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selected.stays.map((stay) => (
                            <tr key={stay.id}>
                              <td>{stay.roomName}</td>
                              <td>{stay.floorName}</td>
                              <td>{stay.roomTypeName}</td>
                              <td>{formatKarachiDateTime(new Date(stay.checkedInAt))}</td>
                              <td>
                                {stay.checkedOutAt ? (
                                  fill(t.outAt, {
                                    time: formatKarachiDateTime(new Date(stay.checkedOutAt)),
                                  })
                                ) : canStay ? (
                                  <button
                                    type="button"
                                    className="kz-button-quiet"
                                    disabled={busy}
                                    onClick={() => void checkOut(stay.id)}
                                  >
                                    {t.checkOut}
                                  </button>
                                ) : (
                                  t.inRoom
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ) : null}

                {canDecide && selected.status === 'SUBMITTED' ? (
                  <section className="kz-order-section kz-order-decision">
                    <h3>{t.decisionTitle}</h3>
                    {availability?.requestId === selected.id && !availability.canAccept ? (
                      <p className="kz-order-warning">{t.roomsShortText}</p>
                    ) : null}
                    <Field label={t.reasonForRejecting} hint={t.rejectHint}>
                      <input
                        value={reason}
                        maxLength={500}
                        onChange={(event) => setReason(event.target.value)}
                      />
                    </Field>
                    <div className="kz-order-actions">
                      <button
                        type="button"
                        className="kz-button kz-button-outline"
                        disabled={busy || reason.trim().length < 3}
                        onClick={() => void decide('reject')}
                      >
                        {t.reject}
                      </button>
                      <button
                        type="button"
                        className="kz-button"
                        disabled={
                          busy ||
                          (availability?.requestId === selected.id && !availability.canAccept)
                        }
                        onClick={() => void decide('accept')}
                      >
                        {t.accept}
                      </button>
                    </div>
                  </section>
                ) : null}
              </>
            ) : null}
            {error ? (
              <p className="kz-error" role="alert">
                {error}
              </p>
            ) : null}
            {saved ? (
              <p className="kz-order-saved" role="status">
                {saved}
              </p>
            ) : null}
          </div>
        )}
      </FormDialog>
    </section>
  );
}

/** What the search box looks in. */
function requestSearchText(row: RoomRequestRecord): string {
  return [row.number, row.airlineName, row.party ?? ''].join(' ');
}
