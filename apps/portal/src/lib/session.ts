import { ApiClient, ApiError } from '@knazawy/api-client';
import { forgetLegacyToken, readSessionUser, writeSessionUser } from '@knazawy/auth-client';

export const api = new ApiClient('', 'portal');

forgetLegacyToken();

export { ApiError, readSessionUser, writeSessionUser };

/** Signs out: the API clears the session cookie, and the page forgets who was signed in. */
export function clearSession(): void {
  void api.logout().catch(() => undefined);
  writeSessionUser(null);
}
