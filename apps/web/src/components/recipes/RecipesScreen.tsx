'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { messages } from '@knazawy/i18n';
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
import { useEffect, useState } from 'react';

import { explainApiError } from '../../lib/explain';
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

  if (!ready) return <p>Loading recipes</p>;
  if (!user) {
    return (
      <p>
        <a href="/login">{messages.en.common.signIn}</a> to see recipes.
      </p>
    );
  }

  const canWrite = can(user.role, 'recipes', 'C') || can(user.role, 'recipes', 'U');
  const canApprove = can(user.role, 'recipes', 'A');
  const editing = recipes.find((recipe) => recipe.id === editingId) ?? null;
  const itemById = new Map(items.map((item) => [item.id, item]));

  return (
    <section className="kz-stack">
      <div className="kz-page-head">
        <h1>{messages.en.common.recipes}</h1>
        <p>
          A recipe is a meal or a snack. Each ingredient is the amount for one portion. The batch
          adds the wastage on top. Changing an approved recipe sends it back for approval.
        </p>
        <p lang="ur" dir="rtl">
          {messages.ur.common.recipes}
        </p>
      </div>
      <div className="kz-workspace">
        {canWrite ? (
          <form
            className="kz-panel kz-form"
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
                    [...current.filter((row) => row.id !== recipe.id), recipe].sort((left, right) =>
                      left.name.localeCompare(right.name),
                    ),
                  );
                  if (editing) {
                    fill(recipe);
                    setSaved(
                      recipe.status === 'DRAFT'
                        ? `${recipe.name} is a draft again.`
                        : `${recipe.name} is saved.`,
                    );
                  } else {
                    clearForm(items[0]?.id ?? '');
                    setSaved(`${recipe.name} is saved as a draft.`);
                  }
                })
                .catch((caught: unknown) => setError(explainApiError(caught, setUser)))
                .finally(() => setSaving(false));
            }}
          >
            <h2>{editing ? `Change ${editing.name}` : 'New recipe'}</h2>
            {editing ? (
              <p>
                <span className="kz-status" data-tone={recipeStatusTone(editing.status)}>
                  {RECIPE_STATUS_LABELS[editing.status]}
                </span>
              </p>
            ) : null}
            <Field label="Code">
              <input value={code} onChange={(event) => setCode(event.target.value)} required />
            </Field>
            <Field label="Name">
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </Field>
            <Field label="Kind">
              <select value={kind} onChange={(event) => setKind(event.target.value as RecipeKind)}>
                {RECIPE_KINDS.map((option) => (
                  <option key={option} value={option}>
                    {RECIPE_KIND_LABELS[option]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Portions" hint="How many portions this recipe makes.">
              <input
                inputMode="decimal"
                value={portions}
                onChange={(event) => setPortions(event.target.value)}
                required
              />
            </Field>
            <Field label="Wastage %" hint="Extra ingredients allowed, as a percent.">
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
                    <th>Ingredient</th>
                    <th>Per portion</th>
                    <th>For the batch</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => {
                    const item = itemById.get(line.itemId);
                    const unit = item ? BASE_UNIT_LABELS[item.baseUnit] : '';
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
                            onChange={(event) => updateLine(line.key, { itemId: event.target.value })}
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
                            placeholder={unit ? `in ${unit}` : ''}
                            onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
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
                                setLines((current) => current.filter((entry) => entry.key !== line.key))
                              }
                            >
                              Remove
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
              Add an ingredient
            </button>
            {error ? (
              <p className="kz-error" role="alert">
                {error}
              </p>
            ) : null}
            {saved ? <p>{saved}</p> : null}
            <button className="kz-button" type="submit" disabled={saving || items.length === 0}>
              {saving ? 'Saving' : 'Save recipe'}
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
                }}
              >
                New recipe
              </button>
            ) : null}
          </form>
        ) : null}
        <div className="kz-panel kz-table-wrap">
          <h2>Recipes</h2>
          {!canWrite && error ? (
            <p className="kz-error" role="alert">
              {error}
            </p>
          ) : null}
          {!canWrite && saved ? <p>{saved}</p> : null}
          {recipes.length === 0 ? <p className="kz-empty">No recipes yet.</p> : null}
          <table className="kz-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Kind</th>
                <th>Portions</th>
                <th>Status</th>
                <th>Ingredients</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recipes.map((recipe) => (
                <tr key={recipe.id}>
                  <td>{recipe.code}</td>
                  <td>{recipe.name}</td>
                  <td>{RECIPE_KIND_LABELS[recipe.kind]}</td>
                  <td>{recipe.portions}</td>
                  <td>
                    <span className="kz-status" data-tone={recipeStatusTone(recipe.status)}>
                      {RECIPE_STATUS_LABELS[recipe.status]}
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
                        const unit = BASE_UNIT_LABELS[line.baseUnit];
                        return batch.ok
                          ? `${line.itemName}: ${line.quantityPerPortion} ${unit} (${batch.batch} ${unit} for the batch)`
                          : line.itemName;
                      })
                      .join('; ')}
                  </td>
                  <td>
                    {canWrite ? (
                      <button type="button" className="kz-button-quiet" onClick={() => fill(recipe)}>
                        Open
                      </button>
                    ) : null}{' '}
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
                              setSaved(`${next.name} is approved.`);
                            })
                            .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
                        }}
                      >
                        Approve
                      </button>
                    ) : null}{' '}
                    {can(user.role, 'recipes', 'U') ? (
                      <button
                        type="button"
                        className="kz-button-quiet"
                        onClick={() => {
                          setError('');
                          void api
                            .updateRecipe(recipe.id, { active: false })
                            .then(() => {
                              setRecipes((current) => current.filter((row) => row.id !== recipe.id));
                              if (editingId === recipe.id) {
                                setEditingId(null);
                                clearForm(items[0]?.id ?? '');
                              }
                              setSaved(`${recipe.name} is archived.`);
                            })
                            .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
                        }}
                      >
                        {messages.en.common.archive}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
