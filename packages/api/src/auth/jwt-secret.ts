const LOCAL_ENVIRONMENTS = new Set(['development', 'test']);
export const MIN_SECRET_LENGTH = 32;

/**
 * The key that signs access tokens. A fixed fallback is allowed only on a developer machine
 * (NODE_ENV development or test). Anywhere else, including a host where NODE_ENV was forgotten,
 * the API refuses to start without a long secret, because a known key lets anyone forge a login.
 */
export function jwtSecret(configured: string | undefined, nodeEnv: string | undefined): string {
  const local = nodeEnv !== undefined && LOCAL_ENVIRONMENTS.has(nodeEnv);
  if (configured && configured.length > 0) {
    if (!local && configured.length < MIN_SECRET_LENGTH) {
      throw new Error(`JWT_ACCESS_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
    }
    return configured;
  }
  if (!local) throw new Error('JWT_ACCESS_SECRET is required');
  return 'dev-only-change-me';
}
