'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { messages } from '@knazawy/i18n';
import { AIRLINE_ROLE_LABELS, AIRLINE_ROLES, USER_STATUS_LABELS, can } from '@knazawy/shared';
import type { AirlineRecord, AirlineRole } from '@knazawy/shared';
import { FormDialog } from '@knazawy/ui-shell';
import { useEffect, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { api, readSessionUser } from '../../lib/session';
import { Field } from '../master/Field';

export function AirlinesScreen() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [airlines, setAirlines] = useState<AirlineRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AirlineRole>('AIRLINE_REQUESTER');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const session = readSessionUser();
    setUser(session);
    setReady(true);
    if (!session || !can(session.role, 'users', 'R')) return;
    void api
      .listAirlines()
      .then((next) => {
        setAirlines(next);
        setSelectedId(next[0]?.id ?? '');
      })
      .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
  }, []);

  if (!ready) return <p>Loading airlines</p>;
  if (!user) {
    return (
      <p>
        <a href="/login">{messages.en.common.signIn}</a> to see airlines.
      </p>
    );
  }
  if (!can(user.role, 'users', 'R')) {
    return <p>An administrator keeps airline accounts.</p>;
  }

  const selected = airlines.find((airline) => airline.id === selectedId) ?? null;
  const canWrite = can(user.role, 'users', 'C');

  return (
    <section className="kz-stack">
      <div className="kz-page-head kz-page-action-head">
        <div>
          <h1>{messages.en.common.airlines}</h1>
          <p>
            Each airline has its own account. Its users sign in on the portal and see only that
            airline. A requester places requests. Finance will see rates and invoices.
          </p>
          <p lang="ur" dir="rtl">
            {messages.ur.common.airlines}
          </p>
        </div>
        {canWrite ? (
          <FormDialog
            buttonLabel="New airline"
            title="New airline"
            onOpenChange={setDialogOpen}
            onOpen={() => setError('')}
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
                    .createAirline({
                      code: code.trim(),
                      name: name.trim(),
                      taxNumber: taxNumber.trim() || undefined,
                    })
                    .then((airline) => {
                      setAirlines((current) =>
                        [...current, airline].sort((left, right) =>
                          left.name.localeCompare(right.name),
                        ),
                      );
                      setSelectedId(airline.id);
                      setCode('');
                      setName('');
                      setTaxNumber('');
                      setSaved(`${airline.name} is open.`);
                      close();
                    })
                    .catch((caught: unknown) => setError(explainApiError(caught, setUser)))
                    .finally(() => setSaving(false));
                }}
              >
                <Field label="Code" hint="A short code, such as PIA.">
                  <input value={code} onChange={(event) => setCode(event.target.value)} required />
                </Field>
                <Field label="Name">
                  <input value={name} onChange={(event) => setName(event.target.value)} required />
                </Field>
                <Field label="Tax number">
                  <input
                    value={taxNumber}
                    onChange={(event) => setTaxNumber(event.target.value)}
                    placeholder="Optional"
                  />
                </Field>
                {error ? (
                  <p className="kz-error" role="alert">
                    {error}
                  </p>
                ) : null}
                <button className="kz-button" type="submit" disabled={saving}>
                  {saving ? 'Saving' : 'Open airline'}
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
      {saved ? <p role="status">{saved}</p> : null}
      <div className="kz-workspace kz-workspace-single">
        <div className="kz-panel kz-stack">
          <h2>Accounts</h2>
          {airlines.length === 0 ? <p className="kz-empty">No airlines yet.</p> : null}
          <div className="kz-table-wrap">
            <table className="kz-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Users</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {airlines.map((airline) => (
                  <tr key={airline.id}>
                    <td>{airline.code}</td>
                    <td>{airline.name}</td>
                    <td>{airline.users.length}</td>
                    <td>
                      <button
                        type="button"
                        className="kz-button-quiet"
                        onClick={() => setSelectedId(airline.id)}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected ? (
            <form
              className="kz-form"
              onSubmit={(event) => {
                event.preventDefault();
                setError('');
                setSaved('');
                setSaving(true);
                void api
                  .createAirlineUser(selected.id, {
                    name: userName.trim(),
                    email: email.trim(),
                    role,
                    password,
                  })
                  .then((airline) => {
                    replaceAirline(airline);
                    setUserName('');
                    setEmail('');
                    setPassword('');
                    setSaved(`${airline.name} has a new user.`);
                  })
                  .catch((caught: unknown) => setError(explainApiError(caught, setUser)))
                  .finally(() => setSaving(false));
              }}
            >
              <h2>{selected.name}</h2>
              {selected.taxNumber ? <p>Tax number {selected.taxNumber}</p> : null}
              <div className="kz-table-wrap">
                <table className="kz-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.users.map((member) => (
                      <tr key={member.id}>
                        <td>{member.name}</td>
                        <td>{member.email}</td>
                        <td>{AIRLINE_ROLE_LABELS[member.role]}</td>
                        <td>{USER_STATUS_LABELS[member.status]}</td>
                        <td>
                          {can(user.role, 'users', 'U') && member.status !== 'INVITED' ? (
                            <button
                              type="button"
                              className="kz-button-quiet"
                              onClick={() => {
                                const status = member.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
                                setError('');
                                void api
                                  .updateAirlineUser(selected.id, member.id, { status })
                                  .then((airline) => {
                                    replaceAirline(airline);
                                    setSaved(
                                      status === 'ACTIVE'
                                        ? `${member.name} can sign in again.`
                                        : `${member.name} cannot sign in.`,
                                    );
                                  })
                                  .catch((caught: unknown) =>
                                    setError(explainApiError(caught, setUser)),
                                  );
                              }}
                            >
                              {member.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {canWrite ? (
                <>
                  <h2>New user</h2>
                  <Field label="Name">
                    <input
                      value={userName}
                      onChange={(event) => setUserName(event.target.value)}
                      required
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                  </Field>
                  <Field label="Role">
                    <select
                      value={role}
                      onChange={(event) => setRole(event.target.value as AirlineRole)}
                    >
                      {AIRLINE_ROLES.map((option) => (
                        <option key={option} value={option}>
                          {AIRLINE_ROLE_LABELS[option]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Password" hint="At least 4 characters. Share it with the user.">
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      minLength={4}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                  </Field>
                  <button className="kz-button" type="submit" disabled={saving}>
                    {saving ? 'Saving' : 'Add user'}
                  </button>
                </>
              ) : null}
            </form>
          ) : null}
        </div>
      </div>
    </section>
  );

  function replaceAirline(airline: AirlineRecord): void {
    setAirlines((current) => current.map((row) => (row.id === airline.id ? airline : row)));
  }
}
