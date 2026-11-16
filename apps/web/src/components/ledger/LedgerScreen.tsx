'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { messages } from '@knazawy/i18n';
import {
  JOURNAL_SIDE_LABELS,
  can,
  formatDisplayDate,
  todayInKarachi,
  type JournalEntryRecord,
} from '@knazawy/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { api, readSessionUser } from '../../lib/session';

export function LedgerScreen() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [entries, setEntries] = useState<JournalEntryRecord[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const session = readSessionUser();
    setUser(session);
    setReady(true);
    if (!session) return;
    void api
      .listJournal()
      .then(setEntries)
      .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
  }, []);

  if (!ready) return <p>Loading the ledger</p>;
  if (!user) {
    return (
      <p>
        <Link href="/login">{messages.en.common.signIn}</Link> to see the ledger.
      </p>
    );
  }
  if (!can(user.role, 'ledger', 'R')) {
    return <p>The ledger is kept by finance.</p>;
  }

  return (
    <section className="kz-stack">
      <div className="kz-page-head">
        <h1>{messages.en.common.ledger}</h1>
        <p>
          Each issued invoice and credit note posts here. An entry is balanced, and it is never
          changed. A correction is a new entry.
        </p>
        <p lang="ur" dir="rtl">
          {messages.ur.common.ledger}
        </p>
        <button
          type="button"
          className="kz-button"
          disabled={busy || entries.length === 0}
          onClick={() => {
            setBusy(true);
            setError('');
            void api
              .journalCsv()
              .then((result) => downloadCsv(result.csv))
              .catch((caught: unknown) => setError(explainApiError(caught, setUser)))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? 'Preparing' : 'Export'}
        </button>
      </div>
      {error ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      {entries.length === 0 ? <p className="kz-empty">Nothing has been posted yet.</p> : null}
      {entries.map((entry) => (
        <article key={entry.id} className="kz-panel kz-stack">
          <h2>
            {entry.number} · {entry.airlineName}
          </h2>
          <p className="kz-help">
            {formatDisplayDate(todayInKarachi(new Date(entry.postedAt)))} · {entry.memo} ·{' '}
            {entry.total} PKR
          </p>
          <EntryTable entry={entry} />
        </article>
      ))}
    </section>
  );
}

function EntryTable({ entry }: { entry: JournalEntryRecord }) {
  return (
    <div className="kz-table-wrap">
      <table className="kz-table">
        <thead>
          <tr>
            <th>Account</th>
            <th>Side</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {entry.lines.map((line) => (
            <tr key={`${line.account}-${line.side}`}>
              <td>
                {line.accountName}
                <span className="kz-help"> · {line.account}</span>
              </td>
              <td>{JOURNAL_SIDE_LABELS[line.side]}</td>
              <td>{line.amount} PKR</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function downloadCsv(csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `ledger-${todayInKarachi()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
