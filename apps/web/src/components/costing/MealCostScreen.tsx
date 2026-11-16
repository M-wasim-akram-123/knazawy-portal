'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { messages } from '@knazawy/i18n';
import {
  BASE_UNIT_LABELS,
  RECIPE_KIND_LABELS,
  RECIPE_STATUS_LABELS,
  can,
  recipeStatusTone,
} from '@knazawy/shared';
import type { MealCostRecord } from '@knazawy/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { api, readSessionUser } from '../../lib/session';

export function MealCostScreen() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [costs, setCosts] = useState<MealCostRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const session = readSessionUser();
    setUser(session);
    setReady(true);
    if (!session || !can(session.role, 'recipes', 'R')) return;
    void api
      .listMealCosts()
      .then((next) => {
        setCosts(next);
        setSelectedId(next[0]?.recipeId ?? '');
      })
      .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
  }, []);

  if (!ready) return <p>Loading meal cost</p>;
  if (!user) {
    return (
      <p>
        <Link href="/login">{messages.en.common.signIn}</Link> to see meal cost.
      </p>
    );
  }
  if (!can(user.role, 'recipes', 'R')) {
    return <p>Meal cost is for the kitchen, operations, and finance.</p>;
  }

  const selected = costs.find((cost) => cost.recipeId === selectedId) ?? null;

  return (
    <section className="kz-stack">
      <div className="kz-page-head">
        <h1>{messages.en.common.mealCost}</h1>
        <p>
          Standard cost is today&apos;s latest purchase price for one portion, including the
          recipe&apos;s wastage. Actual cost is what cooked batches used, divided by the portions
          made. The difference is actual minus standard.
        </p>
        <p lang="ur" dir="rtl">
          {messages.ur.common.mealCost}
        </p>
      </div>
      <div className="kz-workspace">
        <div className="kz-panel kz-table-wrap">
          <h2>Recipes</h2>
          {error ? (
            <p className="kz-error" role="alert">
              {error}
            </p>
          ) : null}
          {costs.length === 0 ? <p className="kz-empty">No recipes yet.</p> : null}
          <table className="kz-table">
            <thead>
              <tr>
                <th>Recipe</th>
                <th>Kind</th>
                <th>Standard</th>
                <th>Actual</th>
                <th>Difference</th>
                <th>Portions cooked</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {costs.map((cost) => (
                <tr key={cost.recipeId}>
                  <td>
                    {cost.name}{' '}
                    <span className="kz-status" data-tone={recipeStatusTone(cost.status)}>
                      {RECIPE_STATUS_LABELS[cost.status]}
                    </span>
                  </td>
                  <td>{RECIPE_KIND_LABELS[cost.kind]}</td>
                  <td>{money(cost.standardCost)}</td>
                  <td>{money(cost.actualCost)}</td>
                  <td>{money(cost.difference)}</td>
                  <td>
                    {cost.portionsCooked}
                    {cost.batches === 1 ? ' (1 batch)' : ` (${cost.batches} batches)`}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="kz-button-quiet"
                      onClick={() => setSelectedId(cost.recipeId)}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selected ? (
          <div className="kz-panel kz-table-wrap">
            <h2>{selected.name}</h2>
            <p>
              Wastage {selected.wastagePercent}%. One portion at today&apos;s prices is{' '}
              {money(selected.standardCost)}.
            </p>
            <table className="kz-table">
              <thead>
                <tr>
                  <th>Ingredient</th>
                  <th>Per portion</th>
                  <th>With wastage</th>
                  <th>Latest price</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {selected.lines.map((line) => (
                  <tr key={line.itemName}>
                    <td>{line.itemName}</td>
                    <td>
                      {line.quantityPerPortion} {BASE_UNIT_LABELS[line.baseUnit]}
                    </td>
                    <td>
                      {line.quantityWithWastage
                        ? `${line.quantityWithWastage} ${BASE_UNIT_LABELS[line.baseUnit]}`
                        : '—'}
                    </td>
                    <td>{line.unitCost ? `${line.unitCost} PKR` : 'No price yet'}</td>
                    <td>{money(line.lineCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function money(value: string | null): string {
  return value === null ? '—' : `${value} PKR`;
}
