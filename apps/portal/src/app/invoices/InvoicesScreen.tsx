'use client';

import { portalInvoicesCopy } from '@knazawy/i18n';
import {
  INVOICE_KIND_LABELS,
  ROOM_INVOICE_KIND_LABELS,
  formatDisplayDate,
  invoiceStatusTone,
  isOverdue,
  todayInKarachi,
  type InvoiceRecord,
  type RoomInvoiceRecord,
} from '@knazawy/shared';
import { KaramLoader } from '@knazawy/ui-shell';
import { useEffect, useState } from 'react';

import { fill, useChrome, useCommon, useCopy, useLabel } from '../../lib/i18n';
import { ApiError, api, clearSession } from '../../lib/session';

type InvoicesCopy = (typeof portalInvoicesCopy)['en'];

/** The invoice totals and terms as one sentence in the chosen language. */
function summaryText(t: InvoicesCopy, invoice: InvoiceRecord, today: string): string {
  const parts: string[] = [];
  if (invoice.discount !== '0.00') {
    parts.push(
      fill(t.subtotalLessDiscount, {
        subtotal: invoice.subtotal,
        percent: invoice.discountPercent,
        discount: invoice.discount,
      }),
    );
  }
  parts.push(fill(t.total, { total: invoice.total }));
  if (invoice.kind !== 'CREDIT_NOTE') parts.push(fill(t.amountDue, { amount: invoice.amountDue }));
  if (invoice.dueOn && invoice.paymentTermsDays !== null) {
    const terms =
      invoice.paymentTermsDays === 0
        ? t.termsOnReceipt
        : fill(t.termsNet, { days: invoice.paymentTermsDays });
    parts.push(fill(t.termsDue, { terms, date: formatDisplayDate(invoice.dueOn) }));
    if (isOverdue(invoice.dueOn, today, invoice.amountDue)) parts.push(t.overdue);
  }
  return parts.join(' ');
}

export function InvoicesScreen() {
  const t = useCopy(portalInvoicesCopy);
  const common = useCommon();
  const chrome = useChrome();
  const label = useLabel();
  const [invoices, setInvoices] = useState<InvoiceRecord[] | null>(null);
  const [roomBills, setRoomBills] = useState<RoomInvoiceRecord[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    void Promise.all([api.listInvoices(), api.listRoomInvoices()])
      .then(([rows, rooms]) => {
        setInvoices(rows);
        setRoomBills(rooms);
      })
      .catch((caught: unknown) => {
        if (caught instanceof ApiError && caught.status === 401) {
          clearSession();
          window.location.assign('/login');
          return;
        }
        setError(caught instanceof Error ? caught.message : t.loadFailed);
      });
  }, []);

  return (
    <section className="kz-stack">
      <div className="kz-page-head">
        <h1>{common.invoices}</h1>
        <p>{t.intro}</p>
      </div>
      {error ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      {invoices === null && !error ? <KaramLoader label={chrome.loading} fullPage /> : null}
      {roomBills.length > 0 ? (
        <section className="kz-stack">
          <h2>{t.roomBills}</h2>
          {roomBills.map((bill) => (
            <article key={bill.id} className="kz-panel kz-stack">
              <h3>
                {bill.number} · {label(ROOM_INVOICE_KIND_LABELS[bill.kind])}
              </h3>
              <p className="kz-help">
                {fill(t.roomBillSummary, {
                  request: bill.roomRequestNumber,
                  checkIn: formatDisplayDate(bill.checkIn),
                  checkOut: formatDisplayDate(bill.checkOut),
                  nights: bill.nights,
                })}
                {bill.sourceInvoiceNumber
                  ? fill(t.credits, { number: bill.sourceInvoiceNumber })
                  : ''}
              </p>
              <div className="kz-table-wrap">
                <table className="kz-table">
                  <thead>
                    <tr>
                      <th>{t.roomType}</th>
                      <th>{t.rooms}</th>
                      <th>{t.nights}</th>
                      <th>{t.nightly}</th>
                      <th>{t.amount}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bill.lines.map((line) => (
                      <tr key={line.roomTypeName}>
                        <td>{line.roomTypeName}</td>
                        <td>{line.rooms}</td>
                        <td>{line.nights}</td>
                        <td>{line.nightly} SAR</td>
                        <td>{line.amount} SAR</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>{fill(t.total, { total: bill.total })}</p>
              {bill.reason ? <p>{fill(t.reason, { reason: bill.reason })}</p> : null}
            </article>
          ))}
        </section>
      ) : null}
      {invoices !== null && invoices.length === 0 && roomBills.length === 0 ? (
        <p className="kz-empty">{t.empty}</p>
      ) : null}
      {invoices?.map((invoice) => (
        <article key={invoice.id} className="kz-panel kz-stack">
          <h2>
            {invoice.number}{' '}
            <span className="kz-status" data-tone={invoiceStatusTone(invoice.status)}>
              · {label(INVOICE_KIND_LABELS[invoice.kind])}
            </span>
          </h2>
          <p className="kz-help">
            {invoice.requestNumber && invoice.flightNumber
              ? invoice.serviceDate
                ? fill(t.requestFlightDate, {
                    request: invoice.requestNumber,
                    flight: invoice.flightNumber,
                    date: formatDisplayDate(invoice.serviceDate),
                  })
                : fill(t.requestFlight, {
                    request: invoice.requestNumber,
                    flight: invoice.flightNumber,
                  })
              : t.oneOff}
            {invoice.sourceInvoiceNumber
              ? fill(t.credits, { number: invoice.sourceInvoiceNumber })
              : ''}
          </p>
          <div className="kz-table-wrap">
            <table className="kz-table">
              <thead>
                <tr>
                  <th>{t.item}</th>
                  <th>{t.arrived}</th>
                  <th>{t.billed}</th>
                  <th>{t.price}</th>
                  <th>{t.amount}</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lines.map((line) => (
                  <tr key={line.recipeId}>
                    <td>{line.recipeName}</td>
                    <td>{line.deliveredQuantity}</td>
                    <td>{line.billedQuantity}</td>
                    <td>{line.unitPrice}</td>
                    <td>{line.amount} SAR</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>{summaryText(t, invoice, todayInKarachi())}</p>
          {invoice.reason ? <p>{fill(t.reason, { reason: invoice.reason })}</p> : null}
        </article>
      ))}
    </section>
  );
}
