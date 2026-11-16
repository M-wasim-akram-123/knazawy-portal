'use client';

import { messages } from '@knazawy/i18n';
import {
  DELIVERY_POINT_LABELS,
  REQUEST_STATUS_LABELS,
  formatDisplayDate,
  statusTone,
  type DeliveryRecord,
} from '@knazawy/shared';
import { useEffect, useState } from 'react';

import { ApiError, api, clearSession } from '../../lib/session';

export function DeliveriesScreen() {
  const [deliveries, setDeliveries] = useState<DeliveryRecord[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void api
      .listDeliveries()
      .then(setDeliveries)
      .catch((caught: unknown) => {
        if (caught instanceof ApiError && caught.status === 401) {
          clearSession();
          window.location.assign('/login');
          return;
        }
        setError(caught instanceof Error ? caught.message : 'Deliveries could not load.');
      });
  }, []);

  return (
    <section className="kz-stack">
      <div className="kz-page-head">
        <h1>{messages.en.common.deliveries}</h1>
        <p>
          What Karam has sent for your flights, and what was signed for on arrival. You only see
          your own airline.
        </p>
        <p lang="ur" dir="rtl">
          {messages.ur.common.deliveries}
        </p>
      </div>
      {error ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      {deliveries === null && !error ? <p>Loading</p> : null}
      {deliveries !== null && deliveries.length === 0 ? (
        <p className="kz-empty">Nothing has gone into production yet.</p>
      ) : null}
      {deliveries?.map((delivery) => (
        <article key={delivery.id} className="kz-panel kz-stack">
          <h2>
            {delivery.number}{' '}
            <span className="kz-status" data-tone={statusTone(delivery.status)}>
              · {REQUEST_STATUS_LABELS[delivery.status]}
            </span>
          </h2>
          <p className="kz-help">
            {delivery.requestNumber}, flight {delivery.flightNumber} {delivery.route},{' '}
            {formatDisplayDate(delivery.serviceDate)},{' '}
            {DELIVERY_POINT_LABELS[delivery.deliveryPoint]}
          </p>
          <div className="kz-table-wrap">
            <table className="kz-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Ordered</th>
                  <th>Sent</th>
                  <th>Received</th>
                </tr>
              </thead>
              <tbody>
                {delivery.lines.map((line) => (
                  <tr key={line.recipeId}>
                    <td>{line.recipeName}</td>
                    <td>{line.ordered}</td>
                    <td>{line.dispatched ?? '—'}</td>
                    <td>{line.delivered ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {delivery.note ? <p>{delivery.note}</p> : null}
        </article>
      ))}
    </section>
  );
}
