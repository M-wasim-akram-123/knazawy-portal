'use client';

import type { ServiceRequestInput } from '@knazawy/api-client';
import type { SessionUser } from '@knazawy/auth-client';
import { portalRequestsCopy } from '@knazawy/i18n';
import {
  DELIVERY_POINT_LABELS,
  DELIVERY_POINTS,
  RECIPE_KIND_LABELS,
  REQUEST_STATUS_LABELS,
  amendmentError,
  cancellationChargeApplies,
  cutOffInstant,
  formatDisplayDate,
  formatKarachiDateTime,
  isAirlineRole,
  isPastCutOff,
  passengerTotal,
  previewCharges,
  statusTone,
  todayInKarachi,
  type ChargePreviewLine,
  type DeliveryPoint,
  type MenuItemRecord,
  type RateCardRecord,
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

import { Field } from '../../components/Field';
import { fill, useChrome, useCommon, useCopy, useLabel } from '../../lib/i18n';
import { ApiError, api, clearSession, readSessionUser } from '../../lib/session';

interface FormState {
  flightNumber: string;
  route: string;
  serviceDate: string;
  deliveryTime: string;
  deliveryPoint: DeliveryPoint;
  deliveryDetail: string;
  adults: string;
  children: string;
  infants: string;
  crew: string;
  specialDiets: string;
  specialDietNote: string;
  note: string;
}

function emptyForm(): FormState {
  return {
    flightNumber: '',
    route: '',
    serviceDate: todayInKarachi(),
    deliveryTime: '',
    deliveryPoint: 'GATE',
    deliveryDetail: '',
    adults: '',
    children: '',
    infants: '',
    crew: '',
    specialDiets: '',
    specialDietNote: '',
    note: '',
  };
}

export function RequestsScreen() {
  const t = useCopy(portalRequestsCopy);
  const common = useCommon();
  const chrome = useChrome();
  const label = useLabel();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [menu, setMenu] = useState<MenuItemRecord[]>([]);
  const [requests, setRequests] = useState<ServiceRequestRecord[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [purpose, setPurpose] = useState<'draft' | 'amend'>('draft');
  const [amendReason, setAmendReason] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState<RateCardRecord | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailCard, setDetailCard] = useState<RateCardRecord | null>(null);
  const filters = useRequestFilters(requests, requestSearchText);
  const page = usePage(filters.shown, 10);

  useEffect(() => {
    const session = readSessionUser();
    setUser(session);
    setReady(true);
    if (!session || !isAirlineRole(session.role)) return;
    void Promise.all([api.listMenu(), api.listRequests()])
      .then(([nextMenu, nextRequests]) => {
        setMenu(nextMenu);
        setRequests(nextRequests);
      })
      .catch((caught: unknown) => handleFailure(caught));
  }, []);

  const serviceDate = form.serviceDate;
  const airlineUser = user !== null && isAirlineRole(user.role);

  useEffect(() => {
    if (!airlineUser || !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
      setCard(null);
      return;
    }
    let live = true;
    void api
      .currentRateCard(serviceDate)
      .then((next) => {
        if (live) setCard(next);
      })
      .catch(() => {
        if (live) setCard(null);
      });
    return () => {
      live = false;
    };
  }, [airlineUser, serviceDate]);

  const selected = requests.find((row) => row.id === selectedId) ?? null;
  const selectedServiceDate = selected?.serviceDate ?? null;

  // The pop-up prices the order with the rate card valid on its own service date.
  useEffect(() => {
    if (!airlineUser || !detailOpen || !selectedServiceDate) {
      setDetailCard(null);
      return;
    }
    let live = true;
    void api
      .currentRateCard(selectedServiceDate)
      .then((next) => {
        if (live) setDetailCard(next);
      })
      .catch(() => {
        if (live) setDetailCard(null);
      });
    return () => {
      live = false;
    };
  }, [airlineUser, detailOpen, selectedServiceDate]);

  function handleFailure(caught: unknown) {
    if (caught instanceof ApiError && caught.status === 401) {
      clearSession();
      setUser(null);
      return;
    }
    setError(caught instanceof Error ? caught.message : t.genericError);
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setForm(emptyForm());
    setQuantities({});
    setEditingId(null);
    setPurpose('draft');
    setAmendReason('');
  }

  function openRequest(request: ServiceRequestRecord, next: 'draft' | 'amend') {
    setError('');
    setSaved('');
    setEditingId(request.id);
    setPurpose(next);
    setAmendReason('');
    setForm({
      flightNumber: request.flightNumber,
      route: request.route,
      serviceDate: request.serviceDate,
      deliveryTime: request.deliveryTime,
      deliveryPoint: request.deliveryPoint,
      deliveryDetail: request.deliveryDetail ?? '',
      adults: String(request.passengers.adults),
      children: String(request.passengers.children),
      infants: String(request.passengers.infants),
      crew: String(request.passengers.crew),
      specialDiets: String(request.passengers.specialDiets),
      specialDietNote: request.specialDietNote ?? '',
      note: request.note ?? '',
    });
    setQuantities(
      Object.fromEntries(request.lines.map((line) => [line.recipeId, String(line.quantity)])),
    );
    setDialogOpen(true);
  }

  async function save(send: boolean) {
    setBusy(true);
    setError('');
    setSaved('');
    try {
      const input = toInput(form, quantities);
      if (purpose === 'amend' && editingId) {
        if (amendReason.trim().length < 3) {
          setError(t.reasonRequired);
          return;
        }
        const record = await api.amendRequest(editingId, { ...input, reason: amendReason.trim() });
        setRequests(await api.listRequests());
        resetForm();
        setSaved(fill(t.changed, { number: record.number }));
        setDialogOpen(false);
        return;
      }
      let record = editingId
        ? await api.updateRequest(editingId, input)
        : await api.createRequest(input);
      setEditingId(record.id);
      if (send) record = await api.submitRequest(record.id);
      setRequests(await api.listRequests());
      if (send) {
        resetForm();
        setSaved(fill(t.sent, { number: record.number }));
      } else {
        setSaved(fill(t.savedDraft, { number: record.number }));
      }
      setDialogOpen(false);
    } catch (caught: unknown) {
      handleFailure(caught);
    } finally {
      setBusy(false);
    }
  }

  async function cancelRequest(request: ServiceRequestRecord) {
    setBusy(true);
    setError('');
    setSaved('');
    try {
      let acceptCharge = false;
      if (
        cancellationChargeApplies(
          request.status,
          isPastCutOff(request.serviceDate, request.deliveryTime),
        )
      ) {
        const current = await api.currentRateCard(request.serviceDate);
        const charge = previewCharges(request.lines, current);
        const confirmed = window.confirm(
          charge.total !== null
            ? fill(t.cancelConfirm, { number: request.number, total: charge.total })
            : fill(t.cancelConfirmUnknown, { number: request.number }),
        );
        if (!confirmed) return;
        acceptCharge = true;
      }
      const record = await api.cancelRequest(request.id, { acceptCharge });
      setRequests(await api.listRequests());
      if (editingId === request.id) {
        resetForm();
        setDialogOpen(false);
      }
      setSaved(fill(acceptCharge ? t.cancelledBilled : t.cancelled, { number: record.number }));
    } catch (caught: unknown) {
      handleFailure(caught);
    } finally {
      setBusy(false);
    }
  }

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
  if (!isAirlineRole(user.role)) {
    return <p>{t.notAirline}</p>;
  }

  const preview = previewCharges(toInput(form, quantities).lines, card);
  const ordered = preview.lines.length > 0;

  function canAmend(request: ServiceRequestRecord): boolean {
    return (
      amendmentError(
        request.status,
        isPastCutOff(request.serviceDate, request.deliveryTime),
        false,
      ) === null
    );
  }

  function canCancel(request: ServiceRequestRecord): boolean {
    return request.status === 'SUBMITTED' || request.status === 'ACCEPTED';
  }

  function showDetail(request: ServiceRequestRecord) {
    setSelectedId(request.id);
    setDetailOpen(true);
    setError('');
    setSaved('');
  }

  return (
    <section className="kz-stack">
      <div className="kz-page-head kz-page-action-head">
        <div>
          <h1>{common.requests}</h1>
          <p>{t.intro}</p>
        </div>
        <button
          className="kz-button kz-form-dialog-trigger"
          type="button"
          aria-haspopup="dialog"
          onClick={() => {
            resetForm();
            setError('');
            setSaved('');
            setDialogOpen(true);
          }}
        >
          {t.newRequest}
        </button>
      </div>
      {error && !dialogOpen && !detailOpen ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      {saved && !detailOpen ? <p role="status">{saved}</p> : null}
      <div className="kz-workspace kz-workspace-single">
        <FormDialog
          buttonLabel={t.newRequest}
          title={purpose === 'amend' ? t.changeRequest : editingId ? t.editDraft : t.newRequest}
          showTrigger={false}
          isOpen={dialogOpen}
          onOpenChange={setDialogOpen}
        >
          {() => (
            <form
              className="kz-form"
              onSubmit={(event) => {
                event.preventDefault();
                void save(true);
              }}
            >
              <div className="kz-form-grid">
                <Field label={t.flightNumber}>
                  <input
                    value={form.flightNumber}
                    maxLength={8}
                    placeholder="PK301"
                    onChange={(event) => update('flightNumber', event.target.value)}
                    required
                  />
                </Field>
                <Field label={t.route}>
                  <input
                    value={form.route}
                    maxLength={80}
                    placeholder="KHI-DXB"
                    onChange={(event) => update('route', event.target.value)}
                    required
                  />
                </Field>
                <Field label={t.serviceDate} hint={t.dateHint}>
                  <input
                    type="date"
                    value={form.serviceDate}
                    min={todayInKarachi()}
                    onChange={(event) => update('serviceDate', event.target.value)}
                    required
                  />
                </Field>
                <Field
                  label={t.deliveryTime}
                  hint={
                    cutOffInstant(form.serviceDate, form.deliveryTime.trim())
                      ? fill(t.cutOffHint, {
                          time: formatKarachiDateTime(
                            cutOffInstant(form.serviceDate, form.deliveryTime.trim()) as Date,
                          ),
                        })
                      : t.timeHint
                  }
                >
                  <input
                    value={form.deliveryTime}
                    maxLength={5}
                    placeholder="11:30"
                    onChange={(event) => update('deliveryTime', event.target.value)}
                    required
                  />
                </Field>
                <Field label={t.deliverTo}>
                  <select
                    value={form.deliveryPoint}
                    onChange={(event) =>
                      update('deliveryPoint', event.target.value as DeliveryPoint)
                    }
                  >
                    {DELIVERY_POINTS.map((point) => (
                      <option key={point} value={point}>
                        {label(DELIVERY_POINT_LABELS[point])}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t.whereExactly} hint={t.whereExactlyHint}>
                  <input
                    value={form.deliveryDetail}
                    maxLength={120}
                    onChange={(event) => update('deliveryDetail', event.target.value)}
                  />
                </Field>
              </div>
              <h3>{t.passengers}</h3>
              <div className="kz-form-grid">
                <CountField
                  label={t.adults}
                  value={form.adults}
                  onChange={(v) => update('adults', v)}
                />
                <CountField
                  label={t.children}
                  value={form.children}
                  onChange={(v) => update('children', v)}
                />
                <CountField
                  label={t.infants}
                  value={form.infants}
                  onChange={(v) => update('infants', v)}
                />
                <CountField label={t.crew} value={form.crew} onChange={(v) => update('crew', v)} />
                <CountField
                  label={t.specialDiets}
                  hint={t.specialDietsHint}
                  value={form.specialDiets}
                  onChange={(v) => update('specialDiets', v)}
                />
                <Field label={t.specialDietNote}>
                  <input
                    value={form.specialDietNote}
                    maxLength={200}
                    onChange={(event) => update('specialDietNote', event.target.value)}
                  />
                </Field>
              </div>
              <h3>{t.menu}</h3>
              {menu.length === 0 ? (
                <p className="kz-empty">{t.noMenu}</p>
              ) : (
                <div className="kz-table-wrap">
                  <table className="kz-table">
                    <thead>
                      <tr>
                        <th>{t.item}</th>
                        <th>{t.type}</th>
                        <th>{t.portions}</th>
                        <th>{t.price}</th>
                        <th>{t.charge}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {menu.map((item) => (
                        <tr key={item.id}>
                          <td>{item.name}</td>
                          <td>{label(RECIPE_KIND_LABELS[item.kind])}</td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              max={999}
                              step={1}
                              inputMode="numeric"
                              aria-label={fill(t.portionsOf, { name: item.name })}
                              value={quantities[item.id] ?? ''}
                              onChange={(event) =>
                                setQuantities((current) => ({
                                  ...current,
                                  [item.id]: event.target.value,
                                }))
                              }
                            />
                          </td>
                          <PriceCells
                            rate={card?.lines.find((line) => line.recipeId === item.id) ?? null}
                            charge={preview.lines.find((line) => line.recipeId === item.id) ?? null}
                          />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {ordered ? (
                <p>
                  {preview.total !== null && card
                    ? fill(t.estimate, { total: preview.total, card: card.number })
                    : card
                      ? fill(t.missingPrice, { card: card.number })
                      : t.noCard}
                </p>
              ) : null}
              <Field label={t.noteForKaram}>
                <input
                  value={form.note}
                  maxLength={300}
                  onChange={(event) => update('note', event.target.value)}
                />
              </Field>
              {error ? (
                <p className="kz-error" role="alert">
                  {error}
                </p>
              ) : null}
              {purpose === 'amend' ? (
                <Field label={t.changeReason} hint={t.changeReasonHint}>
                  <input
                    value={amendReason}
                    maxLength={300}
                    onChange={(event) => setAmendReason(event.target.value)}
                    required
                  />
                </Field>
              ) : null}
              <div className="kz-actions">
                {purpose === 'amend' ? (
                  <button
                    type="button"
                    className="kz-button"
                    disabled={busy}
                    onClick={() => void save(false)}
                  >
                    {t.saveChange}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="kz-button"
                      disabled={busy}
                      onClick={() => void save(false)}
                    >
                      {t.saveDraft}
                    </button>
                    <button type="submit" className="kz-button" disabled={busy}>
                      {t.sendToKaram}
                    </button>
                  </>
                )}
                {editingId ? (
                  <button
                    type="button"
                    className="kz-button-quiet"
                    disabled={busy}
                    onClick={() => {
                      const current = requests.find((row) => row.id === editingId);
                      if (current) void cancelRequest(current);
                    }}
                  >
                    {purpose === 'amend' ? t.cancelRequest : t.cancelDraft}
                  </button>
                ) : null}
              </div>
            </form>
          )}
        </FormDialog>
        <div className="kz-panel kz-table-wrap">
          <h2>{t.yourRequests}</h2>
          <RequestFilters
            filters={filters}
            copy={t}
            statusLabel={(status) =>
              label(REQUEST_STATUS_LABELS[status as keyof typeof REQUEST_STATUS_LABELS])
            }
            onChange={() => page.setPage(1)}
            showAirline={false}
          />
          {requests.length === 0 ? <p className="kz-empty">{t.empty}</p> : null}
          {requests.length > 0 && filters.shown.length === 0 ? (
            <p className="kz-empty">{t.noMatches}</p>
          ) : null}
          {requests.length > 0 ? (
            <table className="kz-table">
              <thead>
                <tr>
                  <th>{t.number}</th>
                  <th>{t.flight}</th>
                  <th>{t.route}</th>
                  <th>{t.serviceDate}</th>
                  <th>{t.status}</th>
                  <th className="kz-actions-head">{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((request) => (
                  <tr
                    key={request.id}
                    className="kz-row-clickable"
                    aria-selected={request.id === selectedId}
                    onClick={() => showDetail(request)}
                  >
                    <td>
                      {/* The number stays a link so the row can be reached and opened from the keyboard. */}
                      <a
                        href={`#${request.id}`}
                        aria-current={request.id === selectedId ? 'true' : undefined}
                        onClick={(event) => event.preventDefault()}
                      >
                        {request.number}
                      </a>
                    </td>
                    <td>{request.flightNumber}</td>
                    <td>{request.route}</td>
                    <td>{formatDisplayDate(request.serviceDate)}</td>
                    <td>
                      <span className="kz-status" data-tone={statusTone(request.status)}>
                        {label(REQUEST_STATUS_LABELS[request.status])}
                      </span>
                      {request.status === 'REJECTED' && request.decisionNote ? (
                        <span className="kz-help"> {request.decisionNote}</span>
                      ) : null}
                    </td>
                    <td className="kz-actions-cell">
                      <div className="kz-row-actions">
                        {request.status === 'DRAFT' ? (
                          <button
                            type="button"
                            className="kz-button-quiet"
                            onClick={(event) => {
                              event.stopPropagation();
                              openRequest(request, 'draft');
                            }}
                          >
                            {t.edit}
                          </button>
                        ) : null}
                        {canAmend(request) ? (
                          <button
                            type="button"
                            className="kz-button-quiet"
                            onClick={(event) => {
                              event.stopPropagation();
                              openRequest(request, 'amend');
                            }}
                          >
                            {t.change}
                          </button>
                        ) : null}
                        {canCancel(request) ? (
                          <button
                            type="button"
                            className="kz-button-quiet kz-button-danger"
                            disabled={busy}
                            onClick={(event) => {
                              event.stopPropagation();
                              void cancelRequest(request);
                            }}
                          >
                            {t.cancel}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
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
              <RequestDetail
                request={selected}
                card={detailCard}
                busy={busy}
                canAmend={canAmend(selected)}
                canCancel={canCancel(selected)}
                onEdit={() => {
                  setDetailOpen(false);
                  openRequest(selected, 'draft');
                }}
                onChange={() => {
                  setDetailOpen(false);
                  openRequest(selected, 'amend');
                }}
                onCancel={() => void cancelRequest(selected)}
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
    </section>
  );
}

function RequestDetail({
  request,
  card,
  busy,
  canAmend,
  canCancel,
  onEdit,
  onChange,
  onCancel,
}: {
  request: ServiceRequestRecord;
  card: RateCardRecord | null;
  busy: boolean;
  canAmend: boolean;
  canCancel: boolean;
  onEdit: () => void;
  onChange: () => void;
  onCancel: () => void;
}) {
  const t = useCopy(portalRequestsCopy);
  const label = useLabel();
  const charges = previewCharges(request.lines, card);
  const canEdit = request.status === 'DRAFT';
  const hasNotes = Boolean(request.note || request.decisionNote || request.amendments.length > 0);
  return (
    <>
      <div className="kz-order-head">
        <span className="kz-status" data-tone={statusTone(request.status)}>
          {label(REQUEST_STATUS_LABELS[request.status])}
        </span>
        <span className="kz-order-flight">
          {fill(t.flightRoute, { flight: request.flightNumber, route: request.route })}
        </span>
      </div>

      <dl className="kz-order-facts">
        <div>
          <dt>{t.factService}</dt>
          <dd>
            {formatDisplayDate(request.serviceDate)} · {request.deliveryTime}
          </dd>
        </div>
        <div>
          <dt>{t.factDelivery}</dt>
          <dd>
            {label(DELIVERY_POINT_LABELS[request.deliveryPoint])}
            {request.deliveryDetail ? <small>{request.deliveryDetail}</small> : null}
          </dd>
        </div>
        <div>
          <dt>{t.factCutOff}</dt>
          <dd>
            {request.cutOffAt ? formatKarachiDateTime(new Date(request.cutOffAt)) : '—'}
            <small>{t.factCutOffHint}</small>
          </dd>
        </div>
        <div>
          <dt>{t.factPassengers}</dt>
          <dd>
            {passengerTotal(request.passengers)}
            <small>
              {fill(t.passengerSplit, {
                adults: request.passengers.adults,
                children: request.passengers.children,
                infants: request.passengers.infants,
                crew: request.passengers.crew,
              })}
            </small>
          </dd>
        </div>
        <div>
          <dt>{t.factSpecialDiets}</dt>
          <dd>
            {request.passengers.specialDiets}
            {request.specialDietNote ? <small>{request.specialDietNote}</small> : null}
          </dd>
        </div>
        <div>
          <dt>{t.totalPortions}</dt>
          <dd>{request.lines.reduce((sum, line) => sum + line.quantity, 0)}</dd>
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
                <th>{t.price}</th>
                <th>{t.charge}</th>
              </tr>
            </thead>
            <tbody>
              {request.lines.map((line) => (
                <tr key={line.recipeId}>
                  <td>{line.recipeName}</td>
                  <td>{label(RECIPE_KIND_LABELS[line.kind])}</td>
                  <td>{line.quantity}</td>
                  <PriceCells
                    rate={card?.lines.find((rate) => rate.recipeId === line.recipeId) ?? null}
                    charge={charges.lines.find((row) => row.recipeId === line.recipeId) ?? null}
                  />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {hasNotes ? (
        <section className="kz-order-section">
          <h3>{t.notesTitle}</h3>
          <ul className="kz-order-notes">
            {request.note ? <li>{fill(t.yourNote, { note: request.note })}</li> : null}
            {request.decisionNote ? (
              <li>{fill(t.karamNote, { note: request.decisionNote })}</li>
            ) : null}
            {request.amendments.map((amendment) => (
              <li key={amendment.id}>
                <strong>{amendment.number}</strong> {amendment.reason}{' '}
                <span className="kz-help">({amendment.createdByName})</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canEdit || canAmend || canCancel ? (
        <section className="kz-order-section kz-order-decision">
          <h3>{t.actionsTitle}</h3>
          <div className="kz-order-actions">
            {canCancel ? (
              <button
                type="button"
                className="kz-button kz-button-outline"
                disabled={busy}
                onClick={onCancel}
              >
                {t.cancelRequest}
              </button>
            ) : null}
            {canEdit ? (
              <button type="button" className="kz-button" disabled={busy} onClick={onEdit}>
                {t.editDraft}
              </button>
            ) : null}
            {canAmend ? (
              <button type="button" className="kz-button" disabled={busy} onClick={onChange}>
                {t.changeRequest}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  );
}

function PriceCells({
  rate,
  charge,
}: {
  rate: RateCardRecord['lines'][number] | null;
  charge: ChargePreviewLine | null;
}) {
  const t = useCopy(portalRequestsCopy);
  return (
    <>
      <td>
        {rate ? `${rate.unitPrice} SAR` : '—'}
        {rate && rate.minimumQuantity > 0 ? (
          <span className="kz-help">{fill(t.atLeast, { count: rate.minimumQuantity })}</span>
        ) : null}
      </td>
      <td>
        {charge?.amount ? `${charge.amount} SAR` : '—'}
        {charge && charge.billedQuantity > charge.quantity ? (
          <span className="kz-help">{fill(t.billedAs, { count: charge.billedQuantity })}</span>
        ) : null}
      </td>
    </>
  );
}

function CountField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="number"
        min={0}
        max={999}
        step={1}
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

function toInput(form: FormState, quantities: Record<string, string>): ServiceRequestInput {
  return {
    flightNumber: form.flightNumber.trim(),
    route: form.route.trim(),
    serviceDate: form.serviceDate,
    deliveryTime: form.deliveryTime.trim(),
    deliveryPoint: form.deliveryPoint,
    deliveryDetail: optional(form.deliveryDetail),
    adults: count(form.adults),
    children: count(form.children),
    infants: count(form.infants),
    crew: count(form.crew),
    specialDiets: count(form.specialDiets),
    specialDietNote: optional(form.specialDietNote),
    note: optional(form.note),
    lines: Object.entries(quantities)
      .map(([recipeId, value]) => ({ recipeId, quantity: count(value) }))
      .filter((line) => line.quantity > 0),
  };
}

function count(value: string): number {
  const parsed = Number(value.trim() || '0');
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/** What the search box looks in. */
function requestSearchText(row: ServiceRequestRecord): string {
  return [row.number, row.flightNumber, row.route].join(' ');
}
