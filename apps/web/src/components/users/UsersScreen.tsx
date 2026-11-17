'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { usersCopy } from '@knazawy/i18n';
import {
  AIRLINE_ROLES,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  ROLE_LABELS,
  STAFF_ROLES,
  USER_STATUS_LABELS,
  canManageUsers,
  formatKarachiDateTime,
  type AirlineRecord,
  type BranchRecord,
  type Role,
  type UserAccountRecord,
} from '@knazawy/shared';
import { FormDialog, KaramLoader, PasswordInput } from '@knazawy/ui-shell';
import { useEffect, useMemo, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { fill, useChrome, useCommon, useCopy, useLabel } from '../../lib/i18n';
import { api, readSessionUser } from '../../lib/session';
import { Field } from '../master/Field';

const STAFF = 'staff';

type UsersCopy = (typeof usersCopy)['en'];

/** The shared length rule, with a message in the chosen language. */
function passwordProblem(password: string, t: UsersCopy): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return fill(t.passwordTooShort, { min: MIN_PASSWORD_LENGTH });
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return fill(t.passwordTooLong, { max: MAX_PASSWORD_LENGTH });
  }
  return null;
}

interface Draft {
  name: string;
  email: string;
  organisationId: string;
  role: Role;
  branchId: string;
  password: string;
}

const blankDraft = (branchId = ''): Draft => ({
  name: '',
  email: '',
  organisationId: STAFF,
  role: 'STOREKEEPER',
  branchId,
  password: '',
});

/**
 * Every account in one place. Accounts are made here, not by sign-up, and there is no
 * "forgot password": an administrator sets a new one, which signs the person out everywhere.
 */
export function UsersScreen() {
  const t = useCopy(usersCopy);
  const common = useCommon();
  const chrome = useChrome();
  const label = useLabel();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [users, setUsers] = useState<UserAccountRecord[]>([]);
  const [airlines, setAirlines] = useState<AirlineRecord[]>([]);
  const [branches, setBranches] = useState<BranchRecord[]>([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Draft>(blankDraft());
  const [editing, setEditing] = useState<UserAccountRecord | null>(null);
  const [passwordFor, setPasswordFor] = useState<UserAccountRecord | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const session = readSessionUser();
    setUser(session);
    if (!session || !canManageUsers(session.role)) return;
    void Promise.all([api.listUsers(), api.listAirlines(), api.listOpenBranches()])
      .then(([nextUsers, nextAirlines, nextBranches]) => {
        setUsers(nextUsers);
        setAirlines(nextAirlines);
        setBranches(nextBranches);
        setDraft(blankDraft(nextBranches[0]?.id ?? ''));
      })
      .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
  }, []);

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((row) => {
      if (filter === STAFF && !row.staff) return false;
      if (filter !== 'all' && filter !== STAFF && row.organisationId !== filter) return false;
      if (!term) return true;
      return `${row.name} ${row.email}`.toLowerCase().includes(term);
    });
  }, [users, filter, search]);

  if (!user) return <KaramLoader label={t.loading} fullPage />;
  if (!canManageUsers(user.role)) return <p>{t.notAllowed}</p>;

  const staffAccount = draft.organisationId === STAFF;
  const roleChoices: readonly Role[] = staffAccount ? STAFF_ROLES : AIRLINE_ROLES;

  function replace(record: UserAccountRecord) {
    setUsers((current) => current.map((row) => (row.id === record.id ? record : row)));
  }

  async function run(action: () => Promise<string>) {
    setBusy(true);
    setError('');
    setSaved('');
    try {
      setSaved(await action());
      return true;
    } catch (caught: unknown) {
      setError(explainApiError(caught, setUser));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="kz-stack">
      <div className="kz-page-head kz-page-action-head">
        <div>
          <h1>{common.users}</h1>
          <p>{t.intro}</p>
        </div>
        <FormDialog
          buttonLabel={t.addUser}
          title={t.addUser}
          onOpen={() => {
            setError('');
            setDraft(blankDraft(branches[0]?.id ?? ''));
          }}
        >
          {({ close }) => (
            <form
              className="kz-form"
              onSubmit={(event) => {
                event.preventDefault();
                const problem = passwordProblem(draft.password, t);
                if (problem) {
                  setError(problem);
                  return;
                }
                void run(async () => {
                  const created = await api.createUser({
                    name: draft.name.trim(),
                    email: draft.email.trim(),
                    role: draft.role,
                    organisationId: staffAccount ? undefined : draft.organisationId,
                    branchId: staffAccount && draft.branchId ? draft.branchId : undefined,
                    password: draft.password,
                  });
                  setUsers((current) => [...current, created]);
                  close();
                  return fill(t.canSignIn, { name: created.name });
                });
              }}
            >
              <Field label={t.name}>
                <input
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  required
                />
              </Field>
              <Field label={t.email} hint={t.emailHint}>
                <input
                  type="email"
                  value={draft.email}
                  onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                  required
                />
              </Field>
              <Field label={t.accountFor}>
                <select
                  value={draft.organisationId}
                  onChange={(event) => {
                    const organisationId = event.target.value;
                    setDraft({
                      ...draft,
                      organisationId,
                      role: organisationId === STAFF ? 'STOREKEEPER' : 'AIRLINE_REQUESTER',
                    });
                  }}
                >
                  <option value={STAFF}>{t.karamStaff}</option>
                  {airlines.map((airline) => (
                    <option key={airline.id} value={airline.id}>
                      {airline.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t.role}>
                <select
                  value={draft.role}
                  onChange={(event) => setDraft({ ...draft, role: event.target.value as Role })}
                >
                  {roleChoices.map((role) => (
                    <option key={role} value={role}>
                      {label(ROLE_LABELS[role])}
                    </option>
                  ))}
                </select>
              </Field>
              {staffAccount ? (
                <Field label={t.branch} hint={t.branchHint}>
                  <select
                    value={draft.branchId}
                    onChange={(event) => setDraft({ ...draft, branchId: event.target.value })}
                  >
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
              <Field label={t.password} hint={t.passwordHint}>
                <PasswordInput
                  autoComplete="new-password"
                  minLength={10}
                  value={draft.password}
                  onChange={(event) => setDraft({ ...draft, password: event.target.value })}
                  required
                  showLabel={chrome.showPassword}
                  hideLabel={chrome.hidePassword}
                />
              </Field>
              {error ? (
                <p className="kz-error" role="alert">
                  {error}
                </p>
              ) : null}
              <button className="kz-button" type="submit" disabled={busy}>
                {busy ? t.saving : t.addUser}
              </button>
            </form>
          )}
        </FormDialog>
      </div>

      <div className="kz-panel kz-stack">
        <div className="kz-form-row">
          <Field label={t.show}>
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">{t.everyone}</option>
              <option value={STAFF}>{t.karamStaff}</option>
              {airlines.map((airline) => (
                <option key={airline.id} value={airline.id}>
                  {airline.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t.search}>
            <input
              type="search"
              value={search}
              placeholder={t.searchPlaceholder}
              onChange={(event) => setSearch(event.target.value)}
            />
          </Field>
        </div>
        {saved ? <p>{saved}</p> : null}
        {error && !editing && !passwordFor ? (
          <p className="kz-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="kz-table-wrap">
          <table className="kz-table">
            <thead>
              <tr>
                <th>{t.name}</th>
                <th>{t.account}</th>
                <th>{t.role}</th>
                <th>{t.status}</th>
                <th>{t.lastSignIn}</th>
                <th>{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => {
                const self = row.id === user.id;
                return (
                  <tr key={row.id}>
                    <td>
                      {row.name}
                      <span className="kz-help"> · {row.email}</span>
                    </td>
                    <td>
                      {row.organisationName}
                      {row.branchName ? <span className="kz-help"> · {row.branchName}</span> : null}
                    </td>
                    <td>{label(ROLE_LABELS[row.role])}</td>
                    <td>
                      <span
                        className="kz-status"
                        data-tone={row.status === 'ACTIVE' ? 'done' : 'problem'}
                      >
                        {label(USER_STATUS_LABELS[row.status])}
                      </span>
                    </td>
                    <td>
                      {row.lastLoginAt ? formatKarachiDateTime(new Date(row.lastLoginAt)) : t.never}
                    </td>
                    <td className="kz-row-actions">
                      <button
                        type="button"
                        className="kz-button-quiet"
                        onClick={() => {
                          setError('');
                          setEditing(row);
                        }}
                      >
                        {t.edit}
                      </button>
                      <button
                        type="button"
                        className="kz-button-quiet"
                        onClick={() => {
                          setError('');
                          setNewPassword('');
                          setPasswordFor(row);
                        }}
                      >
                        {t.password}
                      </button>
                      {row.status === 'ACTIVE' ? (
                        <button
                          type="button"
                          className="kz-button-quiet"
                          disabled={busy || self}
                          onClick={() => {
                            if (!window.confirm(fill(t.confirmRevoke, { name: row.name }))) return;
                            void run(async () => {
                              replace(await api.revokeUser(row.id));
                              return fill(t.revoked, { name: row.name });
                            });
                          }}
                        >
                          {t.revoke}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="kz-button-quiet"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              replace(await api.restoreUser(row.id));
                              return fill(t.restored, { name: row.name });
                            })
                          }
                        >
                          {t.restore}
                        </button>
                      )}
                      <button
                        type="button"
                        className="kz-button-quiet"
                        disabled={busy || self}
                        onClick={() => {
                          if (!window.confirm(fill(t.confirmDelete, { name: row.name }))) return;
                          void run(async () => {
                            await api.deleteUser(row.id);
                            setUsers((current) => current.filter((item) => item.id !== row.id));
                            return fill(t.deleted, { name: row.name });
                          });
                        }}
                      >
                        {t.delete}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {shown.length === 0 ? <p className="kz-empty">{t.noMatch}</p> : null}
        </div>
      </div>

      {editing ? (
        <EditUserDialog
          key={editing.id}
          account={editing}
          branches={branches}
          busy={busy}
          error={error}
          onClose={() => setEditing(null)}
          onSave={(changes) =>
            void run(async () => {
              const updated = await api.updateUser(editing.id, changes);
              replace(updated);
              setEditing(null);
              return fill(t.updated, { name: updated.name });
            })
          }
        />
      ) : null}

      <FormDialog
        buttonLabel={t.changePassword}
        title={passwordFor ? fill(t.newPasswordFor, { name: passwordFor.name }) : t.newPassword}
        description={t.newPasswordDescription}
        showTrigger={false}
        isOpen={passwordFor !== null}
        onOpenChange={(open) => {
          if (!open) setPasswordFor(null);
        }}
      >
        {() => (
          <form
            className="kz-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!passwordFor) return;
              const problem = passwordProblem(newPassword, t);
              if (problem) {
                setError(problem);
                return;
              }
              const target = passwordFor;
              void run(async () => {
                replace(await api.setUserPassword(target.id, newPassword));
                setPasswordFor(null);
                return fill(t.passwordChanged, { name: target.name });
              });
            }}
          >
            <Field label={t.newPassword} hint={t.newPasswordHint}>
              <PasswordInput
                autoComplete="new-password"
                minLength={10}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                showLabel={chrome.showPassword}
                hideLabel={chrome.hidePassword}
              />
            </Field>
            {error ? (
              <p className="kz-error" role="alert">
                {error}
              </p>
            ) : null}
            <button className="kz-button" type="submit" disabled={busy}>
              {t.setPassword}
            </button>
          </form>
        )}
      </FormDialog>
    </section>
  );
}

function EditUserDialog({
  account,
  branches,
  busy,
  error,
  onClose,
  onSave,
}: {
  account: UserAccountRecord;
  branches: BranchRecord[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (changes: { name: string; email: string; role: Role; branchId?: string }) => void;
}) {
  const t = useCopy(usersCopy);
  const label = useLabel();
  const [name, setName] = useState(account.name);
  const [email, setEmail] = useState(account.email);
  const [role, setRole] = useState<Role>(account.role);
  const [branchId, setBranchId] = useState(account.branchId ?? branches[0]?.id ?? '');
  const choices: readonly Role[] = account.staff ? STAFF_ROLES : AIRLINE_ROLES;

  return (
    <FormDialog
      buttonLabel={t.edit}
      title={fill(t.editTitle, { name: account.name })}
      showTrigger={false}
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {() => (
        <form
          className="kz-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSave({
              name: name.trim(),
              email: email.trim(),
              role,
              branchId: account.staff && branchId ? branchId : undefined,
            });
          }}
        >
          <Field label={t.name}>
            <input value={name} onChange={(event) => setName(event.target.value)} required />
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
            <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
              {choices.map((option) => (
                <option key={option} value={option}>
                  {label(ROLE_LABELS[option])}
                </option>
              ))}
            </select>
          </Field>
          {account.staff ? (
            <Field label={t.branch}>
              <select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          {error ? (
            <p className="kz-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="kz-button" type="submit" disabled={busy}>
            {t.save}
          </button>
        </form>
      )}
    </FormDialog>
  );
}
