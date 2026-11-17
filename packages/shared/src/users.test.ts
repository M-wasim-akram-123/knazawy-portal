import {
  canManageUsers,
  passwordError,
  roleFitsOrganisation,
  tokenStillValid,
  userChangeError,
} from './users';

const admin = { id: 'admin-1', role: 'ADMINISTRATOR' as const, status: 'ACTIVE' as const };
const store = { id: 'store-1', role: 'STOREKEEPER' as const, status: 'ACTIVE' as const };

describe('user accounts', () => {
  it('lets only a Karam administrator manage accounts', () => {
    expect(canManageUsers('ADMINISTRATOR')).toBe(true);
    expect(canManageUsers('OPERATIONS_MANAGER')).toBe(false);
    expect(canManageUsers('AIRLINE_FINANCE')).toBe(false);
  });

  it('keeps staff roles on Karam accounts and airline roles on airline accounts', () => {
    expect(roleFitsOrganisation('STOREKEEPER', true)).toBe(true);
    expect(roleFitsOrganisation('AIRLINE_REQUESTER', true)).toBe(false);
    expect(roleFitsOrganisation('AIRLINE_FINANCE', false)).toBe(true);
    expect(roleFitsOrganisation('ADMINISTRATOR', false)).toBe(false);
  });

  it('asks for a password of 10 to 72 characters', () => {
    expect(passwordError('short')).toMatch(/at least 10/);
    expect(passwordError('a'.repeat(73))).toMatch(/at most 72/);
    expect(passwordError('long-enough-1')).toBeNull();
  });

  it('stops an administrator locking themselves out', () => {
    for (const change of ['revoke', 'delete', 'demote'] as const) {
      expect(
        userChangeError({ change, actorId: 'admin-1', target: admin, activeAdministrators: 3 }),
      ).not.toBeNull();
    }
  });

  it('keeps the last active administrator', () => {
    expect(
      userChangeError({
        change: 'revoke',
        actorId: 'admin-2',
        target: admin,
        activeAdministrators: 1,
      }),
    ).toBe('Keep at least one active administrator.');
    expect(
      userChangeError({
        change: 'revoke',
        actorId: 'admin-2',
        target: admin,
        activeAdministrators: 2,
      }),
    ).toBeNull();
  });

  it('allows changes to anyone else', () => {
    expect(
      userChangeError({
        change: 'delete',
        actorId: 'admin-1',
        target: store,
        activeAdministrators: 1,
      }),
    ).toBeNull();
  });

  it('turns away a token issued before the password changed', () => {
    const changed = new Date('2026-11-17T10:00:00Z');
    const before = Math.floor(changed.getTime() / 1000) - 60;
    const after = Math.floor(changed.getTime() / 1000) + 1;
    expect(tokenStillValid(before, changed)).toBe(false);
    expect(tokenStillValid(after, changed)).toBe(true);
    expect(tokenStillValid(before, null)).toBe(true);
  });
});
