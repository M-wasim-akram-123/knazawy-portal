'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { transfersCopy } from '@knazawy/i18n';
import {
  BASE_UNIT_LABELS,
  TRANSFER_STATUS_LABELS,
  can,
  formatDisplayDate,
  todayInKarachi,
  transferStatusTone,
} from '@knazawy/shared';
import type {
  ItemRecord,
  LocationRecord,
  StockOnHandRecord,
  StockTransferRecord,
} from '@knazawy/shared';
import { FormDialog, KaramLoader } from '@knazawy/ui-shell';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { fill, useCommon, useCopy, useLabel } from '../../lib/i18n';
import { api, readSessionUser } from '../../lib/session';
import { Field } from '../master/Field';

interface DraftLine {
  key: string;
  itemId: string;
  quantity: string;
}

export function TransfersScreen() {
  const t = useCopy(transfersCopy);
  const common = useCommon();
  const label = useLabel();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [stock, setStock] = useState<StockOnHandRecord[]>([]);
  const [transfers, setTransfers] = useState<StockTransferRecord[]>([]);
  const [fromLocationId, setFromLocationId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [sentOn, setSentOn] = useState(todayInKarachi());
  const [lines, setLines] = useState<DraftLine[]>([]);
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
    void Promise.all([api.listItems(), api.listLocations(), api.listStock(), api.listTransfers()])
      .then(([nextItems, nextLocations, nextStock, nextTransfers]) => {
        const openItems = nextItems.filter((item) => item.active);
        const openLocations = nextLocations.filter((location) => location.active);
        setItems(openItems);
        setLocations(openLocations);
        setStock(nextStock);
        setTransfers(nextTransfers);
        setFromLocationId(openLocations[0]?.id ?? '');
        setToLocationId(openLocations[1]?.id ?? '');
        setLines([blankLine(openItems[0]?.id ?? '')]);
      })
      .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
  }, []);

  const onHand = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of stock) {
      totals.set(`${row.itemId}:${row.locationId}`, Number(row.quantityBase));
    }
    return totals;
  }, [stock]);

  if (!ready) return <KaramLoader label={t.loading} fullPage />;
  if (!user) {
    return (
      <p>
        <Link href="/login">{common.signIn}</Link> {t.signInSuffix}
      </p>
    );
  }

  const canSend = can(user.role, 'stock', 'C');
  const canReceive = can(user.role, 'stock', 'U');
  const itemById = new Map(items.map((item) => [item.id, item]));
  const samePlace = fromLocationId !== '' && fromLocationId === toLocationId;

  return (
    <section className="kz-stack">
      <div className="kz-page-head kz-page-action-head">
        <div>
          <h1>{common.transferStock}</h1>
          <p>{t.intro}</p>
        </div>
        {canSend ? (
          <button
            className="kz-button kz-form-dialog-trigger"
            type="button"
            aria-haspopup="dialog"
            onClick={() => {
              setError('');
              setDialogOpen(true);
            }}
          >
            {t.newTransfer}
          </button>
        ) : null}
      </div>
      {error && !dialogOpen ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="kz-workspace kz-workspace-single">
        {canSend ? (
          <FormDialog
            buttonLabel={t.newTransfer}
            title={t.newTransfer}
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
                    .createTransfer({
                      fromLocationId,
                      toLocationId,
                      sentOn,
                      lines: lines.map((line) => ({
                        itemId: line.itemId,
                        quantity: line.quantity,
                      })),
                    })
                    .then(async (transfer) => {
                      setTransfers((current) => [transfer, ...current]);
                      setSaved(
                        fill(t.onTheWay, {
                          number: transfer.number,
                          location: transfer.toLocationName,
                        }),
                      );
                      setLines([blankLine(items[0]?.id ?? '')]);
                      setStock(await api.listStock());
                      close();
                    })
                    .catch((caught: unknown) => setError(explainApiError(caught, setUser)))
                    .finally(() => setSaving(false));
                }}
              >
                <Field label={t.from}>
                  <select
                    value={fromLocationId}
                    onChange={(event) => setFromLocationId(event.target.value)}
                    required
                  >
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t.to}>
                  <select
                    value={toLocationId}
                    onChange={(event) => setToLocationId(event.target.value)}
                    required
                  >
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t.sentOn} hint={t.dateHint}>
                  <input
                    type="date"
                    value={sentOn}
                    onChange={(event) => setSentOn(event.target.value)}
                    required
                  />
                </Field>
                <div className="kz-table-wrap">
                  <table className="kz-table">
                    <thead>
                      <tr>
                        <th>{t.item}</th>
                        <th>{t.quantity}</th>
                        <th>{t.onHand}</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => {
                        const item = itemById.get(line.itemId);
                        const unit = item ? label(BASE_UNIT_LABELS[item.baseUnit]) : '';
                        const available = item
                          ? (onHand.get(`${item.id}:${fromLocationId}`) ?? 0)
                          : 0;
                        return (
                          <tr key={line.key}>
                            <td>
                              <select
                                value={line.itemId}
                                onChange={(event) =>
                                  updateLine(line.key, { itemId: event.target.value })
                                }
                                required
                              >
                                {items.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                inputMode="decimal"
                                value={line.quantity}
                                onChange={(event) =>
                                  updateLine(line.key, { quantity: event.target.value })
                                }
                                placeholder={unit ? fill(t.inUnit, { unit }) : ''}
                                required
                              />
                            </td>
                            <td>{item ? `${available} ${unit}` : '—'}</td>
                            <td>
                              {lines.length > 1 ? (
                                <button
                                  type="button"
                                  className="kz-button-quiet"
                                  onClick={() =>
                                    setLines((current) =>
                                      current.filter((entry) => entry.key !== line.key),
                                    )
                                  }
                                >
                                  {t.remove}
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  className="kz-button-quiet"
                  onClick={() => setLines((current) => [...current, blankLine(items[0]?.id ?? '')])}
                >
                  {t.addLine}
                </button>
                {samePlace ? <p className="kz-error">{t.chooseTwo}</p> : null}
                {locations.length < 2 ? <p>{t.addAnotherLocation}</p> : null}
                {error ? (
                  <p className="kz-error" role="alert">
                    {error}
                  </p>
                ) : null}
                <button
                  className="kz-button"
                  type="submit"
                  disabled={saving || samePlace || locations.length < 2}
                >
                  {saving ? t.sending : t.sendTransfer}
                </button>
              </form>
            )}
          </FormDialog>
        ) : null}
        {saved ? <p role="status">{saved}</p> : null}
        <div className="kz-panel kz-table-wrap">
          <h2>{t.transfers}</h2>
          {transfers.length === 0 ? <p className="kz-empty">{t.noTransfers}</p> : null}
          <table className="kz-table">
            <thead>
              <tr>
                <th>{t.number}</th>
                <th>{t.from}</th>
                <th>{t.to}</th>
                <th>{t.status}</th>
                <th>{t.sent}</th>
                <th>{t.lines}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((transfer) => (
                <tr key={transfer.id}>
                  <td>{transfer.number}</td>
                  <td>{transfer.fromLocationName}</td>
                  <td>{transfer.toLocationName}</td>
                  <td>
                    <span className="kz-status" data-tone={transferStatusTone(transfer.status)}>
                      {label(TRANSFER_STATUS_LABELS[transfer.status])}
                    </span>
                  </td>
                  <td>{formatDisplayDate(transfer.sentOn)}</td>
                  <td>
                    {transfer.lines
                      .map((line) =>
                        fill(t.lineSummary, {
                          item: line.itemName,
                          quantity: line.quantityBase,
                          unit: label(BASE_UNIT_LABELS[line.baseUnit]),
                          cost: line.cost,
                        }),
                      )
                      .join('; ')}
                  </td>
                  <td>
                    {canReceive && transfer.status === 'SENT' ? (
                      <button
                        type="button"
                        className="kz-button"
                        onClick={() => {
                          setError('');
                          void api
                            .receiveTransfer(transfer.id, todayInKarachi())
                            .then(async (next) => {
                              setTransfers((current) =>
                                current.map((row) => (row.id === next.id ? next : row)),
                              );
                              setSaved(
                                fill(t.arrived, {
                                  number: next.number,
                                  location: next.toLocationName,
                                }),
                              );
                              setStock(await api.listStock());
                            })
                            .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
                        }}
                      >
                        {t.receive}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );

  function updateLine(key: string, patch: Partial<DraftLine>): void {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }
}

function blankLine(itemId = ''): DraftLine {
  return { key: `${Date.now()}-${Math.random()}`, itemId, quantity: '' };
}
