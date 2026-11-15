'use client';

import type { RateCardInput } from '@knazawy/api-client';
import type { SessionUser } from '@knazawy/auth-client';
import { messages } from '@knazawy/i18n';
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
import { FormDialog } from '@knazawy/ui-shell';
import { useEffect, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { api, readSessionUser } from '../../lib/session';
import { Field } from '../master/Field';

interface PriceRow {
  unitPrice: string;
  minimumQuantity: string;
}

export function RateCardsScreen() {
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

  if (!ready) return <p>Loading rate cards</p>;
  if (!user) {
    return (
      <p>
        <a href="/login">{messages.en.common.signIn}</a> to see rate cards.
      </p>
    );
  }
  if (!can(user.role, 'service_rates', 'R')) {
    return <p>Rate cards are kept by finance.</p>;
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
          <h1>{messages.en.common.rateCards}</h1>
          <p>
            The price an airline pays for each meal and snack, for a range of dates. A request uses
            the card that covers its service date. The airline pays for at least the minimum
            portions.
          </p>
          <p lang="ur" dir="rtl">
            {messages.ur.common.rateCards}
          </p>
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
            New rate card
          </button>
        ) : null}
      </div>
      <div className="kz-workspace kz-workspace-single">
        {showForm ? (
          <FormDialog
            buttonLabel="New rate card"
            title={editingId ? 'Edit draft' : 'New rate card'}
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
                    (card) => `${card.number} is saved as a draft.`,
                  ).then((card) => {
                    if (card) {
                      resetForm();
                      close();
                    }
                  });
                }}
              >
                <Field label="Airline">
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
                <Field label="Applies from" hint="Shown as DD/MM/YYYY.">
                  <input
                    type="date"
                    value={validFrom}
                    onChange={(event) => setValidFrom(event.target.value)}
                    required
                  />
                </Field>
                <Field label="Applies until" hint="Leave empty if it has no end date yet.">
                  <input
                    type="date"
                    value={validTo}
                    onChange={(event) => setValidTo(event.target.value)}
                  />
                </Field>
                <Field label="Note">
                  <input
                    value={note}
                    maxLength={300}
                    placeholder="Optional"
                    onChange={(event) => setNote(event.target.value)}
                  />
                </Field>
                <div className="kz-table-wrap">
                  <table className="kz-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Price (PKR)</th>
                        <th>Minimum portions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipes.map((recipe) => (
                        <tr key={recipe.id}>
                          <td>
                            {recipe.name}
                            <span className="kz-help"> · {RECIPE_KIND_LABELS[recipe.kind]}</span>
                          </td>
                          <td>
                            <input
                              inputMode="decimal"
                              aria-label={`Price of ${recipe.name}`}
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
                              aria-label={`Minimum portions of ${recipe.name}`}
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
                {recipes.length === 0 ? <p>Approve a recipe before you price it.</p> : null}
                <p className="kz-help">Items left without a price are not on this card.</p>
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
                    {busy ? 'Saving' : 'Save draft'}
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
                      Stop editing
                    </button>
                  ) : null}
                </div>
                {airlines.length === 0 ? <p>Open an airline account first.</p> : null}
              </form>
            )}
          </FormDialog>
        ) : null}
        <div className="kz-stack">
          <div className="kz-panel kz-table-wrap">
            <h2>Cards</h2>
            {cards.length === 0 ? <p className="kz-empty">No rate cards yet.</p> : null}
            {cards.length > 0 ? (
              <table className="kz-table">
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Airline</th>
                    <th>Applies</th>
                    <th>Status</th>
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
                      <td>{periodLabel(card)}</td>
                      <td>
                        <span className="kz-status" data-tone={rateCardStatusTone(card.status)}>
                          {RATE_CARD_STATUS_LABELS[card.status]}
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
                  {RATE_CARD_STATUS_LABELS[selected.status]}
                </span>
                {' · '}
                {periodLabel(selected)}
                {selected.approvedByName ? ` · approved by ${selected.approvedByName}` : ''}
              </p>
              {selected.note ? <p>{selected.note}</p> : null}
              <div className="kz-table-wrap">
                <table className="kz-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Price</th>
                      <th>Minimum portions</th>
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
                      Edit draft
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
                          (card) => `${card.number} is approved.`,
                        )
                      }
                    >
                      Approve
                    </button>
                  ) : null}
                </div>
              ) : null}
              {selected.status === 'APPROVED' && canDecide ? (
                <div className="kz-actions">
                  <Field label="Last day it applies" hint="Days already past keep their prices.">
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
                        (card) => `${card.number} now ends on ${formatDisplayDate(endOn)}.`,
                      )
                    }
                  >
                    End card
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
    </section>
  );
}

function periodLabel(card: RateCardRecord): string {
  const from = formatDisplayDate(card.validFrom);
  return card.validTo
    ? `${from} to ${formatDisplayDate(card.validTo)}`
    : `From ${from}, no end date`;
}
