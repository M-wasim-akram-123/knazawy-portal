'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { roomBillsCopy } from '@knazawy/i18n';
import {
  ROOM_INVOICE_KIND_LABELS,
  canRaiseRoomInvoice,
  formatDisplayDate,
  type RoomBillableRecord,
  type RoomInvoiceRecord,
} from '@knazawy/shared';
import { KaramLoader } from '@knazawy/ui-shell';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { fill, useCopy, useCommon, useLabel } from '../../lib/i18n';
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
  const t = useCopy(roomBillsCopy);
  const common = useCommon();
  const label = useLabel();

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

  if (!ready) return <KaramLoader label={t.loading} fullPage />;
  if (!user) {
    return (
      <p>
        <Link href="/login">{common.signIn}</Link> {t.signInSuffix}
      </p>
    );
  }
  if (!canRaiseRoomInvoice(user.role)) {
    return <p>{t.financeOnly}</p>;
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
        <h1>{common.roomBills}</h1>
        <p>{t.intro}</p>
      </div>
      {error ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? <p>{saved}</p> : null}

      <section className="kz-panel kz-stack">
        <h2>{t.staysToBill}</h2>
        {billable.length === 0 ? (
          <p className="kz-empty">{t.noBillable}</p>
        ) : (
          <div className="kz-table-wrap">
            <table className="kz-table">
              <thead>
                <tr>
                  <th>{t.number}</th>
                  <th>{t.airline}</th>
                  <th>{t.stay}</th>
                  <th>{t.nights}</th>
                  <th>{t.total}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {billable.map((row) => (
                  <tr key={row.roomRequestId}>
                    <td>{row.number}</td>
                    <td>{row.airlineName}</td>
                    <td>
                      {fill(t.dateRange, {
                        from: formatDisplayDate(row.checkIn),
                        to: formatDisplayDate(row.checkOut),
                      })}
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
                            fill(t.isBilled, { number: row.number }),
                          )
                        }
                      >
                        {t.raiseBill}
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
        <h2>{common.roomBills}</h2>
        {bills.length === 0 ? <p className="kz-empty">{t.noBills}</p> : null}
        {bills.map((bill) => (
          <article key={bill.id} className="kz-panel kz-stack">
            <h3>
              {bill.number} · {label(ROOM_INVOICE_KIND_LABELS[bill.kind])}
            </h3>
            <p className="kz-help">
              {fill(t.billDetails, {
                airline: bill.airlineName,
                request: bill.roomRequestNumber,
                from: formatDisplayDate(bill.checkIn),
                to: formatDisplayDate(bill.checkOut),
                nights: bill.nights,
              })}
              {bill.sourceInvoiceNumber
                ? fill(t.creditsSuffix, { number: bill.sourceInvoiceNumber })
                : ''}
            </p>
            <div className="kz-table-wrap">
              <table className="kz-table">
                <thead>
                  <tr>
                    <th>{t.roomType}</th>
                    <th>{t.rooms}</th>
                    <th>{t.nights}</th>
                    <th>{t.nightly}</th>
                    <th>{t.amount}</th>
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
            <p>{fill(t.totalLine, { total: bill.total })}</p>
            {bill.reason ? <p>{fill(t.reasonLine, { reason: bill.reason })}</p> : null}

            {bill.kind === 'INVOICE' && bill.creditNumber ? (
              <p>{fill(t.creditedBy, { number: bill.creditNumber })}</p>
            ) : null}
            {bill.kind === 'INVOICE' && !bill.creditNumber && creditingId === bill.id ? (
              <form
                className="kz-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(
                    () => api.creditRoomInvoice(bill.id, reason.trim()),
                    fill(t.isCredited, { number: bill.number }),
                  );
                }}
              >
                <Field label={t.reasonForCredit}>
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
                    {t.issueCreditNote}
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
                    {t.cancel}
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
                  {t.creditThisBill}
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </section>
  );
}
