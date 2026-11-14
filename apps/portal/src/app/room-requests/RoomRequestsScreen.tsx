'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { messages } from '@knazawy/i18n';
import {
  ROOM_REQUEST_STATUS_LABELS,
  canRequestRooms,
  formatDisplayDate,
  isRoomRequestEditable,
  nextRoomRequestStatus,
  roomNights,
  roomRequestStatusTone,
  stayTotal,
  todayInKarachi,
  type RoomOfferRecord,
  type RoomRequestRecord,
} from '@knazawy/shared';
import { useEffect, useState } from 'react';

import { Field } from '../../components/Field';
import { ApiError, api, clearSession, readSessionUser } from '../../lib/session';

interface LineForm {
  roomTypeId: string;
  rooms: string;
}

const emptyLine = (): LineForm => ({ roomTypeId: '', rooms: '1' });

export function RoomRequestsScreen() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [offers, setOffers] = useState<RoomOfferRecord[]>([]);
  const [requests, setRequests] = useState<RoomRequestRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [checkIn, setCheckIn] = useState(todayInKarachi());
  const [checkOut, setCheckOut] = useState('');
  const [party, setParty] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<LineForm[]>([emptyLine()]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);

  function handleFailure(caught: unknown): void {
    if (caught instanceof ApiError && caught.status === 401) {
      clearSession();
      setUser(null);
      return;
    }
    setError(caught instanceof Error ? caught.message : 'Something went wrong. Try again.');
  }

  async function reload(): Promise<RoomRequestRecord[]> {
    const [nextOffers, nextRequests] = await Promise.all([
      api.listRoomOffers(),
      api.listRoomRequests(),
    ]);
    setOffers(nextOffers);
    setRequests(nextRequests);
    return nextRequests;
  }

  useEffect(() => {
    const session = readSessionUser();
    setUser(session);
    setReady(true);
    if (!session) return;
    void reload().catch((caught: unknown) => handleFailure(caught));
  }, []);

  if (!ready) return <p>Loading</p>;
  if (!user) {
    return (
      <p>
        <a href="/login">{messages.en.common.signIn}</a> to ask for rooms.
      </p>
    );
  }

  const canWrite = canRequestRooms(user.role);
  const nights = roomNights(checkIn, checkOut);
  const preview = nights
    ? stayTotal(
        lines
          .filter((line) => line.roomTypeId)
          .map((line) => ({
            rooms: Number(line.rooms),
            nightly: offers.find((offer) => offer.id === line.roomTypeId)?.nightlyTotal ?? '',
          })),
        nights,
      )
    : null;

  function resetForm(): void {
    setEditingId(null);
    setCheckIn(todayInKarachi());
    setCheckOut('');
    setParty('');
    setNote('');
    setLines([emptyLine()]);
  }

  function edit(request: RoomRequestRecord): void {
    setEditingId(request.id);
    setCheckIn(request.checkIn);
    setCheckOut(request.checkOut);
    setParty(request.party ?? '');
    setNote(request.note ?? '');
    setLines(
      request.lines.map((line) => ({ roomTypeId: line.roomTypeId, rooms: String(line.rooms) })),
    );
    setSaved('');
    setError('');
  }

  async function save(send: boolean): Promise<void> {
    setBusy(true);
    setError('');
    setSaved('');
    try {
      const input = {
        checkIn,
        checkOut,
        party: party.trim(),
        note: note.trim(),
        lines: lines.map((line) => ({ roomTypeId: line.roomTypeId, rooms: Number(line.rooms) })),
      };
      const draft = editingId
        ? await api.updateRoomRequest(editingId, input)
        : await api.createRoomRequest(input);
      const record = send ? await api.submitRoomRequest(draft.id) : draft;
      await reload();
      resetForm();
      setSaved(send ? `${record.number} was sent.` : `${record.number} is saved as a draft.`);
    } catch (caught: unknown) {
      handleFailure(caught);
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string): Promise<void> {
    setBusy(true);
    setError('');
    setSaved('');
    try {
      const record = await api.cancelRoomRequest(id);
      await reload();
      if (editingId === id) resetForm();
      setSaved(`${record.number} is cancelled.`);
    } catch (caught: unknown) {
      handleFailure(caught);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="kz-stack">
      <div className="kz-page-head">
        <h1>{messages.en.common.roomRequests}</h1>
        <p>Ask for rooms by type. The price is the charges Karam has set for one night.</p>
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
      {canWrite ? (
        <form
          className="kz-panel kz-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save(false);
          }}
        >
          <h2>{editingId ? 'Edit draft' : 'New stay'}</h2>
          <div className="kz-form-grid">
            <Field label="Check-in" hint="Shown as DD/MM/YYYY.">
              <input
                type="date"
                value={checkIn}
                min={todayInKarachi()}
                onChange={(event) => setCheckIn(event.target.value)}
                required
              />
            </Field>
            <Field label="Check-out" hint="The morning after the last night.">
              <input
                type="date"
                value={checkOut}
                min={checkIn}
                onChange={(event) => setCheckOut(event.target.value)}
                required
              />
            </Field>
            <Field label="Who the rooms are for">
              <input
                value={party}
                maxLength={120}
                onChange={(event) => setParty(event.target.value)}
              />
            </Field>
            <Field label="Note">
              <input
                value={note}
                maxLength={500}
                onChange={(event) => setNote(event.target.value)}
              />
            </Field>
          </div>
          {lines.map((line, index) => (
            <div className="kz-form-grid" key={index}>
              <Field label="Room type">
                <select
                  value={line.roomTypeId}
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, roomTypeId: event.target.value } : item,
                      ),
                    )
                  }
                  required
                >
                  <option value="">Choose a room type</option>
                  {offers.map((offer) => (
                    <option key={offer.id} value={offer.id}>
                      {offer.name} · {offer.nightlyTotal} PKR · {offer.rooms} rooms
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Rooms">
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={line.rooms}
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, rooms: event.target.value } : item,
                      ),
                    )
                  }
                  required
                />
              </Field>
            </div>
          ))}
          <p>{nights ? `${nights} nights` : 'Choose a check-out after check-in.'}</p>
          <p>{preview ? `About ${preview} PKR at today's charges.` : null}</p>
          <div className="kz-actions">
            <button
              type="button"
              className="kz-button-quiet"
              disabled={busy || lines.length >= 12}
              onClick={() => setLines((current) => [...current, emptyLine()])}
            >
              Add a room type
            </button>
            {lines.length > 1 ? (
              <button
                type="button"
                className="kz-button-quiet"
                disabled={busy}
                onClick={() => setLines((current) => current.slice(0, -1))}
              >
                Remove last
              </button>
            ) : null}
            <button type="submit" className="kz-button" disabled={busy}>
              Save draft
            </button>
            <button
              type="button"
              className="kz-button"
              disabled={busy}
              onClick={() => void save(true)}
            >
              Send request
            </button>
            {editingId ? (
              <button type="button" className="kz-button-quiet" disabled={busy} onClick={resetForm}>
                Clear
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
      {requests.length === 0 ? <p className="kz-empty">No room requests yet.</p> : null}
      {requests.map((request) => (
        <article key={request.id} className="kz-panel kz-stack">
          <h2>
            {request.number}{' '}
            <span className="kz-status" data-tone={roomRequestStatusTone(request.status)}>
              {ROOM_REQUEST_STATUS_LABELS[request.status]}
            </span>
          </h2>
          <p>
            {formatDisplayDate(request.checkIn)} to {formatDisplayDate(request.checkOut)} ·{' '}
            {request.nights} nights · {request.total} PKR
            {request.lines.some((line) => line.quoted) ? '' : ' at current charges'}
          </p>
          {request.party ? <p>{request.party}</p> : null}
          {request.decisionNote ? <p>{request.decisionNote}</p> : null}
          <ul>
            {request.lines.map((line) => (
              <li key={line.roomTypeId}>
                {line.rooms} {line.roomTypeName} · {line.nightly} PKR a night · {line.amount} PKR
                {request.status === 'ACCEPTED'
                  ? ` · ${line.checkedIn} of ${line.rooms} checked in`
                  : ''}
              </li>
            ))}
          </ul>
          <div className="kz-actions">
            {canWrite && isRoomRequestEditable(request.status) ? (
              <button
                type="button"
                className="kz-button-quiet"
                disabled={busy}
                onClick={() => edit(request)}
              >
                Edit
              </button>
            ) : null}
            {canWrite && nextRoomRequestStatus(request.status, 'cancel') ? (
              <button
                type="button"
                className="kz-button-quiet"
                disabled={busy}
                onClick={() => void act(request.id)}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </article>
      ))}
    </section>
  );
}
