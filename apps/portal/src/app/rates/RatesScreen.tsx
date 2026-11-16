'use client';

import { messages } from '@knazawy/i18n';
import {
  RECIPE_KIND_LABELS,
  formatDisplayDate,
  rateCardCovers,
  todayInKarachi,
  type RateCardRecord,
} from '@knazawy/shared';
import { useEffect, useState } from 'react';

import { ApiError, api, clearSession } from '../../lib/session';

export function RatesScreen() {
  const [cards, setCards] = useState<RateCardRecord[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void api
      .listRateCards()
      .then(setCards)
      .catch((caught: unknown) => {
        if (caught instanceof ApiError && caught.status === 401) {
          clearSession();
          window.location.assign('/login');
          return;
        }
        setError(caught instanceof Error ? caught.message : 'Rates could not load.');
      });
  }, []);

  const today = todayInKarachi();

  return (
    <section className="kz-stack">
      <div className="kz-page-head">
        <h1>{messages.en.common.rateCards}</h1>
        <p>
          The prices Karam has agreed with your airline. A request is charged on the card that
          covers its service date, for at least the minimum portions.
        </p>
        <p lang="ur" dir="rtl">
          {messages.ur.common.rateCards}
        </p>
      </div>
      {error ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      {cards === null && !error ? <p>Loading</p> : null}
      {cards !== null && cards.length === 0 ? (
        <p className="kz-empty">Karam has not agreed a rate card with your airline yet.</p>
      ) : null}
      {cards?.map((card) => (
        <article key={card.id} className="kz-panel kz-stack">
          <h2>
            {card.number}
            {rateCardCovers(card, today) ? (
              <span className="kz-status" data-tone="done">
                {' '}
                · Applies today
              </span>
            ) : null}
          </h2>
          <p className="kz-help">
            {card.validTo
              ? `${formatDisplayDate(card.validFrom)} to ${formatDisplayDate(card.validTo)}`
              : `From ${formatDisplayDate(card.validFrom)}, no end date`}
          </p>
          <div className="kz-table-wrap">
            <table className="kz-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Type</th>
                  <th>Price</th>
                  <th>Minimum portions</th>
                </tr>
              </thead>
              <tbody>
                {card.lines.map((line) => (
                  <tr key={line.recipeId}>
                    <td>{line.recipeName}</td>
                    <td>{RECIPE_KIND_LABELS[line.kind]}</td>
                    <td>{line.unitPrice} PKR</td>
                    <td>{line.minimumQuantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ))}
    </section>
  );
}
