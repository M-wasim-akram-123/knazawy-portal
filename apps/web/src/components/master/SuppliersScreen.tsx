'use client';

import { ApiError } from '@knazawy/api-client';
import type { SessionUser } from '@knazawy/auth-client';
import { messages } from '@knazawy/i18n';
import { can } from '@knazawy/shared';
import type { SupplierRecord } from '@knazawy/shared';
import { FormDialog } from '@knazawy/ui-shell';
import Link from 'next/link';
import { useEffect, useState } from 'react';

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
    void reload().catch((caught: unknown) => setError(explain(caught, setUser)));
  }, []);

  if (!ready) return <p>Loading suppliers</p>;
  if (!user) {
    return (
      <p>
        <Link href="/login">{messages.en.common.signIn}</Link> to see suppliers.
      </p>
    );
  }

  const canCreate = can(user.role, 'purchases', 'C');
  const canArchive = can(user.role, 'purchases', 'U');

  return (
    <section className="kz-stack">
      <div className="kz-page-head kz-page-action-head">
        <div>
          <h1>{messages.en.common.suppliers}</h1>
          <p>Who supplies the kitchen, and how soon they are paid.</p>
        </div>
        {canCreate ? (
          <FormDialog
            buttonLabel="New supplier"
            title="New supplier"
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
                    .catch((caught: unknown) => setError(explain(caught, setUser)));
                }}
              >
                <Field label="Name">
                  <input
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    required
                  />
                </Field>
                <Field label="Contact name">
                  <input
                    value={form.contactName}
                    onChange={(event) => setForm({ ...form, contactName: event.target.value })}
                  />
                </Field>
                <Field label="Phone">
                  <input
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                  />
                </Field>
                <Field label="Tax number">
                  <input
                    value={form.taxNumber}
                    onChange={(event) => setForm({ ...form, taxNumber: event.target.value })}
                  />
                </Field>
                <Field label="Payment terms (days)">
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
                  Save supplier
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
          {suppliers.length === 0 ? <p className="kz-empty">No suppliers yet.</p> : null}
          <table className="kz-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Phone</th>
                <th>Pay in</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier) => (
                <tr key={supplier.id}>
                  <td>{supplier.name}</td>
                  <td>{supplier.contactName ?? ''}</td>
                  <td>{supplier.phone ?? ''}</td>
                  <td>{supplier.paymentTermsDays} days</td>
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
