'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { countsCopy } from '@knazawy/i18n';
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
import { FormDialog, KaramLoader } from '@knazawy/ui-shell';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { fill, useCommon, useCopy, useLabel } from '../../lib/i18n';
import { api, readSessionUser } from '../../lib/session';
import { Field } from '../master/Field';

type CountsText = Record<keyof (typeof countsCopy)['en'], string>;

export function CountsScreen() {
  const t = useCopy(countsCopy);
  const common = useCommon();
  const label = useLabel();
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

  if (!ready) return <KaramLoader label={t.loading} fullPage />;
  if (!user) {
    return (
      <p>
        <Link href="/login">{common.signIn}</Link> {t.signInSuffix}
      </p>
    );
  }

  const canCount = can(user.role, 'stock', 'C');
  const canApprove = can(user.role, 'stock', 'A');
  const sheet = counts.find((count) => count.id === sheetId) ?? null;
  const rows = rowsOf(sheet, extras, items, t.item);
  const used = new Set(rows.map((row) => row.itemId));
  const spareItems = items.filter((item) => !used.has(item.id));

  return (
    <section className="kz-stack">
      <div className="kz-page-head kz-page-action-head">
        <div>
          <h1>{common.countStock}</h1>
          <p>{t.intro}</p>
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
            {t.newCount}
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
            buttonLabel={t.newCount}
            title={t.newCount}
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
                      setSaved(
                        fill(t.readyToCount, {
                          number: count.number,
                          location: count.locationName,
                        }),
                      );
                      close();
                    })
                    .catch(async (caught: unknown) => {
                      setError(explainApiError(caught, setUser));
                      await refresh();
                    })
                    .finally(() => setSaving(false));
                }}
              >
                <Field label={t.location}>
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
                <Field label={t.countedOn} hint={t.dateHint}>
                  <input
                    type="date"
                    value={countedOn}
                    onChange={(event) => setCountedOn(event.target.value)}
                    required
                  />
                </Field>
                <Field label={t.note}>
                  <input
                    value={note}
                    maxLength={200}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={t.optional}
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
                  {saving ? t.starting : t.startCount}
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
                setError(fill(t.enterCounted, { item: missing.itemName }));
                return;
              }
              setError('');
              setSaved('');
              setSaving(true);
              void api
                .submitCount(sheet.id, lines)
                .then((next) => {
                  remember(next);
                  setSaved(fill(t.waitingApproval, { number: next.number }));
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
                {label(COUNT_STATUS_LABELS[sheet.status])}
              </span>{' '}
              {formatDisplayDate(sheet.countedOn)}
            </p>
            {sheet.note ? <p>{sheet.note}</p> : null}
            {rows.length === 0 ? <p>{t.nothingOnBook}</p> : null}
            {rows.length > 0 ? (
              <div className="kz-table-wrap">
                <table className="kz-table">
                  <thead>
                    <tr>
                      <th>{t.item}</th>
                      <th>{t.book}</th>
                      <th>{t.counted}</th>
                      <th>{t.difference}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const unit = label(BASE_UNIT_LABELS[row.baseUnit]);
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
                                placeholder={fill(t.inUnit, { unit })}
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
                            {differenceText(
                              entered || row.countedQuantity,
                              row.bookQuantity,
                              unit,
                              t,
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
            {sheet.status === 'COUNTING' && canCount && spareItems.length > 0 ? (
              <Field label={t.addItem}>
                <select
                  value=""
                  onChange={(event) => {
                    const itemId = event.target.value;
                    if (!itemId) return;
                    setExtras((current) => [...current, itemId]);
                    setCounted((current) => ({ ...current, [itemId]: current[itemId] ?? '' }));
                  }}
                >
                  <option value="">{t.chooseItem}</option>
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
                {saving ? t.submitting : t.submitForApproval}
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
                          fill(t.posted, { number: next.number, location: next.locationName }),
                        );
                      })
                      .catch((caught: unknown) => setError(explainApiError(caught, setUser)))
                      .finally(() => setSaving(false));
                  }}
                >
                  {t.approveAndPost}
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
                        setSaved(fill(t.backWithCounter, { number: next.number }));
                      })
                      .catch((caught: unknown) => setError(explainApiError(caught, setUser)))
                      .finally(() => setSaving(false));
                  }}
                >
                  {t.sendBack}
                </button>
              </p>
            ) : null}
          </form>
        ) : null}
        <div className="kz-panel kz-table-wrap">
          <h2>{t.counts}</h2>
          {counts.length === 0 ? <p className="kz-empty">{t.noCounts}</p> : null}
          <table className="kz-table">
            <thead>
              <tr>
                <th>{t.number}</th>
                <th>{t.location}</th>
                <th>{t.status}</th>
                <th>{t.counted}</th>
                <th>{t.lines}</th>
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
                      {label(COUNT_STATUS_LABELS[count.status])}
                    </span>
                  </td>
                  <td>{formatDisplayDate(count.countedOn)}</td>
                  <td>
                    {count.lines.map((line) => describeLine(line, t, label)).join('; ') || '—'}
                  </td>
                  <td>
                    <button type="button" className="kz-button-quiet" onClick={() => show(count)}>
                      {t.open}
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

function rowsOf(
  sheet: StockCountRecord | null,
  extras: string[],
  items: ItemRecord[],
  fallbackName: string,
): SheetRow[] {
  if (!sheet) return [];
  const extraRows = extras.map((itemId) => {
    const item = items.find((entry) => entry.id === itemId);
    return {
      itemId,
      itemName: item?.name ?? fallbackName,
      baseUnit: item?.baseUnit ?? 'KG',
      bookQuantity: '0',
      countedQuantity: null,
    };
  });
  return [...sheet.lines, ...extraRows];
}

function describeLine(
  line: StockCountLineRecord,
  t: CountsText,
  label: (english: string) => string,
): string {
  const unit = label(BASE_UNIT_LABELS[line.baseUnit]);
  const item = line.itemName;
  if (line.countedQuantity === null) {
    return fill(t.lineBook, { item, quantity: line.bookQuantity, unit });
  }
  const diff = fromScaled(toScaled(line.countedQuantity) - toScaled(line.bookQuantity));
  if (diff === '0') return fill(t.lineNoDifference, { item });
  const amount = diff.startsWith('-') ? diff.slice(1) : diff;
  const cost =
    line.varianceCost && !/^[-+]?0+(?:\.0+)?$/.test(line.varianceCost)
      ? fill(t.lineCost, { amount: money(line.varianceCost) })
      : '';
  return fill(diff.startsWith('-') ? t.lineShort : t.lineOver, { item, amount, unit, cost });
}

function differenceText(counted: string | null, book: string, unit: string, t: CountsText): string {
  if (!counted || counted.trim() === '') return '—';
  const diff = fromScaled(toScaled(counted) - toScaled(book));
  if (!Number.isFinite(toScaled(counted))) return '—';
  if (diff === '0') return t.noDifference;
  const amount = diff.startsWith('-') ? diff.slice(1) : diff;
  return fill(diff.startsWith('-') ? t.short : t.over, { amount, unit });
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
