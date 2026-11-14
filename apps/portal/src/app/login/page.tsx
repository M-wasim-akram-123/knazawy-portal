'use client';

import { messages } from '@knazawy/i18n';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { api, tokens, writeSessionUser } from '../../lib/session';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  return (
    <form
      className="kz-panel kz-signin-card kz-form"
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        setError('');
        void api
          .login(email, password)
          .then((result) => {
            tokens.setAccessToken(result.accessToken);
            writeSessionUser(result.user);
            router.push('/');
            router.refresh();
          })
          .catch((caught: unknown) => {
            setError(caught instanceof Error ? caught.message : 'Email or password is wrong.');
          })
          .finally(() => setPending(false));
      }}
    >
      <div className="kz-page-head">
        <h1>{messages.en.common.signIn}</h1>
        <p>Use the email your administrator set up for your airline.</p>
        <p lang="ur" dir="rtl">
          {messages.ur.common.signIn}
        </p>
      </div>
      <label className="kz-field">
        <span>Email</span>
        <input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>
      <label className="kz-field">
        <span>Password</span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      {error ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="kz-button kz-button-block" type="submit" disabled={pending}>
        {messages.en.common.signIn}
      </button>
    </form>
  );
}
