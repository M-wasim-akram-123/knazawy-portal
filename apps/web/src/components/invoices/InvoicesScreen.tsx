'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { staffInvoicesCopy } from '@knazawy/i18n';
import {
  INVOICE_KINDS,
  INVOICE_KIND_LABELS,
  INVOICE_STATUS_LABELS,
  RECIPE_KIND_LABELS,
  can,
  canIssueInvoice,
  canRaiseInvoice,
  formatDisplayDate,
  formatKarachiDateTime,
  invoiceStatusTone,
  isOverdue,
  todayInKarachi,
  type InvoiceRecord,
  type BillableRequestOption,
  type RecipeRecord,
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
import { useEffect, useMemo, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { fill, useCommon, useCopy, useLabel } from '../../lib/i18n';
import { api, readSessionUser } from '../../lib/session';
import { Field } from '../master/Field';

interface ManualLineDraft {
  key: string;
  recipeId: string;
  quantity: string;
  unitPrice: string;
}

export function InvoicesScreen() {
  const t = useCopy(staffInvoicesCopy);
  const common = useCommon();
  const label = useLabel();
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
  const [detailOpen, setDetailOpen] = useState(false);
  const [kind, setKind] = useState('ALL');
  const filters = useRequestFilters(invoices, invoiceSearchText);
  const shownInvoices = useMemo(
    () =>
      kind === 'ALL' ? filters.shown : filters.shown.filter((invoice) => invoice.kind === kind),
    [filters.shown, kind],
  );
  const page = usePage(shownInvoices, 10);

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
      })
      .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
  }, []);

  if (!ready) return <KaramLoader label={t.loading} fullPage />;
  if (!user) {
    return (
      <p>
        <Link href="/login">{common.signIn}</Link> {t.signInToSee}
      </p>
    );
  }
  if (!can(user.role, 'invoices', 'R')) {
    return <p>{t.financeOnly}</p>;
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
          <h1>{common.invoices}</h1>
          <p>{t.intro}</p>
        </div>
        {raiser ? (
          <button
            className="kz-button kz-form-dialog-trigger"
            type="button"
            aria-haspopup="dialog"
            onClick={() => {
              setError('');
              setSaved('');
              setDetailOpen(false);
              setDialogOpen(true);
            }}
          >
            {t.prepareInvoice}
          </button>
        ) : null}
      </div>
      {raiser ? (
        <FormDialog
          buttonLabel={t.prepareInvoice}
          title={t.prepareAnInvoice}
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
                void run(action, t.draftPrepared).then((succeeded) => {
                  if (succeeded) {
                    setNote('');
                    setAirlineName('');
                    setTaxNumber('');
                    close();
                  }
                });
              }}
            >
              <Field label={t.invoiceFor}>
                <select
                  value={mode}
                  onChange={(event) =>
                    setMode(event.target.value === 'oneOff' ? 'oneOff' : 'request')
                  }
                >
                  <option value="request">{t.deliveredRequest}</option>
                  <option value="oneOff">{t.unregisteredAirline}</option>
                </select>
              </Field>
              {mode === 'request' ? (
                waiting.length === 0 ? (
                  <p className="kz-empty">{t.noWaiting}</p>
                ) : (
                  <Field label={t.request}>
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
                  <Field label={t.airlineName}>
                    <input
                      value={airlineName}
                      maxLength={200}
                      onChange={(event) => setAirlineName(event.target.value)}
                      required
                    />
                  </Field>
                  <Field label={t.taxNumber}>
                    <input
                      value={taxNumber}
                      maxLength={100}
                      placeholder={t.optional}
                      onChange={(event) => setTaxNumber(event.target.value)}
                    />
                  </Field>
                  <div className="kz-stack">
                    <h2>{t.mealsAndSnacks}</h2>
                    {manualLines.map((line, index) => (
                      <div className="kz-form-grid" key={line.key}>
                        <Field label={fill(t.menuItem, { number: index + 1 })}>
                          <select
                            value={line.recipeId}
                            onChange={(event) =>
                              updateManualLine(line.key, { recipeId: event.target.value })
                            }
                            required
                          >
                            {recipes.map((recipe) => (
                              <option key={recipe.id} value={recipe.id}>
                                {recipe.name} · {label(RECIPE_KIND_LABELS[recipe.kind])}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label={t.quantity}>
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
                        <Field label={t.agreedUnitPrice}>
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
                            {t.removeItem}
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
                      {t.addMenuItem}
                    </button>
                    {recipes.length === 0 ? (
                      <p className="kz-empty">{t.approveRecipeFirst}</p>
                    ) : null}
                  </div>
                </>
              )}
              {error ? (
                <p className="kz-error" role="alert">
                  {error}
                </p>
              ) : null}
              <Field label={mode === 'oneOff' ? t.flightRefOrNote : t.note}>
                <input
                  value={note}
                  maxLength={300}
                  placeholder={mode === 'oneOff' ? t.flightRefPlaceholder : t.optional}
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
                {t.prepare}
              </button>
            </form>
          )}
        </FormDialog>
      ) : null}
      <div className="kz-panel kz-table-wrap">
        <h2>{common.invoices}</h2>
        <RequestFilters
          filters={filters}
          copy={t}
          statusLabel={(status) =>
            label(INVOICE_STATUS_LABELS[status as keyof typeof INVOICE_STATUS_LABELS])
          }
          onChange={() => page.setPage(1)}
          extraActive={kind !== 'ALL'}
          onClearExtra={() => setKind('ALL')}
          extra={
            <label className="kz-field">
              <span className="kz-field-label">{t.filterKind}</span>
              <select
                value={kind}
                onChange={(event) => {
                  setKind(event.target.value);
                  page.setPage(1);
                }}
              >
                <option value="ALL">{t.all}</option>
                {INVOICE_KINDS.map((value) => (
                  <option key={value} value={value}>
                    {label(INVOICE_KIND_LABELS[value])}
                  </option>
                ))}
              </select>
            </label>
          }
        />
        {invoices.length > 0 && shownInvoices.length === 0 ? (
          <p className="kz-empty">{t.noMatches}</p>
        ) : null}
        {invoices.length === 0 ? (
          <p className="kz-empty">{t.noInvoices}</p>
        ) : (
          <table className="kz-table">
            <thead>
              <tr>
                <th>{t.number}</th>
                <th>{t.airline}</th>
                <th>{t.kind}</th>
                <th>{t.requestFlightColumn}</th>
                <th>{t.serviceDate}</th>
                <th>{t.total}</th>
                <th>{t.dueDate}</th>
                <th>{t.status}</th>
              </tr>
            </thead>
            <tbody>
              {page.rows.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="kz-row-clickable"
                  aria-selected={invoice.id === selectedId}
                  onClick={() => {
                    setSelectedId(invoice.id);
                    setDetailOpen(true);
                    setCredits({});
                    setReason('');
                    setSaved('');
                    setError('');
                  }}
                >
                  <td>
                    {/* The number stays a link so the row can be reached and opened from the keyboard. */}
                    <a
                      href={`#${invoice.id}`}
                      aria-current={invoice.id === selectedId ? 'true' : undefined}
                      onClick={(event) => event.preventDefault()}
                    >
                      {invoice.number}
                    </a>
                  </td>
                  <td>{invoice.airlineName}</td>
                  <td>{label(INVOICE_KIND_LABELS[invoice.kind])}</td>
                  <td>
                    {invoice.requestNumber
                      ? fill(t.requestAndFlight, {
                          request: invoice.requestNumber,
                          flight: invoice.flightNumber ?? '',
                        })
                      : t.oneOff}
                  </td>
                  <td>{invoice.serviceDate ? formatDisplayDate(invoice.serviceDate) : '-'}</td>
                  <td>{fill(t.pkr, { amount: invoice.total })}</td>
                  <td>
                    {invoice.dueOn ? (
                      <span
                        className="kz-status"
                        data-tone={
                          isOverdue(invoice.dueOn, todayInKarachi(), invoice.amountDue)
                            ? 'problem'
                            : 'draft'
                        }
                      >
                        {formatDisplayDate(invoice.dueOn)}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>
                    <span className="kz-status" data-tone={invoiceStatusTone(invoice.status)}>
                      {label(INVOICE_STATUS_LABELS[invoice.status])}
                    </span>
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
                  void run(
                    () => api.issueInvoice(selected.id),
                    fill(t.issued, { number: selected.number }),
                  );
                }}
                onCredit={() => {
                  const lines = selected.lines
                    .map((line) => ({
                      recipeId: line.recipeId,
                      quantity: Number(credits[line.recipeId] || '0'),
                    }))
                    .filter((line) => line.quantity > 0);
                  void run(
                    () => api.creditInvoice(selected.id, { reason: reason.trim(), lines }),
                    t.creditIssued,
                  );
                }}
              />
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
      {error && !detailOpen ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      {saved && !detailOpen ? <p role="status">{saved}</p> : null}
    </section>
  );
}

/** The invoice pop-up's body: who and what, the money, the lines, and what can happen next. */
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
  invoice: InvoiceRecord;
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
  const t = useCopy(staffInvoicesCopy);
  const label = useLabel();
  const canCredit = invoice.kind === 'INVOICE' && invoice.status === 'ISSUED' && raiser;
  const canIssue = invoice.status === 'DRAFT' && issuer;
  const overdue =
    invoice.dueOn !== null && isOverdue(invoice.dueOn, todayInKarachi(), invoice.amountDue);

  return (
    <>
      <div className="kz-order-head">
        <span className="kz-status" data-tone="draft">
          {label(INVOICE_KIND_LABELS[invoice.kind])}
        </span>
        <span className="kz-status" data-tone={invoiceStatusTone(invoice.status)}>
          {label(INVOICE_STATUS_LABELS[invoice.status])}
        </span>
        <strong className="kz-order-airline">{invoice.airlineName}</strong>
        <span className="kz-order-flight">
          {invoice.requestNumber
            ? fill(t.requestAndFlight, {
                request: invoice.requestNumber,
                flight: invoice.flightNumber ?? '',
              })
            : t.oneOff}
        </span>
      </div>

      <dl className="kz-order-facts">
        <div>
          <dt>{t.subtotal}</dt>
          <dd>{fill(t.pkr, { amount: invoice.subtotal })}</dd>
        </div>
        <div>
          <dt>{t.discount}</dt>
          <dd>
            {invoice.discountPercent}%<small>{fill(t.pkr, { amount: invoice.discount })}</small>
          </dd>
        </div>
        <div>
          <dt>{t.total}</dt>
          <dd>{fill(t.pkr, { amount: invoice.total })}</dd>
        </div>
        {invoice.kind !== 'CREDIT_NOTE' ? (
          <div>
            <dt>{t.amountDue}</dt>
            <dd>{fill(t.pkr, { amount: invoice.amountDue })}</dd>
          </div>
        ) : null}
        <div>
          <dt>{t.paymentTerms}</dt>
          <dd>
            {invoice.paymentTermsDays === null
              ? '—'
              : invoice.paymentTermsDays === 0
                ? t.dueOnReceipt
                : fill(t.netDays, { days: invoice.paymentTermsDays })}
          </dd>
        </div>
        <div>
          <dt>{t.dueDate}</dt>
          <dd>
            {invoice.dueOn ? formatDisplayDate(invoice.dueOn) : '—'}
            {overdue ? (
              <small>
                <span className="kz-status" data-tone="problem">
                  {t.overdue}
                </span>
              </small>
            ) : null}
          </dd>
        </div>
        <div>
          <dt>{t.serviceDate}</dt>
          <dd>{invoice.serviceDate ? formatDisplayDate(invoice.serviceDate) : '—'}</dd>
        </div>
        <div>
          <dt>{t.rateCard}</dt>
          <dd>{invoice.rateCardNumber ?? '—'}</dd>
        </div>
        <div>
          <dt>{t.issuedAt}</dt>
          <dd>{invoice.issuedAt ? formatKarachiDateTime(new Date(invoice.issuedAt)) : '—'}</dd>
        </div>
        {invoice.airlineTaxNumber ? (
          <div>
            <dt>{t.taxNumber}</dt>
            <dd>{invoice.airlineTaxNumber}</dd>
          </div>
        ) : null}
        {invoice.sourceInvoiceNumber ? (
          <div>
            <dt>{t.creditsInvoice}</dt>
            <dd>{invoice.sourceInvoiceNumber}</dd>
          </div>
        ) : null}
      </dl>

      <section className="kz-order-section">
        <h3>{t.linesTitle}</h3>
        <div className="kz-table-wrap">
          <table className="kz-table">
            <thead>
              <tr>
                <th>{t.item}</th>
                <th>{t.delivered}</th>
                <th>{t.minimum}</th>
                <th>{t.billed}</th>
                <th>{t.unitPrice}</th>
                <th>{t.amount}</th>
                <th>{t.credited}</th>
                {canCredit ? <th>{t.credit}</th> : null}
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line) => (
                <tr key={line.recipeId}>
                  <td>{line.recipeName}</td>
                  <td>{line.deliveredQuantity}</td>
                  <td>{line.minimumQuantity}</td>
                  <td>{line.billedQuantity}</td>
                  <td>{line.unitPrice}</td>
                  <td>{fill(t.pkr, { amount: line.amount })}</td>
                  <td>{line.creditedQuantity}</td>
                  {canCredit ? (
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={Math.max(0, line.billedQuantity - line.creditedQuantity)}
                        step={1}
                        inputMode="numeric"
                        aria-label={fill(t.creditAria, { name: line.recipeName })}
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
      </section>

      {invoice.credits.length > 0 ? (
        <section className="kz-order-section">
          <h3>{t.creditNotesTitle}</h3>
          <div className="kz-table-wrap">
            <table className="kz-table">
              <thead>
                <tr>
                  <th>{t.number}</th>
                  <th>{t.creditReason}</th>
                  <th>{t.total}</th>
                </tr>
              </thead>
              <tbody>
                {invoice.credits.map((credit) => (
                  <tr key={credit.id}>
                    <td>{credit.number}</td>
                    <td>{credit.reason ?? '—'}</td>
                    <td>{fill(t.pkr, { amount: credit.total })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {invoice.note || invoice.reason ? (
        <section className="kz-order-section">
          <h3>{t.notesTitle}</h3>
          <ul className="kz-order-notes">
            {invoice.note ? <li>{invoice.note}</li> : null}
            {invoice.reason ? <li>{fill(t.reason, { reason: invoice.reason })}</li> : null}
          </ul>
        </section>
      ) : null}

      {canIssue || canCredit ? (
        <section className="kz-order-section kz-order-decision">
          <h3>{t.actionsTitle}</h3>
          {canCredit ? (
            <Field label={t.creditReason}>
              <input
                value={reason}
                maxLength={300}
                onChange={(event) => onReason(event.target.value)}
              />
            </Field>
          ) : null}
          <div className="kz-order-actions">
            {canCredit ? (
              <button
                type="button"
                className="kz-button kz-button-outline"
                disabled={busy || reason.trim().length < 3}
                onClick={onCredit}
              >
                {t.creditSelected}
              </button>
            ) : null}
            {canIssue ? (
              <button type="button" className="kz-button" disabled={busy} onClick={onIssue}>
                {t.issueInvoice}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
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

/** What the search box looks in. */
function invoiceSearchText(row: InvoiceRecord): string {
  return [row.number, row.airlineName, row.requestNumber ?? '', row.flightNumber ?? ''].join(' ');
}
