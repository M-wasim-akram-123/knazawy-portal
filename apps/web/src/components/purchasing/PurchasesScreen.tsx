'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { messages } from '@knazawy/i18n';
import {
  PURCHASE_STATUS_LABELS,
  can,
  formatDisplayDate,
  purchaseStatusTone,
  todayInKarachi,
} from '@knazawy/shared';
import type { ItemRecord, PurchaseRecord, SupplierRecord } from '@knazawy/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { api, readSessionUser } from '../../lib/session';
import { Field } from '../master/Field';

export function PurchasesScreen() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [orderedOn, setOrderedOn] = useState(todayInKarachi());
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const session = readSessionUser();
    setUser(session);
    setReady(true);
    if (!session) return;
    void Promise.all([api.listPurchases(), api.listSuppliers(), api.listItems()])
      .then(([nextPurchases, nextSuppliers, nextItems]) => {
        setPurchases(nextPurchases);
        setSuppliers(nextSuppliers);
        setItems(nextItems);
        setSupplierId(nextSuppliers[0]?.id ?? '');
        setItemId(nextItems[0]?.id ?? '');
      })
      .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
  }, []);

  if (!ready) return <p>Loading purchases</p>;
  if (!user) {
    return (
      <p>
        <a href="/login">{messages.en.common.signIn}</a> to see purchases.
      </p>
    );
  }

  const canCreate = can(user.role, 'purchases', 'C');

  return (
    <section className="kz-stack">
      <div className="kz-page-head">
        <h1>{messages.en.common.purchases}</h1>
        <p>
          Draft an order for this branch, send it, then receive the goods into one of its locations.
        </p>
      </div>
      <div className="kz-workspace">
        {canCreate ? (
          <form
            className="kz-panel kz-form"
            onSubmit={(event) => {
              event.preventDefault();
              setError('');
              void api
                .createPurchase({
                  supplierId,
                  orderedOn,
                  lines: [{ itemId, quantity, unitPrice }],
                })
                .then((purchase) => router.push(`/purchases/${purchase.id}`))
                .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
            }}
          >
            <h2>New purchase</h2>
            <Field label="Supplier">
              <select
                value={supplierId}
                onChange={(event) => setSupplierId(event.target.value)}
                required
              >
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Order date" hint="Stored for the day in Pakistan. Shown as DD/MM/YYYY.">
              <input
                type="date"
                value={orderedOn}
                onChange={(event) => setOrderedOn(event.target.value)}
                required
              />
            </Field>
            <Field label="Item">
              <select value={itemId} onChange={(event) => setItemId(event.target.value)} required>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Quantity" hint="In the purchase unit, such as bags.">
              <input
                inputMode="decimal"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                required
              />
            </Field>
            <Field label="Price" hint="PKR for one purchase unit.">
              <input
                inputMode="decimal"
                value={unitPrice}
                onChange={(event) => setUnitPrice(event.target.value)}
                required
              />
            </Field>
            {error ? (
              <p className="kz-error" role="alert">
                {error}
              </p>
            ) : null}
            <button className="kz-button" type="submit">
              Save purchase
            </button>
          </form>
        ) : null}
        {!canCreate && error ? (
          <p className="kz-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="kz-panel kz-table-wrap">
          {purchases.length === 0 ? <p className="kz-empty">No purchases yet.</p> : null}
          <table className="kz-table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Supplier</th>
                <th>Status</th>
                <th>Ordered</th>
                <th>Lines</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((purchase) => (
                <tr key={purchase.id}>
                  <td>
                    <a href={`/purchases/${purchase.id}`}>{purchase.number}</a>
                  </td>
                  <td>{purchase.supplierName}</td>
                  <td>
                    <span className="kz-status" data-tone={purchaseStatusTone(purchase.status)}>
                      {PURCHASE_STATUS_LABELS[purchase.status]}
                    </span>
                  </td>
                  <td>{formatDisplayDate(purchase.orderedOn)}</td>
                  <td>{purchase.lines.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
