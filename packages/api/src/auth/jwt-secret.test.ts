import { jwtSecret } from './jwt-secret';

describe('jwtSecret', () => {
  it('uses the configured secret', () => {
    expect(jwtSecret('local-secret', 'development')).toBe('local-secret');
  });

  it('refuses to start production without a secret', () => {
    expect(() => jwtSecret(undefined, 'production')).toThrow('JWT_ACCESS_SECRET is required');
  });

  it('refuses the fallback when NODE_ENV was forgotten or is staging', () => {
    expect(() => jwtSecret(undefined, undefined)).toThrow('JWT_ACCESS_SECRET is required');
    expect(() => jwtSecret(undefined, 'staging')).toThrow('JWT_ACCESS_SECRET is required');
  });

  it('refuses a short secret outside a developer machine', () => {
    expect(() => jwtSecret('short', 'production')).toThrow('at least 32');
    expect(jwtSecret('x'.repeat(32), 'production')).toBe('x'.repeat(32));
  });

  it('allows the fallback only on a developer machine', () => {
    expect(jwtSecret(undefined, 'development')).toBe('dev-only-change-me');
    expect(jwtSecret(undefined, 'test')).toBe('dev-only-change-me');
  });
});
