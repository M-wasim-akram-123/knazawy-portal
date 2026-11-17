'use client';

import { portalDeliveriesCopy } from '@knazawy/i18n';
import {
  DELIVERY_POINT_LABELS,
  REQUEST_STATUS_LABELS,
  formatDisplayDate,
  statusTone,
  type DeliveryRecord,
} from '@knazawy/shared';
import { KaramLoader } from '@knazawy/ui-shell';
import { useEffect, useState } from 'react';

import { fill, useChrome, useCommon, useCopy, useLabel } from '../../lib/i18n';
import { ApiError, api, clearSession } from '../../lib/session';

export function DeliveriesScreen() {
  const t = useCopy(portalDeliveriesCopy);
  const common = useCommon();
  const chrome = useChrome();
  const label = useLabel();
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
        setError(caught instanceof Error ? caught.message : t.loadFailed);
      });
  }, []);

  return (
    <section className="kz-stack">
      <div className="kz-page-head">
        <h1>{common.deliveries}</h1>
        <p>{t.intro}</p>
      </div>
      {error ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      {deliveries === null && !error ? <KaramLoader label={chrome.loading} fullPage /> : null}
      {deliveries !== null && deliveries.length === 0 ? (
        <p className="kz-empty">{t.empty}</p>
      ) : null}
      {deliveries?.map((delivery) => (
        <article key={delivery.id} className="kz-panel kz-stack">
          <h2>
            {delivery.number}{' '}
            <span className="kz-status" data-tone={statusTone(delivery.status)}>
              · {label(REQUEST_STATUS_LABELS[delivery.status])}
            </span>
          </h2>
          <p className="kz-help">
            {fill(t.summary, {
              request: delivery.requestNumber,
              flight: delivery.flightNumber,
              route: delivery.route,
              date: formatDisplayDate(delivery.serviceDate),
              point: label(DELIVERY_POINT_LABELS[delivery.deliveryPoint]),
            })}
          </p>
          <div className="kz-table-wrap">
            <table className="kz-table">
              <thead>
                <tr>
                  <th>{t.item}</th>
                  <th>{t.ordered}</th>
                  <th>{t.sent}</th>
                  <th>{t.received}</th>
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
