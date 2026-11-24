'use client';

import { portalLedgerCopy } from '@knazawy/i18n';
import { formatDisplayDate, todayInKarachi, type JournalEntryRecord } from '@knazawy/shared';
import { KaramLoader } from '@knazawy/ui-shell';
import { useEffect, useState } from 'react';

import { useChrome, useCommon, useCopy } from '../../lib/i18n';
import { ApiError, api, clearSession } from '../../lib/session';

import { EntryLines } from './EntryLines';

export function LedgerScreen() {
  const t = useCopy(portalLedgerCopy);
  const common = useCommon();
  const chrome = useChrome();
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
        setError(caught instanceof Error ? caught.message : t.loadFailed);
      });
  }, []);

  return (
    <section className="kz-stack">
      <div className="kz-page-head">
        <h1>{common.ledger}</h1>
        <p>{t.intro}</p>
      </div>
      {error ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      {entries === null && !error ? <KaramLoader label={chrome.loading} fullPage /> : null}
      {entries !== null && entries.length === 0 ? <p className="kz-empty">{t.empty}</p> : null}
      {entries?.map((entry) => (
        <article key={entry.id} className="kz-panel kz-stack">
          <h2>{entry.number}</h2>
          <p className="kz-help">
            {formatDisplayDate(todayInKarachi(new Date(entry.postedAt)))} · {entry.memo} ·{' '}
            {entry.total} SAR
          </p>
          <EntryLines entry={entry} />
        </article>
      ))}
    </section>
  );
}
