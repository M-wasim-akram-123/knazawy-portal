'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { messages } from '@knazawy/i18n';
import {
  BASE_UNIT_LABELS,
  COUNT_STATUS_LABELS,
  can,
  countStatusTone,
  formatDisplayDate,
  todayInKarachi,
} from '@knazawy/shared';
import type {
  ItemRecord,
  LocationRecord,
  StockCountLineRecord,
  StockCountRecord,
} from '@knazawy/shared';
import { FormDialog } from '@knazawy/ui-shell';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { api, readSessionUser } from '../../lib/session';
import { Field } from '../master/Field';

export function CountsScreen() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [counts, setCounts] = useState<StockCountRecord[]>([]);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState('');
  const [countedOn, setCountedOn] = useState(todayInKarachi());
  const [note, setNote] = useState('');
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [extras, setExtras] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const session = readSessionUser();
    setUser(session);
    setReady(true);
    if (!session) return;
    void Promise.all([api.listItems(), api.listLocations(), api.listCounts()])
      .then(([nextItems, nextLocations, nextCounts]) => {
        const openLocations = nextLocations.filter((location) => location.active);
        setItems(nextItems.filter((item) => item.active));
        setLocations(openLocations);
        setCounts(nextCounts);
        setLocationId(openLocations[0]?.id ?? '');
        const counting = nextCounts.find((count) => count.status === 'COUNTING');
        if (counting) show(counting);
      })
      .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
  }, []);

  if (!ready) return <p>Loading counts</p>;
  if (!user) {
    return (
      <p>
        <Link href="/login">{messages.en.common.signIn}</Link> to count stock.
      </p>
    );
  }

  const canCount = can(user.role, 'stock', 'C');
  const canApprove = can(user.role, 'stock', 'A');
  const sheet = counts.find((count) => count.id === sheetId) ?? null;
  const rows = rowsOf(sheet, extras, items);
  const used = new Set(rows.map((row) => row.itemId));
  const spareItems = items.filter((item) => !used.has(item.id));

  return (
    <section className="kz-stack">
      <div className="kz-page-head kz-page-action-head">
        <div>
          <h1>{messages.en.common.countStock}</h1>
          <p>
            Count one location. The difference waits for approval, then stock is corrected. A
            shortage leaves at the oldest cost, and anything extra comes in at the latest cost.
          </p>
          <p lang="ur" dir="rtl">
            {messages.ur.common.countStock}
          </p>
        </div>
        {canCount ? (
          <button
            className="kz-button kz-form-dialog-trigger"
            type="button"
            aria-haspopup="dialog"
            onClick={() => {
              setError('');
              setDialogOpen(true);
            }}
          >
            New count
          </button>
        ) : null}
      </div>
      {error && !dialogOpen && !sheet ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className={`kz-workspace${sheet ? '' : ' kz-workspace-single'}`}>
        {canCount ? (
          <FormDialog
            buttonLabel="New count"
            title="New count"
            showTrigger={false}
            isOpen={dialogOpen}
            onOpenChange={setDialogOpen}
          >
            {({ close }) => (
              <form
                className="kz-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  setError('');
                  setSaved('');
                  setSaving(true);
                  void api
                    .createCount({ locationId, countedOn, note: note.trim() || undefined })
                    .then((count) => {
                      setCounts((current) => [
                        count,
                        ...current.filter((row) => row.id !== count.id),
                      ]);
                      setNote('');
                      show(count);
                      setSaved(`${count.number} is ready to count at ${count.locationName}.`);
                      close();
                    })
                    .catch(async (caught: unknown) => {
                      setError(explainApiError(caught, setUser));
                      await refresh();
                    })
                    .finally(() => setSaving(false));
                }}
              >
                <Field label="Location">
                  <select
                    value={locationId}
                    onChange={(event) => setLocationId(event.target.value)}
                    required
                  >
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Counted on" hint="Shown as DD/MM/YYYY.">
                  <input
                    type="date"
                    value={countedOn}
                    onChange={(event) => setCountedOn(event.target.value)}
                    required
                  />
                </Field>
                <Field label="Note">
                  <input
                    value={note}
                    maxLength={200}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Optional"
                  />
                </Field>
                {error && !sheet ? (
                  <p className="kz-error" role="alert">
                    {error}
                  </p>
                ) : null}
                {saved && !sheet ? <p>{saved}</p> : null}
                <button
                  className="kz-button"
                  type="submit"
                  disabled={saving || locations.length === 0}
                >
                  {saving ? 'Starting' : 'Start count'}
                </button>
              </form>
            )}
          </FormDialog>
        ) : null}
        {sheet ? (
          <form
            className="kz-panel kz-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (sheet.status !== 'COUNTING') return;
              const lines = rows.map((row) => ({
                itemId: row.itemId,
                counted: counted[row.itemId] ?? '',
              }));
              const missing = rows.find((row) => (counted[row.itemId] ?? '').trim() === '');
              if (missing) {
                setError(`Enter the counted quantity for ${missing.itemName}.`);
                return;
              }
              setError('');
              setSaved('');
              setSaving(true);
              void api
                .submitCount(sheet.id, lines)
                .then((next) => {
                  remember(next);
                  setSaved(`${next.number} is waiting for approval.`);
                })
                .catch(async (caught: unknown) => {
                  setError(explainApiError(caught, setUser));
                  await refresh();
                })
                .finally(() => setSaving(false));
            }}
          >
            <h2>
              {sheet.number} · {sheet.locationName}
            </h2>
            <p>
              <span className="kz-status" data-tone={countStatusTone(sheet.status)}>
                {COUNT_STATUS_LABELS[sheet.status]}
              </span>{' '}
              {formatDisplayDate(sheet.countedOn)}
            </p>
            {sheet.note ? <p>{sheet.note}</p> : null}
            {rows.length === 0 ? (
              <p>Nothing is on the book here. Add an item if you found some.</p>
            ) : null}
            {rows.length > 0 ? (
              <div className="kz-table-wrap">
                <table className="kz-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Book</th>
                      <th>Counted</th>
                      <th>Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const unit = BASE_UNIT_LABELS[row.baseUnit];
                      const entered = counted[row.itemId] ?? '';
                      return (
                        <tr key={row.itemId}>
                          <td>{row.itemName}</td>
                          <td>
                            {row.bookQuantity} {unit}
                          </td>
                          <td>
                            {sheet.status === 'COUNTING' && canCount ? (
                              <input
                                inputMode="decimal"
                                value={entered}
                                placeholder={`in ${unit}`}
                                onChange={(event) =>
                                  setCounted((current) => ({
                                    ...current,
                                    [row.itemId]: event.target.value,
                                  }))
                                }
                                required
                              />
                            ) : (
                              (row.countedQuantity ?? '—')
                            )}
                          </td>
                          <td>
                            {differenceText(entered || row.countedQuantity, row.bookQuantity, unit)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
            {sheet.status === 'COUNTING' && canCount && spareItems.length > 0 ? (
              <Field label="Add an item">
                <select
                  value=""
                  onChange={(event) => {
                    const itemId = event.target.value;
                    if (!itemId) return;
                    setExtras((current) => [...current, itemId]);
                    setCounted((current) => ({ ...current, [itemId]: current[itemId] ?? '' }));
                  }}
                >
                  <option value="">Choose an item</option>
                  {spareItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            {error ? (
              <p className="kz-error" role="alert">
                {error}
              </p>
            ) : null}
            {saved ? <p>{saved}</p> : null}
            {sheet.status === 'COUNTING' && canCount ? (
              <button className="kz-button" type="submit" disabled={saving}>
                {saving ? 'Submitting' : 'Submit for approval'}
              </button>
            ) : null}
            {sheet.status === 'WAITING' && canApprove ? (
              <p>
                <button
                  className="kz-button"
                  type="button"
                  onClick={() => {
                    setError('');
                    setSaving(true);
                    void api
                      .approveCount(sheet.id)
                      .then((next) => {
                        remember(next);
                        setSaved(
                          `${next.number} is posted. Stock at ${next.locationName} matches the count.`,
                        );
                      })
                      .catch((caught: unknown) => setError(explainApiError(caught, setUser)))
                      .finally(() => setSaving(false));
                  }}
                >
                  Approve and post
                </button>{' '}
                <button
                  className="kz-button-quiet"
                  type="button"
                  onClick={() => {
                    setError('');
                    setSaving(true);
                    void api
                      .sendCountBack(sheet.id)
                      .then((next) => {
                        remember(next);
                        setSaved(`${next.number} is back with the counter.`);
                      })
                      .catch((caught: unknown) => setError(explainApiError(caught, setUser)))
                      .finally(() => setSaving(false));
                  }}
                >
                  Send back
                </button>
              </p>
            ) : null}
          </form>
        ) : null}
        <div className="kz-panel kz-table-wrap">
          <h2>Counts</h2>
          {counts.length === 0 ? <p className="kz-empty">No counts yet.</p> : null}
          <table className="kz-table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Location</th>
                <th>Status</th>
                <th>Counted</th>
                <th>Lines</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {counts.map((count) => (
                <tr key={count.id}>
                  <td>{count.number}</td>
                  <td>{count.locationName}</td>
                  <td>
                    <span className="kz-status" data-tone={countStatusTone(count.status)}>
                      {COUNT_STATUS_LABELS[count.status]}
                    </span>
                  </td>
                  <td>{formatDisplayDate(count.countedOn)}</td>
                  <td>{count.lines.map((line) => describeLine(line)).join('; ') || '—'}</td>
                  <td>
                    <button type="button" className="kz-button-quiet" onClick={() => show(count)}>
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );

  function show(count: StockCountRecord): void {
    setSheetId(count.id);
    setCounted(
      Object.fromEntries(count.lines.map((line) => [line.itemId, line.countedQuantity ?? ''])),
    );
    setExtras([]);
  }

  function remember(count: StockCountRecord): void {
    setCounts((current) => [count, ...current.filter((row) => row.id !== count.id)]);
    show(count);
  }

  async function refresh(): Promise<void> {
    const latest = await api.listCounts().catch(() => null);
    if (latest) setCounts(latest);
  }
}

interface SheetRow {
  itemId: string;
  itemName: string;
  baseUnit: StockCountLineRecord['baseUnit'];
  bookQuantity: string;
  countedQuantity: string | null;
}

function rowsOf(sheet: StockCountRecord | null, extras: string[], items: ItemRecord[]): SheetRow[] {
  if (!sheet) return [];
  const extraRows = extras.map((itemId) => {
    const item = items.find((entry) => entry.id === itemId);
    return {
      itemId,
      itemName: item?.name ?? 'Item',
      baseUnit: item?.baseUnit ?? 'KG',
      bookQuantity: '0',
      countedQuantity: null,
    };
  });
  return [...sheet.lines, ...extraRows];
}

function describeLine(line: StockCountLineRecord): string {
  const unit = BASE_UNIT_LABELS[line.baseUnit];
  if (line.countedQuantity === null) return `${line.itemName}: book ${line.bookQuantity} ${unit}`;
  const diff = fromScaled(toScaled(line.countedQuantity) - toScaled(line.bookQuantity));
  if (diff === '0') return `${line.itemName}: no difference`;
  const amount = diff.startsWith('-') ? diff.slice(1) : diff;
  const way = diff.startsWith('-') ? 'short' : 'over';
  const cost =
    line.varianceCost && !/^[-+]?0+(?:\.0+)?$/.test(line.varianceCost)
      ? ` (${money(line.varianceCost)} PKR)`
      : '';
  return `${line.itemName}: ${amount} ${unit} ${way}${cost}`;
}

function differenceText(counted: string | null, book: string, unit: string): string {
  if (!counted || counted.trim() === '') return '—';
  const diff = fromScaled(toScaled(counted) - toScaled(book));
  if (!Number.isFinite(toScaled(counted))) return '—';
  if (diff === '0') return 'No difference';
  const amount = diff.startsWith('-') ? diff.slice(1) : diff;
  return diff.startsWith('-') ? `${amount} ${unit} short` : `${amount} ${unit} over`;
}

function money(value: string): string {
  return value
    .replace(/^-/, '')
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '');
}

function toScaled(value: string): number {
  const trimmed = value.trim();
  const negative = trimmed.startsWith('-');
  const [whole, frac = ''] = trimmed.replace('-', '').split('.');
  if (!/^\d+$/.test(whole || '0') || (frac !== '' && !/^\d+$/.test(frac))) return Number.NaN;
  const scaled = Number(whole || '0') * 10000 + Number((frac + '0000').slice(0, 4));
  return negative ? -scaled : scaled;
}

function fromScaled(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value < 0 ? '-' : '';
  const absolute = Math.abs(value);
  const whole = Math.trunc(absolute / 10000);
  const frac = String(absolute % 10000)
    .padStart(4, '0')
    .replace(/0+$/, '');
  return frac ? `${sign}${whole}.${frac}` : `${sign}${whole}`;
}
