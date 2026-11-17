'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { airlinesCopy } from '@knazawy/i18n';
import { AIRLINE_ROLE_LABELS, AIRLINE_ROLES, USER_STATUS_LABELS, can } from '@knazawy/shared';
import type { AirlineRecord, AirlineRole } from '@knazawy/shared';
import { FormDialog, KaramLoader, PasswordInput } from '@knazawy/ui-shell';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { fill, useChrome, useCommon, useCopy, useLabel } from '../../lib/i18n';
import { api, readSessionUser } from '../../lib/session';
import { Field } from '../master/Field';

export function AirlinesScreen() {
  const t = useCopy(airlinesCopy);
  const common = useCommon();
  const chrome = useChrome();
  const label = useLabel();
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
  if (!can(user.role, 'users', 'R')) {
    return <p>{t.notAllowed}</p>;
  }

  const selected = airlines.find((airline) => airline.id === selectedId) ?? null;
  const canWrite = can(user.role, 'users', 'C');

  return (
    <section className="kz-stack">
      <div className="kz-page-head kz-page-action-head">
        <div>
          <h1>{common.airlines}</h1>
          <p>{t.intro}</p>
        </div>
        {canWrite ? (
          <FormDialog
            buttonLabel={t.newAirline}
            title={t.newAirline}
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
                      setSaved(fill(t.opened, { name: airline.name }));
                      close();
                    })
                    .catch((caught: unknown) => setError(explainApiError(caught, setUser)))
                    .finally(() => setSaving(false));
                }}
              >
                <Field label={t.code} hint={t.codeHint}>
                  <input value={code} onChange={(event) => setCode(event.target.value)} required />
                </Field>
                <Field label={t.name}>
                  <input value={name} onChange={(event) => setName(event.target.value)} required />
                </Field>
                <Field label={t.taxNumber}>
                  <input
                    value={taxNumber}
                    onChange={(event) => setTaxNumber(event.target.value)}
                    placeholder={t.optional}
                  />
                </Field>
                {error ? (
                  <p className="kz-error" role="alert">
                    {error}
                  </p>
                ) : null}
                <button className="kz-button" type="submit" disabled={saving}>
                  {saving ? t.saving : t.openAirline}
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
          <h2>{t.accounts}</h2>
          {airlines.length === 0 ? <p className="kz-empty">{t.noAirlines}</p> : null}
          <div className="kz-table-wrap">
            <table className="kz-table">
              <thead>
                <tr>
                  <th>{t.code}</th>
                  <th>{t.name}</th>
                  <th>{t.users}</th>
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
                        {t.open}
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
                    setSaved(fill(t.newUserAdded, { name: airline.name }));
                  })
                  .catch((caught: unknown) => setError(explainApiError(caught, setUser)))
                  .finally(() => setSaving(false));
              }}
            >
              <h2>{selected.name}</h2>
              {selected.taxNumber ? (
                <p>{fill(t.taxNumberValue, { number: selected.taxNumber })}</p>
              ) : null}
              <div className="kz-table-wrap">
                <table className="kz-table">
                  <thead>
                    <tr>
                      <th>{t.name}</th>
                      <th>{t.email}</th>
                      <th>{t.role}</th>
                      <th>{t.status}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.users.map((member) => (
                      <tr key={member.id}>
                        <td>{member.name}</td>
                        <td>{member.email}</td>
                        <td>{label(AIRLINE_ROLE_LABELS[member.role])}</td>
                        <td>{label(USER_STATUS_LABELS[member.status])}</td>
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
                                        ? fill(t.canSignInAgain, { name: member.name })
                                        : fill(t.cannotSignIn, { name: member.name }),
                                    );
                                  })
                                  .catch((caught: unknown) =>
                                    setError(explainApiError(caught, setUser)),
                                  );
                              }}
                            >
                              {member.status === 'ACTIVE' ? t.disable : t.enable}
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
                  <h2>{t.newUser}</h2>
                  <Field label={t.name}>
                    <input
                      value={userName}
                      onChange={(event) => setUserName(event.target.value)}
                      required
                    />
                  </Field>
                  <Field label={t.email}>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                  </Field>
                  <Field label={t.role}>
                    <select
                      value={role}
                      onChange={(event) => setRole(event.target.value as AirlineRole)}
                    >
                      {AIRLINE_ROLES.map((option) => (
                        <option key={option} value={option}>
                          {label(AIRLINE_ROLE_LABELS[option])}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t.password} hint={t.passwordHint}>
                    <PasswordInput
                      autoComplete="new-password"
                      value={password}
                      minLength={10}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      showLabel={chrome.showPassword}
                      hideLabel={chrome.hidePassword}
                    />
                  </Field>
                  <button className="kz-button" type="submit" disabled={saving}>
                    {saving ? t.saving : t.addUser}
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
