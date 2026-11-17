'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { staffRequestsCopy } from '@knazawy/i18n';
import {
  BASE_UNIT_LABELS,
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
  type FulfilmentRecord,
  type ServiceRequestRecord,
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

export function RequestsScreen() {
  const t = useCopy(staffRequestsCopy);
  const common = useCommon();
  const label = useLabel();
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
  const [stock, setStock] = useState<FulfilmentRecord | null>(null);
  const [stockError, setStockError] = useState('');
  const [stockVersion, setStockVersion] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const filters = useRequestFilters(requests, requestSearchText);
  const page = usePage(filters.shown, 10);

  useEffect(() => {
    const session = readSessionUser();
    setUser(session);
    setReady(true);
    if (!session) return;
    void api
      .listRequests()
      .then((rows) => {
        setRequests(rows);
      })
      .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
  }, []);

  const selectedStatus = requests.find((row) => row.id === selectedId)?.status ?? null;
  useEffect(() => {
    setStock(null);
    setStockError('');
    if (!selectedId || (selectedStatus !== 'SUBMITTED' && selectedStatus !== 'ACCEPTED')) return;
    let current = true;
    void api
      .requestFulfilment(selectedId)
      .then((record) => {
        if (current) setStock(record);
      })
      .catch((caught: unknown) => {
        if (current) setStockError(explainApiError(caught, setUser));
      });
    return () => {
      current = false;
    };
  }, [selectedId, selectedStatus, stockVersion]);

  if (!ready) return <KaramLoader label={t.loading} fullPage />;
  if (!user) {
    return (
      <p>
        <Link href="/login">{common.signIn}</Link> {t.signInToSee}
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
      setStockVersion((version) => version + 1);
      setSaved(fill(action === 'accept' ? t.accepted : t.rejected, { number: record.number }));
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
      setStockVersion((version) => version + 1);
      setSaved(fill(t.changed, { number: record.number }));
    } catch (caught: unknown) {
      setError(explainApiError(caught, setUser));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="kz-stack">
      <div className="kz-page-head">
        <h1>{common.airlineOrders}</h1>
        <p>{t.intro}</p>
      </div>
      <div className="kz-panel kz-table-wrap">
        <h2>{t.sentRequests}</h2>
        <RequestFilters
          filters={filters}
          copy={t}
          statusLabel={(status) =>
            label(REQUEST_STATUS_LABELS[status as keyof typeof REQUEST_STATUS_LABELS])
          }
          onChange={() => page.setPage(1)}
        />
        {requests.length > 0 && filters.shown.length === 0 ? (
          <p className="kz-empty">{t.noMatches}</p>
        ) : null}
        {requests.length === 0 ? (
          <p className="kz-empty">{t.noRequests}</p>
        ) : (
          <table className="kz-table">
            <thead>
              <tr>
                <th>{t.number}</th>
                <th>{t.airline}</th>
                <th>{t.flight}</th>
                <th>{t.serviceDate}</th>
                <th>{t.status}</th>
              </tr>
            </thead>
            <tbody>
              {page.rows.map((row) => (
                <tr
                  key={row.id}
                  className="kz-row-clickable"
                  aria-selected={row.id === selectedId}
                  onClick={() => {
                    setSelectedId(row.id);
                    setDetailOpen(true);
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
                  <td>
                    {/* The number stays a link so the row can be reached and opened from the keyboard. */}
                    <a
                      href={`#${row.id}`}
                      aria-current={row.id === selectedId ? 'true' : undefined}
                      onClick={(event) => event.preventDefault()}
                    >
                      {row.number}
                    </a>
                  </td>
                  <td>{row.airlineName}</td>
                  <td>{row.flightNumber}</td>
                  <td>{formatDisplayDate(row.serviceDate)}</td>
                  <td>
                    <span className="kz-status" data-tone={statusTone(row.status)}>
                      {label(REQUEST_STATUS_LABELS[row.status])}
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
        {error && !detailOpen ? (
          <p className="kz-error" role="alert">
            {error}
          </p>
        ) : null}
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
              <>
                <div className="kz-order-head">
                  <span className="kz-status" data-tone={statusTone(selected.status)}>
                    {label(REQUEST_STATUS_LABELS[selected.status])}
                  </span>
                  <strong className="kz-order-airline">{selected.airlineName}</strong>
                  <span className="kz-order-flight">
                    {fill(t.flightRoute, { flight: selected.flightNumber, route: selected.route })}
                  </span>
                </div>

                <dl className="kz-order-facts">
                  <div>
                    <dt>{t.factService}</dt>
                    <dd>
                      {formatDisplayDate(selected.serviceDate)} · {selected.deliveryTime}
                    </dd>
                  </div>
                  <div>
                    <dt>{t.factDelivery}</dt>
                    <dd>
                      {label(DELIVERY_POINT_LABELS[selected.deliveryPoint])}
                      {selected.deliveryDetail ? <small>{selected.deliveryDetail}</small> : null}
                    </dd>
                  </div>
                  <div>
                    <dt>{t.factCutOff}</dt>
                    <dd>
                      {selected.cutOffAt ? formatKarachiDateTime(new Date(selected.cutOffAt)) : '—'}
                      <small>{t.factCutOffHint}</small>
                    </dd>
                  </div>
                  <div>
                    <dt>{t.factPassengers}</dt>
                    <dd>
                      {passengerTotal(selected.passengers)}
                      <small>
                        {fill(t.passengerSplit, {
                          adults: selected.passengers.adults,
                          children: selected.passengers.children,
                          infants: selected.passengers.infants,
                          crew: selected.passengers.crew,
                        })}
                      </small>
                    </dd>
                  </div>
                  <div>
                    <dt>{t.factSpecialDiets}</dt>
                    <dd>
                      {selected.passengers.specialDiets}
                      {selected.specialDietNote ? <small>{selected.specialDietNote}</small> : null}
                    </dd>
                  </div>
                  <div>
                    <dt>{t.totalPortions}</dt>
                    <dd>{selected.lines.reduce((sum, line) => sum + line.quantity, 0)}</dd>
                  </div>
                </dl>

                <section className="kz-order-section">
                  <h3>{t.itemsOrdered}</h3>
                  <div className="kz-table-wrap">
                    <table className="kz-table">
                      <thead>
                        <tr>
                          <th>{t.item}</th>
                          <th>{t.type}</th>
                          <th>{t.portions}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.lines.map((line) => (
                          <tr key={line.recipeId}>
                            <td>{line.recipeName}</td>
                            <td>{label(RECIPE_KIND_LABELS[line.kind])}</td>
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
                </section>

                <section className="kz-order-section">
                  <StockCheck
                    status={selected.status}
                    stock={stock?.requestId === selected.id ? stock : null}
                    error={stockError}
                  />
                </section>

                {selected.note || selected.decisionNote || selected.amendments.length > 0 ? (
                  <section className="kz-order-section">
                    <h3>{t.notesTitle}</h3>
                    <ul className="kz-order-notes">
                      {selected.note ? (
                        <li>
                          {fill(t.noteFrom, { airline: selected.airlineName, note: selected.note })}
                        </li>
                      ) : null}
                      {selected.decisionNote ? (
                        <li>{fill(t.reason, { reason: selected.decisionNote })}</li>
                      ) : null}
                      {selected.amendments.map((amendment) => (
                        <li key={amendment.id}>
                          <strong>{amendment.number}</strong> {amendment.reason}{' '}
                          <span className="kz-help">({amendment.createdByName})</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {canChange &&
                amendmentError(
                  selected.status,
                  isPastCutOff(selected.serviceDate, selected.deliveryTime),
                  true,
                ) === null ? (
                  <section className="kz-order-section kz-stack">
                    <h3>{t.changeTitle}</h3>
                    <Field label={t.changeReason} hint={t.changeReasonHint}>
                      <input
                        value={changeReason}
                        maxLength={300}
                        onChange={(event) => setChangeReason(event.target.value)}
                      />
                    </Field>
                    <div className="kz-order-actions">
                      <button
                        type="button"
                        className="kz-button"
                        disabled={busy || changeReason.trim().length < 3}
                        onClick={() => void saveChange()}
                      >
                        {t.saveChange}
                      </button>
                    </div>
                  </section>
                ) : null}

                {canDecide && selected.status === 'SUBMITTED' ? (
                  <section className="kz-order-section kz-order-decision">
                    <h3>{t.decisionTitle}</h3>
                    {stock?.requestId === selected.id && !stock.canFulfil ? (
                      <p className="kz-order-warning">{t.stockShortWarning}</p>
                    ) : null}
                    <Field label={t.rejectReason} hint={t.rejectReasonHint}>
                      <input
                        value={reason}
                        maxLength={300}
                        onChange={(event) => setReason(event.target.value)}
                      />
                    </Field>
                    <div className="kz-order-actions">
                      <button
                        type="button"
                        className="kz-button kz-button-outline"
                        disabled={busy || reason.trim().length < 3}
                        onClick={() => void decide('reject')}
                      >
                        {t.rejectRequest}
                      </button>
                      <button
                        type="button"
                        className="kz-button"
                        disabled={busy}
                        onClick={() => void decide('accept')}
                      >
                        {stock?.requestId === selected.id && !stock.canFulfil
                          ? t.acceptAnyway
                          : t.acceptRequest}
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

function StockCheck({
  status,
  stock,
  error,
}: {
  status: ServiceRequestRecord['status'];
  stock: FulfilmentRecord | null;
  error: string;
}) {
  const t = useCopy(staffRequestsCopy);
  const common = useCommon();
  const label = useLabel();
  if (status !== 'SUBMITTED' && status !== 'ACCEPTED') return null;
  if (error) {
    return (
      <p className="kz-error" role="alert">
        {fill(t.stockCheckFailed, { error })}
      </p>
    );
  }
  if (!stock) return <p className="kz-help">{t.checkingStock}</p>;
  const shortRows = stock.ingredients.filter((row) => row.short !== '0');
  const unchecked = stock.lines.filter((line) => !line.checked);
  return (
    <div className="kz-stack">
      <h3>{common.stockCheck}</h3>
      <p>
        <span className="kz-status" data-tone={stock.canFulfil ? 'done' : 'problem'}>
          {stock.canFulfil ? t.stockCovers : t.notEnoughStock}
        </span>{' '}
        {stock.canFulfil
          ? t.everyItemCovered
          : unchecked.length > 0
            ? fill(t.ingredientsShortNoRecipe, {
                count: shortRows.length,
                items: unchecked.length,
              })
            : fill(t.ingredientsShort, { count: shortRows.length })}
      </p>
      <div className="kz-table-wrap">
        <table className="kz-table">
          <thead>
            <tr>
              <th>{t.item}</th>
              <th>{t.askedFor}</th>
              <th>{t.stockCanMake}</th>
            </tr>
          </thead>
          <tbody>
            {stock.lines.map((line) => (
              <tr key={line.recipeId}>
                <td>{line.recipeName}</td>
                <td>{line.quantity}</td>
                <td>
                  {line.checked ? (
                    <span
                      className="kz-status"
                      data-tone={line.canMake >= line.quantity ? 'done' : 'problem'}
                    >
                      {line.canMake}
                    </span>
                  ) : (
                    t.noRecipeIngredients
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {stock.ingredients.length > 0 ? (
        <div className="kz-table-wrap">
          <table className="kz-table">
            <thead>
              <tr>
                <th>{t.ingredient}</th>
                <th>{t.needed}</th>
                <th>{t.inStock}</th>
                <th>{t.heldForOthers}</th>
                <th>{t.short}</th>
              </tr>
            </thead>
            <tbody>
              {stock.ingredients.map((row) => {
                const unit = label(BASE_UNIT_LABELS[row.baseUnit]);
                return (
                  <tr key={row.itemId}>
                    <td>{row.itemName}</td>
                    <td>
                      {row.needed} {unit}
                    </td>
                    <td>
                      {row.onHand} {unit}
                    </td>
                    <td>
                      {row.promised} {unit}
                    </td>
                    <td>
                      {row.short === '0' ? (
                        <span className="kz-status" data-tone="done">
                          {t.none}
                        </span>
                      ) : (
                        <span className="kz-status" data-tone="problem">
                          {row.short} {unit}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

/** What the search box looks in. */
function requestSearchText(row: ServiceRequestRecord): string {
  return [row.number, row.airlineName, row.flightNumber, row.route].join(' ');
}
