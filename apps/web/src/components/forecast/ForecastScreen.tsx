'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { forecastCopy } from '@knazawy/i18n';
import {
  RECIPE_KIND_LABELS,
  can,
  formatDisplayDate,
  type ForecastDayRecord,
  type ForecastRecord,
  type ForecastRowRecord,
} from '@knazawy/shared';
import { KaramLoader } from '@knazawy/ui-shell';
import { useEffect, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { fill, useCommon, useCopy, useLabel } from '../../lib/i18n';
import { api, readSessionUser } from '../../lib/session';

export function ForecastScreen() {
  const t = useCopy(forecastCopy);
  const common = useCommon();
  const label = useLabel();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [forecast, setForecast] = useState<ForecastRecord | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const session = readSessionUser();
    setUser(session);
    setReady(true);
    if (!session || !can(session.role, 'forecast', 'R')) return;
    void api
      .getForecast()
      .then(setForecast)
      .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
  }, []);

  if (!ready) return <KaramLoader label={t.loading} fullPage />;
  if (!user) {
    return (
      <p>
        <a href="/login">{common.signIn}</a> {t.signInToSee}
      </p>
    );
  }
  if (!can(user.role, 'forecast', 'R')) {
    return <p>{t.restricted}</p>;
  }

  const days = forecast?.rows[0]?.days ?? [];
  const totals = totalsByItem(forecast?.rows ?? []);

  return (
    <section className="kz-stack">
      <div className="kz-page-head">
        <h1>{common.forecast}</h1>
        <p>{t.intro}</p>
      </div>
      {error ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      {forecast && forecast.rows.length === 0 ? <p className="kz-empty">{t.noData}</p> : null}
      {forecast && forecast.rows.length > 0 ? (
        <>
          <div className="kz-panel kz-table-wrap">
            <h2>{t.byAirlineAndItem}</h2>
            <table className="kz-table">
              <thead>
                <tr>
                  <th>{t.airline}</th>
                  <th>{t.item}</th>
                  <th>{t.kind}</th>
                  {days.map((day) => (
                    <th key={day.date}>{formatDisplayDate(day.date)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {forecast.rows.map((row) => (
                  <tr key={`${row.airlineId}-${row.recipeId}`}>
                    <td>{row.airlineName}</td>
                    <td>{row.recipeName}</td>
                    <td>{label(RECIPE_KIND_LABELS[row.recipeKind])}</td>
                    {row.days.map((day) => (
                      <td key={day.date}>{dayCell(day, t.booked)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="kz-panel kz-table-wrap">
            <h2>{t.totalByItem}</h2>
            <table className="kz-table">
              <thead>
                <tr>
                  <th>{t.item}</th>
                  <th>{t.kind}</th>
                  {days.map((day) => (
                    <th key={day.date}>{formatDisplayDate(day.date)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {totals.map((total) => (
                  <tr key={total.recipeId}>
                    <td>{total.recipeName}</td>
                    <td>{label(RECIPE_KIND_LABELS[total.recipeKind])}</td>
                    {total.days.map((day) => (
                      <td key={day.date}>{dayCell(day, t.booked)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}

function dayCell(day: ForecastDayRecord, booked: string) {
  return (
    <>
      <strong>{day.expected}</strong>
      {day.booked > 0 ? <span> · {fill(booked, { count: day.booked })}</span> : null}
    </>
  );
}

/** Adds up the rows for each item across airlines, day by day. */
function totalsByItem(rows: ForecastRowRecord[]): ForecastRowRecord[] {
  const byItem = new Map<string, ForecastRowRecord>();
  for (const row of rows) {
    const existing = byItem.get(row.recipeId);
    if (!existing) {
      byItem.set(row.recipeId, {
        ...row,
        airlineId: '',
        airlineName: '',
        days: row.days.map((day) => ({ ...day })),
      });
      continue;
    }
    existing.days = existing.days.map((day, index) => ({
      date: day.date,
      booked: round(day.booked + row.days[index].booked),
      expected: round(day.expected + row.days[index].expected),
    }));
  }
  return [...byItem.values()].sort((a, b) => a.recipeName.localeCompare(b.recipeName));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
