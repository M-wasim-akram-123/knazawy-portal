'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { ratesCopy } from '@knazawy/i18n';
import {
  MAX_PAYMENT_TERMS_DAYS,
  airlineTermsError,
  canSetAirlineTerms,
  type AirlineTermsRecord,
  type Role,
} from '@knazawy/shared';
import { useEffect, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { fill, useCopy } from '../../lib/i18n';
import { api } from '../../lib/session';

interface Draft {
  paymentTermsDays: string;
  discountPercent: string;
}

/**
 * Payment days and discount for each airline. An invoice copies them when it is issued, so a
 * change here applies to the next invoice, never one already sent.
 */
export function AirlineTermsPanel({
  role,
  setUser,
}: {
  role: Role;
  setUser: (user: SessionUser | null) => void;
}) {
  const t = useCopy(ratesCopy);
  const termsLabel = (days: number) => (days === 0 ? t.dueOnReceipt : fill(t.netDays, { days }));
  const [terms, setTerms] = useState<AirlineTermsRecord[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const editable = canSetAirlineTerms(role);

  useEffect(() => {
    void api
      .listAirlineTerms()
      .then((rows) => {
        setTerms(rows);
        setDrafts(Object.fromEntries(rows.map((row) => [row.airlineId, draftOf(row)])));
      })
      .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
  }, []);

  async function save(row: AirlineTermsRecord) {
    const draft = drafts[row.airlineId] ?? draftOf(row);
    const input = {
      paymentTermsDays: Number(draft.paymentTermsDays),
      discountPercent: draft.discountPercent.trim(),
    };
    const problem = airlineTermsError(input);
    setSaved('');
    if (problem) {
      const daysValid =
        Number.isInteger(input.paymentTermsDays) &&
        input.paymentTermsDays >= 0 &&
        input.paymentTermsDays <= MAX_PAYMENT_TERMS_DAYS;
      setError(
        daysValid
          ? fill(t.discountInvalid, { airline: row.airlineName })
          : fill(t.daysInvalid, { airline: row.airlineName, max: MAX_PAYMENT_TERMS_DAYS }),
      );
      return;
    }
    setBusyId(row.airlineId);
    setError('');
    try {
      const next = await api.setAirlineTerms(row.airlineId, input);
      setTerms((current) =>
        current.map((item) => (item.airlineId === next.airlineId ? next : item)),
      );
      setDrafts((current) => ({ ...current, [next.airlineId]: draftOf(next) }));
      setSaved(
        fill(t.termsSaved, {
          airline: next.airlineName,
          terms: termsLabel(next.paymentTermsDays),
          percent: next.discountPercent,
        }),
      );
    } catch (caught: unknown) {
      setError(explainApiError(caught, setUser));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="kz-panel kz-stack">
      <h2>{t.paymentTerms}</h2>
      <p className="kz-help">{t.termsIntro}</p>
      {terms.length === 0 ? (
        <p className="kz-empty">{t.noAirlines}</p>
      ) : (
        <div className="kz-table-wrap">
          <table className="kz-table">
            <thead>
              <tr>
                <th>{t.airline}</th>
                <th>{t.daysToPay}</th>
                <th>{t.discountPercent}</th>
                {editable ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {terms.map((row) => {
                const draft = drafts[row.airlineId] ?? draftOf(row);
                return (
                  <tr key={row.airlineId}>
                    <td>
                      {row.airlineName}
                      <span className="kz-help"> · {termsLabel(row.paymentTermsDays)}</span>
                    </td>
                    <td>
                      {editable ? (
                        <input
                          type="number"
                          min={0}
                          max={180}
                          step={1}
                          inputMode="numeric"
                          aria-label={fill(t.daysAria, { airline: row.airlineName })}
                          value={draft.paymentTermsDays}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [row.airlineId]: { ...draft, paymentTermsDays: event.target.value },
                            }))
                          }
                        />
                      ) : (
                        row.paymentTermsDays
                      )}
                    </td>
                    <td>
                      {editable ? (
                        <input
                          inputMode="decimal"
                          aria-label={fill(t.discountAria, { airline: row.airlineName })}
                          value={draft.discountPercent}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [row.airlineId]: { ...draft, discountPercent: event.target.value },
                            }))
                          }
                        />
                      ) : (
                        `${row.discountPercent}%`
                      )}
                    </td>
                    {editable ? (
                      <td>
                        <button
                          type="button"
                          className="kz-button-quiet"
                          disabled={
                            busyId !== null ||
                            (draft.paymentTermsDays === String(row.paymentTermsDays) &&
                              draft.discountPercent === row.discountPercent)
                          }
                          onClick={() => void save(row)}
                        >
                          {t.save}
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {error ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? <p>{saved}</p> : null}
    </div>
  );
}

function draftOf(row: AirlineTermsRecord): Draft {
  return {
    paymentTermsDays: String(row.paymentTermsDays),
    discountPercent: row.discountPercent,
  };
}
