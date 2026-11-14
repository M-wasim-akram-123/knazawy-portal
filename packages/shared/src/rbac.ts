import type { Access, Area, Role } from './enums';

const KARAM_ROLES: readonly Role[] = [
  'OPERATIONS_MANAGER',
  'STOREKEEPER',
  'KITCHEN_LEAD',
  'FINANCE_OFFICER',
  'ADMINISTRATOR',
];

export const ROLE_ACCESS: Record<Role, Partial<Record<Area, readonly Access[]>>> = {
  AIRLINE_REQUESTER: {
    service_requests: ['C', 'R'],
    service_rates: ['R'],
    distribution: ['R'],
    invoices: ['R'],
  },
  AIRLINE_FINANCE: {
    service_rates: ['R'],
    invoices: ['C', 'R'],
    ledger: ['R'],
  },
  HOTEL_COORDINATOR: {
    service_requests: ['R', 'U'],
    service_rates: ['C', 'R'],
    invoices: ['R'],
  },
  OPERATIONS_MANAGER: {
    service_requests: ['R', 'U', 'A'],
    service_rates: ['R'],
    purchases: ['R', 'A'],
    stock: ['R', 'A'],
    recipes: ['R', 'A'],
    distribution: ['C', 'R', 'U'],
    invoices: ['R'],
  },
  STOREKEEPER: {
    service_requests: ['R'],
    purchases: ['C', 'R', 'U'],
    stock: ['C', 'R', 'U'],
  },
  KITCHEN_LEAD: {
    service_requests: ['R'],
    stock: ['R'],
    recipes: ['C', 'R', 'U'],
  },
  FINANCE_OFFICER: {
    service_rates: ['C', 'R', 'U', 'A'],
    purchases: ['R', 'A'],
    recipes: ['R'],
    invoices: ['C', 'R', 'U', 'A'],
    ledger: ['C', 'R', 'U'],
  },
  ADMINISTRATOR: {
    service_requests: ['R', 'U'],
    service_rates: ['R', 'U'],
    purchases: ['C', 'R', 'U'],
    stock: ['C', 'R', 'U', 'A'],
    recipes: ['C', 'R', 'U', 'A'],
    invoices: ['R'],
    ledger: ['R'],
    users: ['C', 'R', 'U'],
  },
};

export function isKaramRole(role: Role): boolean {
  return KARAM_ROLES.includes(role);
}

export function can(role: Role, area: Area, access: Access): boolean {
  return ROLE_ACCESS[role][area]?.includes(access) ?? false;
}

export interface OrganisationActor {
  role: Role;
  organisationId: string;
}

/** Karam staff may read every organisation. Partners may read only their own. */
export function canReadOrganisation(actor: OrganisationActor, organisationId: string): boolean {
  if (isKaramRole(actor.role)) return true;
  return actor.organisationId === organisationId;
}
