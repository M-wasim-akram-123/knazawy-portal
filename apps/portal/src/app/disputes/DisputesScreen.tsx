'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { portalDisputesCopy } from '@knazawy/i18n';
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
import { FormDialog, KaramLoader } from '@knazawy/ui-shell';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Field } from '../../components/Field';
import { fill, useChrome, useCommon, useCopy, useLabel } from '../../lib/i18n';
import { ApiError, api, clearSession, readSessionUser } from '../../lib/session';

export function DisputesScreen() {
  const t = useCopy(portalDisputesCopy);
  const common = useCommon();
  const chrome = useChrome();
  const label = useLabel();
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
        setError(caught instanceof Error ? caught.message : t.loadFailed);
      });
  }, []);

  if (!ready) return <KaramLoader label={chrome.loading} fullPage />;
  if (!user) {
    const [beforeLink, afterLink] = t.signInToSee.split('{link}');
    return (
      <p>
        {beforeLink}
        <Link href="/login">{common.signIn}</Link>
        {afterLink}
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
        label: `${invoice.number} · ${invoice.total} SAR${
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
        label: fill(t.roomBillOption, {
          number: bill.number,
          total: bill.total,
          date: formatDisplayDate(bill.checkIn),
        }),
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
      setSaved(fill(t.opened, { number: record.number }));
      setDialogOpen(false);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : t.openFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="kz-stack">
      <div className="kz-page-head kz-page-action-head">
        <div>
          <h1>{common.disputes}</h1>
          <p>{t.intro}</p>
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
            {t.openADispute}
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
          buttonLabel={t.openADispute}
          title={t.openADispute}
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
              <Field label={t.bill}>
                <select
                  value={billKey}
                  onChange={(event) => setBillKey(event.target.value)}
                  required
                >
                  <option value="">{t.chooseBill}</option>
                  {openable.map((bill) => (
                    <option key={bill.key} value={bill.key}>
                      {bill.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t.reason}>
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
                {t.openDispute}
              </button>
            </form>
          )}
        </FormDialog>
      ) : null}
      {rows.length === 0 ? <p className="kz-empty">{t.empty}</p> : null}
      {rows.map((row) => (
        <article key={row.id} className="kz-panel kz-stack">
          <h2>
            {row.number}{' '}
            <span className="kz-status" data-tone={disputeStatusTone(row.status)}>
              {label(DISPUTE_STATUS_LABELS[row.status])}
            </span>
          </h2>
          <p>
            {row.source === 'ROOM_INVOICE'
              ? fill(t.roomBill, { number: row.invoiceNumber })
              : row.invoiceNumber}{' '}
            · {row.invoiceTotal} SAR · {formatDisplayDate(row.createdAt.slice(0, 10))}
          </p>
          <p>{row.reason}</p>
          {row.resolution ? <p>{fill(t.decision, { resolution: row.resolution })}</p> : null}
        </article>
      ))}
    </section>
  );
}
