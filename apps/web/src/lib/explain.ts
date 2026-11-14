import { ApiError } from '@knazawy/api-client';
import type { SessionUser } from '@knazawy/auth-client';

import { clearSession } from './session';

export function explainApiError(error: unknown, setUser: (user: SessionUser | null) => void): string {
  if (error instanceof ApiError && error.status === 401) {
    clearSession();
    setUser(null);
    return 'Sign in to continue.';
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
}
