import { ROLES, type Actor } from '@knazawy/shared';

export type SessionUser = Actor;

/** Where older builds kept the access token. It now lives in an httpOnly cookie. */
const LEGACY_TOKEN_KEY = 'knazawy.accessToken';
const USER_KEY = 'knazawy.user';

/** Removes a token an older build left in localStorage, where any script could read it. */
export function forgetLegacyToken(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(LEGACY_TOKEN_KEY);
}

/**
 * The signed-in person's name and role, for the page header and menus. Not a credential: the
 * API checks the session cookie on every request.
 */
export function readSessionUser(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    const user = JSON.parse(raw) as SessionUser;
    // A role renamed or removed since this person signed in would open nothing. Make them sign in again.
    if (!(ROLES as readonly string[]).includes(user.role)) {
      window.localStorage.removeItem(USER_KEY);
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

export function writeSessionUser(user: SessionUser | null): void {
  if (typeof window === 'undefined') return;
  if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  else window.localStorage.removeItem(USER_KEY);
}
