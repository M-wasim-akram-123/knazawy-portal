'use client';

import type { RateCardInput } from '@knazawy/api-client';
import type { SessionUser } from '@knazawy/auth-client';
import { ratesCopy } from '@knazawy/i18n';
import {
  RATE_CARD_STATUS_LABELS,
  RECIPE_KIND_LABELS,
  can,
  formatDisplayDate,
  rateCardStatusTone,
  todayInKarachi,
  type AirlineOption,
  type RateCardRecord,
  type RecipeRecord,
} from '@knazawy/shared';
import { FormDialog, KaramLoader } from '@knazawy/ui-shell';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { fill, useCommon, useCopy, useLabel } from '../../lib/i18n';
import { api, readSessionUser } from '../../lib/session';
import { Field } from '../master/Field';

import { AirlineTermsPanel } from './AirlineTermsPanel';

interface PriceRow {
  unitPrice: string;
  minimumQuantity: string;
}

export function RateCardsScreen() {
  const t = useCopy(ratesCopy);
  const common = useCommon();
  const label = useLabel();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [airlines, setAirlines] = useState<AirlineOption[]>([]);
  const [recipes, setRecipes] = useState<RecipeRecord[]>([]);
  const [cards, setCards] = useState<RateCardRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [airlineId, setAirlineId] = useState('');
  const [validFrom, setValidFrom] = useState(todayInKarachi());
  const [validTo, setValidTo] = useState('');
  const [note, setNote] = useState('');
  const [prices, setPrices] = useState<Record<string, PriceRow>>({});
  const [endOn, setEndOn] = useState(todayInKarachi());
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const session = readSessionUser();
    setUser(session);
    setReady(true);
    if (!session) return;
    void Promise.all([api.listRateCardAirlines(), api.listRecipes(), api.listRateCards()])
      .then(([nextAirlines, nextRecipes, nextCards]) => {
        setAirlines(nextAirlines);
        setAirlineId(nextAirlines[0]?.id ?? '');
        setRecipes(nextRecipes.filter((recipe) => recipe.active && recipe.status === 'APPROVED'));
        setCards(nextCards);
        setSelectedId(nextCards[0]?.id ?? null);
      })
      .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
  }, []);

  if (!ready) return <KaramLoader label={t.loading} fullPage />;
  if (!user) {
    return (
      <p>
        <Link href="/login">{common.signIn}</Link> {t.signInToSee}
      </p>
    );
  }
  if (!can(user.role, 'service_rates', 'R')) {
    return <p>{t.financeOnly}</p>;
  }

  const canCreate = can(user.role, 'service_rates', 'C');
  const canEdit = can(user.role, 'service_rates', 'U');
  const canDecide = can(user.role, 'service_rates', 'A');
  const showForm = canCreate || (canEdit && editingId !== null);
  const selected = cards.find((card) => card.id === selectedId) ?? null;

  function resetForm() {
    setEditingId(null);
    setValidFrom(todayInKarachi());
    setValidTo('');
    setNote('');
    setPrices({});
  }

  function openDraft(card: RateCardRecord) {
    setError('');
    setSaved('');
    setEditingId(card.id);
    setAirlineId(card.airlineId);
    setValidFrom(card.validFrom);
    setValidTo(card.validTo ?? '');
    setNote(card.note ?? '');
    setPrices(
      Object.fromEntries(
        card.lines.map((line) => [
          line.recipeId,
          { unitPrice: line.unitPrice, minimumQuantity: String(line.minimumQuantity) },
        ]),
      ),
    );
  }

  function replaceCard(card: RateCardRecord) {
    setCards((current) => {
      const exists = current.some((row) => row.id === card.id);
      return exists ? current.map((row) => (row.id === card.id ? card : row)) : [card, ...current];
    });
    setSelectedId(card.id);
  }

  async function run(
    action: () => Promise<RateCardRecord>,
    message: (card: RateCardRecord) => string,
  ) {
    setBusy(true);
    setError('');
    setSaved('');
    try {
      const card = await action();
      replaceCard(card);
      setSaved(message(card));
      return card;
    } catch (caught: unknown) {
      setError(explainApiError(caught, setUser));
      return null;
    } finally {
      setBusy(false);
    }
  }

  function toInput(): RateCardInput {
    return {
      airlineId,
      validFrom,
      validTo: validTo || undefined,
      note: note.trim() || undefined,
      lines: Object.entries(prices)
        .filter(([, row]) => row.unitPrice.trim() !== '')
        .map(([recipeId, row]) => ({
          recipeId,
          unitPrice: row.unitPrice.trim(),
          minimumQuantity: Number(row.minimumQuantity.trim() || '0'),
        })),
    };
  }

  function setPrice(recipeId: string, change: Partial<PriceRow>) {
    setPrices((current) => ({
      ...current,
      [recipeId]: {
        unitPrice: change.unitPrice ?? current[recipeId]?.unitPrice ?? '',
        minimumQuantity: change.minimumQuantity ?? current[recipeId]?.minimumQuantity ?? '',
      },
    }));
  }

  return (
    <section className="kz-stack">
      <div className="kz-page-head kz-page-action-head">
        <div>
          <h1>{common.rateCards}</h1>
          <p>{t.intro}</p>
        </div>
        {canCreate ? (
          <button
            className="kz-button kz-form-dialog-trigger"
            type="button"
            aria-haspopup="dialog"
            onClick={() => {
              resetForm();
              setError('');
              setSaved('');
              setDialogOpen(true);
            }}
          >
            {t.newRateCard}
          </button>
        ) : null}
      </div>
      <div className="kz-workspace kz-workspace-single">
        {showForm ? (
          <FormDialog
            buttonLabel={t.newRateCard}
            title={editingId ? t.editDraft : t.newRateCard}
            showTrigger={false}
            isOpen={dialogOpen}
            onOpenChange={setDialogOpen}
          >
            {({ close }) => (
              <form
                className="kz-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const input = toInput();
                  void run(
                    () =>
                      editingId ? api.updateRateCard(editingId, input) : api.createRateCard(input),
                    (card) => fill(t.savedAsDraft, { number: card.number }),
                  ).then((card) => {
                    if (card) {
                      resetForm();
                      close();
                    }
                  });
                }}
              >
                <Field label={t.airline}>
                  <select
                    value={airlineId}
                    onChange={(event) => setAirlineId(event.target.value)}
                    required
                  >
                    {airlines.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name} ({option.code})
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t.appliesFrom} hint={t.appliesFromHint}>
                  <input
                    type="date"
                    value={validFrom}
                    onChange={(event) => setValidFrom(event.target.value)}
                    required
                  />
                </Field>
                <Field label={t.appliesUntil} hint={t.appliesUntilHint}>
                  <input
                    type="date"
                    value={validTo}
                    onChange={(event) => setValidTo(event.target.value)}
                  />
                </Field>
                <Field label={t.note}>
                  <input
                    value={note}
                    maxLength={300}
                    placeholder={t.optional}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </Field>
                <div className="kz-table-wrap">
                  <table className="kz-table">
                    <thead>
                      <tr>
                        <th>{t.item}</th>
                        <th>{t.pricePkr}</th>
                        <th>{t.minimumPortions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipes.map((recipe) => (
                        <tr key={recipe.id}>
                          <td>
                            {recipe.name}
                            <span className="kz-help">
                              {' '}
                              · {label(RECIPE_KIND_LABELS[recipe.kind])}
                            </span>
                          </td>
                          <td>
                            <input
                              inputMode="decimal"
                              aria-label={fill(t.priceOf, { name: recipe.name })}
                              value={prices[recipe.id]?.unitPrice ?? ''}
                              onChange={(event) =>
                                setPrice(recipe.id, { unitPrice: event.target.value })
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              step={1}
                              inputMode="numeric"
                              aria-label={fill(t.minimumOf, { name: recipe.name })}
                              value={prices[recipe.id]?.minimumQuantity ?? ''}
                              onChange={(event) =>
                                setPrice(recipe.id, { minimumQuantity: event.target.value })
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {recipes.length === 0 ? <p>{t.approveRecipeFirst}</p> : null}
                <p className="kz-help">{t.unpricedNotOnCard}</p>
                {error ? (
                  <p className="kz-error" role="alert">
                    {error}
                  </p>
                ) : null}
                <div className="kz-actions">
                  <button
                    className="kz-button"
                    type="submit"
                    disabled={busy || airlines.length === 0 || recipes.length === 0}
                  >
                    {busy ? t.saving : t.saveDraft}
                  </button>
                  {editingId ? (
                    <button
                      type="button"
                      className="kz-button-quiet"
                      onClick={() => {
                        resetForm();
                        setDialogOpen(false);
                      }}
                    >
                      {t.stopEditing}
                    </button>
                  ) : null}
                </div>
                {airlines.length === 0 ? <p>{t.openAirlineFirst}</p> : null}
              </form>
            )}
          </FormDialog>
        ) : null}
        <div className="kz-stack">
          <div className="kz-panel kz-table-wrap">
            <h2>{t.cards}</h2>
            {cards.length === 0 ? <p className="kz-empty">{t.noCards}</p> : null}
            {cards.length > 0 ? (
              <table className="kz-table">
                <thead>
                  <tr>
                    <th>{t.number}</th>
                    <th>{t.airline}</th>
                    <th>{t.applies}</th>
                    <th>{t.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {cards.map((card) => (
                    <tr key={card.id}>
                      <td>
                        <a
                          href={`#${card.id}`}
                          aria-current={card.id === selectedId ? 'true' : undefined}
                          onClick={(event) => {
                            event.preventDefault();
                            setSelectedId(card.id);
                          }}
                        >
                          {card.number}
                        </a>
                      </td>
                      <td>{card.airlineName}</td>
                      <td>{periodLabel(card, t)}</td>
                      <td>
                        <span className="kz-status" data-tone={rateCardStatusTone(card.status)}>
                          {label(RATE_CARD_STATUS_LABELS[card.status])}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
          {selected ? (
            <div className="kz-panel kz-stack">
              <h2>
                {selected.number} · {selected.airlineName}
              </h2>
              <p>
                <span className="kz-status" data-tone={rateCardStatusTone(selected.status)}>
                  {label(RATE_CARD_STATUS_LABELS[selected.status])}
                </span>
                {' · '}
                {periodLabel(selected, t)}
                {selected.approvedByName
                  ? ` · ${fill(t.approvedBy, { name: selected.approvedByName })}`
                  : ''}
              </p>
              {selected.note ? <p>{selected.note}</p> : null}
              <div className="kz-table-wrap">
                <table className="kz-table">
                  <thead>
                    <tr>
                      <th>{t.item}</th>
                      <th>{t.price}</th>
                      <th>{t.minimumPortions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.lines.map((line) => (
                      <tr key={line.recipeId}>
                        <td>{line.recipeName}</td>
                        <td>{line.unitPrice} PKR</td>
                        <td>{line.minimumQuantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selected.status === 'DRAFT' ? (
                <div className="kz-actions">
                  {canEdit ? (
                    <button
                      type="button"
                      className="kz-button-quiet"
                      onClick={() => {
                        openDraft(selected);
                        setDialogOpen(true);
                      }}
                    >
                      {t.editDraft}
                    </button>
                  ) : null}
                  {canDecide ? (
                    <button
                      type="button"
                      className="kz-button"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () => api.approveRateCard(selected.id),
                          (card) => fill(t.approved, { number: card.number }),
                        )
                      }
                    >
                      {t.approve}
                    </button>
                  ) : null}
                </div>
              ) : null}
              {selected.status === 'APPROVED' && canDecide ? (
                <div className="kz-actions">
                  <Field label={t.lastDay} hint={t.lastDayHint}>
                    <input
                      type="date"
                      value={endOn}
                      min={todayInKarachi()}
                      onChange={(event) => setEndOn(event.target.value)}
                    />
                  </Field>
                  <button
                    type="button"
                    className="kz-button-quiet"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => api.endRateCard(selected.id, endOn),
                        (card) =>
                          fill(t.endsOn, { number: card.number, date: formatDisplayDate(endOn) }),
                      )
                    }
                  >
                    {t.endCard}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          {error ? (
            <p className="kz-error" role="alert">
              {error}
            </p>
          ) : null}
          {saved ? <p>{saved}</p> : null}
        </div>
      </div>
      <AirlineTermsPanel role={user.role} setUser={setUser} />
    </section>
  );
}

function periodLabel(card: RateCardRecord, t: { periodRange: string; periodOpen: string }): string {
  const from = formatDisplayDate(card.validFrom);
  return card.validTo
    ? fill(t.periodRange, { from, to: formatDisplayDate(card.validTo) })
    : fill(t.periodOpen, { from });
}
