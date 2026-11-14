'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { messages } from '@knazawy/i18n';
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
  type RoomRequestRecord,
} from '@knazawy/shared';
import { useEffect, useState } from 'react';

import { explainApiError } from '../../lib/explain';
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

  useEffect(() => {
    const session = readSessionUser();
    setUser(session);
    setReady(true);
    if (!session) return;
    void api
      .listRoomRequests()
      .then((rows) => {
        setRequests(rows);
        setSelectedId(rows[0]?.id ?? null);
        loadFreeRooms(rows[0], session);
      })
      .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
  }, []);

  if (!ready) return <p>Loading room requests</p>;
  if (!user) {
    return (
      <p>
        <a href="/login">{messages.en.common.signIn}</a> to see room requests.
      </p>
    );
  }

  const canDecide = canDecideRoomRequest(user.role);
  const canStay = canManageRoomStays(user.role);
  const selected = requests.find((row) => row.id === selectedId) ?? null;
  const windowHint = selected
    ? roomStayWindowError(todayInKarachi(), selected.checkIn, selected.checkOut)
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
      setSaved(
        action === 'accept' ? `${record.number} is accepted.` : `${record.number} is rejected.`,
      );
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
      setSaved(`${picked.length} ${picked.length === 1 ? 'guest is' : 'guests are'} checked in.`);
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
      setSaved('The room is checked out.');
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
        <h1>{messages.en.common.roomRequests}</h1>
        <p>
          Accept a stay only when those rooms are free. The nightly price is fixed when you accept.
          Check guests in to the rooms they will sleep in, and check them out when they leave.
        </p>
        <p lang="ur" dir="rtl">
          {messages.ur.common.roomRequests}
        </p>
      </div>
      {error ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? <p>{saved}</p> : null}
      <div className="kz-workspace">
        <div className="kz-panel">
          {requests.length === 0 ? <p className="kz-empty">No room requests yet.</p> : null}
          {requests.length > 0 ? (
            <div className="kz-table-wrap">
              <table className="kz-table">
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Airline</th>
                    <th>Check-in</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <a
                          href={`#${row.id}`}
                          aria-current={row.id === selectedId ? 'true' : undefined}
                          onClick={(event) => {
                            event.preventDefault();
                            setSelectedId(row.id);
                            setReason('');
                            setSaved('');
                            setError('');
                            loadFreeRooms(row, user);
                          }}
                        >
                          {row.number}
                        </a>
                      </td>
                      <td>{row.airlineName}</td>
                      <td>{formatDisplayDate(row.checkIn)}</td>
                      <td>
                        <span className="kz-status" data-tone={roomRequestStatusTone(row.status)}>
                          {ROOM_REQUEST_STATUS_LABELS[row.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
        <div className="kz-panel kz-stack">
          {selected ? (
            <>
              <h2>{selected.number}</h2>
              <p>
                <span className="kz-status" data-tone={roomRequestStatusTone(selected.status)}>
                  {ROOM_REQUEST_STATUS_LABELS[selected.status]}
                </span>
                {' · '}
                {selected.airlineName}
              </p>
              <p>
                {formatDisplayDate(selected.checkIn)} to {formatDisplayDate(selected.checkOut)} ·{' '}
                {selected.nights} nights · {selected.total} PKR
              </p>
              {selected.party ? <p>{selected.party}</p> : null}
              {selected.note ? <p>{selected.note}</p> : null}
              {selected.decisionNote ? <p>{selected.decisionNote}</p> : null}
              <ul>
                {selected.lines.map((line) => (
                  <li key={line.roomTypeId}>
                    {line.rooms} {line.roomTypeName} · {line.nightly} PKR a night · {line.amount}{' '}
                    PKR
                    {line.quoted ? ' (fixed)' : ''}
                    {selected.status === 'ACCEPTED'
                      ? ` · ${line.checkedIn} of ${line.rooms} checked in`
                      : ''}
                  </li>
                ))}
              </ul>

              {canDecide && selected.status === 'SUBMITTED' ? (
                <form
                  className="kz-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void decide('reject');
                  }}
                >
                  <Field label="Reason for rejecting">
                    <input
                      value={reason}
                      maxLength={500}
                      onChange={(event) => setReason(event.target.value)}
                    />
                  </Field>
                  <div className="kz-actions">
                    <button
                      type="button"
                      className="kz-button"
                      disabled={busy}
                      onClick={() => void decide('accept')}
                    >
                      Accept
                    </button>
                    <button type="submit" className="kz-button-quiet" disabled={busy}>
                      Reject
                    </button>
                  </div>
                </form>
              ) : null}

              {canStay && selected.status === 'ACCEPTED' ? (
                <section className="kz-stack">
                  <h3>Check in</h3>
                  {windowHint ? (
                    <p className="kz-help">{windowHint}</p>
                  ) : stillToCheckIn === 0 ? (
                    <p className="kz-help">Every room on this stay is checked in.</p>
                  ) : freeRooms.length === 0 ? (
                    <p className="kz-help">No rooms of these types are free right now.</p>
                  ) : (
                    <>
                      <p className="kz-help">
                        {stillToCheckIn} still to check in. Pick the rooms the guests move into.
                      </p>
                      <div className="kz-stack">
                        {freeRooms.map((room) => (
                          <label key={room.id} className="kz-field">
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
                      <div className="kz-actions">
                        <button
                          type="button"
                          className="kz-button"
                          disabled={busy || picked.length === 0}
                          onClick={() => void checkIn()}
                        >
                          Check in {picked.length > 0 ? picked.length : ''} selected
                        </button>
                      </div>
                    </>
                  )}
                </section>
              ) : null}

              {selected.stays.length > 0 ? (
                <section className="kz-stack">
                  <h3>Rooms in use</h3>
                  <div className="kz-table-wrap">
                    <table className="kz-table">
                      <thead>
                        <tr>
                          <th>Room</th>
                          <th>Floor</th>
                          <th>Type</th>
                          <th>Checked in</th>
                          <th>Status</th>
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
                                `Out ${formatKarachiDateTime(new Date(stay.checkedOutAt))}`
                              ) : canStay ? (
                                <button
                                  type="button"
                                  className="kz-button-quiet"
                                  disabled={busy}
                                  onClick={() => void checkOut(stay.id)}
                                >
                                  Check out
                                </button>
                              ) : (
                                'In'
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}
            </>
          ) : (
            <p className="kz-empty">Select a request.</p>
          )}
        </div>
      </div>
    </section>
  );
}
