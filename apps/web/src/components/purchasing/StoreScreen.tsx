'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { stockOnHandCopy } from '@knazawy/i18n';
import { BASE_UNIT_LABELS, can, formatDisplayDate } from '@knazawy/shared';
import type { GoodsReceiptRecord, LowStockRecord, StockOnHandRecord } from '@knazawy/shared';
import { KaramLoader } from '@knazawy/ui-shell';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { fill, useCommon, useCopy, useLabel } from '../../lib/i18n';
import { api, readSessionUser } from '../../lib/session';

export function StoreScreen() {
  const t = useCopy(stockOnHandCopy);
  const common = useCommon();
  const label = useLabel();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [stock, setStock] = useState<StockOnHandRecord[]>([]);
  const [receipts, setReceipts] = useState<GoodsReceiptRecord[]>([]);
  const [low, setLow] = useState<LowStockRecord[]>([]);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const session = readSessionUser();
    setUser(session);
    setReady(true);
    if (!session) return;
    void Promise.all([api.listStock(), api.listReceipts(), api.listLowStock()])
      .then(([nextStock, nextReceipts, nextLow]) => {
        setStock(nextStock);
        setReceipts(nextReceipts);
        setLow(nextLow);
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

  return (
    <section className="kz-stack">
      <div className="kz-page-head kz-page-action-head">
        <div>
          <h1>{common.stockOnHand}</h1>
          <p>{t.intro}</p>
        </div>
        {can(user.role, 'stock', 'C') ? (
          <div className="kz-dashboard-actions">
            <Link className="kz-button" href="/bills">
              {common.goodsIn}
            </Link>
            {can(user.role, 'purchases', 'R') ? (
              <Link className="kz-button kz-button-outline" href="/purchases">
                {common.purchaseOrders}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
      {error ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      {low.length > 0 ? (
        <div className="kz-panel kz-table-wrap">
          <h2>{common.lowStock}</h2>
          <p className="kz-help">{t.lowStockHelp}</p>
          <table className="kz-table">
            <thead>
              <tr>
                <th>{t.item}</th>
                <th>{t.inStock}</th>
                <th>{t.reorderLevel}</th>
              </tr>
            </thead>
            <tbody>
              {low.map((row) => (
                <tr key={row.itemId}>
                  <td>{row.itemName}</td>
                  <td>
                    <span className="kz-status" data-tone="problem">
                      {row.onHand} {label(BASE_UNIT_LABELS[row.baseUnit])}
                    </span>
                  </td>
                  <td>
                    {row.reorderLevel} {label(BASE_UNIT_LABELS[row.baseUnit])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="kz-panel kz-table-wrap">
        <h2>{common.stockOnHand}</h2>
        {stock.length === 0 ? <p className="kz-empty">{t.nothingInStock}</p> : null}
        <table className="kz-table">
          <thead>
            <tr>
              <th>{t.item}</th>
              <th>{t.location}</th>
              <th>{t.quantity}</th>
            </tr>
          </thead>
          <tbody>
            {stock.map((row) => (
              <tr key={`${row.itemId}:${row.locationId}`}>
                <td>{row.itemName}</td>
                <td>{row.locationName}</td>
                <td>
                  {row.quantityBase} {label(BASE_UNIT_LABELS[row.baseUnit])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="kz-panel kz-table-wrap">
        <h2>{t.goodsReceived}</h2>
        {receipts.length === 0 ? <p className="kz-empty">{t.noGoodsReceived}</p> : null}
        <table className="kz-table">
          <thead>
            <tr>
              <th>{t.number}</th>
              <th>{t.purchase}</th>
              <th>{t.bill}</th>
              <th>{t.location}</th>
              <th>{t.received}</th>
              <th>{t.lines}</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((receipt) => (
              <tr key={receipt.id}>
                <td>{receipt.number}</td>
                <td>{receipt.purchaseNumber ?? '—'}</td>
                <td>
                  {receipt.billNumber ?? '—'}
                  {receipt.hasBillFile ? (
                    <button
                      type="button"
                      className="kz-button-quiet"
                      onClick={() => openBill(receipt.id)}
                    >
                      {t.view}
                    </button>
                  ) : null}
                </td>
                <td>{receipt.locationName}</td>
                <td>{formatDisplayDate(receipt.receivedOn)}</td>
                <td>
                  {receipt.lines
                    .map((line) =>
                      fill(t.receiptLine, {
                        item: line.itemName,
                        quantity: line.quantity,
                        purchaseUnit: line.purchaseUnit,
                        quantityBase: line.quantityBase,
                        unit: label(BASE_UNIT_LABELS[line.baseUnit]),
                        unitCost: line.unitCost,
                      }),
                    )
                    .join('; ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  function openBill(receiptId: string): void {
    void api
      .billFile(receiptId)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener');
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      })
      .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
  }
}
