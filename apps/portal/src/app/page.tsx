'use client';

import { messages } from '@knazawy/i18n';
import { can, isAirlineRole, type AccountRecord } from '@knazawy/shared';
import Link from 'next/link';
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

  const financeUser = account.role === 'AIRLINE_FINANCE';

  return (
    <section className="kz-stack">
      <header className="kz-partner-hero">
        <div className="kz-partner-hero-copy">
          <p className="kz-eyebrow">
            {financeUser ? 'Karam / Airline finance' : 'Karam / Service workspace'}
          </p>
          <h1>{account.organisationName}</h1>
          <p>
            {financeUser
              ? 'Review invoices, resolve bill questions, and follow your airline ledger.'
              : 'Create flight and room requests, then follow delivery and agreed rates.'}
          </p>
          <p className="kz-partner-urdu" lang="ur" dir="rtl">
            {messages.ur.common.portalSurface}
          </p>
          {can(account.role, 'service_requests', 'C') ? (
            <Link className="kz-button" href="/requests">
              Create a service request
            </Link>
          ) : can(account.role, 'invoices', 'R') ? (
            <Link className="kz-button" href="/invoices">
              Review invoices
            </Link>
          ) : null}
        </div>
        <div className="kz-partner-stamp">
          <span>YOUR ORGANISATION</span>
          <strong>{account.organisationCode}</strong>
          <small>Private partner access</small>
        </div>
      </header>
      <div className="kz-home-grid">
        {can(account.role, 'service_requests', 'R') ? (
          <Link className="kz-panel kz-home-card" href="/requests">
            <h2>{messages.en.common.requests}</h2>
            <p>Ask for meals and snacks for a flight and follow each request.</p>
          </Link>
        ) : null}
        {can(account.role, 'room_requests', 'R') ? (
          <Link className="kz-panel kz-home-card" href="/room-requests">
            <h2>{messages.en.common.roomRequests}</h2>
            <p>Request rooms for your flight crew and follow each request.</p>
          </Link>
        ) : null}
        {can(account.role, 'distribution', 'R') ? (
          <Link className="kz-panel kz-home-card" href="/deliveries">
            <h2>{messages.en.common.deliveries}</h2>
            <p>See what has left the kitchen and what arrived for your flights.</p>
          </Link>
        ) : null}
        {can(account.role, 'ledger', 'R') ? (
          <Link className="kz-panel kz-home-card" href="/ledger">
            <h2>{messages.en.common.ledger}</h2>
            <p>See what has been posted for your airline.</p>
          </Link>
        ) : null}
        {isAirlineRole(account.role) ? (
          <Link className="kz-panel kz-home-card" href="/notifications">
            <h2>{messages.en.common.notifications}</h2>
            <p>See messages about your requests, deliveries, and bills.</p>
          </Link>
        ) : null}
        {can(account.role, 'disputes', 'R') ? (
          <Link className="kz-panel kz-home-card" href="/disputes">
            <h2>{messages.en.common.disputes}</h2>
            <p>Question a bill Karam has issued. The bill itself is not changed.</p>
          </Link>
        ) : null}
        {can(account.role, 'invoices', 'R') ? (
          <Link className="kz-panel kz-home-card" href="/invoices">
            <h2>{messages.en.common.invoices}</h2>
            <p>See the bills Karam has issued and any credit notes.</p>
          </Link>
        ) : null}
        {can(account.role, 'service_rates', 'R') ? (
          <Link className="kz-panel kz-home-card" href="/rates">
            <h2>{messages.en.common.rateCards}</h2>
            <p>See the prices agreed with Karam and the dates they apply.</p>
          </Link>
        ) : null}
      </div>
    </section>
  );
}
