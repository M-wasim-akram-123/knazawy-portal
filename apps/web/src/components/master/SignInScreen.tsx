'use client';

import { messages } from '@knazawy/i18n';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { api, tokens, writeSessionUser } from '../../lib/session';

import { Field } from './Field';

export function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@karam.local');
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
      <div className="kz-auth-aside">
        <div className="kz-auth-brand">
          <Image
            className="kz-auth-logo"
            src="/karam-dome-mark.png"
            alt="Karam Restaurant"
            width={64}
            height={64}
            priority
          />
          <span className="kz-auth-chip">KARAM / STAFF</span>
        </div>
        <div className="kz-auth-visual" aria-hidden="true">
          <svg viewBox="0 0 480 360" role="img">
            <defs>
              <linearGradient id="plate" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="#f4f1e8" />
                <stop offset="1" stopColor="#c9c1b2" />
              </linearGradient>
              <linearGradient id="rice" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="#d6bd89" />
                <stop offset="1" stopColor="#b88d61" />
              </linearGradient>
              <linearGradient id="curry" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="#b97359" />
                <stop offset="1" stopColor="#925347" />
              </linearGradient>
            </defs>
            <ellipse cx="243" cy="292" rx="150" ry="25" fill="#101a14" opacity=".3" />
            <circle cx="238" cy="174" r="127" fill="url(#plate)" />
            <circle cx="238" cy="174" r="110" fill="#f8f6f0" stroke="#d0c8b9" strokeWidth="2" />
            <circle cx="238" cy="174" r="94" fill="none" stroke="#e2dbce" strokeWidth="2" />
            <path
              d="M151 174c6-40 39-66 83-66 47 0 78 28 88 63-9 37-41 64-88 65-42 1-73-22-83-62Z"
              fill="url(#rice)"
            />
            <path
              d="M171 163c25-25 73-36 116-17m-105 36c36-20 75-20 124-7m-105 27c27-9 51-9 80-3"
              fill="none"
              stroke="#efe4c8"
              strokeLinecap="round"
              strokeWidth="4"
              opacity=".8"
            />
            <path
              d="M258 140c12-22 42-25 57-9 14 15 10 41-8 54-15 11-35 8-47-5-8-10-9-27-2-40Z"
              fill="url(#curry)"
            />
            <circle cx="276" cy="145" r="4" fill="#d0ad70" />
            <circle cx="298" cy="161" r="3" fill="#d0ad70" />
            <path
              d="M190 138c-13-25-3-39 14-42 10 17 4 33-14 42Zm12 3c3-26 20-36 37-30-1 20-17 32-37 30Zm-17 13c-22-13-24-30-12-43 18 10 23 25 12 43Z"
              fill="#667864"
            />
            <path d="M198 140 189 108m12 30 24-28m-28 44-23-23" stroke="#b8c0a3" strokeWidth="2" />
            <circle cx="217" cy="190" r="5" fill="#986b5a" />
            <circle cx="235" cy="202" r="4" fill="#986b5a" />
            <circle cx="255" cy="190" r="4" fill="#986b5a" />
            <circle cx="318" cy="89" r="20" fill="#c5aa6b" opacity=".92" />
            <path d="M318 77v24m-12-12h24" stroke="#efe6d3" strokeWidth="2" opacity=".8" />
            <circle cx="132" cy="228" r="7" fill="#b9785e" />
            <circle cx="352" cy="224" r="5" fill="#86a273" />
          </svg>
        </div>
        <div className="kz-auth-copy">
          <h2>From goods received to meals delivered.</h2>
          <p>One workspace for the people who keep every service moving.</p>
        </div>
        <div className="kz-auth-foot">
          STORE <span /> KITCHEN <span /> FINANCE
        </div>
      </div>
      <div className="kz-auth-form">
        <div className="kz-page-head">
          <p className="kz-auth-kicker">Staff workspace</p>
          <h1>{messages.en.common.signIn}</h1>
          <p>Use your staff email to open the store, kitchen, and finance tools.</p>
        </div>
        <Field label="Email">
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </Field>
        {error ? (
          <p className="kz-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="kz-button kz-button-block" type="submit" disabled={pending}>
          {messages.en.common.signIn}
        </button>
        <p className="kz-auth-note">Your access follows your staff role.</p>
      </div>
    </form>
  );
}
