'use client';

import { ApiError } from '@knazawy/api-client';
import type { SessionUser } from '@knazawy/auth-client';
import { messages } from '@knazawy/i18n';
import {
  BASE_UNIT_LABELS,
  BASE_UNITS,
  STORAGE_TYPE_LABELS,
  STORAGE_TYPES,
  can,
} from '@knazawy/shared';
import type { ItemRecord, SupplierRecord } from '@knazawy/shared';
import { useEffect, useState } from 'react';

import { api, clearSession, readSessionUser } from '../../lib/session';

import { Field } from './Field';

const empty: {
  code: string;
  name: string;
  category: string;
  baseUnit: (typeof BASE_UNITS)[number];
  purchaseUnit: string;
  conversionToBase: string;
  reorderLevel: string;
  shelfLifeDays: string;
  storageType: (typeof STORAGE_TYPES)[number];
  supplierIds: string[];
} = {
  code: '',
  name: '',
  category: '',
  baseUnit: BASE_UNITS[0],
  purchaseUnit: '',
  conversionToBase: '',
  reorderLevel: '0',
  shelfLifeDays: '0',
  storageType: STORAGE_TYPES[0],
  supplierIds: [],
};

export function ItemsScreen() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  async function reload(): Promise<void> {
    const [nextItems, nextSuppliers] = await Promise.all([
      api.listItems(),
      api.listSuppliers().catch(() => [] as SupplierRecord[]),
    ]);
    setItems(nextItems);
    setSuppliers(nextSuppliers);
  }

  useEffect(() => {
    const session = readSessionUser();
    setUser(session);
    setReady(true);
    if (!session) return;
    void reload().catch((caught: unknown) => setError(explain(caught, setUser)));
  }, []);

  if (!ready) return <p>Loading items</p>;
  if (!user) {
    return (
      <p>
        <a href="/login">{messages.en.common.signIn}</a> to see items.
      </p>
    );
  }

  const canCreate = can(user.role, 'stock', 'C');
  const canArchive = can(user.role, 'stock', 'U');

  return (
    <section className="kz-stack">
      <div className="kz-page-head">
        <h1>{messages.en.common.items}</h1>
        <p>Codes, units, and where each item is kept.</p>
      </div>
      <div className="kz-workspace">
      {canCreate ? (
        <form
          className="kz-panel kz-form kz-form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            setError('');
            void api
              .createItem({
                ...form,
                shelfLifeDays: Number(form.shelfLifeDays),
              })
              .then(() => {
                setForm(empty);
                return reload();
              })
              .catch((caught: unknown) => setError(explain(caught, setUser)));
          }}
        >
          <h2 className="kz-span-2">New item</h2>
          <Field label="Code">
            <input
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.target.value })}
              required
            />
          </Field>
          <Field label="Name">
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
          </Field>
          <Field label="Category">
            <input
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
              required
            />
          </Field>
          <Field label="Base unit">
            <select
              value={form.baseUnit}
              onChange={(event) =>
                setForm({ ...form, baseUnit: event.target.value as (typeof BASE_UNITS)[number] })
              }
            >
              {BASE_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {BASE_UNIT_LABELS[unit]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Purchase unit" hint="For example bag, bori, or crate.">
            <input
              value={form.purchaseUnit}
              onChange={(event) => setForm({ ...form, purchaseUnit: event.target.value })}
              required
            />
          </Field>
          <Field
            label="Base units in one purchase unit"
            hint="A 25 kg bag is 25 when the base unit is kg."
          >
            <input
              inputMode="decimal"
              value={form.conversionToBase}
              onChange={(event) => setForm({ ...form, conversionToBase: event.target.value })}
              required
            />
          </Field>
          <Field label="Reorder level" hint="In the base unit.">
            <input
              inputMode="decimal"
              value={form.reorderLevel}
              onChange={(event) => setForm({ ...form, reorderLevel: event.target.value })}
              required
            />
          </Field>
          <Field label="Shelf life (days)">
            <input
              inputMode="numeric"
              value={form.shelfLifeDays}
              onChange={(event) => setForm({ ...form, shelfLifeDays: event.target.value })}
              required
            />
          </Field>
          <Field label="Storage">
            <select
              value={form.storageType}
              onChange={(event) =>
                setForm({
                  ...form,
                  storageType: event.target.value as (typeof STORAGE_TYPES)[number],
                })
              }
            >
              {STORAGE_TYPES.map((storage) => (
                <option key={storage} value={storage}>
                  {STORAGE_TYPE_LABELS[storage]}
                </option>
              ))}
            </select>
          </Field>
          {suppliers.length > 0 ? (
            <fieldset className="kz-field kz-span-2">
              <legend>Suppliers</legend>
              {suppliers.map((supplier) => (
                <label key={supplier.id} className="kz-check">
                  <input
                    type="checkbox"
                    checked={form.supplierIds.includes(supplier.id)}
                    onChange={(event) => {
                      const supplierIds = event.target.checked
                        ? [...form.supplierIds, supplier.id]
                        : form.supplierIds.filter((id) => id !== supplier.id);
                      setForm({ ...form, supplierIds });
                    }}
                  />
                  {supplier.name}
                </label>
              ))}
            </fieldset>
          ) : null}
          {error ? (
            <p className="kz-error kz-span-2" role="alert">
              {error}
            </p>
          ) : null}
          <button className="kz-button kz-span-2" type="submit">
            Save item
          </button>
        </form>
      ) : null}
      {!canCreate && error ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="kz-panel kz-table-wrap">
        {items.length === 0 ? <p className="kz-empty">No items yet.</p> : null}
        <table className="kz-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Category</th>
              <th>Unit</th>
              <th>Storage</th>
              <th>Reorder</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.code}</td>
                <td>{item.name}</td>
                <td>{item.category}</td>
                <td>
                  {item.conversionToBase} {BASE_UNIT_LABELS[item.baseUnit]} / {item.purchaseUnit}
                </td>
                <td>{STORAGE_TYPE_LABELS[item.storageType]}</td>
                <td>
                  {item.reorderLevel} {BASE_UNIT_LABELS[item.baseUnit]}
                </td>
                <td>
                  {canArchive ? (
                    <button
                      type="button"
                      className="kz-button-quiet"
                      onClick={() => {
                        setError('');
                        void api
                          .archiveItem(item.id)
                          .then(() => reload())
                          .catch((caught: unknown) => setError(explain(caught, setUser)));
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
}

function explain(error: unknown, setUser: (user: SessionUser | null) => void): string {
  if (error instanceof ApiError && error.status === 401) {
    clearSession();
    setUser(null);
    return 'Sign in to continue.';
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
}
