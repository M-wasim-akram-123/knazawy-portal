'use client';

import type { ServiceRequestInput } from '@knazawy/api-client';
import type { SessionUser } from '@knazawy/auth-client';
import { messages } from '@knazawy/i18n';
import {
  DELIVERY_POINT_LABELS,
  DELIVERY_POINTS,
  RECIPE_KIND_LABELS,
  REQUEST_STATUS_LABELS,
  formatDisplayDate,
  isAirlineRole,
  statusTone,
  todayInKarachi,
  type DeliveryPoint,
  type MenuItemRecord,
  type ServiceRequestRecord,
} from '@knazawy/shared';
import { useEffect, useState } from 'react';

import { Field } from '../../components/Field';
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
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [menu, setMenu] = useState<MenuItemRecord[]>([]);
  const [requests, setRequests] = useState<ServiceRequestRecord[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);

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

  function handleFailure(caught: unknown) {
    if (caught instanceof ApiError && caught.status === 401) {
      clearSession();
      setUser(null);
      return;
    }
    setError(caught instanceof Error ? caught.message : 'Something went wrong. Try again.');
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setForm(emptyForm());
    setQuantities({});
    setEditingId(null);
  }

  function openDraft(request: ServiceRequestRecord) {
    setError('');
    setSaved('');
    setEditingId(request.id);
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
  }

  async function save(send: boolean) {
    setBusy(true);
    setError('');
    setSaved('');
    try {
      const input = toInput(form, quantities);
      let record = editingId
        ? await api.updateRequest(editingId, input)
        : await api.createRequest(input);
      setEditingId(record.id);
      if (send) record = await api.submitRequest(record.id);
      setRequests(await api.listRequests());
      if (send) {
        resetForm();
        setSaved(`${record.number} is sent to Karam.`);
      } else {
        setSaved(`${record.number} is saved as a draft.`);
      }
    } catch (caught: unknown) {
      handleFailure(caught);
    } finally {
      setBusy(false);
    }
  }

  async function cancelDraft() {
    if (!editingId) return;
    setBusy(true);
    setError('');
    setSaved('');
    try {
      const record = await api.cancelRequest(editingId);
      setRequests(await api.listRequests());
      resetForm();
      setSaved(`${record.number} is cancelled.`);
    } catch (caught: unknown) {
      handleFailure(caught);
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <p>Loading</p>;
  if (!user) {
    return (
      <p>
        <a href="/login">{messages.en.common.signIn}</a> to see your requests.
      </p>
    );
  }
  if (!isAirlineRole(user.role)) {
    return <p>This page is for airline staff. Karam staff use the staff app.</p>;
  }

  return (
    <section className="kz-stack">
      <div className="kz-page-head">
        <h1>{messages.en.common.requests}</h1>
        <p>
          Ask for meals and snacks for a flight. Save a draft as often as you like. Karam sees the
          request once you send it. You only see your own airline.
        </p>
        <p lang="ur" dir="rtl">
          {messages.ur.common.requests}
        </p>
      </div>
      <div className="kz-workspace">
        <form
          className="kz-panel kz-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save(true);
          }}
        >
          <h2>{editingId ? 'Edit draft' : 'New request'}</h2>
          <div className="kz-form-grid">
            <Field label="Flight number">
              <input
                value={form.flightNumber}
                maxLength={8}
                placeholder="PK301"
                onChange={(event) => update('flightNumber', event.target.value)}
                required
              />
            </Field>
            <Field label="Route">
              <input
                value={form.route}
                maxLength={80}
                placeholder="KHI-DXB"
                onChange={(event) => update('route', event.target.value)}
                required
              />
            </Field>
            <Field label="Service date" hint="Shown as DD/MM/YYYY.">
              <input
                type="date"
                value={form.serviceDate}
                min={todayInKarachi()}
                onChange={(event) => update('serviceDate', event.target.value)}
                required
              />
            </Field>
            <Field label="Delivery time" hint="24-hour, such as 11:30.">
              <input
                value={form.deliveryTime}
                maxLength={5}
                placeholder="11:30"
                onChange={(event) => update('deliveryTime', event.target.value)}
                required
              />
            </Field>
            <Field label="Deliver to">
              <select
                value={form.deliveryPoint}
                onChange={(event) => update('deliveryPoint', event.target.value as DeliveryPoint)}
              >
                {DELIVERY_POINTS.map((point) => (
                  <option key={point} value={point}>
                    {DELIVERY_POINT_LABELS[point]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Where exactly" hint="Optional, such as gate or aircraft door.">
              <input
                value={form.deliveryDetail}
                maxLength={120}
                onChange={(event) => update('deliveryDetail', event.target.value)}
              />
            </Field>
          </div>
          <h3>Passengers</h3>
          <div className="kz-form-grid">
            <CountField label="Adults" value={form.adults} onChange={(v) => update('adults', v)} />
            <CountField
              label="Children"
              value={form.children}
              onChange={(v) => update('children', v)}
            />
            <CountField
              label="Infants"
              value={form.infants}
              onChange={(v) => update('infants', v)}
            />
            <CountField label="Crew" value={form.crew} onChange={(v) => update('crew', v)} />
            <CountField
              label="Special diets"
              hint="Counted within the passengers above."
              value={form.specialDiets}
              onChange={(v) => update('specialDiets', v)}
            />
            <Field label="Special diet note">
              <input
                value={form.specialDietNote}
                maxLength={200}
                onChange={(event) => update('specialDietNote', event.target.value)}
              />
            </Field>
          </div>
          <h3>Menu</h3>
          {menu.length === 0 ? (
            <p className="kz-empty">No menu items are available yet.</p>
          ) : (
            <div className="kz-table-wrap">
              <table className="kz-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Type</th>
                    <th>Portions</th>
                  </tr>
                </thead>
                <tbody>
                  {menu.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{RECIPE_KIND_LABELS[item.kind]}</td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          max={999}
                          step={1}
                          inputMode="numeric"
                          aria-label={`Portions of ${item.name}`}
                          value={quantities[item.id] ?? ''}
                          onChange={(event) =>
                            setQuantities((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Field label="Note for Karam">
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
          {saved ? <p>{saved}</p> : null}
          <div className="kz-actions">
            <button
              type="button"
              className="kz-button"
              disabled={busy}
              onClick={() => void save(false)}
            >
              Save draft
            </button>
            <button type="submit" className="kz-button" disabled={busy}>
              Send to Karam
            </button>
            {editingId ? (
              <button
                type="button"
                className="kz-button-quiet"
                disabled={busy}
                onClick={() => void cancelDraft()}
              >
                Cancel draft
              </button>
            ) : null}
          </div>
        </form>
        <div className="kz-panel kz-table-wrap">
          <h2>Your requests</h2>
          {requests.length === 0 ? <p className="kz-empty">No requests yet.</p> : null}
          {requests.length > 0 ? (
            <table className="kz-table">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Flight</th>
                  <th>Route</th>
                  <th>Service date</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.number}</td>
                    <td>{request.flightNumber}</td>
                    <td>{request.route}</td>
                    <td>{formatDisplayDate(request.serviceDate)}</td>
                    <td>
                      <span className="kz-status" data-tone={statusTone(request.status)}>
                        {REQUEST_STATUS_LABELS[request.status]}
                      </span>
                      {request.status === 'REJECTED' && request.decisionNote ? (
                        <span className="kz-help"> {request.decisionNote}</span>
                      ) : null}
                    </td>
                    <td>
                      {request.status === 'DRAFT' ? (
                        <button
                          type="button"
                          className="kz-button-quiet"
                          onClick={() => openDraft(request)}
                        >
                          Edit
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </div>
    </section>
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
