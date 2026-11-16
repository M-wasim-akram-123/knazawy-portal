'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { messages } from '@knazawy/i18n';
import {
  DISPUTE_STATUS_LABELS,
  canDisputeInvoice,
  canDisputeRoomInvoice,
  canOpenDispute,
  disputeStatusTone,
  formatDisplayDate,
  type DisputeRecord,
  type InvoiceRecord,
  type RoomInvoiceRecord,
} from '@knazawy/shared';
import { FormDialog } from '@knazawy/ui-shell';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Field } from '../../components/Field';
import { ApiError, api, clearSession, readSessionUser } from '../../lib/session';

export function DisputesScreen() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [rows, setRows] = useState<DisputeRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [roomBills, setRoomBills] = useState<RoomInvoiceRecord[]>([]);
  const [billKey, setBillKey] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const session = readSessionUser();
    setUser(session);
    setReady(true);
    if (!session) return;
    void Promise.all([api.listDisputes(), api.listInvoices(), api.listRoomInvoices()])
      .then(([nextRows, nextInvoices, nextRoomBills]) => {
        setRows(nextRows);
        setInvoices(nextInvoices);
        setRoomBills(nextRoomBills);
      })
      .catch((caught: unknown) => {
        if (caught instanceof ApiError && caught.status === 401) {
          clearSession();
          window.location.assign('/login');
          return;
        }
        setError(caught instanceof Error ? caught.message : 'Disputes could not load.');
      });
  }, []);

  if (!ready) return <p>Loading</p>;
  if (!user) {
    return (
      <p>
        <Link href="/login">{messages.en.common.signIn}</Link> to see disputes.
      </p>
    );
  }

  const openable = [
    ...invoices
      .filter(
        (invoice) =>
          invoice.requestId !== null &&
          canDisputeInvoice(invoice.kind, invoice.status) &&
          !rows.some((row) => row.invoiceId === invoice.id),
      )
      .map((invoice) => ({
        key: `invoice:${invoice.id}`,
        label: `${invoice.number} · ${invoice.total} PKR${
          invoice.serviceDate ? ` · ${formatDisplayDate(invoice.serviceDate)}` : ''
        }`,
      })),
    ...roomBills
      .filter(
        (bill) =>
          canDisputeRoomInvoice(bill.kind) && !rows.some((row) => row.roomInvoiceId === bill.id),
      )
      .map((bill) => ({
        key: `room:${bill.id}`,
        label: `Room bill ${bill.number} · ${bill.total} PKR · ${formatDisplayDate(bill.checkIn)}`,
      })),
  ];

  async function openDispute() {
    const invoiceId = billKey.startsWith('invoice:') ? billKey.slice('invoice:'.length) : '';
    const roomInvoiceId = billKey.startsWith('room:') ? billKey.slice('room:'.length) : '';
    setBusy(true);
    setError('');
    setSaved('');
    try {
      const record = invoiceId
        ? await api.openDispute(invoiceId, reason.trim())
        : await api.openRoomDispute(roomInvoiceId, reason.trim());
      setRows((current) => [record, ...current]);
      setReason('');
      setBillKey('');
      setSaved(`${record.number} is open. Karam will decide it. The bill is unchanged.`);
      setDialogOpen(false);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'The dispute could not be opened.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="kz-stack">
      <div className="kz-page-head kz-page-action-head">
        <div>
          <h1>{messages.en.common.disputes}</h1>
          <p>
            Dispute an issued bill for your airline. One dispute per bill. Karam&apos;s decision
            does not change the bill.
          </p>
          <p lang="ur" dir="rtl">
            {messages.ur.common.disputes}
          </p>
        </div>
        {canOpenDispute(user.role) ? (
          <button
            className="kz-button kz-form-dialog-trigger"
            type="button"
            aria-haspopup="dialog"
            onClick={() => {
              setError('');
              setSaved('');
              setDialogOpen(true);
            }}
          >
            Open a dispute
          </button>
        ) : null}
      </div>
      {error && !dialogOpen ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? <p role="status">{saved}</p> : null}
      {canOpenDispute(user.role) ? (
        <FormDialog
          buttonLabel="Open a dispute"
          title="Open a dispute"
          showTrigger={false}
          isOpen={dialogOpen}
          onOpenChange={setDialogOpen}
        >
          {() => (
            <form
              className="kz-form"
              onSubmit={(event) => {
                event.preventDefault();
                void openDispute();
              }}
            >
              <Field label="Bill">
                <select
                  value={billKey}
                  onChange={(event) => setBillKey(event.target.value)}
                  required
                >
                  <option value="">Choose a bill</option>
                  {openable.map((bill) => (
                    <option key={bill.key} value={bill.key}>
                      {bill.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Reason">
                <input
                  value={reason}
                  maxLength={300}
                  onChange={(event) => setReason(event.target.value)}
                  required
                />
              </Field>
              {error ? (
                <p className="kz-error" role="alert">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                className="kz-button"
                disabled={busy || reason.trim().length < 3}
              >
                Open dispute
              </button>
            </form>
          )}
        </FormDialog>
      ) : null}
      {rows.length === 0 ? <p className="kz-empty">No disputes yet.</p> : null}
      {rows.map((row) => (
        <article key={row.id} className="kz-panel kz-stack">
          <h2>
            {row.number}{' '}
            <span className="kz-status" data-tone={disputeStatusTone(row.status)}>
              {DISPUTE_STATUS_LABELS[row.status]}
            </span>
          </h2>
          <p>
            {row.source === 'ROOM_INVOICE' ? `Room bill ${row.invoiceNumber}` : row.invoiceNumber} ·{' '}
            {row.invoiceTotal} PKR · {formatDisplayDate(row.createdAt.slice(0, 10))}
          </p>
          <p>{row.reason}</p>
          {row.resolution ? <p>Decision: {row.resolution}</p> : null}
        </article>
      ))}
    </section>
  );
}
