'use client';

import { messages } from '@knazawy/i18n';
import { can, isAirlineRole, type AccountRecord } from '@knazawy/shared';
import { useEffect, useState } from 'react';

import { ApiError, api, clearSession } from '../lib/session';

export default function HomePage() {
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
        setError(caught instanceof Error ? caught.message : 'The portal could not load.');
      });
  }, []);

  if (error) {
    return (
      <p className="kz-error" role="alert">
        {error}
      </p>
    );
  }
  if (!account) return <p>Loading</p>;

  if (!isAirlineRole(account.role)) {
    return (
      <section className="kz-stack">
        <div className="kz-page-head">
          <h1>{account.organisationName}</h1>
          <p>This portal is for airline staff. Karam staff use the staff app.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="kz-stack">
      <div className="kz-page-head">
        <h1>{account.organisationName}</h1>
        <p>
          Signed in as {account.name} for {account.organisationCode}. You only see this
          airline&apos;s requests, rates, and invoices.
        </p>
        <p lang="ur" dir="rtl">
          {messages.ur.common.portalSurface}
        </p>
      </div>
      <div className="kz-home-grid">
        {can(account.role, 'service_requests', 'R') ? (
          <a className="kz-panel kz-home-card" href="/requests">
            <h2>{messages.en.common.requests}</h2>
            <p>Ask for meals and snacks for a flight and follow each request.</p>
          </a>
        ) : null}
        {can(account.role, 'service_rates', 'R') ? (
          <a className="kz-panel kz-home-card" href="/rates">
            <h2>{messages.en.common.rateCards}</h2>
            <p>See the prices agreed with Karam and the dates they apply.</p>
          </a>
        ) : null}
      </div>
    </section>
  );
}
