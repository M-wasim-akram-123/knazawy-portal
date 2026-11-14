'use client';

import { messages } from '@knazawy/i18n';
import { formatDisplayDate, todayInKarachi, type JournalEntryRecord } from '@knazawy/shared';
import { useEffect, useState } from 'react';

import { ApiError, api, clearSession } from '../../lib/session';

import { EntryLines } from './EntryLines';

export function LedgerScreen() {
  const [entries, setEntries] = useState<JournalEntryRecord[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void api
      .listJournal()
      .then(setEntries)
      .catch((caught: unknown) => {
        if (caught instanceof ApiError && caught.status === 401) {
          clearSession();
          window.location.assign('/login');
          return;
        }
        setError(caught instanceof Error ? caught.message : 'The ledger could not load.');
      });
  }, []);

  return (
    <section className="kz-stack">
      <div className="kz-page-head">
        <h1>{messages.en.common.ledger}</h1>
        <p>What your airline has been charged, as it was posted. You only see your own airline.</p>
        <p lang="ur" dir="rtl">
          {messages.ur.common.ledger}
        </p>
      </div>
      {error ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      {entries === null && !error ? <p>Loading</p> : null}
      {entries !== null && entries.length === 0 ? (
        <p className="kz-empty">Nothing has been posted yet.</p>
      ) : null}
      {entries?.map((entry) => (
        <article key={entry.id} className="kz-panel kz-stack">
          <h2>{entry.number}</h2>
          <p className="kz-help">
            {formatDisplayDate(todayInKarachi(new Date(entry.postedAt)))} · {entry.memo} ·{' '}
            {entry.total} PKR
          </p>
          <EntryLines entry={entry} />
        </article>
      ))}
    </section>
  );
}
