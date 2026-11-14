import { ApiClient, ApiError } from '@knazawy/api-client';
import { browserTokenStore, readSessionUser, writeSessionUser } from '@knazawy/auth-client';

export const tokens = browserTokenStore();

export const api = new ApiClient('', tokens);

export { ApiError, readSessionUser, writeSessionUser };

export function clearSession(): void {
  tokens.setAccessToken(null);
  writeSessionUser(null);
}
