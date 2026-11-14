'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { messages } from '@knazawy/i18n';
import { can, isKaramRole, type BranchRecord } from '@knazawy/shared';
import { useEffect, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { api, readSessionUser, writeSessionUser } from '../../lib/session';

export function BranchesScreen() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [branches, setBranches] = useState<BranchRecord[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const session = readSessionUser();
    setUser(session);
    setReady(true);
    if (!session || !isKaramRole(session.role)) return;
    void load(session);
  }, []);

  async function load(session: SessionUser) {
    try {
      const next = can(session.role, 'branches', 'R')
        ? await api.listBranches()
        : await api.listOpenBranches();
      setBranches(next);
    } catch (caught: unknown) {
      setError(explainApiError(caught, setUser));
    }
  }

  if (!ready) return <p>Loading branches</p>;
  if (!user) {
    return (
      <p>
        <a href="/login">{messages.en.common.signIn}</a> to see branches.
      </p>
    );
  }
  if (!isKaramRole(user.role)) {
    return <p>Branches are for Karam staff. An airline is not split into branches.</p>;
  }

  const manages = can(user.role, 'branches', 'C');
  const openCount = branches.filter((branch) => branch.active).length;

  return (
    <section className="kz-stack">
      <div className="kz-page-head">
        <h1>{messages.en.common.branches}</h1>
        <p>
          Karam works in branches. Stock and rooms will belong to the branch you are working in. An
          airline stays one account and is not split.
        </p>
        <p lang="ur" dir="rtl">
          {messages.ur.common.branches}
        </p>
      </div>
      {error ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="kz-panel">
        <h2>Branches</h2>
        {branches.length === 0 ? <p className="kz-empty">No branches yet.</p> : null}
        <ul>
          {branches.map((branch) => (
            <li key={branch.id}>
              <strong>{branch.name}</strong> · {branch.code}
              {branch.id === user.branchId ? ' · working here' : ''}
              {branch.active ? '' : ' · closed'}
              {branch.active && branch.id !== user.branchId ? (
                <button
                  type="button"
                  className="kz-button-quiet"
                  disabled={busy}
                  onClick={() => void workIn(branch)}
                >
                  Work here
                </button>
              ) : null}
              {manages && branch.active && openCount > 1 ? (
                <button
                  type="button"
                  className="kz-button-quiet"
                  disabled={busy}
                  onClick={() => void close(branch)}
                >
                  Close
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
      {manages ? (
        <form
          className="kz-panel"
          onSubmit={(event) => {
            event.preventDefault();
            void add();
          }}
        >
          <h2>New branch</h2>
          <label>
            Code
            <input value={code} onChange={(event) => setCode(event.target.value)} required />
          </label>
          <label>
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <button type="submit" className="kz-button" disabled={busy}>
            Add branch
          </button>
        </form>
      ) : null}
    </section>
  );

  async function workIn(branch: BranchRecord) {
    setBusy(true);
    setError('');
    try {
      const used = await api.useBranch(branch.id);
      const next = { ...user!, branchId: used.id };
      writeSessionUser(next);
      setUser(next);
    } catch (caught: unknown) {
      setError(explainApiError(caught, setUser));
    } finally {
      setBusy(false);
    }
  }

  async function close(branch: BranchRecord) {
    setBusy(true);
    setError('');
    try {
      await api.updateBranch(branch.id, { active: false });
      await load(user!);
    } catch (caught: unknown) {
      setError(explainApiError(caught, setUser));
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    setBusy(true);
    setError('');
    try {
      await api.createBranch({ code, name });
      setCode('');
      setName('');
      await load(user!);
    } catch (caught: unknown) {
      setError(explainApiError(caught, setUser));
    } finally {
      setBusy(false);
    }
  }
}
