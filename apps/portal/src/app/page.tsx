'use client';

import { messages } from '@knazawy/i18n';
import { isAirlineRole, type AccountRecord } from '@knazawy/shared';
import { useEffect, useState } from 'react';

import { api, clearSession, readSessionUser } from '../lib/session';

export default function HomePage() {
  const [account, setAccount] = useState<AccountRecord | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const session = readSessionUser();
    if (!session) {
      setReady(true);
      return;
    }
    void api
      .account()
      .then(setAccount)
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : 'Sign in to continue.');
      })
      .finally(() => setReady(true));
  }, []);

  if (!ready) return <p>Loading</p>;
  if (!account) {
    return (
      <section className="kz-hero">
        <h1>{messages.en.common.portalSurface}</h1>
        <p>Sign in to see your airline. Requests, rates, and invoices follow on this portal.</p>
        <p lang="ur" dir="rtl">
          {messages.ur.common.portalSurface}
        </p>
        {error ? <p className="kz-error">{error}</p> : null}
        <a className="kz-button" href="/login">
          {messages.en.common.signIn}
        </a>
      </section>
    );
  }

  const airline = isAirlineRole(account.role);

  return (
    <section className="kz-hero">
      <h1>{account.organisationName}</h1>
      <p>
        Signed in as {account.name}
        {airline ? ` for ${account.organisationCode}` : ''}.
      </p>
      {airline ? (
        <p>Your requests will appear here. You only see this airline.</p>
      ) : (
        <p>This portal is for airline staff. Karam staff use the staff app.</p>
      )}
      <button
        type="button"
        className="kz-button"
        onClick={() => {
          clearSession();
          setAccount(null);
        }}
      >
        {messages.en.common.signOut}
      </button>
    </section>
  );
}
