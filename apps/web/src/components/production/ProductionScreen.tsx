'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { productionCopy } from '@knazawy/i18n';
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
import { FormDialog, KaramLoader } from '@knazawy/ui-shell';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { fill, useCopy, useCommon, useLabel } from '../../lib/i18n';
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
  const t = useCopy(productionCopy);
  const common = useCommon();
  const label = useLabel();

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

  if (!ready) return <KaramLoader label={t.loading} fullPage />;
  if (!user) {
    return (
      <p>
        <Link href="/login">{common.signIn}</Link> {t.signInSuffix}
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
          const unit = label(BASE_UNIT_LABELS[line.baseUnit]);
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
          <h1>{common.production}</h1>
          <p>{t.intro}</p>
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
            {t.newBatch}
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
            buttonLabel={t.newBatch}
            title={t.newBatch}
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
                        fill(t.recorded, {
                          number: batch.number,
                          portions: batch.actualPortions,
                          cost: batch.costPerPortion,
                        }),
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
                <Field label={t.recipe}>
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
                <Field label={t.cookedAt}>
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
                <Field label={t.cookedOn} hint={t.dateHint}>
                  <input
                    type="date"
                    value={producedOn}
                    onChange={(event) => setProducedOn(event.target.value)}
                    required
                  />
                </Field>
                {stockYield?.ok ? (
                  <p role="status">
                    {fill(t.canMake, { portions: stockYield.portions })}
                    {fill(stockYield.portions === '0' ? t.notEnoughForOne : t.limitedBy, {
                      items: stockYield.limitingIngredients.join(t.listSeparator),
                    })}
                  </p>
                ) : null}
                <Field label={t.plannedPortions}>
                  <input
                    inputMode="numeric"
                    value={plannedPortions}
                    onChange={(event) => setPlannedPortions(event.target.value)}
                    required
                  />
                </Field>
                <Field label={t.portionsMade} hint={t.portionsMadeHint}>
                  <input
                    inputMode="numeric"
                    value={actualPortions}
                    onChange={(event) => setActualPortions(event.target.value)}
                    required
                  />
                </Field>
                <Field label={t.note}>
                  <input
                    value={note}
                    maxLength={200}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={t.optional}
                  />
                </Field>
                {preview.length > 0 ? (
                  <div className="kz-table-wrap">
                    <table className="kz-table">
                      <thead>
                        <tr>
                          <th>{t.ingredient}</th>
                          <th>{t.needed}</th>
                          <th>{t.inThisLocation}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((row) => (
                          <tr key={row.itemId}>
                            <td>{row.itemName}</td>
                            <td>{row.needed}</td>
                            <td>
                              {row.available}
                              {row.short ? t.notEnoughSuffix : ''}
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
                  {saving ? t.recording : t.recordBatch}
                </button>
                {recipes.length === 0 ? <p>{t.approveFirst}</p> : null}
              </form>
            )}
          </FormDialog>
        ) : null}
        <div className="kz-panel kz-table-wrap">
          <h2>{t.batches}</h2>
          {batches.length === 0 ? <p className="kz-empty">{t.noBatches}</p> : null}
          <table className="kz-table">
            <thead>
              <tr>
                <th>{t.number}</th>
                <th>{t.recipe}</th>
                <th>{t.location}</th>
                <th>{t.cooked}</th>
                <th>{t.portions}</th>
                <th>{t.ingredientCost}</th>
                <th>{t.costPerPortion}</th>
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
                      ? fill(t.plannedSuffix, { count: batch.plannedPortions })
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
