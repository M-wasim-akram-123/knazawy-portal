'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { messages } from '@knazawy/i18n';
import {
  INVOICE_KIND_LABELS,
  INVOICE_STATUS_LABELS,
  can,
  canIssueInvoice,
  canRaiseInvoice,
  formatDisplayDate,
  invoiceStatusTone,
  type InvoiceRecord,
  type ServiceRequestRecord,
} from '@knazawy/shared';
import { useEffect, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { api, readSessionUser } from '../../lib/session';
import { Field } from '../master/Field';

export function InvoicesScreen() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [requests, setRequests] = useState<ServiceRequestRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [requestId, setRequestId] = useState('');
  const [note, setNote] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [credits, setCredits] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const session = readSessionUser();
    setUser(session);
    setReady(true);
    if (!session) return;
    void Promise.all([api.listRequests(), api.listInvoices()])
      .then(([nextRequests, nextInvoices]) => {
        setRequests(nextRequests);
        setInvoices(nextInvoices);
        setRequestId(waitingFor(nextRequests, nextInvoices)[0]?.id ?? '');
        setSelectedId(nextInvoices[0]?.id ?? null);
      })
      .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
  }, []);

  if (!ready) return <p>Loading invoices</p>;
  if (!user) {
    return (
      <p>
        <a href="/login">{messages.en.common.signIn}</a> to see invoices.
      </p>
    );
  }
  if (!can(user.role, 'invoices', 'R')) {
    return <p>Invoices are kept by finance.</p>;
  }

  const raiser = canRaiseInvoice(user.role);
  const issuer = canIssueInvoice(user.role);
  const waiting = waitingFor(requests, invoices);
  const selected = invoices.find((invoice) => invoice.id === selectedId) ?? null;

  function replace(invoice: InvoiceRecord) {
    setInvoices((current) => {
      const exists = current.some((row) => row.id === invoice.id);
      const next = exists
        ? current.map((row) => (row.id === invoice.id ? invoice : row))
        : [invoice, ...current];
      return next;
    });
    setSelectedId(invoice.id);
  }

  async function run(action: () => Promise<InvoiceRecord>, message: string) {
    setBusy(true);
    setError('');
    setSaved('');
    try {
      const invoice = await action();
      if (invoice.kind === 'CREDIT_NOTE') {
        const fresh = await api.listInvoices();
        setInvoices(fresh);
        setSelectedId(
          invoice.sourceInvoiceNumber
            ? (fresh.find((row) => row.number === invoice.sourceInvoiceNumber)?.id ?? invoice.id)
            : invoice.id,
        );
      } else {
        replace(invoice);
      }
      setSaved(message);
      setReason('');
      setCredits({});
    } catch (caught: unknown) {
      setError(explainApiError(caught, setUser));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="kz-stack">
      <div className="kz-page-head">
        <h1>{messages.en.common.invoices}</h1>
        <p>
          Bill a delivered request at the rate card for its service date. The airline pays for the
          portions that arrived, and at least the minimum. A correction is a credit note.
        </p>
        <p lang="ur" dir="rtl">
          {messages.ur.common.invoices}
        </p>
      </div>
      <div className="kz-workspace">
        <div className="kz-stack">
          {raiser ? (
            <form
              className="kz-panel kz-form"
              onSubmit={(event) => {
                event.preventDefault();
                void run(
                  () => api.createInvoice(requestId, note.trim() || undefined),
                  'Draft invoice prepared.',
                ).then(() => setNote(''));
              }}
            >
              <h2>Prepare an invoice</h2>
              {waiting.length === 0 ? (
                <p className="kz-empty">No delivered requests are waiting for an invoice.</p>
              ) : (
                <Field label="Request">
                  <select value={requestId} onChange={(event) => setRequestId(event.target.value)}>
                    {waiting.map((request) => (
                      <option key={request.id} value={request.id}>
                        {request.number} · {request.airlineName} · {request.flightNumber}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Note">
                <input
                  value={note}
                  maxLength={300}
                  placeholder="Optional"
                  onChange={(event) => setNote(event.target.value)}
                />
              </Field>
              <button className="kz-button" type="submit" disabled={busy || waiting.length === 0}>
                Prepare
              </button>
            </form>
          ) : null}
          <div className="kz-panel kz-table-wrap">
            <h2>Invoices</h2>
            {invoices.length === 0 ? <p className="kz-empty">No invoices yet.</p> : null}
            {invoices.length > 0 ? (
              <table className="kz-table">
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Airline</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td>
                        <a
                          href={`#${invoice.id}`}
                          aria-current={invoice.id === selectedId ? 'true' : undefined}
                          onClick={(event) => {
                            event.preventDefault();
                            setSelectedId(invoice.id);
                          }}
                        >
                          {invoice.number}
                        </a>
                      </td>
                      <td>{invoice.airlineName}</td>
                      <td>{invoice.total} PKR</td>
                      <td>
                        <span className="kz-status" data-tone={invoiceStatusTone(invoice.status)}>
                          {INVOICE_KIND_LABELS[invoice.kind]} ·{' '}
                          {INVOICE_STATUS_LABELS[invoice.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        </div>
        <InvoiceDetail
          invoice={selected}
          raiser={raiser}
          issuer={issuer}
          busy={busy}
          credits={credits}
          reason={reason}
          onCreditChange={(recipeId, value) =>
            setCredits((current) => ({ ...current, [recipeId]: value }))
          }
          onReason={setReason}
          onIssue={() => {
            if (!selected) return;
            void run(() => api.issueInvoice(selected.id), `${selected.number} is issued.`);
          }}
          onCredit={() => {
            if (!selected) return;
            const lines = selected.lines
              .map((line) => ({
                recipeId: line.recipeId,
                quantity: Number(credits[line.recipeId] || '0'),
              }))
              .filter((line) => line.quantity > 0);
            void run(
              () => api.creditInvoice(selected.id, { reason: reason.trim(), lines }),
              'Credit note issued.',
            );
          }}
        />
      </div>
      {error ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? <p>{saved}</p> : null}
    </section>
  );
}

function InvoiceDetail({
  invoice,
  raiser,
  issuer,
  busy,
  credits,
  reason,
  onCreditChange,
  onReason,
  onIssue,
  onCredit,
}: {
  invoice: InvoiceRecord | null;
  raiser: boolean;
  issuer: boolean;
  busy: boolean;
  credits: Record<string, string>;
  reason: string;
  onCreditChange: (recipeId: string, value: string) => void;
  onReason: (value: string) => void;
  onIssue: () => void;
  onCredit: () => void;
}) {
  if (!invoice) {
    return (
      <div className="kz-panel">
        <p className="kz-empty">Choose an invoice to see it.</p>
      </div>
    );
  }
  const open = invoice.kind === 'INVOICE' && invoice.status === 'ISSUED';
  return (
    <div className="kz-panel kz-stack">
      <h2>
        {invoice.number} · {invoice.airlineName}
      </h2>
      <p>
        <span className="kz-status" data-tone={invoiceStatusTone(invoice.status)}>
          {INVOICE_KIND_LABELS[invoice.kind]} · {INVOICE_STATUS_LABELS[invoice.status]}
        </span>
        {' · '}
        {invoice.requestNumber}, flight {invoice.flightNumber},{' '}
        {formatDisplayDate(invoice.serviceDate)}
        {' · '}
        {invoice.rateCardNumber}
        {invoice.sourceInvoiceNumber ? ` · credits ${invoice.sourceInvoiceNumber}` : ''}
      </p>
      <div className="kz-table-wrap">
        <table className="kz-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Arrived</th>
              <th>Billed</th>
              <th>Price</th>
              <th>Amount</th>
              {open && raiser ? <th>Credit</th> : null}
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.recipeId}>
                <td>{line.recipeName}</td>
                <td>{line.deliveredQuantity}</td>
                <td>
                  {line.billedQuantity}
                  {line.creditedQuantity > 0 ? (
                    <span className="kz-help"> · credited {line.creditedQuantity}</span>
                  ) : null}
                </td>
                <td>{line.unitPrice}</td>
                <td>{line.amount} PKR</td>
                {open && raiser ? (
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={Math.max(0, line.billedQuantity - line.creditedQuantity)}
                      step={1}
                      inputMode="numeric"
                      aria-label={`Portions of ${line.recipeName} to credit`}
                      value={credits[line.recipeId] ?? ''}
                      onChange={(event) => onCreditChange(line.recipeId, event.target.value)}
                    />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Total {invoice.total} PKR. Amount due {invoice.amountDue} PKR.
      </p>
      {invoice.note ? <p>{invoice.note}</p> : null}
      {invoice.reason ? <p>Reason: {invoice.reason}</p> : null}
      {invoice.credits.length > 0 ? (
        <p>
          Credit notes:{' '}
          {invoice.credits.map((credit) => `${credit.number} ${credit.total} PKR`).join(', ')}
        </p>
      ) : null}
      {invoice.status === 'DRAFT' && issuer ? (
        <button type="button" className="kz-button" disabled={busy} onClick={onIssue}>
          Issue invoice
        </button>
      ) : null}
      {open && raiser ? (
        <>
          <Field label="Reason for the credit note">
            <input
              value={reason}
              maxLength={300}
              onChange={(event) => onReason(event.target.value)}
            />
          </Field>
          <button
            type="button"
            className="kz-button-quiet"
            disabled={busy || reason.trim().length < 3}
            onClick={onCredit}
          >
            Issue credit note
          </button>
        </>
      ) : null}
    </div>
  );
}

function waitingFor(
  requests: ServiceRequestRecord[],
  invoices: InvoiceRecord[],
): ServiceRequestRecord[] {
  const billed = new Set(
    invoices.filter((invoice) => invoice.kind === 'INVOICE').map((invoice) => invoice.requestId),
  );
  return requests.filter((request) => request.status === 'DELIVERED' && !billed.has(request.id));
}
