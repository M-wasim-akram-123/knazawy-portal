'use client';

import { ApiError } from '@knazawy/api-client';
import type { SessionUser } from '@knazawy/auth-client';
import { suppliersCopy } from '@knazawy/i18n';
import { can } from '@knazawy/shared';
import type { SupplierRecord } from '@knazawy/shared';
import { FormDialog, KaramLoader } from '@knazawy/ui-shell';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { fill, useCommon, useCopy } from '../../lib/i18n';
import { api, clearSession, readSessionUser } from '../../lib/session';

import { Field } from './Field';

const empty = {
  name: '',
  contactName: '',
  phone: '',
  email: '',
  taxNumber: '',
  paymentTermsDays: '0',
};

export function SuppliersScreen() {
  const t = useCopy(suppliersCopy);
  const common = useCommon();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function reload(): Promise<void> {
    setSuppliers(await api.listSuppliers());
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

  const canCreate = can(user.role, 'purchases', 'C');
  const canArchive = can(user.role, 'purchases', 'U');

  return (
    <section className="kz-stack">
      <div className="kz-page-head kz-page-action-head">
        <div>
          <h1>{common.suppliers}</h1>
          <p>{t.intro}</p>
        </div>
        {canCreate ? (
          <FormDialog
            buttonLabel={t.newSupplier}
            title={t.newSupplier}
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
                    .createSupplier({
                      name: form.name,
                      paymentTermsDays: Number(form.paymentTermsDays),
                      ...(form.contactName ? { contactName: form.contactName } : {}),
                      ...(form.phone ? { phone: form.phone } : {}),
                      ...(form.email ? { email: form.email } : {}),
                      ...(form.taxNumber ? { taxNumber: form.taxNumber } : {}),
                    })
                    .then(async () => {
                      await reload();
                      setForm(empty);
                      close();
                    })
                    .catch((caught: unknown) => setError(explain(caught, setUser, t)));
                }}
              >
                <Field label={t.name}>
                  <input
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    required
                  />
                </Field>
                <Field label={t.contactName}>
                  <input
                    value={form.contactName}
                    onChange={(event) => setForm({ ...form, contactName: event.target.value })}
                  />
                </Field>
                <Field label={t.phone}>
                  <input
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  />
                </Field>
                <Field label={t.email}>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                  />
                </Field>
                <Field label={t.taxNumber}>
                  <input
                    value={form.taxNumber}
                    onChange={(event) => setForm({ ...form, taxNumber: event.target.value })}
                  />
                </Field>
                <Field label={t.paymentTerms}>
                  <input
                    inputMode="numeric"
                    value={form.paymentTermsDays}
                    onChange={(event) => setForm({ ...form, paymentTermsDays: event.target.value })}
                    required
                  />
                </Field>
                {error ? (
                  <p className="kz-error kz-span-2" role="alert">
                    {error}
                  </p>
                ) : null}
                <button className="kz-button kz-span-2" type="submit">
                  {t.saveSupplier}
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
          {suppliers.length === 0 ? <p className="kz-empty">{t.noSuppliers}</p> : null}
          <table className="kz-table">
            <thead>
              <tr>
                <th>{t.name}</th>
                <th>{t.contact}</th>
                <th>{t.phone}</th>
                <th>{t.payIn}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier) => (
                <tr key={supplier.id}>
                  <td>{supplier.name}</td>
                  <td>{supplier.contactName ?? ''}</td>
                  <td>{supplier.phone ?? ''}</td>
                  <td>{fill(t.days, { count: supplier.paymentTermsDays })}</td>
                  <td>
                    {canArchive ? (
                      <button
                        type="button"
                        className="kz-button-quiet"
                        onClick={() => {
                          setError('');
                          void api
                            .archiveSupplier(supplier.id)
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
