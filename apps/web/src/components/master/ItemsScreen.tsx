'use client';

import { ApiError } from '@knazawy/api-client';
import type { SessionUser } from '@knazawy/auth-client';
import { itemsCopy } from '@knazawy/i18n';
import {
  BASE_UNIT_LABELS,
  BASE_UNITS,
  STORAGE_TYPE_LABELS,
  STORAGE_TYPES,
  can,
} from '@knazawy/shared';
import type { ItemRecord, SupplierRecord } from '@knazawy/shared';
import { FormDialog, KaramLoader } from '@knazawy/ui-shell';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useCommon, useCopy, useLabel } from '../../lib/i18n';
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
  const t = useCopy(itemsCopy);
  const common = useCommon();
  const label = useLabel();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

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
    void reload().catch((caught: unknown) => setError(explain(caught, setUser, t)));
  }, []);

  if (!ready) return <KaramLoader label={t.loading} fullPage />;
  if (!user) {
    const [beforeLink, afterLink] = t.signInToSee.split('{signIn}');
    return (
      <p>
        {beforeLink}
        <Link href="/login">{common.signIn}</Link>
        {afterLink}
      </p>
    );
  }

  const canCreate = can(user.role, 'stock', 'C');
  const canArchive = can(user.role, 'stock', 'U');

  return (
    <section className="kz-stack">
      <div className="kz-page-head kz-page-action-head">
        <div>
          <h1>{common.items}</h1>
          <p>{t.intro}</p>
        </div>
        {canCreate ? (
          <FormDialog
            buttonLabel={t.newItem}
            title={t.newItem}
            onOpenChange={setDialogOpen}
            onOpen={() => setError('')}
          >
            {({ close }) => (
              <form
                className="kz-form kz-form-grid"
                onSubmit={(event) => {
                  event.preventDefault();
                  setError('');
                  void api
                    .createItem({
                      ...form,
                      shelfLifeDays: Number(form.shelfLifeDays),
                    })
                    .then(async () => {
                      await reload();
                      setForm(empty);
                      close();
                    })
                    .catch((caught: unknown) => setError(explain(caught, setUser, t)));
                }}
              >
                <Field label={t.code}>
                  <input
                    value={form.code}
                    onChange={(event) => setForm({ ...form, code: event.target.value })}
                    required
                  />
                </Field>
                <Field label={t.name}>
                  <input
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    required
                  />
                </Field>
                <Field label={t.category}>
                  <input
                    value={form.category}
                    onChange={(event) => setForm({ ...form, category: event.target.value })}
                    required
                  />
                </Field>
                <Field label={t.baseUnit}>
                  <select
                    value={form.baseUnit}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        baseUnit: event.target.value as (typeof BASE_UNITS)[number],
                      })
                    }
                  >
                    {BASE_UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {label(BASE_UNIT_LABELS[unit])}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t.purchaseUnit} hint={t.purchaseUnitHint}>
                  <input
                    value={form.purchaseUnit}
                    onChange={(event) => setForm({ ...form, purchaseUnit: event.target.value })}
                    required
                  />
                </Field>
                <Field label={t.conversion} hint={t.conversionHint}>
                  <input
                    inputMode="decimal"
                    value={form.conversionToBase}
                    onChange={(event) => setForm({ ...form, conversionToBase: event.target.value })}
                    required
                  />
                </Field>
                <Field label={t.reorderLevel} hint={t.reorderLevelHint}>
                  <input
                    inputMode="decimal"
                    value={form.reorderLevel}
                    onChange={(event) => setForm({ ...form, reorderLevel: event.target.value })}
                    required
                  />
                </Field>
                <Field label={t.shelfLife}>
                  <input
                    inputMode="numeric"
                    value={form.shelfLifeDays}
                    onChange={(event) => setForm({ ...form, shelfLifeDays: event.target.value })}
                    required
                  />
                </Field>
                <Field label={t.storage}>
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
                        {label(STORAGE_TYPE_LABELS[storage])}
                      </option>
                    ))}
                  </select>
                </Field>
                {suppliers.length > 0 ? (
                  <fieldset className="kz-field kz-span-2 kz-check-grid">
                    <legend>{t.suppliers}</legend>
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
                  {t.saveItem}
                </button>
              </form>
            )}
          </FormDialog>
        ) : null}
      </div>
      {error && !dialogOpen ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="kz-workspace kz-workspace-single">
        <div className="kz-panel kz-table-wrap">
          {items.length === 0 ? <p className="kz-empty">{t.noItems}</p> : null}
          <table className="kz-table">
            <thead>
              <tr>
                <th>{t.code}</th>
                <th>{t.name}</th>
                <th>{t.category}</th>
                <th>{t.unit}</th>
                <th>{t.storage}</th>
                <th>{t.reorder}</th>
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
                    {item.conversionToBase} {label(BASE_UNIT_LABELS[item.baseUnit])} /{' '}
                    {item.purchaseUnit}
                  </td>
                  <td>{label(STORAGE_TYPE_LABELS[item.storageType])}</td>
                  <td>
                    {item.reorderLevel} {label(BASE_UNIT_LABELS[item.baseUnit])}
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
                            .catch((caught: unknown) => setError(explain(caught, setUser, t)));
                        }}
                      >
                        {common.archive}
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

function explain(
  error: unknown,
  setUser: (user: SessionUser | null) => void,
  t: { signInToContinue: string; somethingWentWrong: string },
): string {
  if (error instanceof ApiError && error.status === 401) {
    clearSession();
    setUser(null);
    return t.signInToContinue;
  }
  return error instanceof Error ? error.message : t.somethingWentWrong;
}
