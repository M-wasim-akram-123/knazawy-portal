'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { messages } from '@knazawy/i18n';
import {
  DELIVERY_POINT_LABELS,
  RECIPE_KIND_LABELS,
  REQUEST_STATUS_LABELS,
  amendmentError,
  can,
  formatDisplayDate,
  formatKarachiDateTime,
  isPastCutOff,
  passengerTotal,
  statusTone,
  type ServiceRequestRecord,
} from '@knazawy/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { api, readSessionUser } from '../../lib/session';
import { Field } from '../master/Field';

export function RequestsScreen() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [requests, setRequests] = useState<ServiceRequestRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [portions, setPortions] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const session = readSessionUser();
    setUser(session);
    setReady(true);
    if (!session) return;
    void api
      .listRequests()
      .then((rows) => {
        setRequests(rows);
        setSelectedId(rows[0]?.id ?? null);
        setPortions(
          Object.fromEntries(
            (rows[0]?.lines ?? []).map((line) => [line.recipeId, String(line.quantity)]),
          ),
        );
      })
      .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
  }, []);

  if (!ready) return <p>Loading requests</p>;
  if (!user) {
    return (
      <p>
        <Link href="/login">{messages.en.common.signIn}</Link> to see requests.
      </p>
    );
  }

  const canDecide = can(user.role, 'service_requests', 'A');
  const canChange = can(user.role, 'service_requests', 'U');
  const selected = requests.find((row) => row.id === selectedId) ?? null;

  async function decide(action: 'accept' | 'reject') {
    if (!selected) return;
    setBusy(true);
    setError('');
    setSaved('');
    try {
      const record =
        action === 'accept'
          ? await api.acceptRequest(selected.id)
          : await api.rejectRequest(selected.id, reason.trim());
      setRequests((current) => current.map((row) => (row.id === record.id ? record : row)));
      setReason('');
      setSaved(
        action === 'accept' ? `${record.number} is accepted.` : `${record.number} is rejected.`,
      );
    } catch (caught: unknown) {
      setError(explainApiError(caught, setUser));
    } finally {
      setBusy(false);
    }
  }

  async function saveChange() {
    if (!selected) return;
    setBusy(true);
    setError('');
    setSaved('');
    try {
      const record = await api.amendRequest(selected.id, {
        flightNumber: selected.flightNumber,
        route: selected.route,
        serviceDate: selected.serviceDate,
        deliveryTime: selected.deliveryTime,
        deliveryPoint: selected.deliveryPoint,
        deliveryDetail: selected.deliveryDetail ?? undefined,
        adults: selected.passengers.adults,
        children: selected.passengers.children,
        infants: selected.passengers.infants,
        crew: selected.passengers.crew,
        specialDiets: selected.passengers.specialDiets,
        specialDietNote: selected.specialDietNote ?? undefined,
        note: selected.note ?? undefined,
        reason: changeReason.trim(),
        lines: selected.lines
          .map((line) => ({
            recipeId: line.recipeId,
            quantity: Number(portions[line.recipeId] ?? line.quantity),
          }))
          .filter((line) => Number.isInteger(line.quantity) && line.quantity > 0),
      });
      setRequests((current) => current.map((row) => (row.id === record.id ? record : row)));
      setChangeReason('');
      setSaved(`${record.number} is changed.`);
    } catch (caught: unknown) {
      setError(explainApiError(caught, setUser));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="kz-stack">
      <div className="kz-page-head">
        <h1>{messages.en.common.requests}</h1>
        <p>
          Requests that airlines have sent. Accept one to plan its meals, or reject it with a reason
          the airline can read.
        </p>
        <p lang="ur" dir="rtl">
          {messages.ur.common.requests}
        </p>
      </div>
      <div className="kz-workspace">
        <div className="kz-panel kz-table-wrap">
          <h2>Sent requests</h2>
          {requests.length === 0 ? (
            <p className="kz-empty">No requests have been sent yet.</p>
          ) : (
            <table className="kz-table">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Airline</th>
                  <th>Flight</th>
                  <th>Service date</th>
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
                          setPortions(
                            Object.fromEntries(
                              row.lines.map((line) => [line.recipeId, String(line.quantity)]),
                            ),
                          );
                          setChangeReason('');
                          setSaved('');
                          setError('');
                        }}
                      >
                        {row.number}
                      </a>
                    </td>
                    <td>{row.airlineName}</td>
                    <td>{row.flightNumber}</td>
                    <td>{formatDisplayDate(row.serviceDate)}</td>
                    <td>
                      <span className="kz-status" data-tone={statusTone(row.status)}>
                        {REQUEST_STATUS_LABELS[row.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="kz-panel kz-stack">
          {selected ? (
            <>
              <h2>{selected.number}</h2>
              <p>
                <span className="kz-status" data-tone={statusTone(selected.status)}>
                  {REQUEST_STATUS_LABELS[selected.status]}
                </span>
                {' · '}
                {selected.airlineName}
                {' · '}Flight {selected.flightNumber}, {selected.route}
              </p>
              <p>
                {selected.cutOffAt
                  ? `Cut-off ${formatKarachiDateTime(new Date(selected.cutOffAt))}. After that, the airline asks you to change it.`
                  : null}
              </p>
              <p>
                Service {formatDisplayDate(selected.serviceDate)} at {selected.deliveryTime},{' '}
                {DELIVERY_POINT_LABELS[selected.deliveryPoint]}
                {selected.deliveryDetail ? `, ${selected.deliveryDetail}` : ''}
              </p>
              <p>
                Passengers: {passengerTotal(selected.passengers)} (adults{' '}
                {selected.passengers.adults}, children {selected.passengers.children}, infants{' '}
                {selected.passengers.infants}, crew {selected.passengers.crew}). Special diets:{' '}
                {selected.passengers.specialDiets}
                {selected.specialDietNote ? `. ${selected.specialDietNote}` : ''}
              </p>
              <div className="kz-table-wrap">
                <table className="kz-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Type</th>
                      <th>Portions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.lines.map((line) => (
                      <tr key={line.recipeId}>
                        <td>{line.recipeName}</td>
                        <td>{RECIPE_KIND_LABELS[line.kind]}</td>
                        <td>
                          {canChange &&
                          amendmentError(
                            selected.status,
                            isPastCutOff(selected.serviceDate, selected.deliveryTime),
                            true,
                          ) === null ? (
                            <input
                              type="number"
                              min={0}
                              max={999}
                              value={portions[line.recipeId] ?? String(line.quantity)}
                              onChange={(event) =>
                                setPortions((current) => ({
                                  ...current,
                                  [line.recipeId]: event.target.value,
                                }))
                              }
                            />
                          ) : (
                            line.quantity
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selected.note ? (
                <p>
                  Note from {selected.airlineName}: {selected.note}
                </p>
              ) : null}
              {selected.decisionNote ? <p>Reason: {selected.decisionNote}</p> : null}
              {selected.amendments.map((amendment) => (
                <p key={amendment.id} className="kz-help">
                  {amendment.number}: {amendment.reason} ({amendment.createdByName})
                </p>
              ))}
              {canChange &&
              amendmentError(
                selected.status,
                isPastCutOff(selected.serviceDate, selected.deliveryTime),
                true,
              ) === null ? (
                <div className="kz-stack">
                  <Field label="Reason for the change" hint="Kept with the request.">
                    <input
                      value={changeReason}
                      maxLength={300}
                      onChange={(event) => setChangeReason(event.target.value)}
                    />
                  </Field>
                  <button
                    type="button"
                    className="kz-button"
                    disabled={busy || changeReason.trim().length < 3}
                    onClick={() => void saveChange()}
                  >
                    Save change
                  </button>
                </div>
              ) : null}
              {canDecide && selected.status === 'SUBMITTED' ? (
                <div className="kz-stack">
                  <button
                    type="button"
                    className="kz-button"
                    disabled={busy}
                    onClick={() => void decide('accept')}
                  >
                    Accept request
                  </button>
                  <Field label="Reason for rejecting" hint="Needed if you reject the request.">
                    <input
                      value={reason}
                      maxLength={300}
                      onChange={(event) => setReason(event.target.value)}
                    />
                  </Field>
                  <button
                    type="button"
                    className="kz-button-quiet"
                    disabled={busy || reason.trim().length < 3}
                    onClick={() => void decide('reject')}
                  >
                    Reject request
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="kz-empty">Choose a request to see its details.</p>
          )}
          {error ? (
            <p className="kz-error" role="alert">
              {error}
            </p>
          ) : null}
          {saved ? <p>{saved}</p> : null}
        </div>
      </div>
    </section>
  );
}
