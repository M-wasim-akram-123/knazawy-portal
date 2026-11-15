'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { messages } from '@knazawy/i18n';
import {
  BASE_UNIT_LABELS,
  can,
  formatDisplayDate,
  recipeIngredientQuantity,
  recipeStockYield,
  todayInKarachi,
} from '@knazawy/shared';
import type {
  LocationRecord,
  ProductionRecord,
  RecipeRecord,
  StockOnHandRecord,
} from '@knazawy/shared';
import { FormDialog } from '@knazawy/ui-shell';
import { useEffect, useMemo, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { api, readSessionUser } from '../../lib/session';
import { Field } from '../master/Field';

export function ProductionScreen() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [recipes, setRecipes] = useState<RecipeRecord[]>([]);
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [stock, setStock] = useState<StockOnHandRecord[]>([]);
  const [batches, setBatches] = useState<ProductionRecord[]>([]);
  const [recipeId, setRecipeId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [producedOn, setProducedOn] = useState(todayInKarachi());
  const [plannedPortions, setPlannedPortions] = useState('');
  const [actualPortions, setActualPortions] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const session = readSessionUser();
    setUser(session);
    setReady(true);
    if (!session) return;
    void Promise.all([
      api.listRecipes(),
      api.listLocations(),
      api.listStock(),
      api.listProduction(),
    ])
      .then(([nextRecipes, nextLocations, nextStock, nextBatches]) => {
        const cookable = nextRecipes.filter(
          (recipe) => recipe.active && recipe.status === 'APPROVED',
        );
        const openLocations = nextLocations.filter((location) => location.active);
        setRecipes(cookable);
        setLocations(openLocations);
        setStock(nextStock);
        setBatches(nextBatches);
        setRecipeId(cookable[0]?.id ?? '');
        setLocationId(openLocations[0]?.id ?? '');
      })
      .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
  }, []);

  const onHand = useMemo(() => {
    const totals = new Map<string, string>();
    for (const row of stock) totals.set(`${row.itemId}:${row.locationId}`, row.quantityBase);
    return totals;
  }, [stock]);

  if (!ready) return <p>Loading production</p>;
  if (!user) {
    return (
      <p>
        <a href="/login">{messages.en.common.signIn}</a> to record production.
      </p>
    );
  }

  const canRecord = can(user.role, 'recipes', 'C');
  const recipe = recipes.find((row) => row.id === recipeId) ?? null;
  const stockYield =
    recipe && locationId
      ? recipeStockYield({
          wastagePercent: recipe.wastagePercent,
          lines: recipe.lines.map((line) => ({
            itemName: line.itemName,
            quantityPerPortion: line.quantityPerPortion,
            available: onHand.get(`${line.itemId}:${locationId}`) ?? '0',
          })),
        })
      : null;
  const preview =
    recipe && actualPortions.trim() !== ''
      ? recipe.lines.map((line) => {
          const batch = recipeIngredientQuantity({
            quantityPerPortion: line.quantityPerPortion,
            portions: actualPortions.trim(),
            wastagePercent: recipe.wastagePercent,
          });
          const unit = BASE_UNIT_LABELS[line.baseUnit];
          const available = onHand.get(`${line.itemId}:${locationId}`) ?? '0';
          const short = batch.ok ? Number(available) < Number(batch.batch) : false;
          return {
            itemId: line.itemId,
            itemName: line.itemName,
            unit,
            needed: batch.ok ? `${batch.batch} ${unit}` : '—',
            available: `${available} ${unit}`,
            short,
          };
        })
      : [];

  return (
    <section className="kz-stack">
      <div className="kz-page-head kz-page-action-head">
        <div>
          <h1>{messages.en.common.production}</h1>
          <p>
            Record a batch when it is cooked. Its ingredients leave stock straight away, oldest cost
            first, and the batch shows what each portion cost.
          </p>
          <p lang="ur" dir="rtl">
            {messages.ur.common.production}
          </p>
        </div>
        {canRecord ? (
          <button
            className="kz-button kz-form-dialog-trigger"
            type="button"
            aria-haspopup="dialog"
            onClick={() => {
              setError('');
              setDialogOpen(true);
            }}
          >
            New batch
          </button>
        ) : null}
      </div>
      {error && !dialogOpen ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? <p role="status">{saved}</p> : null}
      <div className="kz-workspace kz-workspace-single">
        {canRecord ? (
          <FormDialog
            buttonLabel="New batch"
            title="New batch"
            showTrigger={false}
            isOpen={dialogOpen}
            onOpenChange={setDialogOpen}
          >
            {({ close }) => (
              <form
                className="kz-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  setError('');
                  setSaved('');
                  setSaving(true);
                  void api
                    .createProduction({
                      recipeId,
                      locationId,
                      producedOn,
                      plannedPortions: plannedPortions.trim(),
                      actualPortions: actualPortions.trim(),
                      note: note.trim() || undefined,
                    })
                    .then(async (batch) => {
                      setBatches((current) => [batch, ...current]);
                      setSaved(
                        `${batch.number} is recorded: ${batch.actualPortions} portions at ${batch.costPerPortion} PKR each.`,
                      );
                      setPlannedPortions('');
                      setActualPortions('');
                      setNote('');
                      setStock(await api.listStock());
                      close();
                    })
                    .catch((caught: unknown) => setError(explainApiError(caught, setUser)))
                    .finally(() => setSaving(false));
                }}
              >
                <Field label="Recipe">
                  <select
                    value={recipeId}
                    onChange={(event) => setRecipeId(event.target.value)}
                    required
                  >
                    {recipes.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Cooked at">
                  <select
                    value={locationId}
                    onChange={(event) => setLocationId(event.target.value)}
                    required
                  >
                    {locations.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Cooked on" hint="Shown as DD/MM/YYYY.">
                  <input
                    type="date"
                    value={producedOn}
                    onChange={(event) => setProducedOn(event.target.value)}
                    required
                  />
                </Field>
                {stockYield?.ok ? (
                  <p role="status">
                    Current stock at this location can make up to {stockYield.portions} portions.
                    {stockYield.portions === '0'
                      ? ` Not enough ${stockYield.limitingIngredients.join(', ')} for one portion.`
                      : ` Limited by ${stockYield.limitingIngredients.join(', ')}.`}
                  </p>
                ) : null}
                <Field label="Planned portions">
                  <input
                    inputMode="numeric"
                    value={plannedPortions}
                    onChange={(event) => setPlannedPortions(event.target.value)}
                    required
                  />
                </Field>
                <Field label="Portions made" hint="Ingredients are taken for these portions.">
                  <input
                    inputMode="numeric"
                    value={actualPortions}
                    onChange={(event) => setActualPortions(event.target.value)}
                    required
                  />
                </Field>
                <Field label="Note">
                  <input
                    value={note}
                    maxLength={200}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Optional"
                  />
                </Field>
                {preview.length > 0 ? (
                  <div className="kz-table-wrap">
                    <table className="kz-table">
                      <thead>
                        <tr>
                          <th>Ingredient</th>
                          <th>Needed</th>
                          <th>In this location</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((row) => (
                          <tr key={row.itemId}>
                            <td>{row.itemName}</td>
                            <td>{row.needed}</td>
                            <td>
                              {row.available}
                              {row.short ? ' · not enough' : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                {error ? (
                  <p className="kz-error" role="alert">
                    {error}
                  </p>
                ) : null}
                <button
                  className="kz-button"
                  type="submit"
                  disabled={saving || recipes.length === 0 || locations.length === 0}
                >
                  {saving ? 'Recording' : 'Record batch'}
                </button>
                {recipes.length === 0 ? <p>Approve a recipe before you cook it.</p> : null}
              </form>
            )}
          </FormDialog>
        ) : null}
        <div className="kz-panel kz-table-wrap">
          <h2>Batches</h2>
          {batches.length === 0 ? <p className="kz-empty">No batches yet.</p> : null}
          <table className="kz-table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Recipe</th>
                <th>Location</th>
                <th>Cooked</th>
                <th>Portions</th>
                <th>Ingredient cost</th>
                <th>Cost per portion</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id}>
                  <td>{batch.number}</td>
                  <td>{batch.recipeName}</td>
                  <td>{batch.locationName}</td>
                  <td>{formatDisplayDate(batch.producedOn)}</td>
                  <td>
                    {batch.actualPortions}
                    {batch.actualPortions !== batch.plannedPortions
                      ? ` (planned ${batch.plannedPortions})`
                      : ''}
                  </td>
                  <td>{batch.totalCost} PKR</td>
                  <td>{batch.costPerPortion} PKR</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
