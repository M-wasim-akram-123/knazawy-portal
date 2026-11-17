import { AIRLINE_ROLES } from './airlines';
import type { Role, UserStatus } from './enums';
import { can, isKaramRole } from './rbac';

/**
 * Accounts are made inside the system: there is no self sign-up and no "forgot password".
 * An administrator adds people, changes their details and passwords, revokes access, and
 * deletes an account that has never done anything. Anyone with history is revoked instead, so
 * records keep the name of who made them.
 */

export const STAFF_ROLES = [
  'OPERATIONS_MANAGER',
  'STOREKEEPER',
  'KITCHEN_LEAD',
  'FINANCE_OFFICER',
  'ADMINISTRATOR',
] as const satisfies readonly Role[];

export type StaffRole = (typeof STAFF_ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  AIRLINE_REQUESTER: 'Airline requester',
  AIRLINE_FINANCE: 'Airline finance',
  HOTEL_COORDINATOR: 'Hotel coordinator',
  OPERATIONS_MANAGER: 'Operations manager',
  STOREKEEPER: 'Storekeeper',
  KITCHEN_LEAD: 'Kitchen lead',
  FINANCE_OFFICER: 'Finance officer',
  ADMINISTRATOR: 'Administrator',
};

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 72;

export interface UserAccountRecord {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  organisationId: string;
  organisationName: string;
  /** True for Karam staff, false for an airline's people. */
  staff: boolean;
  branchId: string | null;
  branchName: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

/** Only a Karam administrator manages accounts. */
export function canManageUsers(role: Role): boolean {
  return isKaramRole(role) && can(role, 'users', 'U');
}

/** A Karam account takes a staff role; an airline account takes an airline role. */
export function roleFitsOrganisation(role: Role, staff: boolean): boolean {
  return staff
    ? (STAFF_ROLES as readonly Role[]).includes(role)
    : (AIRLINE_ROLES as readonly Role[]).includes(role);
}

/** Null when the password is acceptable. */
export function passwordError(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Use at most ${MAX_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

export type UserChange = 'revoke' | 'delete' | 'demote';

/**
 * Null when the change is allowed. An administrator cannot lock themselves out, and the last
 * active administrator cannot be revoked, deleted, or given another role.
 */
export function userChangeError(input: {
  change: UserChange;
  actorId: string;
  target: { id: string; role: Role; status: UserStatus };
  activeAdministrators: number;
}): string | null {
  const { change, actorId, target, activeAdministrators } = input;
  if (target.id === actorId) {
    if (change === 'revoke') return 'You cannot revoke your own account.';
    if (change === 'delete') return 'You cannot delete your own account.';
    return 'You cannot change your own role.';
  }
  const lastAdmin =
    target.role === 'ADMINISTRATOR' && target.status === 'ACTIVE' && activeAdministrators <= 1;
  if (lastAdmin) return 'Keep at least one active administrator.';
  return null;
}

/**
 * A token is still good only if it was issued after the password last changed. Changing a
 * password therefore signs that person out everywhere. Times are in whole seconds.
 */
export function tokenStillValid(issuedAtSeconds: number, passwordChangedAt: Date | null): boolean {
  if (!passwordChangedAt) return true;
  return issuedAtSeconds >= Math.floor(passwordChangedAt.getTime() / 1000);
}
