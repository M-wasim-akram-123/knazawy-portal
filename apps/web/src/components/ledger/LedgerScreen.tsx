'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { staffLedgerCopy } from '@knazawy/i18n';
import {
  JOURNAL_SIDE_LABELS,
  can,
  formatDisplayDate,
  journalCsv,
  sumMoney,
  todayInKarachi,
  type JournalEntryRecord,
  type JournalSide,
} from '@knazawy/shared';
import { FormDialog, KaramLoader, Pagination, usePage } from '@knazawy/ui-shell';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { fill, useCommon, useCopy, useLabel } from '../../lib/i18n';
import { api, readSessionUser } from '../../lib/session';
import { Field } from '../master/Field';

const ALL = 'ALL';

export function LedgerScreen() {
  const t = useCopy(staffLedgerCopy);
  const common = useCommon();
  const label = useLabel();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [entries, setEntries] = useState<JournalEntryRecord[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [airline, setAirline] = useState(ALL);
  const [account, setAccount] = useState(ALL);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    const session = readSessionUser();
    setUser(session);
    setReady(true);
    if (!session) return;
    void api
      .listJournal()
      .then(setEntries)
      .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
  }, []);

  const airlines = useMemo(
    () =>
      [
        ...new Set(entries.map((entry) => entry.airlineName).filter((name) => name.length > 0)),
      ].sort((left, right) => left.localeCompare(right)),
    [entries],
  );
  const accounts = useMemo(() => {
    const byCode = new Map<string, string>();
    for (const entry of entries) {
      for (const line of entry.lines) byCode.set(line.account, line.accountName);
    }
    return [...byCode.entries()].sort((left, right) => left[0].localeCompare(right[0]));
  }, [entries]);

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (needle && !entrySearchText(entry).toLowerCase().includes(needle)) return false;
      if (airline !== ALL && entry.airlineName !== airline) return false;
      if (account !== ALL && !entry.lines.some((line) => line.account === account)) return false;
      const posted = postedDay(entry);
      if (dateFrom && posted < dateFrom) return false;
      if (dateTo && posted > dateTo) return false;
      return true;
    });
  }, [entries, search, airline, account, dateFrom, dateTo]);

  const page = usePage(shown, 15);

  const summary = useMemo(() => {
    const lines = shown.flatMap((entry) => entry.lines);
    return {
      debit: sideTotal(lines, 'DEBIT'),
      credit: sideTotal(lines, 'CREDIT'),
    };
  }, [shown]);

  if (!ready) return <KaramLoader label={t.loading} fullPage />;
  if (!user) {
    return (
      <p>
        <Link href="/login">{common.signIn}</Link> {t.signInToSee}
      </p>
    );
  }
  if (!can(user.role, 'ledger', 'R')) {
    return <p>{t.financeOnly}</p>;
  }

  const filtersActive =
    search !== '' || airline !== ALL || account !== ALL || dateFrom !== '' || dateTo !== '';
  const selected = entries.find((entry) => entry.id === selectedId) ?? null;
  const selectedTotals = selected
    ? { debit: sideTotal(selected.lines, 'DEBIT'), credit: sideTotal(selected.lines, 'CREDIT') }
    : null;

  function filtered<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      page.setPage(1);
    };
  }

  function clearFilters() {
    setSearch('');
    setAirline(ALL);
    setAccount(ALL);
    setDateFrom('');
    setDateTo('');
    page.setPage(1);
  }

  function openEntry(id: string) {
    setSelectedId(id);
    setDetailOpen(true);
  }

  return (
    <section className="kz-stack">
      <div className="kz-page-head">
        <h1>{common.ledger}</h1>
        <p>{t.intro}</p>
        <button
          type="button"
          className="kz-button"
          disabled={busy || entries.length === 0}
          onClick={() => {
            setBusy(true);
            setError('');
            void api
              .journalCsv()
              .then((result) => downloadCsv(result.csv, `ledger-${todayInKarachi()}.csv`))
              .catch((caught: unknown) => setError(explainApiError(caught, setUser)))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? t.preparing : t.export}
        </button>
        {filtersActive ? (
          <button
            type="button"
            className="kz-button kz-button-outline"
            disabled={shown.length === 0}
            onClick={() =>
              downloadCsv(journalCsv(shown), `ledger-${todayInKarachi()}-filtered.csv`)
            }
          >
            {t.exportShown}
          </button>
        ) : null}
      </div>
      {error && !detailOpen ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="kz-panel kz-table-wrap">
        <h2>{t.entriesTitle}</h2>
        {entries.length === 0 ? (
          <p className="kz-empty">{t.nothingPosted}</p>
        ) : (
          <>
            <dl className="kz-order-facts">
              <div>
                <dt>{t.factEntries}</dt>
                <dd>
                  {shown.length}
                  {filtersActive ? (
                    <small>{fill(t.ofTotal, { total: entries.length })}</small>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt>{t.totalDebits}</dt>
                <dd>{money(summary.debit)}</dd>
              </div>
              <div>
                <dt>{t.totalCredits}</dt>
                <dd>{money(summary.credit)}</dd>
              </div>
              <div>
                <dt>{t.factBalance}</dt>
                <dd>
                  <BalanceBadge debit={summary.debit} credit={summary.credit} />
                </dd>
              </div>
            </dl>

            <div className="kz-filters">
              <Field label={t.search}>
                <input
                  type="search"
                  value={search}
                  placeholder={t.searchPlaceholder}
                  onChange={(event) => filtered(setSearch)(event.target.value)}
                />
              </Field>
              {airlines.length > 0 ? (
                <Field label={t.filterAirline}>
                  <select
                    value={airline}
                    onChange={(event) => filtered(setAirline)(event.target.value)}
                  >
                    <option value={ALL}>{t.all}</option>
                    {airlines.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
              <Field label={t.filterAccount}>
                <select
                  value={account}
                  onChange={(event) => filtered(setAccount)(event.target.value)}
                >
                  <option value={ALL}>{t.all}</option>
                  {accounts.map(([code, name]) => (
                    <option key={code} value={code}>
                      {name} · {code}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t.dateFrom}>
                <input
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(event) => filtered(setDateFrom)(event.target.value)}
                />
              </Field>
              <Field label={t.dateTo}>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(event) => filtered(setDateTo)(event.target.value)}
                />
              </Field>
              {filtersActive ? (
                <button
                  type="button"
                  className="kz-button-quiet kz-filters-clear"
                  onClick={clearFilters}
                >
                  {t.clearFilters}
                </button>
              ) : null}
            </div>

            {shown.length === 0 ? (
              <p className="kz-empty">{t.noMatches}</p>
            ) : (
              <table className="kz-table">
                <thead>
                  <tr>
                    <th>{t.posted}</th>
                    <th>{t.number}</th>
                    <th>{t.airline}</th>
                    <th>{t.memo}</th>
                    <th>{t.total}</th>
                    <th className="kz-actions-head">{t.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {page.rows.map((entry) => (
                    <tr
                      key={entry.id}
                      className="kz-row-clickable"
                      aria-selected={entry.id === selectedId}
                      onClick={() => openEntry(entry.id)}
                    >
                      <td>{formatDisplayDate(postedDay(entry))}</td>
                      <td>
                        {/* The number stays a link so the row can be reached and opened from the keyboard. */}
                        <a
                          href={`#${entry.id}`}
                          aria-current={entry.id === selectedId ? 'true' : undefined}
                          onClick={(event) => event.preventDefault()}
                        >
                          {entry.number}
                        </a>
                      </td>
                      <td>{entry.airlineName || '—'}</td>
                      <td>{entry.memo}</td>
                      <td>{money(sideTotal(entry.lines, 'DEBIT'))}</td>
                      <td className="kz-actions-cell">
                        <div className="kz-row-actions">
                          <button
                            type="button"
                            className="kz-button kz-button-outline"
                            onClick={(event) => {
                              event.stopPropagation();
                              openEntry(entry.id);
                            }}
                          >
                            {t.open}
                          </button>
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
          </>
        )}
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
            {selected && selectedTotals ? (
              <>
                <div className="kz-order-head">
                  <BalanceBadge debit={selectedTotals.debit} credit={selectedTotals.credit} />
                  <strong className="kz-order-airline">
                    {selected.memo || selected.airlineName}
                  </strong>
                  <span className="kz-order-flight">
                    {fill(t.postedOn, { date: formatDisplayDate(postedDay(selected)) })}
                  </span>
                </div>

                <dl className="kz-order-facts">
                  <div>
                    <dt>{t.posted}</dt>
                    <dd>{formatDisplayDate(postedDay(selected))}</dd>
                  </div>
                  <div>
                    <dt>{t.airline}</dt>
                    <dd>{selected.airlineName || '—'}</dd>
                  </div>
                  <div>
                    <dt>{t.totalDebits}</dt>
                    <dd>{money(selectedTotals.debit)}</dd>
                  </div>
                  <div>
                    <dt>{t.totalCredits}</dt>
                    <dd>{money(selectedTotals.credit)}</dd>
                  </div>
                </dl>

                <section className="kz-order-section">
                  <h3>{t.linesTitle}</h3>
                  <div className="kz-table-wrap">
                    <table className="kz-table">
                      <thead>
                        <tr>
                          <th>{t.account}</th>
                          <th>{label(JOURNAL_SIDE_LABELS.DEBIT)}</th>
                          <th>{label(JOURNAL_SIDE_LABELS.CREDIT)}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.lines.map((line, index) => (
                          <tr key={`${line.account}-${line.side}-${index}`}>
                            <td>
                              {line.accountName}
                              <span className="kz-help"> · {line.account}</span>
                            </td>
                            <td>{line.side === 'DEBIT' ? money(line.amount) : '—'}</td>
                            <td>{line.side === 'CREDIT' ? money(line.amount) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <th scope="row">{t.total}</th>
                          <th>{money(selectedTotals.debit)}</th>
                          <th>{money(selectedTotals.credit)}</th>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </section>
              </>
            ) : null}
            {error ? (
              <p className="kz-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        )}
      </FormDialog>
    </section>
  );
}

function BalanceBadge({ debit, credit }: { debit: string | null; credit: string | null }) {
  const t = useCopy(staffLedgerCopy);
  const balanced = debit !== null && credit !== null && debit === credit;
  return (
    <span className="kz-status" data-tone={balanced ? 'done' : 'problem'}>
      {balanced ? t.balanced : t.notBalanced}
    </span>
  );
}

/** Exact paisa sum of one side; null when an amount cannot be read. */
function sideTotal(lines: JournalEntryRecord['lines'], side: JournalSide): string | null {
  return sumMoney(lines.filter((line) => line.side === side).map((line) => line.amount));
}

function money(amount: string | null): string {
  return amount === null ? '—' : `${amount} SAR`;
}

/** The posted day in Karachi as YYYY-MM-DD, which compares directly with a date input. */
function postedDay(entry: JournalEntryRecord): string {
  return todayInKarachi(new Date(entry.postedAt));
}

/** What the search box looks in. */
function entrySearchText(entry: JournalEntryRecord): string {
  return [
    entry.number,
    entry.memo,
    entry.airlineName,
    ...entry.lines.flatMap((line) => [line.accountName, line.account]),
  ].join(' ');
}

function downloadCsv(csv: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
