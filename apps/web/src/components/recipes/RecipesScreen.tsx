'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { recipesCopy } from '@knazawy/i18n';
import {
  BASE_UNIT_LABELS,
  RECIPE_KIND_LABELS,
  RECIPE_KINDS,
  RECIPE_STATUS_LABELS,
  can,
  recipeIngredientQuantity,
  recipeStatusTone,
} from '@knazawy/shared';
import type { ItemRecord, RecipeKind, RecipeRecord } from '@knazawy/shared';
import { FormDialog, KaramLoader, Pagination, usePage } from '@knazawy/ui-shell';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { fill as fillText, useCopy, useCommon, useLabel } from '../../lib/i18n';
import { api, readSessionUser } from '../../lib/session';
import { Field } from '../master/Field';

interface DraftLine {
  key: string;
  itemId: string;
  quantity: string;
}

export function RecipesScreen() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [recipes, setRecipes] = useState<RecipeRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<RecipeKind>('MEAL');
  const [portions, setPortions] = useState('1');
  const [wastagePercent, setWastagePercent] = useState('0');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const t = useCopy(recipesCopy);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<'ALL' | RecipeKind>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'APPROVED'>('ALL');
  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    return recipes.filter((recipe) => {
      if (kindFilter !== 'ALL' && recipe.kind !== kindFilter) return false;
      if (statusFilter !== 'ALL' && recipe.status !== statusFilter) return false;
      if (!term) return true;
      return [recipe.code, recipe.name, ...recipe.lines.map((line) => line.itemName)]
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [recipes, search, kindFilter, statusFilter]);
  const page = usePage(shown, 10);
  const common = useCommon();
  const label = useLabel();

  useEffect(() => {
    const session = readSessionUser();
    setUser(session);
    setReady(true);
    if (!session) return;
    void Promise.all([api.listItems(), api.listRecipes()])
      .then(([nextItems, nextRecipes]) => {
        const openItems = nextItems.filter((item) => item.active);
        setItems(openItems);
        setRecipes(nextRecipes);
        setLines([blankLine(openItems[0]?.id ?? '')]);
      })
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

  const canWrite = can(user.role, 'recipes', 'C') || can(user.role, 'recipes', 'U');
  const canApprove = can(user.role, 'recipes', 'A');
  const editing = recipes.find((recipe) => recipe.id === editingId) ?? null;
  const itemById = new Map(items.map((item) => [item.id, item]));

  return (
    <section className="kz-stack">
      <div className="kz-page-head kz-page-action-head">
        <div>
          <h1>{common.recipes}</h1>
          <p>{t.intro}</p>
        </div>
        {can(user.role, 'recipes', 'C') ? (
          <button
            className="kz-button kz-form-dialog-trigger"
            type="button"
            aria-haspopup="dialog"
            onClick={() => {
              setEditingId(null);
              clearForm(items[0]?.id ?? '');
              setError('');
              setSaved('');
              setDialogOpen(true);
            }}
          >
            {t.newRecipe}
          </button>
        ) : null}
      </div>
      {error && (!dialogOpen || !canWrite) ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? <p role="status">{saved}</p> : null}
      <div className="kz-workspace kz-workspace-single">
        {canWrite ? (
          <FormDialog
            buttonLabel={t.newRecipe}
            title={editing ? fillText(t.changeRecipe, { name: editing.name }) : t.newRecipe}
            showTrigger={false}
            isOpen={dialogOpen}
            onOpenChange={setDialogOpen}
          >
            {({ close }) => (
              <form
                className="kz-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const payload = {
                    code,
                    name,
                    kind,
                    portions,
                    wastagePercent,
                    lines: lines.map((line) => ({ itemId: line.itemId, quantity: line.quantity })),
                  };
                  setError('');
                  setSaved('');
                  setSaving(true);
                  const request = editing
                    ? api.updateRecipe(editing.id, payload)
                    : api.createRecipe(payload);
                  void request
                    .then((recipe) => {
                      setRecipes((current) =>
                        [...current.filter((row) => row.id !== recipe.id), recipe].sort(
                          (left, right) => left.name.localeCompare(right.name),
                        ),
                      );
                      if (editing) {
                        fill(recipe);
                        setSaved(
                          fillText(recipe.status === 'DRAFT' ? t.draftAgain : t.isSaved, {
                            name: recipe.name,
                          }),
                        );
                      } else {
                        clearForm(items[0]?.id ?? '');
                        setSaved(fillText(t.savedAsDraft, { name: recipe.name }));
                      }
                      close();
                    })
                    .catch((caught: unknown) => setError(explainApiError(caught, setUser)))
                    .finally(() => setSaving(false));
                }}
              >
                {editing ? (
                  <p>
                    <span className="kz-status" data-tone={recipeStatusTone(editing.status)}>
                      {label(RECIPE_STATUS_LABELS[editing.status])}
                    </span>
                  </p>
                ) : null}
                <Field label={t.code}>
                  <input value={code} onChange={(event) => setCode(event.target.value)} required />
                </Field>
                <Field label={t.name}>
                  <input value={name} onChange={(event) => setName(event.target.value)} required />
                </Field>
                <Field label={t.kind}>
                  <select
                    value={kind}
                    onChange={(event) => setKind(event.target.value as RecipeKind)}
                  >
                    {RECIPE_KINDS.map((option) => (
                      <option key={option} value={option}>
                        {label(RECIPE_KIND_LABELS[option])}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t.portions} hint={t.portionsHint}>
                  <input
                    inputMode="decimal"
                    value={portions}
                    onChange={(event) => setPortions(event.target.value)}
                    required
                  />
                </Field>
                <Field label={t.wastage} hint={t.wastageHint}>
                  <input
                    inputMode="decimal"
                    value={wastagePercent}
                    onChange={(event) => setWastagePercent(event.target.value)}
                    required
                  />
                </Field>
                <div className="kz-table-wrap">
                  <table className="kz-table">
                    <thead>
                      <tr>
                        <th>{t.ingredient}</th>
                        <th>{t.perPortion}</th>
                        <th>{t.forTheBatch}</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => {
                        const item = itemById.get(line.itemId);
                        const unit = item ? label(BASE_UNIT_LABELS[item.baseUnit]) : '';
                        const batch = recipeIngredientQuantity({
                          quantityPerPortion: line.quantity,
                          portions,
                          wastagePercent,
                        });
                        return (
                          <tr key={line.key}>
                            <td>
                              <select
                                value={line.itemId}
                                onChange={(event) =>
                                  updateLine(line.key, { itemId: event.target.value })
                                }
                                required
                              >
                                {items.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                inputMode="decimal"
                                value={line.quantity}
                                placeholder={unit ? fillText(t.inUnit, { unit }) : ''}
                                onChange={(event) =>
                                  updateLine(line.key, { quantity: event.target.value })
                                }
                                required
                              />
                            </td>
                            <td>{batch.ok ? `${batch.batch} ${unit}` : '—'}</td>
                            <td>
                              {lines.length > 1 ? (
                                <button
                                  type="button"
                                  className="kz-button-quiet"
                                  onClick={() =>
                                    setLines((current) =>
                                      current.filter((entry) => entry.key !== line.key),
                                    )
                                  }
                                >
                                  {t.remove}
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  className="kz-button-quiet"
                  onClick={() => setLines((current) => [...current, blankLine(items[0]?.id ?? '')])}
                >
                  {t.addIngredient}
                </button>
                {error ? (
                  <p className="kz-error" role="alert">
                    {error}
                  </p>
                ) : null}
                <button className="kz-button" type="submit" disabled={saving || items.length === 0}>
                  {saving ? t.saving : t.saveRecipe}
                </button>
                {editing ? (
                  <button
                    type="button"
                    className="kz-button-quiet"
                    onClick={() => {
                      setEditingId(null);
                      clearForm(items[0]?.id ?? '');
                      setError('');
                      setSaved('');
                      setDialogOpen(false);
                    }}
                  >
                    {t.newRecipe}
                  </button>
                ) : null}
              </form>
            )}
          </FormDialog>
        ) : null}
        <div className="kz-panel kz-table-wrap">
          <h2>{common.recipes}</h2>
          <div className="kz-filters">
            <Field label={t.search}>
              <input
                type="search"
                value={search}
                placeholder={t.searchPlaceholder}
                onChange={(event) => setSearch(event.target.value)}
              />
            </Field>
            <Field label={t.filterKind}>
              <select
                value={kindFilter}
                onChange={(event) => setKindFilter(event.target.value as 'ALL' | RecipeKind)}
              >
                <option value="ALL">{t.all}</option>
                <option value="MEAL">{label(RECIPE_KIND_LABELS.MEAL)}</option>
                <option value="SNACK">{label(RECIPE_KIND_LABELS.SNACK)}</option>
              </select>
            </Field>
            <Field label={t.filterStatus}>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as 'ALL' | 'DRAFT' | 'APPROVED')
                }
              >
                <option value="ALL">{t.all}</option>
                <option value="DRAFT">{label(RECIPE_STATUS_LABELS.DRAFT)}</option>
                <option value="APPROVED">{label(RECIPE_STATUS_LABELS.APPROVED)}</option>
              </select>
            </Field>
            {search || kindFilter !== 'ALL' || statusFilter !== 'ALL' ? (
              <button
                type="button"
                className="kz-button-quiet kz-filters-clear"
                onClick={() => {
                  setSearch('');
                  setKindFilter('ALL');
                  setStatusFilter('ALL');
                }}
              >
                {t.clearFilters}
              </button>
            ) : null}
          </div>
          {recipes.length === 0 ? <p className="kz-empty">{t.noRecipes}</p> : null}
          {recipes.length > 0 && shown.length === 0 ? (
            <p className="kz-empty">{t.noMatches}</p>
          ) : null}
          <table className="kz-table">
            <thead>
              <tr>
                <th>{t.code}</th>
                <th>{t.name}</th>
                <th>{t.kind}</th>
                <th>{t.portions}</th>
                <th>{t.status}</th>
                <th>{t.ingredients}</th>
                <th className="kz-actions-head">{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {page.rows.map((recipe) => (
                <tr key={recipe.id}>
                  <td>{recipe.code}</td>
                  <td>{recipe.name}</td>
                  <td>{label(RECIPE_KIND_LABELS[recipe.kind])}</td>
                  <td>{recipe.portions}</td>
                  <td>
                    <span className="kz-status" data-tone={recipeStatusTone(recipe.status)}>
                      {label(RECIPE_STATUS_LABELS[recipe.status])}
                    </span>
                  </td>
                  <td>
                    {recipe.lines
                      .map((line) => {
                        const batch = recipeIngredientQuantity({
                          quantityPerPortion: line.quantityPerPortion,
                          portions: recipe.portions,
                          wastagePercent: recipe.wastagePercent,
                        });
                        const unit = label(BASE_UNIT_LABELS[line.baseUnit]);
                        return batch.ok
                          ? fillText(t.ingredientLine, {
                              item: line.itemName,
                              quantity: line.quantityPerPortion,
                              unit,
                              batch: batch.batch,
                            })
                          : line.itemName;
                      })
                      .join(t.lineSeparator)}
                  </td>
                  <td className="kz-actions-cell">
                    <div className="kz-row-actions">
                      {canWrite ? (
                        <button
                          type="button"
                          className="kz-button-quiet"
                          onClick={() => {
                            fill(recipe);
                            setSaved('');
                            setDialogOpen(true);
                          }}
                        >
                          {t.open}
                        </button>
                      ) : null}
                      {canApprove && recipe.status === 'DRAFT' ? (
                        <button
                          type="button"
                          className="kz-button"
                          onClick={() => {
                            setError('');
                            void api
                              .approveRecipe(recipe.id)
                              .then((next) => {
                                setRecipes((current) =>
                                  current.map((row) => (row.id === next.id ? next : row)),
                                );
                                if (editingId === next.id) fill(next);
                                setSaved(fillText(t.isApproved, { name: next.name }));
                              })
                              .catch((caught: unknown) =>
                                setError(explainApiError(caught, setUser)),
                              );
                          }}
                        >
                          {t.approve}
                        </button>
                      ) : null}
                      {can(user.role, 'recipes', 'U') ? (
                        <button
                          type="button"
                          className="kz-button-quiet kz-button-danger"
                          onClick={() => {
                            if (
                              !window.confirm(fillText(t.confirmArchive, { name: recipe.name }))
                            ) {
                              return;
                            }
                            setError('');
                            void api
                              .updateRecipe(recipe.id, { active: false })
                              .then(() => {
                                setRecipes((current) =>
                                  current.filter((row) => row.id !== recipe.id),
                                );
                                if (editingId === recipe.id) {
                                  setEditingId(null);
                                  clearForm(items[0]?.id ?? '');
                                }
                                setSaved(fillText(t.isArchived, { name: recipe.name }));
                              })
                              .catch((caught: unknown) =>
                                setError(explainApiError(caught, setUser)),
                              );
                          }}
                        >
                          {common.archive}
                        </button>
                      ) : null}
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
      </div>
    </section>
  );

  function updateLine(key: string, patch: Partial<DraftLine>): void {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function fill(recipe: RecipeRecord): void {
    setEditingId(recipe.id);
    setCode(recipe.code);
    setName(recipe.name);
    setKind(recipe.kind);
    setPortions(recipe.portions);
    setWastagePercent(recipe.wastagePercent);
    setLines(
      recipe.lines.map((line) => ({
        key: `${line.itemId}-${recipe.id}`,
        itemId: line.itemId,
        quantity: line.quantityPerPortion,
      })),
    );
    setError('');
  }

  function clearForm(itemId: string): void {
    setCode('');
    setName('');
    setKind('MEAL');
    setPortions('1');
    setWastagePercent('0');
    setLines([blankLine(itemId)]);
  }
}

function blankLine(itemId: string): DraftLine {
  return { key: `${Date.now()}-${Math.random()}`, itemId, quantity: '' };
}
