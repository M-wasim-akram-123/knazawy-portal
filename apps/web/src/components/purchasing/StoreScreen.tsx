'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { messages } from '@knazawy/i18n';
import { BASE_UNIT_LABELS, formatDisplayDate } from '@knazawy/shared';
import type { GoodsReceiptRecord, StockOnHandRecord } from '@knazawy/shared';
import { useEffect, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { api, readSessionUser } from '../../lib/session';

export function StoreScreen() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [stock, setStock] = useState<StockOnHandRecord[]>([]);
  const [receipts, setReceipts] = useState<GoodsReceiptRecord[]>([]);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const session = readSessionUser();
    setUser(session);
    setReady(true);
    if (!session) return;
    void Promise.all([api.listStock(), api.listReceipts()])
      .then(([nextStock, nextReceipts]) => {
        setStock(nextStock);
        setReceipts(nextReceipts);
      })
      .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
  }, []);

  if (!ready) return <p>Loading stock</p>;
  if (!user) {
    return (
      <p>
        <a href="/login">{messages.en.common.signIn}</a> to see stock.
      </p>
    );
  }

  return (
    <section className="kz-stack">
      <div className="kz-page-head">
        <h1>{messages.en.common.receiveGoods}</h1>
        <p>What is in each location, and the receipts that put it there.</p>
      </div>
      {error ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="kz-panel kz-table-wrap">
        <h2>Stock on hand</h2>
        {stock.length === 0 ? <p className="kz-empty">Nothing is in stock yet.</p> : null}
        <table className="kz-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Location</th>
              <th>Quantity</th>
            </tr>
          </thead>
          <tbody>
            {stock.map((row) => (
              <tr key={`${row.itemId}:${row.locationId}`}>
                <td>{row.itemName}</td>
                <td>{row.locationName}</td>
                <td>
                  {row.quantityBase} {BASE_UNIT_LABELS[row.baseUnit]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="kz-panel kz-table-wrap">
        <h2>Goods received</h2>
        {receipts.length === 0 ? <p className="kz-empty">No goods received yet.</p> : null}
        <table className="kz-table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Purchase</th>
              <th>Bill</th>
              <th>Location</th>
              <th>Received</th>
              <th>Lines</th>
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
                    <button type="button" className="kz-button-quiet" onClick={() => openBill(receipt.id)}>
                      View
                    </button>
                  ) : null}
                </td>
                <td>{receipt.locationName}</td>
                <td>{formatDisplayDate(receipt.receivedOn)}</td>
                <td>
                  {receipt.lines
                    .map(
                      (line) =>
                        `${line.itemName}: ${line.quantity} ${line.purchaseUnit} (${line.quantityBase} ${BASE_UNIT_LABELS[line.baseUnit]} at ${line.unitCost} PKR)`,
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
