'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { messages } from '@knazawy/i18n';
import {
  INVOICE_KIND_LABELS,
  INVOICE_STATUS_LABELS,
  RECIPE_KIND_LABELS,
  can,
  canIssueInvoice,
  canRaiseInvoice,
  formatDisplayDate,
  invoiceStatusTone,
  type InvoiceRecord,
  type BillableRequestOption,
  type RecipeRecord,
} from '@knazawy/shared';
import { FormDialog } from '@knazawy/ui-shell';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { api, readSessionUser } from '../../lib/session';
import { Field } from '../master/Field';

interface ManualLineDraft {
  key: string;
  recipeId: string;
  quantity: string;
  unitPrice: string;
}

export function InvoicesScreen() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [requests, setRequests] = useState<BillableRequestOption[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [recipes, setRecipes] = useState<RecipeRecord[]>([]);
  const [mode, setMode] = useState<'request' | 'oneOff'>('request');
  const [requestId, setRequestId] = useState('');
  const [airlineName, setAirlineName] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [manualLines, setManualLines] = useState<ManualLineDraft[]>([]);
  const [note, setNote] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [credits, setCredits] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const session = readSessionUser();
    setUser(session);
    setReady(true);
    if (!session) return;
    const billableRequests = canRaiseInvoice(session.role)
      ? api.listBillableRequests()
      : Promise.resolve([]);
    const menuRecipes = canRaiseInvoice(session.role) ? api.listRecipes() : Promise.resolve([]);
    void Promise.all([billableRequests, api.listInvoices(), menuRecipes])
      .then(([nextRequests, nextInvoices, nextRecipes]) => {
        setRequests(nextRequests);
        setInvoices(nextInvoices);
        const menu = nextRecipes.filter((recipe) => recipe.active && recipe.status === 'APPROVED');
        setRecipes(menu);
        setManualLines([blankManualLine(menu[0]?.id ?? '')]);
        setRequestId(nextRequests[0]?.id ?? '');
        setSelectedId(nextInvoices[0]?.id ?? null);
      })
      .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
  }, []);

  if (!ready) return <p>Loading invoices</p>;
  if (!user) {
    return (
      <p>
        <Link href="/login">{messages.en.common.signIn}</Link> to see invoices.
      </p>
    );
  }
  if (!can(user.role, 'invoices', 'R')) {
    return <p>Invoices are kept by finance.</p>;
  }

  const raiser = canRaiseInvoice(user.role);
  const issuer = canIssueInvoice(user.role);
  const waiting = requests;
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

  async function run(action: () => Promise<InvoiceRecord>, message: string): Promise<boolean> {
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
        if (invoice.requestId) {
          setRequests((current) => current.filter((request) => request.id !== invoice.requestId));
        }
      }
      setSaved(message);
      setReason('');
      setCredits({});
      return true;
    } catch (caught: unknown) {
      setError(explainApiError(caught, setUser));
      return false;
    } finally {
      setBusy(false);
    }
  }

  function updateManualLine(key: string, patch: Partial<ManualLineDraft>): void {
    setManualLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  return (
    <section className="kz-stack">
      <div className="kz-page-head kz-page-action-head">
        <div>
          <h1>{messages.en.common.invoices}</h1>
          <p>
            Bill a delivered request at the rate card for its service date. The airline pays for the
            portions that arrived, and at least the minimum. A correction is a credit note.
          </p>
          <p lang="ur" dir="rtl">
            {messages.ur.common.invoices}
          </p>
        </div>
        {raiser ? (
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
            Prepare invoice
          </button>
        ) : null}
      </div>
      <div className="kz-workspace">
        <div className="kz-stack">
          {raiser ? (
            <FormDialog
              buttonLabel="Prepare invoice"
              title="Prepare an invoice"
              showTrigger={false}
              isOpen={dialogOpen}
              onOpenChange={setDialogOpen}
            >
              {({ close }) => (
                <form
                  className="kz-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const action =
                      mode === 'request'
                        ? () => api.createInvoice(requestId, note.trim() || undefined)
                        : () =>
                            api.createManualInvoice({
                              airlineName: airlineName.trim(),
                              taxNumber: taxNumber.trim() || undefined,
                              note: note.trim() || undefined,
                              lines: manualLines.map((line) => ({
                                recipeId: line.recipeId,
                                quantity: Number(line.quantity),
                                unitPrice: line.unitPrice.trim(),
                              })),
                            });
                    void run(action, 'Draft invoice prepared.').then((succeeded) => {
                      if (succeeded) {
                        setNote('');
                        setAirlineName('');
                        setTaxNumber('');
                        close();
                      }
                    });
                  }}
                >
                  <Field label="Invoice for">
                    <select
                      value={mode}
                      onChange={(event) =>
                        setMode(event.target.value === 'oneOff' ? 'oneOff' : 'request')
                      }
                    >
                      <option value="request">A delivered request</option>
                      <option value="oneOff">An unregistered airline</option>
                    </select>
                  </Field>
                  {mode === 'request' ? (
                    waiting.length === 0 ? (
                      <p className="kz-empty">No delivered requests are waiting for an invoice.</p>
                    ) : (
                      <Field label="Request">
                        <select
                          value={requestId}
                          onChange={(event) => setRequestId(event.target.value)}
                        >
                          {waiting.map((request) => (
                            <option key={request.id} value={request.id}>
                              {request.number} · {request.airlineName} · {request.flightNumber}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )
                  ) : (
                    <>
                      <Field label="Airline name">
                        <input
                          value={airlineName}
                          maxLength={200}
                          onChange={(event) => setAirlineName(event.target.value)}
                          required
                        />
                      </Field>
                      <Field label="Tax number">
                        <input
                          value={taxNumber}
                          maxLength={100}
                          placeholder="Optional"
                          onChange={(event) => setTaxNumber(event.target.value)}
                        />
                      </Field>
                      <div className="kz-stack">
                        <h2>Meals and snacks</h2>
                        {manualLines.map((line, index) => (
                          <div className="kz-form-grid" key={line.key}>
                            <Field label={`Menu item ${index + 1}`}>
                              <select
                                value={line.recipeId}
                                onChange={(event) =>
                                  updateManualLine(line.key, { recipeId: event.target.value })
                                }
                                required
                              >
                                {recipes.map((recipe) => (
                                  <option key={recipe.id} value={recipe.id}>
                                    {recipe.name} · {RECIPE_KIND_LABELS[recipe.kind]}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field label="Quantity">
                              <input
                                type="number"
                                min={1}
                                max={999999}
                                step={1}
                                inputMode="numeric"
                                value={line.quantity}
                                onChange={(event) =>
                                  updateManualLine(line.key, { quantity: event.target.value })
                                }
                                required
                              />
                            </Field>
                            <Field label="Agreed unit price (PKR)">
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                inputMode="decimal"
                                value={line.unitPrice}
                                onChange={(event) =>
                                  updateManualLine(line.key, { unitPrice: event.target.value })
                                }
                                required
                              />
                            </Field>
                            {manualLines.length > 1 ? (
                              <button
                                className="kz-button-quiet"
                                type="button"
                                onClick={() =>
                                  setManualLines((current) =>
                                    current.filter((entry) => entry.key !== line.key),
                                  )
                                }
                              >
                                Remove item
                              </button>
                            ) : null}
                          </div>
                        ))}
                        <button
                          className="kz-button-quiet"
                          type="button"
                          disabled={recipes.length === 0}
                          onClick={() =>
                            setManualLines((current) => [
                              ...current,
                              blankManualLine(recipes[0]?.id ?? ''),
                            ])
                          }
                        >
                          Add a menu item
                        </button>
                        {recipes.length === 0 ? (
                          <p className="kz-empty">Approve a meal or snack recipe first.</p>
                        ) : null}
                      </div>
                    </>
                  )}
                  {error ? (
                    <p className="kz-error" role="alert">
                      {error}
                    </p>
                  ) : null}
                  <Field label={mode === 'oneOff' ? 'Flight/reference or note' : 'Note'}>
                    <input
                      value={note}
                      maxLength={300}
                      placeholder={
                        mode === 'oneOff' ? 'e.g. flight number and service date' : 'Optional'
                      }
                      onChange={(event) => setNote(event.target.value)}
                    />
                  </Field>
                  <button
                    className="kz-button"
                    type="submit"
                    disabled={
                      busy ||
                      (mode === 'request' && waiting.length === 0) ||
                      (mode === 'oneOff' && recipes.length === 0)
                    }
                  >
                    Prepare
                  </button>
                </form>
              )}
            </FormDialog>
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
        {invoice.requestNumber ? (
          <>
            {' · '}
            {invoice.requestNumber}, flight {invoice.flightNumber},{' '}
            {invoice.serviceDate ? formatDisplayDate(invoice.serviceDate) : ''}
          </>
        ) : (
          <> · One-off invoice</>
        )}
        {invoice.rateCardNumber ? ` · ${invoice.rateCardNumber}` : ''}
        {invoice.sourceInvoiceNumber ? ` · credits ${invoice.sourceInvoiceNumber}` : ''}
      </p>
      {invoice.airlineTaxNumber ? <p>Tax number {invoice.airlineTaxNumber}</p> : null}
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

function blankManualLine(recipeId: string): ManualLineDraft {
  return {
    key: `${Date.now()}-${Math.random()}`,
    recipeId,
    quantity: '',
    unitPrice: '',
  };
}
