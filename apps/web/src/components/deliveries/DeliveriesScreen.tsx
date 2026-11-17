'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { staffDeliveriesCopy } from '@knazawy/i18n';
import {
  DELIVERY_POINT_LABELS,
  RECIPE_KIND_LABELS,
  REQUEST_STATUS_LABELS,
  can,
  formatDisplayDate,
  statusTone,
  type DeliveryRecord,
  type ServiceRequestRecord,
} from '@knazawy/shared';
import { FormDialog, KaramLoader } from '@knazawy/ui-shell';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { fill, useCommon, useCopy, useLabel } from '../../lib/i18n';
import { api, readSessionUser } from '../../lib/session';
import { Field } from '../master/Field';

export function DeliveriesScreen() {
  const t = useCopy(staffDeliveriesCopy);
  const common = useCommon();
  const label = useLabel();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [requests, setRequests] = useState<ServiceRequestRecord[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [requestId, setRequestId] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [vehicleNote, setVehicleNote] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const session = readSessionUser();
    setUser(session);
    setReady(true);
    if (!session) return;
    void Promise.all([api.listRequests(), api.listDeliveries()])
      .then(([nextRequests, nextDeliveries]) => {
        setRequests(nextRequests);
        setDeliveries(nextDeliveries);
        const waiting = nextRequests.filter(
          (request) =>
            request.status === 'ACCEPTED' &&
            !nextDeliveries.some((delivery) => delivery.requestId === request.id),
        );
        setRequestId(waiting[0]?.id ?? '');
        setSelectedId(nextDeliveries[0]?.id ?? null);
      })
      .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
  }, []);

  const selected = deliveries.find((delivery) => delivery.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) return;
    const source = selected.status === 'IN_PRODUCTION' ? 'ordered' : 'dispatched';
    setQuantities(
      Object.fromEntries(
        selected.lines.map((line) => [
          line.recipeId,
          String(source === 'ordered' ? line.ordered : (line.dispatched ?? 0)),
        ]),
      ),
    );
    setVehicleNote(selected.vehicleNote ?? '');
    setReceivedBy('');
    setNote('');
  }, [selected]);

  if (!ready) return <KaramLoader label={t.loading} fullPage />;
  if (!user) {
    return (
      <p>
        <Link href="/login">{common.signIn}</Link> {t.signInToSee}
      </p>
    );
  }
  if (!can(user.role, 'distribution', 'R')) {
    return <p>{t.operationsOnly}</p>;
  }

  const canStart = can(user.role, 'distribution', 'C');
  const canUpdate = can(user.role, 'distribution', 'U');
  const waiting = requests.filter(
    (request) =>
      request.status === 'ACCEPTED' &&
      !deliveries.some((delivery) => delivery.requestId === request.id),
  );

  function replace(delivery: DeliveryRecord) {
    setDeliveries((current) => {
      const exists = current.some((row) => row.id === delivery.id);
      return exists
        ? current.map((row) => (row.id === delivery.id ? delivery : row))
        : [delivery, ...current];
    });
    setSelectedId(delivery.id);
  }

  async function run(action: () => Promise<DeliveryRecord>, message: string): Promise<boolean> {
    setBusy(true);
    setError('');
    setSaved('');
    try {
      replace(await action());
      setSaved(message);
      return true;
    } catch (caught: unknown) {
      setError(explainApiError(caught, setUser));
      return false;
    } finally {
      setBusy(false);
    }
  }

  function quantitiesFor(delivery: DeliveryRecord) {
    return delivery.lines.map((line) => ({
      recipeId: line.recipeId,
      quantity: Number(quantities[line.recipeId] ?? '0'),
    }));
  }

  return (
    <section className="kz-stack">
      <div className="kz-page-head kz-page-action-head">
        <div>
          <h1>{common.deliveries}</h1>
          <p>{t.intro}</p>
        </div>
        {canStart ? (
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
            {t.startDelivery}
          </button>
        ) : null}
      </div>
      <div className="kz-workspace kz-workspace-stacked">
        <div className="kz-stack">
          {canStart ? (
            <FormDialog
              buttonLabel={t.startDelivery}
              title={t.startADelivery}
              showTrigger={false}
              isOpen={dialogOpen}
              onOpenChange={setDialogOpen}
            >
              {({ close }) => (
                <form
                  className="kz-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(() => api.startDelivery(requestId), t.inProduction).then(
                      (succeeded) => {
                        if (succeeded) close();
                      },
                    );
                  }}
                >
                  {waiting.length === 0 ? (
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
                  )}
                  {error ? (
                    <p className="kz-error" role="alert">
                      {error}
                    </p>
                  ) : null}
                  <button
                    className="kz-button"
                    type="submit"
                    disabled={busy || waiting.length === 0}
                  >
                    {t.start}
                  </button>
                </form>
              )}
            </FormDialog>
          ) : null}
          <div className="kz-panel kz-table-wrap">
            <h2>{common.deliveries}</h2>
            {deliveries.length === 0 ? <p className="kz-empty">{t.noDeliveries}</p> : null}
            {deliveries.length > 0 ? (
              <table className="kz-table">
                <thead>
                  <tr>
                    <th>{t.number}</th>
                    <th>{t.flight}</th>
                    <th>{t.serviceDate}</th>
                    <th>{t.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((delivery) => (
                    <tr key={delivery.id}>
                      <td>
                        <a
                          href={`#${delivery.id}`}
                          aria-current={delivery.id === selectedId ? 'true' : undefined}
                          onClick={(event) => {
                            event.preventDefault();
                            setSelectedId(delivery.id);
                          }}
                        >
                          {delivery.number}
                        </a>
                      </td>
                      <td>
                        {delivery.flightNumber}
                        <span className="kz-help"> · {delivery.requestNumber}</span>
                      </td>
                      <td>{formatDisplayDate(delivery.serviceDate)}</td>
                      <td>
                        <span className="kz-status" data-tone={statusTone(delivery.status)}>
                          {label(REQUEST_STATUS_LABELS[delivery.status])}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        </div>
        <div className="kz-panel kz-stack">
          {selected ? (
            <>
              <h2>
                {selected.number} · {selected.airlineName}
              </h2>
              <p>
                <span className="kz-status" data-tone={statusTone(selected.status)}>
                  {label(REQUEST_STATUS_LABELS[selected.status])}
                </span>
                {' · '}
                {fill(t.summary, {
                  request: selected.requestNumber,
                  flight: selected.flightNumber,
                  route: selected.route,
                  date: formatDisplayDate(selected.serviceDate),
                  point: label(DELIVERY_POINT_LABELS[selected.deliveryPoint]),
                })}
              </p>
              <div className="kz-table-wrap">
                <table className="kz-table">
                  <thead>
                    <tr>
                      <th>{t.item}</th>
                      <th>{t.ordered}</th>
                      <th>{selected.status === 'IN_PRODUCTION' ? t.sending : t.sent}</th>
                      <th>{selected.status === 'DISPATCHED' ? t.arrived : t.received}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.lines.map((line) => (
                      <tr key={line.recipeId}>
                        <td>
                          {line.recipeName}
                          <span className="kz-help"> · {label(RECIPE_KIND_LABELS[line.kind])}</span>
                        </td>
                        <td>{line.ordered}</td>
                        <td>
                          {selected.status === 'IN_PRODUCTION' && canUpdate ? (
                            <QuantityInput
                              label={fill(t.portionsToSend, { name: line.recipeName })}
                              max={line.ordered}
                              value={quantities[line.recipeId] ?? ''}
                              onChange={(value) =>
                                setQuantities((current) => ({ ...current, [line.recipeId]: value }))
                              }
                            />
                          ) : (
                            (line.dispatched ?? '—')
                          )}
                        </td>
                        <td>
                          {selected.status === 'DISPATCHED' && canUpdate ? (
                            <QuantityInput
                              label={fill(t.portionsArrived, { name: line.recipeName })}
                              max={line.dispatched ?? 0}
                              value={quantities[line.recipeId] ?? ''}
                              onChange={(value) =>
                                setQuantities((current) => ({ ...current, [line.recipeId]: value }))
                              }
                            />
                          ) : (
                            (line.delivered ?? '—')
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selected.status === 'IN_PRODUCTION' && canUpdate ? (
                <>
                  <Field label={t.vehicle} hint={t.optionalHint}>
                    <input
                      value={vehicleNote}
                      maxLength={120}
                      onChange={(event) => setVehicleNote(event.target.value)}
                    />
                  </Field>
                  <button
                    type="button"
                    className="kz-button"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () =>
                          api.dispatchDelivery(selected.id, {
                            vehicleNote: vehicleNote.trim() || undefined,
                            lines: quantitiesFor(selected),
                          }),
                        fill(t.leftKitchen, { number: selected.number }),
                      )
                    }
                  >
                    {t.sendOut}
                  </button>
                </>
              ) : null}
              {selected.status === 'DISPATCHED' && canUpdate ? (
                <>
                  <Field label={t.receivedBy}>
                    <input
                      value={receivedBy}
                      maxLength={120}
                      onChange={(event) => setReceivedBy(event.target.value)}
                    />
                  </Field>
                  <Field label={t.note} hint={t.noteHint}>
                    <input
                      value={note}
                      maxLength={300}
                      onChange={(event) => setNote(event.target.value)}
                    />
                  </Field>
                  <button
                    type="button"
                    className="kz-button"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () =>
                          api.recordDelivery(selected.id, {
                            receivedBy: receivedBy.trim() || undefined,
                            note: note.trim() || undefined,
                            lines: quantitiesFor(selected),
                          }),
                        fill(t.recordedDelivered, { number: selected.number }),
                      )
                    }
                  >
                    {t.recordArrival}
                  </button>
                </>
              ) : null}
              {selected.vehicleNote ? (
                <p>{fill(t.sentWith, { vehicle: selected.vehicleNote })}</p>
              ) : null}
              {selected.receivedBy ? (
                <p>{fill(t.receivedByValue, { name: selected.receivedBy })}</p>
              ) : null}
              {selected.note ? <p>{selected.note}</p> : null}
            </>
          ) : (
            <p className="kz-empty">{t.chooseDelivery}</p>
          )}
          {error ? (
            <p className="kz-error" role="alert">
              {error}
            </p>
          ) : null}
          {saved ? <p>{saved}</p> : null}
        </div>
      </div>
    </section>
  );
}

function QuantityInput({
  label,
  max,
  value,
  onChange,
}: {
  label: string;
  max: number;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="number"
      min={0}
      max={max}
      step={1}
      inputMode="numeric"
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
