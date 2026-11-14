import type { Role, UserStatus } from './enums';

/** Roles an airline user can hold. A Karam role never sits on an airline. */
export const AIRLINE_ROLES = ['AIRLINE_REQUESTER', 'AIRLINE_FINANCE'] as const;

export type AirlineRole = (typeof AIRLINE_ROLES)[number];

export const AIRLINE_ROLE_LABELS: Record<AirlineRole, string> = {
  AIRLINE_REQUESTER: 'Requester',
  AIRLINE_FINANCE: 'Finance',
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: 'Active',
  INVITED: 'Invited',
  DISABLED: 'Disabled',
};

export function isAirlineRole(role: Role): role is AirlineRole {
  return (AIRLINE_ROLES as readonly Role[]).includes(role);
}

export interface AirlineUserRecord {
  id: string;
  name: string;
  email: string;
  role: AirlineRole;
  status: UserStatus;
}

export interface AirlineRecord {
  id: string;
  code: string;
  name: string;
  taxNumber: string | null;
  users: AirlineUserRecord[];
}
