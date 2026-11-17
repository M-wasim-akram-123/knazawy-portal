'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { purchasesCopy } from '@knazawy/i18n';
import {
  BASE_UNIT_LABELS,
  PURCHASE_STATUS_LABELS,
  can,
  formatDisplayDate,
  purchaseStatusTone,
  todayInKarachi,
} from '@knazawy/shared';
import type { ItemRecord, LocationRecord, PurchaseRecord } from '@knazawy/shared';
import { KaramLoader } from '@knazawy/ui-shell';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { fill, useCommon, useCopy, useLabel } from '../../lib/i18n';
import { api, readSessionUser } from '../../lib/session';
import { Field } from '../master/Field';

export function PurchaseDetailScreen({ purchaseId }: { purchaseId: string }) {
  const t = useCopy(purchasesCopy);
  const common = useCommon();
  const label = useLabel();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [purchase, setPurchase] = useState<PurchaseRecord | null>(null);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [locationId, setLocationId] = useState('');
  const [receivedOn, setReceivedOn] = useState(todayInKarachi());
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const session = readSessionUser();
    setUser(session);
    setReady(true);
    if (!session) return;
    void Promise.all([
      api.getPurchase(purchaseId),
      api.listItems().catch(() => [] as ItemRecord[]),
      api.listLocations().catch(() => [] as LocationRecord[]),
    ])
      .then(([nextPurchase, nextItems, nextLocations]) => {
        setPurchase(nextPurchase);
        setItems(nextItems);
        setLocations(nextLocations);
        setItemId(nextItems[0]?.id ?? '');
        setLocationId(nextLocations[0]?.id ?? '');
        setReceiveQty(defaultQuantities(nextPurchase));
      })
      .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
  }, [purchaseId]);

  if (!ready) return <KaramLoader label={t.loadingPurchase} fullPage />;
  if (!user) {
    return (
      <p>
        <Link href="/login">{common.signIn}</Link> {t.signInSuffixDetail}
      </p>
    );
  }
  if (!purchase) {
    return error ? (
      <p className="kz-error" role="alert">
        {error}
      </p>
    ) : (
      <KaramLoader label={t.loadingPurchase} fullPage />
    );
  }

  const canChange = can(user.role, 'purchases', 'U');
  const canReceive = can(user.role, 'stock', 'C');
  const open = purchase.status === 'SENT' || purchase.status === 'PART_RECEIVED';

  function apply(next: PurchaseRecord) {
    setPurchase(next);
    setReceiveQty(defaultQuantities(next));
    setQuantity('');
    setUnitPrice('');
  }

  return (
    <section className="kz-stack">
      <p>
        <Link href="/purchases">{t.backToPurchases}</Link>
      </p>
      <div className="kz-page-head">
        <h1>
          {purchase.number} · {purchase.supplierName}
        </h1>
        <p>
          <span className="kz-status" data-tone={purchaseStatusTone(purchase.status)}>
            {label(PURCHASE_STATUS_LABELS[purchase.status])}
          </span>
          {fill(t.orderedOn, { date: formatDisplayDate(purchase.orderedOn) })}
        </p>
      </div>
      <div className="kz-panel kz-table-wrap">
        <table className="kz-table">
          <thead>
            <tr>
              <th>{t.item}</th>
              <th>{t.ordered}</th>
              <th>{t.price}</th>
              <th>{t.received}</th>
            </tr>
          </thead>
          <tbody>
            {purchase.lines.map((line) => (
              <tr key={line.id}>
                <td>{line.itemName}</td>
                <td>
                  {line.quantity} {line.purchaseUnit}
                </td>
                <td>{line.unitPrice} PKR</td>
                <td>
                  {line.receivedQuantity} {line.purchaseUnit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      {canChange && purchase.status === 'DRAFT' ? (
        <form
          className="kz-panel kz-form"
          onSubmit={(event) => {
            event.preventDefault();
            setError('');
            void api
              .addPurchaseLine(purchase.id, { itemId, quantity, unitPrice })
              .then(apply)
              .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
          }}
        >
          <Field label={t.addItem}>
            <select value={itemId} onChange={(event) => setItemId(event.target.value)} required>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t.quantity}>
            <input
              inputMode="decimal"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              required
            />
          </Field>
          <Field label={t.price} hint={t.priceHint}>
            <input
              inputMode="decimal"
              value={unitPrice}
              onChange={(event) => setUnitPrice(event.target.value)}
              required
            />
          </Field>
          <button className="kz-button" type="submit">
            {t.addLine}
          </button>
        </form>
      ) : null}
      {canChange && (purchase.status === 'DRAFT' || purchase.status === 'SENT') ? (
        <div className="kz-actions">
          {purchase.status === 'DRAFT' ? (
            <button
              className="kz-button"
              type="button"
              onClick={() => {
                setError('');
                void api
                  .sendPurchase(purchase.id)
                  .then(apply)
                  .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
              }}
            >
              {t.sendPurchase}
            </button>
          ) : null}
          <button
            className="kz-button-quiet"
            type="button"
            onClick={() => {
              setError('');
              void api
                .cancelPurchase(purchase.id)
                .then(apply)
                .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
            }}
          >
            {t.cancelPurchase}
          </button>
        </div>
      ) : null}
      {canReceive && open ? (
        <form
          className="kz-panel kz-form"
          onSubmit={(event) => {
            event.preventDefault();
            const lines = purchase.lines
              .filter((line) => Number(receiveQty[line.id] ?? '') > 0)
              .map((line) => ({ purchaseLineId: line.id, quantity: receiveQty[line.id] ?? '' }));
            if (lines.length === 0) {
              setError(t.enterQuantity);
              return;
            }
            setError('');
            void api
              .createReceipt({
                purchaseId: purchase.id,
                locationId,
                receivedOn,
                lines,
              })
              .then(() => api.getPurchase(purchase.id))
              .then(apply)
              .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
          }}
        >
          <h2>{t.goodsReceived}</h2>
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
          <Field label={t.receivedOn}>
            <input
              type="date"
              value={receivedOn}
              onChange={(event) => setReceivedOn(event.target.value)}
              required
            />
          </Field>
          {purchase.lines.map((line) =>
            Number(line.quantity) > Number(line.receivedQuantity) ? (
              <Field
                key={line.id}
                label={fill(t.lineReceived, { item: line.itemName })}
                hint={fill(t.lineReceivedHint, {
                  purchaseUnit: line.purchaseUnit,
                  unit: label(BASE_UNIT_LABELS[line.baseUnit]),
                })}
              >
                <input
                  inputMode="decimal"
                  value={receiveQty[line.id] ?? ''}
                  onChange={(event) =>
                    setReceiveQty({ ...receiveQty, [line.id]: event.target.value })
                  }
                />
              </Field>
            ) : null,
          )}
          <button className="kz-button" type="submit">
            {t.receiveGoods}
          </button>
        </form>
      ) : null}
    </section>
  );
}

function defaultQuantities(purchase: PurchaseRecord): Record<string, string> {
  return Object.fromEntries(
    purchase.lines.map((line) => {
      const left = Number(line.quantity) - Number(line.receivedQuantity);
      return [line.id, left > 0 ? String(left) : ''];
    }),
  );
}
