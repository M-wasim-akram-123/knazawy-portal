import type { Actor } from '@knazawy/shared';

export type SessionUser = Actor;

export interface TokenStore {
  getAccessToken(): string | null;
  setAccessToken(token: string | null): void;
}

const TOKEN_KEY = 'knazawy.accessToken';
const USER_KEY = 'knazawy.user';

export function memoryTokenStore(): TokenStore {
  let accessToken: string | null = null;
  return {
    getAccessToken: () => accessToken,
    setAccessToken: (token) => {
      accessToken = token;
    },
  };
}

export function browserTokenStore(): TokenStore {
  return {
    getAccessToken: () => (typeof window === 'undefined' ? null : window.localStorage.getItem(TOKEN_KEY)),
    setAccessToken: (token) => {
      if (typeof window === 'undefined') return;
      if (token) window.localStorage.setItem(TOKEN_KEY, token);
      else window.localStorage.removeItem(TOKEN_KEY);
    },
  };
}

export function readSessionUser(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function writeSessionUser(user: SessionUser | null): void {
  if (typeof window === 'undefined') return;
  if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  else window.localStorage.removeItem(USER_KEY);
}
