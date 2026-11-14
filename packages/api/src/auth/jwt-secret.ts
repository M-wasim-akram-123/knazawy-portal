export function jwtSecret(configured: string | undefined, nodeEnv: string | undefined): string {
  if (configured && configured.length > 0) return configured;
  if (nodeEnv === 'production') {
    throw new Error('JWT_ACCESS_SECRET is required');
  }
  return 'dev-only-change-me';
}
