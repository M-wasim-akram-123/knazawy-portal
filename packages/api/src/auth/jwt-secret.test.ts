import { jwtSecret } from './jwt-secret';

describe('jwtSecret', () => {
  it('uses the configured secret', () => {
    expect(jwtSecret('local-secret', 'development')).toBe('local-secret');
  });

  it('refuses to start production without a secret', () => {
    expect(() => jwtSecret(undefined, 'production')).toThrow('JWT_ACCESS_SECRET is required');
  });
});
