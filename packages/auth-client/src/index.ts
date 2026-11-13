import type { Role } from '@knazawy/shared';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  organisationId: string;
}

export interface TokenStore {
  getAccessToken(): string | null;
  setAccessToken(token: string | null): void;
}

export function memoryTokenStore(): TokenStore {
  let accessToken: string | null = null;
  return {
    getAccessToken: () => accessToken,
    setAccessToken: (token) => {
      accessToken = token;
    },
  };
}
