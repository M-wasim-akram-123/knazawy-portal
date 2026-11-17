'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { portalRoomRequestsCopy } from '@knazawy/i18n';
import {
  ROOM_REQUEST_STATUS_LABELS,
  canRequestRooms,
  formatDisplayDate,
  formatKarachiDateTime,
  isRoomRequestEditable,
  nextRoomRequestStatus,
  roomNights,
  roomRequestStatusTone,
  stayTotal,
  todayInKarachi,
  type BranchRecord,
  type RoomOfferRecord,
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

import { Field } from '../../components/Field';
import { fill, useChrome, useCommon, useCopy, useLabel } from '../../lib/i18n';
import { ApiError, api, clearSession, readSessionUser } from '../../lib/session';

interface LineForm {
  roomTypeId: string;
  rooms: string;
}

const emptyLine = (): LineForm => ({ roomTypeId: '', rooms: '1' });

export function RoomRequestsScreen() {
  const t = useCopy(portalRoomRequestsCopy);
  const common = useCommon();
  const chrome = useChrome();
  const label = useLabel();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [offers, setOffers] = useState<RoomOfferRecord[]>([]);
  const [branches, setBranches] = useState<BranchRecord[]>([]);
  const [branchId, setBranchId] = useState('');
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const filters = useRequestFilters(requests, requestSearchText);
  const page = usePage(filters.shown, 10);

  function handleFailure(caught: unknown): void {
    if (caught instanceof ApiError && caught.status === 401) {
      clearSession();
      setUser(null);
      return;
    }
    setError(caught instanceof Error ? caught.message : t.genericError);
  }

  async function reload(chosenBranch?: string): Promise<RoomRequestRecord[]> {
    const nextBranches = await api.listStayBranches();
    const chosen = chosenBranch || branchId || nextBranches[0]?.id || '';
    const [nextOffers, nextRequests] = await Promise.all([
      chosen ? api.listRoomOffers(chosen) : Promise.resolve([]),
      api.listRoomRequests(),
    ]);
    setBranches(nextBranches);
    setBranchId(chosen);
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

  if (!ready) return <KaramLoader label={chrome.loading} fullPage />;
  if (!user) {
    const [beforeLink, afterLink] = t.signInToAsk.split('{link}');
    return (
      <p>
        {beforeLink}
        <Link href="/login">{common.signIn}</Link>
        {afterLink}
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
    setBranchId(request.branchId);
    setCheckIn(request.checkIn);
    setCheckOut(request.checkOut);
    setParty(request.party ?? '');
    setNote(request.note ?? '');
    setLines(
      request.lines.map((line) => ({ roomTypeId: line.roomTypeId, rooms: String(line.rooms) })),
    );
    setSaved('');
    setError('');
    // Only one dialog is open at a time, so the detail pop-up closes first.
    setDetailOpen(false);
    setDialogOpen(true);
  }

  function openDetail(request: RoomRequestRecord): void {
    setSelectedId(request.id);
    setSaved('');
    setError('');
    setDetailOpen(true);
  }

  const selected = requests.find((row) => row.id === selectedId) ?? null;
  const canEdit = (request: RoomRequestRecord): boolean =>
    canWrite && isRoomRequestEditable(request.status);
  const canCancel = (request: RoomRequestRecord): boolean =>
    canWrite && nextRoomRequestStatus(request.status, 'cancel') !== null;

  async function save(send: boolean): Promise<void> {
    setBusy(true);
    setError('');
    setSaved('');
    try {
      const input = {
        checkIn,
        checkOut,
        branchId,
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
      setSaved(fill(send ? t.sent : t.savedDraft, { number: record.number }));
      setDialogOpen(false);
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
      if (editingId === id) {
        resetForm();
        setDialogOpen(false);
      }
      setSaved(fill(t.cancelled, { number: record.number }));
    } catch (caught: unknown) {
      handleFailure(caught);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="kz-stack">
      <div className="kz-page-head kz-page-action-head">
        <div>
          <h1>{common.roomRequests}</h1>
          <p>{t.intro}</p>
        </div>
        {canWrite ? (
          <button
            className="kz-button kz-form-dialog-trigger"
            type="button"
            aria-haspopup="dialog"
            onClick={() => {
              resetForm();
              setError('');
              setSaved('');
              setDialogOpen(true);
            }}
          >
            {t.newStay}
          </button>
        ) : null}
      </div>
      {error && !detailOpen ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      {saved && !detailOpen ? <p>{saved}</p> : null}
      {canWrite ? (
        <FormDialog
          buttonLabel={t.newStay}
          title={editingId ? t.editDraft : t.newStay}
          showTrigger={false}
          isOpen={dialogOpen}
          onOpenChange={setDialogOpen}
        >
          {() => (
            <form
              className="kz-form"
              onSubmit={(event) => {
                event.preventDefault();
                void save(false);
              }}
            >
              <div className="kz-form-grid">
                <Field label={t.branch}>
                  <select
                    value={branchId}
                    onChange={(event) => {
                      const next = event.target.value;
                      setBranchId(next);
                      void api.listRoomOffers(next).then(setOffers).catch(handleFailure);
                    }}
                    required
                  >
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t.checkIn} hint={t.checkInHint}>
                  <input
                    type="date"
                    value={checkIn}
                    min={todayInKarachi()}
                    onChange={(event) => setCheckIn(event.target.value)}
                    required
                  />
                </Field>
                <Field label={t.checkOut} hint={t.checkOutHint}>
                  <input
                    type="date"
                    value={checkOut}
                    min={checkIn}
                    onChange={(event) => setCheckOut(event.target.value)}
                    required
                  />
                </Field>
                <Field label={t.party}>
                  <input
                    value={party}
                    maxLength={120}
                    onChange={(event) => setParty(event.target.value)}
                  />
                </Field>
                <Field label={t.note}>
                  <input
                    value={note}
                    maxLength={500}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </Field>
              </div>
              {lines.map((line, index) => (
                <div className="kz-form-grid" key={index}>
                  <Field label={t.roomType}>
                    <select
                      value={line.roomTypeId}
                      onChange={(event) =>
                        setLines((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, roomTypeId: event.target.value }
                              : item,
                          ),
                        )
                      }
                      required
                    >
                      <option value="">{t.chooseRoomType}</option>
                      {offers.map((offer) => (
                        <option key={offer.id} value={offer.id}>
                          {fill(t.offerOption, {
                            name: offer.name,
                            nightly: offer.nightlyTotal,
                            rooms: offer.rooms,
                          })}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t.rooms}>
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
              {error ? (
                <p className="kz-error" role="alert">
                  {error}
                </p>
              ) : null}
              <p>{nights ? fill(t.nightsCount, { nights }) : t.chooseCheckOut}</p>
              <p>{preview ? fill(t.preview, { total: preview }) : null}</p>
              <div className="kz-actions">
                <button
                  type="button"
                  className="kz-button-quiet"
                  disabled={busy || lines.length >= 12}
                  onClick={() => setLines((current) => [...current, emptyLine()])}
                >
                  {t.addRoomType}
                </button>
                {lines.length > 1 ? (
                  <button
                    type="button"
                    className="kz-button-quiet"
                    disabled={busy}
                    onClick={() => setLines((current) => current.slice(0, -1))}
                  >
                    {t.removeLast}
                  </button>
                ) : null}
                <button type="submit" className="kz-button" disabled={busy}>
                  {t.saveDraft}
                </button>
                <button
                  type="button"
                  className="kz-button"
                  disabled={busy}
                  onClick={() => void save(true)}
                >
                  {t.sendRequest}
                </button>
                {editingId ? (
                  <button
                    type="button"
                    className="kz-button-quiet"
                    disabled={busy}
                    onClick={resetForm}
                  >
                    {t.clear}
                  </button>
                ) : null}
              </div>
            </form>
          )}
        </FormDialog>
      ) : null}
      <div className="kz-panel kz-table-wrap">
        <h2>{t.yourRequests}</h2>
        <RequestFilters
          filters={filters}
          copy={t}
          statusLabel={(status) =>
            label(ROOM_REQUEST_STATUS_LABELS[status as keyof typeof ROOM_REQUEST_STATUS_LABELS])
          }
          onChange={() => page.setPage(1)}
          showAirline={false}
        />
        {requests.length > 0 && filters.shown.length === 0 ? (
          <p className="kz-empty">{t.noMatches}</p>
        ) : null}
        {requests.length === 0 ? (
          <p className="kz-empty">{t.empty}</p>
        ) : (
          <table className="kz-table">
            <thead>
              <tr>
                <th>{t.number}</th>
                <th>{t.checkIn}</th>
                <th>{t.checkOut}</th>
                <th>{t.nights}</th>
                <th>{t.rooms}</th>
                <th>{t.total}</th>
                <th>{t.status}</th>
                <th className="kz-actions-head">{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {page.rows.map((row) => (
                <tr
                  key={row.id}
                  className="kz-row-clickable"
                  aria-selected={row.id === selectedId}
                  onClick={() => openDetail(row)}
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
                  <td>{formatDisplayDate(row.checkIn)}</td>
                  <td>{formatDisplayDate(row.checkOut)}</td>
                  <td>{row.nights}</td>
                  <td>{row.lines.reduce((sum, line) => sum + line.rooms, 0)}</td>
                  <td>{row.total} PKR</td>
                  <td>
                    <span className="kz-status" data-tone={roomRequestStatusTone(row.status)}>
                      {label(ROOM_REQUEST_STATUS_LABELS[row.status])}
                    </span>
                  </td>
                  <td className="kz-actions-cell">
                    <div className="kz-row-actions">
                      {canEdit(row) ? (
                        <button
                          type="button"
                          className="kz-button-quiet"
                          disabled={busy}
                          onClick={(event) => {
                            event.stopPropagation();
                            edit(row);
                          }}
                        >
                          {t.edit}
                        </button>
                      ) : null}
                      {canCancel(row) ? (
                        <button
                          type="button"
                          className="kz-button-quiet kz-button-danger"
                          disabled={busy}
                          onClick={(event) => {
                            event.stopPropagation();
                            void act(row.id);
                          }}
                        >
                          {t.cancel}
                        </button>
                      ) : null}
                    </div>
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
                </div>

                <dl className="kz-order-facts">
                  <div>
                    <dt>{t.factStay}</dt>
                    <dd>
                      {formatDisplayDate(selected.checkIn)} → {formatDisplayDate(selected.checkOut)}
                    </dd>
                  </div>
                  <div>
                    <dt>{t.nights}</dt>
                    <dd>{selected.nights}</dd>
                  </div>
                  <div>
                    <dt>{t.rooms}</dt>
                    <dd>{selected.lines.reduce((sum, line) => sum + line.rooms, 0)}</dd>
                  </div>
                  <div>
                    <dt>{t.total}</dt>
                    <dd>
                      {selected.total} PKR
                      {selected.lines.some((line) => line.quoted) ? '' : t.atCurrentCharges}
                    </dd>
                  </div>
                  {selected.party ? (
                    <div>
                      <dt>{t.factGuests}</dt>
                      <dd>{selected.party}</dd>
                    </div>
                  ) : null}
                  {selected.branchName ? (
                    <div>
                      <dt>{t.branch}</dt>
                      <dd>{selected.branchName}</dd>
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
                          <th>{t.rooms}</th>
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

                {selected.note || selected.decisionNote ? (
                  <section className="kz-order-section">
                    <h3>{t.notesTitle}</h3>
                    <ul className="kz-order-notes">
                      {selected.note ? <li>{selected.note}</li> : null}
                      {selected.decisionNote ? <li>{selected.decisionNote}</li> : null}
                    </ul>
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
                            <th>{t.roomType}</th>
                            <th>{t.checkedIn}</th>
                            <th>{t.checkedOut}</th>
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
                                {stay.checkedOutAt
                                  ? formatKarachiDateTime(new Date(stay.checkedOutAt))
                                  : t.inRoom}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ) : null}

                {canEdit(selected) || canCancel(selected) ? (
                  <section className="kz-order-section kz-order-decision">
                    <div className="kz-order-actions">
                      {canCancel(selected) ? (
                        <button
                          type="button"
                          className="kz-button-quiet kz-button-danger"
                          disabled={busy}
                          onClick={() => void act(selected.id)}
                        >
                          {t.cancel}
                        </button>
                      ) : null}
                      {canEdit(selected) ? (
                        <button
                          type="button"
                          className="kz-button"
                          disabled={busy}
                          onClick={() => edit(selected)}
                        >
                          {t.edit}
                        </button>
                      ) : null}
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
  return [row.number, row.party ?? ''].join(' ');
}
