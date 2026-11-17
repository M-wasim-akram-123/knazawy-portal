'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { purchasesCopy } from '@knazawy/i18n';
import {
  PURCHASE_STATUS_LABELS,
  can,
  formatDisplayDate,
  purchaseStatusTone,
  todayInKarachi,
} from '@knazawy/shared';
import type { ItemRecord, PurchaseRecord, SupplierRecord } from '@knazawy/shared';
import { KaramLoader } from '@knazawy/ui-shell';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { useCommon, useCopy, useLabel } from '../../lib/i18n';
import { api, readSessionUser } from '../../lib/session';
import { Field } from '../master/Field';

export function PurchasesScreen() {
  const router = useRouter();
  const t = useCopy(purchasesCopy);
  const common = useCommon();
  const label = useLabel();
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
  const [createOpen, setCreateOpen] = useState(false);
  const createDialog = useRef<HTMLDialogElement>(null);

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

  useEffect(() => {
    const dialog = createDialog.current;
    if (!dialog) return;
    if (createOpen && !dialog.open) dialog.showModal();
    else if (!createOpen && dialog.open) dialog.close();
  }, [createOpen]);

  if (!ready) return <KaramLoader label={t.loading} fullPage />;
  if (!user) {
    return (
      <p>
        <Link href="/login">{common.signIn}</Link> {t.signInSuffix}
      </p>
    );
  }

  const canCreate = can(user.role, 'purchases', 'C');

  return (
    <section className="kz-stack">
      <div className="kz-page-head kz-purchases-head">
        <div>
          <h1>{common.purchaseOrders}</h1>
          <p>{t.intro}</p>
        </div>
        {canCreate ? (
          <button
            className="kz-button"
            type="button"
            onClick={() => {
              setError('');
              setCreateOpen(true);
            }}
          >
            {t.newPurchase}
          </button>
        ) : null}
      </div>
      {error && !createOpen ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      {purchases.length === 0 ? (
        <div className="kz-panel kz-purchase-empty-state">
          <p className="kz-empty">{t.noPurchases}</p>
        </div>
      ) : (
        <div className="kz-panel kz-table-wrap">
          <table className="kz-table">
            <thead>
              <tr>
                <th>{t.number}</th>
                <th>{t.supplier}</th>
                <th>{t.status}</th>
                <th>{t.ordered}</th>
                <th>{t.lines}</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((purchase) => (
                <tr key={purchase.id}>
                  <td>
                    <Link href={`/purchases/${purchase.id}`}>{purchase.number}</Link>
                  </td>
                  <td>{purchase.supplierName}</td>
                  <td>
                    <span className="kz-status" data-tone={purchaseStatusTone(purchase.status)}>
                      {label(PURCHASE_STATUS_LABELS[purchase.status])}
                    </span>
                  </td>
                  <td>{formatDisplayDate(purchase.orderedOn)}</td>
                  <td>{purchase.lines.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canCreate ? (
        <dialog
          className="kz-purchase-dialog"
          ref={createDialog}
          aria-labelledby="kz-new-purchase-title"
          onClose={() => setCreateOpen(false)}
          onClick={(event) => {
            if (event.target === event.currentTarget) setCreateOpen(false);
          }}
        >
          <div className="kz-purchase-dialog-content">
            <div className="kz-purchase-dialog-header">
              <div>
                <p className="kz-eyebrow">{t.eyebrow}</p>
                <h2 id="kz-new-purchase-title">{t.newPurchase}</h2>
                <p>{t.dialogIntro}</p>
              </div>
              <button
                className="kz-button-quiet kz-purchase-close"
                type="button"
                aria-label={t.closeNewPurchase}
                onClick={() => setCreateOpen(false)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <form
              className="kz-form kz-purchase-form"
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
              <div className="kz-purchase-form-grid">
                <Field label={t.supplier}>
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
                <Field label={t.orderDate} hint={t.orderDateHint}>
                  <input
                    type="date"
                    value={orderedOn}
                    onChange={(event) => setOrderedOn(event.target.value)}
                    required
                  />
                </Field>
                <Field label={t.item}>
                  <select
                    value={itemId}
                    onChange={(event) => setItemId(event.target.value)}
                    required
                  >
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t.quantity} hint={t.quantityHint}>
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
              </div>
              {error ? (
                <p className="kz-error" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="kz-purchase-dialog-actions">
                <button
                  className="kz-button-quiet"
                  type="button"
                  onClick={() => setCreateOpen(false)}
                >
                  {t.cancel}
                </button>
                <button className="kz-button" type="submit">
                  {t.savePurchase}
                </button>
              </div>
            </form>
          </div>
        </dialog>
      ) : null}
    </section>
  );
}
