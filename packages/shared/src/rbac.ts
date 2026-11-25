import type { Access, Area, Role } from './enums';

const KARAM_ROLES: readonly Role[] = [
  'OPERATIONS_MANAGER',
  'STOREKEEPER',
  'HEAD_CHEF',
  'CHEF',
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
    meal_cost: ['R'],
    distribution: ['C', 'R', 'U'],
    invoices: ['R'],
    forecast: ['R'],
  },
  STOREKEEPER: {
    service_requests: ['R'],
    purchases: ['C', 'R', 'U'],
    stock: ['C', 'R', 'U'],
  },
  // The head chef owns the recipes: adds, changes, and approves them.
  HEAD_CHEF: {
    service_requests: ['R'],
    stock: ['R'],
    recipes: ['C', 'R', 'U', 'A'],
    meal_cost: ['R'],
    forecast: ['R'],
  },
  // A chef only looks: the orders to prepare, the recipes, and the week ahead.
  CHEF: {
    service_requests: ['R'],
    recipes: ['R'],
    forecast: ['R'],
  },
  // Money only: prices, invoices, disputes, the ledger, meal cost, and approving what is bought.
  FINANCE_OFFICER: {
    service_rates: ['C', 'R', 'U', 'A'],
    purchases: ['R', 'A'],
    meal_cost: ['R'],
    invoices: ['C', 'R', 'U', 'A'],
    disputes: ['R', 'A'],
    ledger: ['C', 'R', 'U'],
  },
  ADMINISTRATOR: {
    service_requests: ['R', 'U', 'A'],
    room_requests: ['R'],
    rooms: ['C', 'R', 'U'],
    service_rates: ['R', 'U'],
    purchases: ['C', 'R', 'U'],
    stock: ['C', 'R', 'U', 'A'],
    recipes: ['C', 'R', 'U', 'A'],
    meal_cost: ['R'],
    invoices: ['R'],
    disputes: ['R'],
    ledger: ['R'],
    forecast: ['R'],
    branches: ['C', 'R', 'U'],
    users: ['C', 'R', 'U'],
  },
};

export function isKaramRole(role: Role): boolean {
  return KARAM_ROLES.includes(role);
}

export function can(role: Role, area: Area, access: Access): boolean {
  return ROLE_ACCESS[role]?.[area]?.includes(access) ?? false;
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
