'use client';

import { ApiError } from '@knazawy/api-client';
import type { SessionUser } from '@knazawy/auth-client';
import { locationsCopy } from '@knazawy/i18n';
import { LOCATION_TYPE_LABELS, LOCATION_TYPES, can } from '@knazawy/shared';
import type { LocationRecord } from '@knazawy/shared';
import { FormDialog, KaramLoader } from '@knazawy/ui-shell';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useCommon, useCopy, useLabel } from '../../lib/i18n';
import { api, clearSession, readSessionUser } from '../../lib/session';

import { Field } from './Field';

export function LocationsScreen() {
  const t = useCopy(locationsCopy);
  const common = useCommon();
  const label = useLabel();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState<(typeof LOCATION_TYPES)[number]>(LOCATION_TYPES[0]);
  const [parentId, setParentId] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function reload(): Promise<void> {
    setLocations(await api.listLocations());
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
  const names = new Map(locations.map((location) => [location.id, location.name]));

  return (
    <section className="kz-stack">
      <div className="kz-page-head kz-page-action-head">
        <div>
          <h1>{common.locations}</h1>
          <p>{t.intro}</p>
        </div>
        {canCreate ? (
          <FormDialog
            buttonLabel={t.newLocation}
            title={t.newLocation}
            onOpenChange={setDialogOpen}
            onOpen={() => setError('')}
          >
            {({ close }) => (
              <form
                className="kz-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  setError('');
                  void api
                    .createLocation({
                      name,
                      type,
                      ...(parentId ? { parentId } : {}),
                    })
                    .then(async () => {
                      await reload();
                      setName('');
                      setParentId('');
                      close();
                    })
                    .catch((caught: unknown) => setError(explain(caught, setUser, t)));
                }}
              >
                <Field label={t.name}>
                  <input value={name} onChange={(event) => setName(event.target.value)} required />
                </Field>
                <Field label={t.type}>
                  <select
                    value={type}
                    onChange={(event) =>
                      setType(event.target.value as (typeof LOCATION_TYPES)[number])
                    }
                  >
                    {LOCATION_TYPES.map((locationType) => (
                      <option key={locationType} value={locationType}>
                        {label(LOCATION_TYPE_LABELS[locationType])}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t.inside} hint={t.insideHint}>
                  <select value={parentId} onChange={(event) => setParentId(event.target.value)}>
                    <option value="">{t.none}</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {error ? (
                  <p className="kz-error" role="alert">
                    {error}
                  </p>
                ) : null}
                <button className="kz-button" type="submit">
                  {t.saveLocation}
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
          {locations.length === 0 ? <p className="kz-empty">{t.noLocations}</p> : null}
          <table className="kz-table">
            <thead>
              <tr>
                <th>{t.name}</th>
                <th>{t.type}</th>
                <th>{t.inside}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {locations.map((location) => (
                <tr key={location.id}>
                  <td>{location.name}</td>
                  <td>{label(LOCATION_TYPE_LABELS[location.type])}</td>
                  <td>{location.parentId ? (names.get(location.parentId) ?? '') : t.topLevel}</td>
                  <td>
                    {canArchive ? (
                      <button
                        type="button"
                        className="kz-button-quiet"
                        onClick={() => {
                          setError('');
                          void api
                            .archiveLocation(location.id)
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
