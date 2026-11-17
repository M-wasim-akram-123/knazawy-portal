'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { mealCostCopy } from '@knazawy/i18n';
import {
  BASE_UNIT_LABELS,
  RECIPE_KIND_LABELS,
  RECIPE_STATUS_LABELS,
  can,
  recipeStatusTone,
} from '@knazawy/shared';
import type { MealCostRecord, RecipeKind } from '@knazawy/shared';
import { FormDialog, KaramLoader, Pagination, usePage } from '@knazawy/ui-shell';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { fill, useCommon, useCopy, useLabel } from '../../lib/i18n';
import { api, readSessionUser } from '../../lib/session';
import { Field } from '../master/Field';

type CostFilter = 'ALL' | 'OVER' | 'WITHIN' | 'NOT_COOKED';

export function MealCostScreen() {
  const t = useCopy(mealCostCopy);
  const common = useCommon();
  const label = useLabel();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [costs, setCosts] = useState<MealCostRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<'ALL' | RecipeKind>('ALL');
  const [costFilter, setCostFilter] = useState<CostFilter>('ALL');

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    return costs.filter((cost) => {
      if (kindFilter !== 'ALL' && cost.kind !== kindFilter) return false;
      if (costFilter !== 'ALL' && costStanding(cost) !== costFilter) return false;
      if (!term) return true;
      return [cost.code, cost.name, ...cost.lines.map((line) => line.itemName)]
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [costs, search, kindFilter, costFilter]);
  const page = usePage(shown, 10);

  useEffect(() => {
    const session = readSessionUser();
    setUser(session);
    setReady(true);
    if (!session || !can(session.role, 'recipes', 'R')) return;
    void api
      .listMealCosts()
      .then(setCosts)
      .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
  }, []);

  if (!ready) return <KaramLoader label={t.loading} fullPage />;
  if (!user) {
    return (
      <p>
        <Link href="/login">{common.signIn}</Link> {t.signInSuffix}
      </p>
    );
  }
  if (!can(user.role, 'recipes', 'R')) {
    return <p>{t.notAllowed}</p>;
  }

  const selected = costs.find((cost) => cost.recipeId === selectedId) ?? null;
  const filtering = search !== '' || kindFilter !== 'ALL' || costFilter !== 'ALL';

  function open(cost: MealCostRecord): void {
    setSelectedId(cost.recipeId);
    setDetailOpen(true);
  }

  return (
    <section className="kz-stack">
      <div className="kz-page-head">
        <h1>{common.mealCost}</h1>
        <p>{t.intro}</p>
      </div>
      <div className="kz-panel kz-table-wrap">
        <h2>{common.recipes}</h2>
        <div className="kz-filters">
          <Field label={t.search}>
            <input
              type="search"
              value={search}
              placeholder={t.searchPlaceholder}
              onChange={(event) => {
                setSearch(event.target.value);
                page.setPage(1);
              }}
            />
          </Field>
          <Field label={t.filterKind}>
            <select
              value={kindFilter}
              onChange={(event) => {
                setKindFilter(event.target.value as 'ALL' | RecipeKind);
                page.setPage(1);
              }}
            >
              <option value="ALL">{t.all}</option>
              <option value="MEAL">{label(RECIPE_KIND_LABELS.MEAL)}</option>
              <option value="SNACK">{label(RECIPE_KIND_LABELS.SNACK)}</option>
            </select>
          </Field>
          <Field label={t.filterCost}>
            <select
              value={costFilter}
              onChange={(event) => {
                setCostFilter(event.target.value as CostFilter);
                page.setPage(1);
              }}
            >
              <option value="ALL">{t.all}</option>
              <option value="OVER">{t.overStandard}</option>
              <option value="WITHIN">{t.withinStandard}</option>
              <option value="NOT_COOKED">{t.notCooked}</option>
            </select>
          </Field>
          {filtering ? (
            <button
              type="button"
              className="kz-button-quiet kz-filters-clear"
              onClick={() => {
                setSearch('');
                setKindFilter('ALL');
                setCostFilter('ALL');
                page.setPage(1);
              }}
            >
              {t.clearFilters}
            </button>
          ) : null}
        </div>
        {error ? (
          <p className="kz-error" role="alert">
            {error}
          </p>
        ) : null}
        {costs.length === 0 ? <p className="kz-empty">{t.noRecipes}</p> : null}
        {costs.length > 0 && shown.length === 0 ? <p className="kz-empty">{t.noMatches}</p> : null}
        <table className="kz-table">
          <thead>
            <tr>
              <th>{t.recipe}</th>
              <th>{t.kind}</th>
              <th>{t.standard}</th>
              <th>{t.actual}</th>
              <th>{t.difference}</th>
              <th>{t.portionsCooked}</th>
              <th className="kz-actions-head">{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {page.rows.map((cost) => (
              <tr
                key={cost.recipeId}
                className="kz-row-clickable"
                aria-selected={cost.recipeId === selectedId}
                onClick={() => open(cost)}
              >
                <td>
                  {cost.name}{' '}
                  <span className="kz-status" data-tone={recipeStatusTone(cost.status)}>
                    {label(RECIPE_STATUS_LABELS[cost.status])}
                  </span>
                </td>
                <td>{label(RECIPE_KIND_LABELS[cost.kind])}</td>
                <td>{money(cost.standardCost)}</td>
                <td>{money(cost.actualCost)}</td>
                <td>
                  <DifferenceBadge cost={cost} />
                </td>
                <td>
                  {cost.portionsCooked}
                  {cost.batches === 1 ? t.oneBatch : fill(t.manyBatches, { count: cost.batches })}
                </td>
                <td className="kz-actions-cell">
                  <div className="kz-row-actions">
                    <button
                      type="button"
                      className="kz-button-quiet"
                      onClick={(event) => {
                        event.stopPropagation();
                        open(cost);
                      }}
                    >
                      {t.open}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination
          page={page.page}
          pageCount={page.pageCount}
          total={page.total}
          from={page.from}
          to={page.to}
          onPage={page.setPage}
          labels={common}
        />
      </div>

      <FormDialog
        buttonLabel={selected?.name ?? ''}
        title={selected?.name ?? ''}
        showTrigger={false}
        isOpen={detailOpen && selected !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setDetailOpen(false);
        }}
      >
        {() =>
          selected ? (
            <div className="kz-order">
              <div className="kz-order-head">
                <span className="kz-status" data-tone={recipeStatusTone(selected.status)}>
                  {label(RECIPE_STATUS_LABELS[selected.status])}
                </span>
                <strong className="kz-order-airline">{selected.name}</strong>
                <span className="kz-order-flight">
                  {selected.code} · {label(RECIPE_KIND_LABELS[selected.kind])}
                </span>
              </div>

              <dl className="kz-order-facts">
                <div>
                  <dt>{t.factStandard}</dt>
                  <dd>
                    {money(selected.standardCost)}
                    <small>{t.factStandardHint}</small>
                  </dd>
                </div>
                <div>
                  <dt>{t.factActual}</dt>
                  <dd>
                    {money(selected.actualCost)}
                    <small>{t.factActualHint}</small>
                  </dd>
                </div>
                <div>
                  <dt>{t.factDifference}</dt>
                  <dd>
                    <span>
                      <DifferenceBadge cost={selected} />
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>{t.factWastage}</dt>
                  <dd>{selected.wastagePercent}%</dd>
                </div>
                <div>
                  <dt>{t.factPortions}</dt>
                  <dd>{selected.portionsCooked}</dd>
                </div>
                <div>
                  <dt>{t.factBatches}</dt>
                  <dd>{selected.batches}</dd>
                </div>
              </dl>

              <section className="kz-order-section">
                <h3>{t.ingredientsTitle}</h3>
                <div className="kz-table-wrap">
                  <table className="kz-table">
                    <thead>
                      <tr>
                        <th>{t.ingredient}</th>
                        <th>{t.perPortion}</th>
                        <th>{t.withWastage}</th>
                        <th>{t.latestPrice}</th>
                        <th>{t.cost}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.lines.map((line) => (
                        <tr key={line.itemName}>
                          <td>{line.itemName}</td>
                          <td>
                            {line.quantityPerPortion} {label(BASE_UNIT_LABELS[line.baseUnit])}
                          </td>
                          <td>
                            {line.quantityWithWastage
                              ? `${line.quantityWithWastage} ${label(BASE_UNIT_LABELS[line.baseUnit])}`
                              : '—'}
                          </td>
                          <td>{line.unitCost ? `${line.unitCost} PKR` : t.noPrice}</td>
                          <td>{money(line.lineCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          ) : null
        }
      </FormDialog>
    </section>
  );
}

/** Over standard is a problem (red); within standard is fine (green); never cooked is plain. */
function costStanding(cost: MealCostRecord): Exclude<CostFilter, 'ALL'> {
  if (cost.difference === null || cost.batches === 0) return 'NOT_COOKED';
  return Number(cost.difference) > 0 ? 'OVER' : 'WITHIN';
}

function DifferenceBadge({ cost }: { cost: MealCostRecord }) {
  const standing = costStanding(cost);
  if (standing === 'NOT_COOKED') return <>{money(cost.difference)}</>;
  return (
    <span className="kz-status" data-tone={standing === 'OVER' ? 'problem' : 'done'}>
      {money(cost.difference)}
    </span>
  );
}

function money(value: string | null): string {
  return value === null ? '—' : `${value} PKR`;
}
