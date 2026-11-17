'use client';

import { portalHomeCopy } from '@knazawy/i18n';
import { can, isAirlineRole, type AccountRecord } from '@knazawy/shared';
import { KaramLoader } from '@knazawy/ui-shell';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useChrome, useCommon, useCopy } from '../lib/i18n';
import { ApiError, api, clearSession } from '../lib/session';

export default function HomePage() {
  const t = useCopy(portalHomeCopy);
  const common = useCommon();
  const chrome = useChrome();
  const [account, setAccount] = useState<AccountRecord | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void api
      .account()
      .then(setAccount)
      .catch((caught: unknown) => {
        if (caught instanceof ApiError && caught.status === 401) {
          clearSession();
          window.location.assign('/login');
          return;
        }
        setError(caught instanceof Error ? caught.message : t.loadFailed);
      });
  }, []);

  if (error) {
    return (
      <p className="kz-error" role="alert">
        {error}
      </p>
    );
  }
  if (!account) return <KaramLoader label={chrome.loading} fullPage />;

  if (!isAirlineRole(account.role)) {
    return (
      <section className="kz-stack">
        <div className="kz-page-head">
          <h1>{account.organisationName}</h1>
          <p>{t.notAirline}</p>
        </div>
      </section>
    );
  }

  const financeUser = account.role === 'AIRLINE_FINANCE';

  return (
    <section className="kz-stack">
      <header className="kz-partner-hero">
        <div className="kz-partner-hero-copy">
          <p className="kz-eyebrow">{financeUser ? t.eyebrowFinance : t.eyebrowService}</p>
          <h1>{account.organisationName}</h1>
          <p>{financeUser ? t.leadFinance : t.leadService}</p>
          {can(account.role, 'service_requests', 'C') ? (
            <Link className="kz-button" href="/requests">
              {t.createRequest}
            </Link>
          ) : can(account.role, 'invoices', 'R') ? (
            <Link className="kz-button" href="/invoices">
              {t.reviewInvoices}
            </Link>
          ) : null}
        </div>
        <div className="kz-partner-stamp">
          <span>{t.yourOrganisation}</span>
          <strong>{account.organisationCode}</strong>
          <small>{t.privateAccess}</small>
        </div>
      </header>
      <div className="kz-home-grid">
        {can(account.role, 'service_requests', 'R') ? (
          <Link className="kz-panel kz-home-card" href="/requests">
            <h2>{common.requests}</h2>
            <p>{t.requestsText}</p>
          </Link>
        ) : null}
        {can(account.role, 'room_requests', 'R') ? (
          <Link className="kz-panel kz-home-card" href="/room-requests">
            <h2>{common.roomRequests}</h2>
            <p>{t.roomRequestsText}</p>
          </Link>
        ) : null}
        {can(account.role, 'distribution', 'R') ? (
          <Link className="kz-panel kz-home-card" href="/deliveries">
            <h2>{common.deliveries}</h2>
            <p>{t.deliveriesText}</p>
          </Link>
        ) : null}
        {can(account.role, 'ledger', 'R') ? (
          <Link className="kz-panel kz-home-card" href="/ledger">
            <h2>{common.ledger}</h2>
            <p>{t.ledgerText}</p>
          </Link>
        ) : null}
        {isAirlineRole(account.role) ? (
          <Link className="kz-panel kz-home-card" href="/notifications">
            <h2>{common.notifications}</h2>
            <p>{t.notificationsText}</p>
          </Link>
        ) : null}
        {can(account.role, 'disputes', 'R') ? (
          <Link className="kz-panel kz-home-card" href="/disputes">
            <h2>{common.disputes}</h2>
            <p>{t.disputesText}</p>
          </Link>
        ) : null}
        {can(account.role, 'invoices', 'R') ? (
          <Link className="kz-panel kz-home-card" href="/invoices">
            <h2>{common.invoices}</h2>
            <p>{t.invoicesText}</p>
          </Link>
        ) : null}
        {can(account.role, 'service_rates', 'R') ? (
          <Link className="kz-panel kz-home-card" href="/rates">
            <h2>{common.rateCards}</h2>
            <p>{t.ratesText}</p>
          </Link>
        ) : null}
      </div>
    </section>
  );
}
