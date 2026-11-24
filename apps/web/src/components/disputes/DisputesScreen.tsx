'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { staffDisputesCopy } from '@knazawy/i18n';
import {
  DISPUTE_STATUS_LABELS,
  canDecideDispute,
  disputeStatusTone,
  formatDisplayDate,
  todayInKarachi,
  type DisputeRecord,
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

import { explainApiError } from '../../lib/explain';
import { fill, useCommon, useCopy, useLabel } from '../../lib/i18n';
import { api, readSessionUser } from '../../lib/session';
import { Field } from '../master/Field';

export function DisputesScreen() {
  const t = useCopy(staffDisputesCopy);
  const common = useCommon();
  const label = useLabel();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [rows, setRows] = useState<DisputeRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [resolution, setResolution] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const filters = useRequestFilters(rows, disputeSearchText);
  const page = usePage(filters.shown, 10);

  useEffect(() => {
    const session = readSessionUser();
    setUser(session);
    setReady(true);
    if (!session) return;
    void api
      .listDisputes()
      .then(setRows)
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

  const canDecide = canDecideDispute(user.role);
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  function openDispute(id: string) {
    if (id !== selectedId) setResolution('');
    setSelectedId(id);
    setDetailOpen(true);
    setSaved('');
    setError('');
  }

  async function decide(id: string, action: 'accept' | 'reject') {
    setBusy(true);
    setError('');
    setSaved('');
    try {
      const record =
        action === 'accept'
          ? await api.acceptDispute(id, resolution.trim())
          : await api.rejectDispute(id, resolution.trim());
      setRows((current) => current.map((row) => (row.id === record.id ? record : row)));
      setResolution('');
      setSaved(fill(action === 'accept' ? t.accepted : t.rejected, { number: record.number }));
    } catch (caught: unknown) {
      setError(explainApiError(caught, setUser));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="kz-stack">
      <div className="kz-page-head">
        <h1>{common.disputes}</h1>
        <p>{t.intro}</p>
      </div>
      <div className="kz-panel kz-table-wrap">
        <h2>{t.listTitle}</h2>
        <RequestFilters
          filters={filters}
          copy={t}
          statusLabel={(status) =>
            label(DISPUTE_STATUS_LABELS[status as keyof typeof DISPUTE_STATUS_LABELS])
          }
          onChange={() => page.setPage(1)}
        />
        {rows.length > 0 && filters.shown.length === 0 ? (
          <p className="kz-empty">{t.noMatches}</p>
        ) : null}
        {rows.length === 0 ? (
          <p className="kz-empty">{t.noDisputes}</p>
        ) : (
          <table className="kz-table">
            <thead>
              <tr>
                <th>{t.colOpened}</th>
                <th>{t.colAirline}</th>
                <th>{t.colBill}</th>
                <th>{t.colReason}</th>
                <th>{t.colStatus}</th>
                <th className="kz-actions-head">{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {page.rows.map((row) => (
                <tr
                  key={row.id}
                  className="kz-row-clickable"
                  aria-selected={row.id === selectedId}
                  onClick={() => openDispute(row.id)}
                >
                  <td>{formatDisplayDate(todayInKarachi(new Date(row.createdAt)))}</td>
                  <td>{row.airlineName}</td>
                  <td>
                    {/* The bill number stays a link so the row can be reached and opened from the keyboard. */}
                    <a
                      href={`#${row.id}`}
                      aria-current={row.id === selectedId ? 'true' : undefined}
                      onClick={(event) => event.preventDefault()}
                    >
                      {billLabel(row, t.roomBill)}
                    </a>
                  </td>
                  <td title={row.reason}>{shorten(row.reason)}</td>
                  <td>
                    <span className="kz-status" data-tone={disputeStatusTone(row.status)}>
                      {label(DISPUTE_STATUS_LABELS[row.status])}
                    </span>
                  </td>
                  <td className="kz-actions-cell">
                    <div className="kz-row-actions">
                      <button
                        type="button"
                        className="kz-button kz-button-outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          openDispute(row.id);
                        }}
                      >
                        {canDecide && row.status === 'OPEN' ? t.review : t.view}
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
        {error && !detailOpen ? (
          <p className="kz-error" role="alert">
            {error}
          </p>
        ) : null}
        {saved && !detailOpen ? <p role="status">{saved}</p> : null}
      </div>
      <FormDialog
        buttonLabel={selected ? billLabel(selected, t.roomBill) : ''}
        title={selected ? billLabel(selected, t.roomBill) : ''}
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
                  <span className="kz-status" data-tone={disputeStatusTone(selected.status)}>
                    {label(DISPUTE_STATUS_LABELS[selected.status])}
                  </span>
                  <strong className="kz-order-airline">{selected.airlineName}</strong>
                  <span className="kz-order-flight">
                    {selected.number} · {billLabel(selected, t.roomBill)}
                  </span>
                </div>

                <dl className="kz-order-facts">
                  <div>
                    <dt>{t.factOpened}</dt>
                    <dd>{formatDisplayDate(todayInKarachi(new Date(selected.createdAt)))}</dd>
                  </div>
                  <div>
                    <dt>{t.factOpenedBy}</dt>
                    <dd>{selected.openedByName}</dd>
                  </div>
                  <div>
                    <dt>{t.factBillTotal}</dt>
                    <dd>{selected.invoiceTotal} SAR</dd>
                  </div>
                  {selected.decidedAt ? (
                    <div>
                      <dt>{t.factDecided}</dt>
                      <dd>{formatDisplayDate(todayInKarachi(new Date(selected.decidedAt)))}</dd>
                    </div>
                  ) : null}
                  {selected.decidedByName ? (
                    <div>
                      <dt>{t.factDecidedBy}</dt>
                      <dd>{selected.decidedByName}</dd>
                    </div>
                  ) : null}
                </dl>

                <section className="kz-order-section">
                  <h3>{t.reasonTitle}</h3>
                  <ul className="kz-order-notes">
                    <li>{selected.reason}</li>
                  </ul>
                </section>

                {selected.resolution ? (
                  <section className="kz-order-section">
                    <h3>{t.resolutionTitle}</h3>
                    <ul className="kz-order-notes">
                      <li>
                        {selected.resolution}
                        {selected.decidedByName ? (
                          <>
                            {' '}
                            <span className="kz-help">({selected.decidedByName})</span>
                          </>
                        ) : null}
                      </li>
                    </ul>
                  </section>
                ) : null}

                {canDecide && selected.status === 'OPEN' ? (
                  <section className="kz-order-section kz-order-decision">
                    <h3>{t.decisionTitle}</h3>
                    <Field label={t.decisionLabel} hint={t.decisionHint}>
                      <input
                        value={resolution}
                        maxLength={300}
                        onChange={(event) => setResolution(event.target.value)}
                      />
                    </Field>
                    <div className="kz-order-actions">
                      <button
                        type="button"
                        className="kz-button kz-button-outline"
                        disabled={busy || resolution.trim().length < 3}
                        onClick={() => void decide(selected.id, 'reject')}
                      >
                        {t.rejectDispute}
                      </button>
                      <button
                        type="button"
                        className="kz-button"
                        disabled={busy || resolution.trim().length < 3}
                        onClick={() => void decide(selected.id, 'accept')}
                      >
                        {t.acceptDispute}
                      </button>
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

function billLabel(row: DisputeRecord, roomBill: string): string {
  return row.source === 'ROOM_INVOICE'
    ? fill(roomBill, { number: row.invoiceNumber })
    : row.invoiceNumber;
}

/** The list shows the start of the reason; the pop-up shows all of it. */
function shorten(text: string, max = 60): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** What the search box looks in. */
function disputeSearchText(row: DisputeRecord): string {
  return [row.number, row.invoiceNumber, row.airlineName, row.reason].join(' ');
}
