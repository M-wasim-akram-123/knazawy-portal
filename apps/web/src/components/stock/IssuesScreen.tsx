'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { messages } from '@knazawy/i18n';
import {
  BASE_UNIT_LABELS,
  STOCK_ISSUE_REASON_LABELS,
  can,
  formatDisplayDate,
  todayInKarachi,
} from '@knazawy/shared';
import type {
  ItemRecord,
  LocationRecord,
  StockIssueReason,
  StockIssueRecord,
  StockOnHandRecord,
} from '@knazawy/shared';
import { FormDialog } from '@knazawy/ui-shell';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { api, readSessionUser } from '../../lib/session';
import { Field } from '../master/Field';

interface DraftLine {
  key: string;
  itemId: string;
  quantity: string;
}

const REASONS = Object.keys(STOCK_ISSUE_REASON_LABELS) as StockIssueReason[];

export function IssuesScreen() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [stock, setStock] = useState<StockOnHandRecord[]>([]);
  const [issues, setIssues] = useState<StockIssueRecord[]>([]);
  const [locationId, setLocationId] = useState('');
  const [issuedOn, setIssuedOn] = useState(todayInKarachi());
  const [reason, setReason] = useState<StockIssueReason>('KITCHEN_USE');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
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
    void Promise.all([api.listItems(), api.listLocations(), api.listStock(), api.listIssues()])
      .then(([nextItems, nextLocations, nextStock, nextIssues]) => {
        const openItems = nextItems.filter((item) => item.active);
        const openLocations = nextLocations.filter((location) => location.active);
        setItems(openItems);
        setLocations(openLocations);
        setStock(nextStock);
        setIssues(nextIssues);
        setLocationId(openLocations[0]?.id ?? '');
        setLines([blankLine(openItems[0]?.id ?? '')]);
      })
      .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
  }, []);

  const onHand = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of stock) {
      const key = `${row.itemId}:${row.locationId}`;
      totals.set(key, (totals.get(key) ?? 0) + Number(row.quantityBase));
    }
    return totals;
  }, [stock]);

  if (!ready) return <p>Loading stock</p>;
  if (!user) {
    return (
      <p>
        <Link href="/login">{messages.en.common.signIn}</Link> to issue stock.
      </p>
    );
  }

  const canIssue = can(user.role, 'stock', 'C');
  const itemById = new Map(items.map((item) => [item.id, item]));

  return (
    <section className="kz-stack">
      <div className="kz-page-head kz-page-action-head">
        <div>
          <h1>{messages.en.common.issueStock}</h1>
          <p>
            Take goods out of a location. The oldest stock goes first, so each issue carries the
            true cost.
          </p>
          <p lang="ur" dir="rtl">
            {messages.ur.common.issueStock}
          </p>
        </div>
        {canIssue ? (
          <button
            className="kz-button kz-form-dialog-trigger"
            type="button"
            aria-haspopup="dialog"
            onClick={() => {
              setError('');
              setDialogOpen(true);
            }}
          >
            New issue
          </button>
        ) : null}
      </div>
      {!canIssue ? <p>You cannot issue stock.</p> : null}
      {canIssue ? (
        <>
          {error && !dialogOpen ? (
            <p className="kz-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="kz-workspace kz-workspace-single">
            <FormDialog
              buttonLabel="New issue"
              title="New issue"
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
                      .createIssue({
                        locationId,
                        issuedOn,
                        reason,
                        note: note.trim() || undefined,
                        lines: lines.map((line) => ({
                          itemId: line.itemId,
                          quantity: line.quantity,
                        })),
                      })
                      .then((issue) => {
                        setIssues((current) => [issue, ...current]);
                        setSaved(`${issue.number} is posted. Stock is down.`);
                        setLines([blankLine(items[0]?.id ?? '')]);
                        setNote('');
                        return api.listStock().then((nextStock) => {
                          setStock(nextStock);
                          close();
                        });
                      })
                      .catch((caught: unknown) => setError(explainApiError(caught, setUser)))
                      .finally(() => setSaving(false));
                  }}
                >
                  <Field label="From location">
                    <select
                      value={locationId}
                      onChange={(event) => setLocationId(event.target.value)}
                      required
                    >
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Issue date" hint="Shown as DD/MM/YYYY.">
                    <input
                      type="date"
                      value={issuedOn}
                      onChange={(event) => setIssuedOn(event.target.value)}
                      required
                    />
                  </Field>
                  <Field label="Reason">
                    <select
                      value={reason}
                      onChange={(event) => setReason(event.target.value as StockIssueReason)}
                    >
                      {REASONS.map((value) => (
                        <option key={value} value={value}>
                          {STOCK_ISSUE_REASON_LABELS[value]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Note" hint="Optional. Who asked for it, or what happened.">
                    <input
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      maxLength={200}
                    />
                  </Field>
                  <div className="kz-table-wrap">
                    <table className="kz-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Quantity</th>
                          <th>On hand</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line) => {
                          const item = itemById.get(line.itemId);
                          const unit = item ? BASE_UNIT_LABELS[item.baseUnit] : '';
                          const available = item
                            ? (onHand.get(`${item.id}:${locationId}`) ?? 0)
                            : 0;
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
                                  onChange={(event) =>
                                    updateLine(line.key, { quantity: event.target.value })
                                  }
                                  placeholder={unit ? `in ${unit}` : ''}
                                  required
                                />
                              </td>
                              <td>{item ? `${available} ${unit}` : '—'}</td>
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
                    onClick={() =>
                      setLines((current) => [...current, blankLine(items[0]?.id ?? '')])
                    }
                  >
                    Add a line
                  </button>
                  {error ? (
                    <p className="kz-error" role="alert">
                      {error}
                    </p>
                  ) : null}
                  <button
                    className="kz-button"
                    type="submit"
                    disabled={saving || lines.length === 0 || !locationId}
                  >
                    {saving ? 'Issuing' : 'Issue stock'}
                  </button>
                </form>
              )}
            </FormDialog>
            {saved ? <p role="status">{saved}</p> : null}
            <div className="kz-panel kz-table-wrap">
              <h2>Issues</h2>
              {issues.length === 0 ? (
                <p className="kz-empty">Nothing has been issued yet.</p>
              ) : null}
              <table className="kz-table">
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Location</th>
                    <th>Date</th>
                    <th>Reason</th>
                    <th>Lines</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map((issue) => (
                    <tr key={issue.id}>
                      <td>{issue.number}</td>
                      <td>{issue.locationName}</td>
                      <td>{formatDisplayDate(issue.issuedOn)}</td>
                      <td>{STOCK_ISSUE_REASON_LABELS[issue.reason]}</td>
                      <td>
                        {issue.lines
                          .map(
                            (line) =>
                              `${line.itemName}: ${line.quantityBase} ${BASE_UNIT_LABELS[line.baseUnit]} (${line.cost} PKR)`,
                          )
                          .join('; ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );

  function updateLine(key: string, patch: Partial<DraftLine>): void {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }
}

function blankLine(itemId = ''): DraftLine {
  return { key: `${Date.now()}-${Math.random()}`, itemId, quantity: '' };
}
