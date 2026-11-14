'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { messages } from '@knazawy/i18n';
import {
  DISPUTE_STATUS_LABELS,
  canDecideDispute,
  disputeStatusTone,
  formatDisplayDate,
  type DisputeRecord,
} from '@knazawy/shared';
import { useEffect, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { api, readSessionUser } from '../../lib/session';
import { Field } from '../master/Field';

export function DisputesScreen() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [rows, setRows] = useState<DisputeRecord[]>([]);
  const [resolution, setResolution] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const session = readSessionUser();
    setUser(session);
    setReady(true);
    if (!session) return;
    void api
      .listDisputes()
      .then(setRows)
      .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
  }, []);

  if (!ready) return <p>Loading</p>;
  if (!user) {
    return (
      <p>
        <a href="/login">{messages.en.common.signIn}</a> to see disputes.
      </p>
    );
  }

  const canDecide = canDecideDispute(user.role);

  async function decide(id: string, action: 'accept' | 'reject') {
    setBusy(true);
    setError('');
    setSaved('');
    try {
      const record =
        action === 'accept'
          ? await api.acceptDispute(id, resolution.trim())
          : await api.rejectDispute(id, resolution.trim());
      setRows((current) => current.map((row) => (row.id === record.id ? record : row)));
      setResolution('');
      setSaved(
        action === 'accept'
          ? `${record.number} is accepted. Raise a credit note if money is due back.`
          : `${record.number} is rejected.`,
      );
    } catch (caught: unknown) {
      setError(explainApiError(caught, setUser));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="kz-stack">
      <div className="kz-page-head">
        <h1>{messages.en.common.disputes}</h1>
        <p>
          An airline can dispute an issued bill. Accepting or rejecting it does not change the bill.
          A credit note is still how money goes back.
        </p>
        <p lang="ur" dir="rtl">
          {messages.ur.common.disputes}
        </p>
      </div>
      {error ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? <p>{saved}</p> : null}
      {rows.length === 0 ? <p className="kz-empty">No disputes yet.</p> : null}
      {rows.map((row) => (
        <article key={row.id} className="kz-panel kz-stack">
          <h2>
            {row.number}{' '}
            <span className="kz-status" data-tone={disputeStatusTone(row.status)}>
              {DISPUTE_STATUS_LABELS[row.status]}
            </span>
          </h2>
          <p>
            {row.airlineName} · {billLabel(row)} · {row.invoiceTotal} PKR · opened{' '}
            {formatDisplayDate(row.createdAt.slice(0, 10))} by {row.openedByName}
          </p>
          <p>{row.reason}</p>
          {row.resolution ? (
            <p>
              Decision{row.decidedByName ? ` by ${row.decidedByName}` : ''}: {row.resolution}
            </p>
          ) : null}
          {canDecide && row.status === 'OPEN' ? (
            <div className="kz-stack">
              <Field label="Decision" hint="The airline can read this. The bill stays as it is.">
                <input
                  value={resolution}
                  maxLength={300}
                  onChange={(event) => setResolution(event.target.value)}
                />
              </Field>
              <div className="kz-actions">
                <button
                  type="button"
                  className="kz-button"
                  disabled={busy || resolution.trim().length < 3}
                  onClick={() => void decide(row.id, 'accept')}
                >
                  Accept dispute
                </button>
                <button
                  type="button"
                  className="kz-button-quiet"
                  disabled={busy || resolution.trim().length < 3}
                  onClick={() => void decide(row.id, 'reject')}
                >
                  Reject dispute
                </button>
              </div>
            </div>
          ) : null}
        </article>
      ))}
    </section>
  );
}

function billLabel(row: DisputeRecord): string {
  return row.source === 'ROOM_INVOICE' ? `Room bill ${row.invoiceNumber}` : row.invoiceNumber;
}
