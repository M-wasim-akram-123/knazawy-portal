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
    service_requests: ['C', 'R', 'U'],
    room_requests: ['C', 'R', 'U'],
    service_rates: ['R'],
    distribution: ['R'],
    invoices: ['R'],
  },
  AIRLINE_FINANCE: {
    service_rates: ['R'],
    invoices: ['C', 'R'],
    disputes: ['C', 'R'],
    ledger: ['R'],
  },
  // Unused. Karam owns the rooms, so there is no hotel partner login. The role stays so an old account still loads.
  HOTEL_COORDINATOR: {},
  OPERATIONS_MANAGER: {
    service_requests: ['R', 'U', 'A'],
    room_requests: ['R', 'U', 'A'],
    rooms: ['R'],
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
    rooms: ['R'],
    invoices: ['C', 'R', 'U', 'A'],
    disputes: ['R', 'A'],
    ledger: ['C', 'R', 'U'],
  },
  ADMINISTRATOR: {
    service_requests: ['R', 'U'],
    room_requests: ['R'],
    rooms: ['C', 'R', 'U'],
    service_rates: ['R', 'U'],
    purchases: ['C', 'R', 'U'],
    stock: ['C', 'R', 'U', 'A'],
    recipes: ['C', 'R', 'U', 'A'],
    invoices: ['R'],
    disputes: ['R'],
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
