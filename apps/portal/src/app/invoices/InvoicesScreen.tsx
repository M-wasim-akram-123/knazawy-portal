'use client';

import { messages } from '@knazawy/i18n';
import {
  INVOICE_KIND_LABELS,
  formatDisplayDate,
  invoiceStatusTone,
  type InvoiceRecord,
} from '@knazawy/shared';
import { useEffect, useState } from 'react';

import { ApiError, api, clearSession } from '../../lib/session';

export function InvoicesScreen() {
  const [invoices, setInvoices] = useState<InvoiceRecord[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void api
      .listInvoices()
      .then(setInvoices)
      .catch((caught: unknown) => {
        if (caught instanceof ApiError && caught.status === 401) {
          clearSession();
          window.location.assign('/login');
          return;
        }
        setError(caught instanceof Error ? caught.message : 'Invoices could not load.');
      });
  }, []);

  return (
    <section className="kz-stack">
      <div className="kz-page-head">
        <h1>{messages.en.common.invoices}</h1>
        <p>
          Bills Karam has issued to your airline, and any credit notes. You only see your own
          airline.
        </p>
        <p lang="ur" dir="rtl">
          {messages.ur.common.invoices}
        </p>
      </div>
      {error ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      {invoices === null && !error ? <p>Loading</p> : null}
      {invoices !== null && invoices.length === 0 ? (
        <p className="kz-empty">No invoices have been issued yet.</p>
      ) : null}
      {invoices?.map((invoice) => (
        <article key={invoice.id} className="kz-panel kz-stack">
          <h2>
            {invoice.number}{' '}
            <span className="kz-status" data-tone={invoiceStatusTone(invoice.status)}>
              · {INVOICE_KIND_LABELS[invoice.kind]}
            </span>
          </h2>
          <p className="kz-help">
            {invoice.requestNumber}, flight {invoice.flightNumber},{' '}
            {formatDisplayDate(invoice.serviceDate)}
            {invoice.sourceInvoiceNumber ? `, credits ${invoice.sourceInvoiceNumber}` : ''}
          </p>
          <div className="kz-table-wrap">
            <table className="kz-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Arrived</th>
                  <th>Billed</th>
                  <th>Price</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lines.map((line) => (
                  <tr key={line.recipeId}>
                    <td>{line.recipeName}</td>
                    <td>{line.deliveredQuantity}</td>
                    <td>{line.billedQuantity}</td>
                    <td>{line.unitPrice}</td>
                    <td>{line.amount} PKR</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Total {invoice.total} PKR. Amount due {invoice.amountDue} PKR.
          </p>
          {invoice.reason ? <p>Reason: {invoice.reason}</p> : null}
        </article>
      ))}
    </section>
  );
}
