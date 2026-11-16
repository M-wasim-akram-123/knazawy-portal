'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { messages } from '@knazawy/i18n';
import {
  ROOM_INVOICE_KIND_LABELS,
  canRaiseRoomInvoice,
  formatDisplayDate,
  type RoomBillableRecord,
  type RoomInvoiceRecord,
} from '@knazawy/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { api, readSessionUser } from '../../lib/session';
import { Field } from '../master/Field';

async function fetchRoomBills(): Promise<[RoomBillableRecord[], RoomInvoiceRecord[]]> {
  return Promise.all([api.listRoomBillable(), api.listRoomInvoices()]);
}

export function RoomBillsScreen() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [billable, setBillable] = useState<RoomBillableRecord[]>([]);
  const [bills, setBills] = useState<RoomInvoiceRecord[]>([]);
  const [creditingId, setCreditingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const session = readSessionUser();
    setUser(session);
    setReady(true);
    if (!session || !canRaiseRoomInvoice(session.role)) return;
    void fetchRoomBills()
      .then(([nextBillable, nextBills]) => {
        setBillable(nextBillable);
        setBills(nextBills);
      })
      .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
  }, []);

  if (!ready) return <p>Loading room bills</p>;
  if (!user) {
    return (
      <p>
        <Link href="/login">{messages.en.common.signIn}</Link> to see room bills.
      </p>
    );
  }
  if (!canRaiseRoomInvoice(user.role)) {
    return <p>Room bills are kept by finance.</p>;
  }

  async function run(action: () => Promise<RoomInvoiceRecord>, message: string): Promise<void> {
    setBusy(true);
    setError('');
    setSaved('');
    try {
      await action();
      const [nextBillable, nextBills] = await fetchRoomBills();
      setBillable(nextBillable);
      setBills(nextBills);
      setSaved(message);
      setReason('');
      setCreditingId(null);
    } catch (caught: unknown) {
      setError(explainApiError(caught, setUser));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="kz-stack">
      <div className="kz-page-head">
        <h1>{messages.en.common.roomBills}</h1>
        <p>
          Bill an accepted room stay for every booked night, at the nightly price fixed when it was
          accepted. A correction is a credit note for the whole bill. Once a bill is credited, the
          stay can be billed again.
        </p>
        <p lang="ur" dir="rtl">
          {messages.ur.common.roomBills}
        </p>
      </div>
      {error ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? <p>{saved}</p> : null}

      <section className="kz-panel kz-stack">
        <h2>Stays to bill</h2>
        {billable.length === 0 ? (
          <p className="kz-empty">No accepted room stays are waiting for a bill.</p>
        ) : (
          <div className="kz-table-wrap">
            <table className="kz-table">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Airline</th>
                  <th>Stay</th>
                  <th>Nights</th>
                  <th>Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {billable.map((row) => (
                  <tr key={row.roomRequestId}>
                    <td>{row.number}</td>
                    <td>{row.airlineName}</td>
                    <td>
                      {formatDisplayDate(row.checkIn)} to {formatDisplayDate(row.checkOut)}
                    </td>
                    <td>{row.nights}</td>
                    <td>{row.total} PKR</td>
                    <td>
                      <button
                        type="button"
                        className="kz-button"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () => api.raiseRoomInvoice(row.roomRequestId),
                            `${row.number} is billed.`,
                          )
                        }
                      >
                        Raise bill
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="kz-stack">
        <h2>Room bills</h2>
        {bills.length === 0 ? (
          <p className="kz-empty">No room bills have been raised yet.</p>
        ) : null}
        {bills.map((bill) => (
          <article key={bill.id} className="kz-panel kz-stack">
            <h3>
              {bill.number} · {ROOM_INVOICE_KIND_LABELS[bill.kind]}
            </h3>
            <p className="kz-help">
              {bill.airlineName}, {bill.roomRequestNumber}, {formatDisplayDate(bill.checkIn)} to{' '}
              {formatDisplayDate(bill.checkOut)}, {bill.nights} nights
              {bill.sourceInvoiceNumber ? `, credits ${bill.sourceInvoiceNumber}` : ''}
            </p>
            <div className="kz-table-wrap">
              <table className="kz-table">
                <thead>
                  <tr>
                    <th>Room type</th>
                    <th>Rooms</th>
                    <th>Nights</th>
                    <th>Nightly</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {bill.lines.map((line) => (
                    <tr key={line.roomTypeName}>
                      <td>{line.roomTypeName}</td>
                      <td>{line.rooms}</td>
                      <td>{line.nights}</td>
                      <td>{line.nightly} PKR</td>
                      <td>{line.amount} PKR</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>Total {bill.total} PKR.</p>
            {bill.reason ? <p>Reason: {bill.reason}</p> : null}

            {bill.kind === 'INVOICE' && bill.creditNumber ? (
              <p>Credited by {bill.creditNumber}.</p>
            ) : null}
            {bill.kind === 'INVOICE' && !bill.creditNumber && creditingId === bill.id ? (
              <form
                className="kz-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(
                    () => api.creditRoomInvoice(bill.id, reason.trim()),
                    `${bill.number} is credited.`,
                  );
                }}
              >
                <Field label="Reason for the credit note">
                  <input
                    value={reason}
                    maxLength={300}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </Field>
                <div className="kz-actions">
                  <button
                    type="submit"
                    className="kz-button"
                    disabled={busy || reason.trim().length < 3}
                  >
                    Issue credit note
                  </button>
                  <button
                    type="button"
                    className="kz-button-quiet"
                    disabled={busy}
                    onClick={() => {
                      setCreditingId(null);
                      setReason('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}
            {bill.kind === 'INVOICE' && !bill.creditNumber && creditingId !== bill.id ? (
              <div className="kz-actions">
                <button
                  type="button"
                  className="kz-button-quiet"
                  disabled={busy}
                  onClick={() => {
                    setCreditingId(bill.id);
                    setReason('');
                  }}
                >
                  Credit this bill
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </section>
  );
}
