export const ORGANISATION_TYPES = {
  KARAM: 'KARAM',
  AIRLINE: 'AIRLINE',
  HOTEL: 'HOTEL',
  SUPPLIER: 'SUPPLIER',
} as const;

export type OrganisationType = (typeof ORGANISATION_TYPES)[keyof typeof ORGANISATION_TYPES];

export const ROLES = [
  'AIRLINE_REQUESTER',
  'AIRLINE_FINANCE',
  'HOTEL_COORDINATOR',
  'OPERATIONS_MANAGER',
  'STOREKEEPER',
  'KITCHEN_LEAD',
  'FINANCE_OFFICER',
  'ADMINISTRATOR',
] as const;

export type Role = (typeof ROLES)[number];

export const USER_STATUSES = {
  ACTIVE: 'ACTIVE',
  INVITED: 'INVITED',
  DISABLED: 'DISABLED',
} as const;

export type UserStatus = (typeof USER_STATUSES)[keyof typeof USER_STATUSES];

export const SERVICE_TYPES = {
  MEAL: 'MEAL',
  SNACK: 'SNACK',
  HOTEL_ROOM: 'HOTEL_ROOM',
} as const;

export type ServiceType = (typeof SERVICE_TYPES)[keyof typeof SERVICE_TYPES];

/** Order matches the operational lifecycle. Rejected and cancelled are terminal. */
export const REQUEST_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'ACCEPTED',
  'REJECTED',
  'IN_PRODUCTION',
  'DISPATCHED',
  'DELIVERED',
  'INVOICED',
  'CANCELLED',
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const AREAS = [
  'service_requests',
  'service_rates',
  'purchases',
  'stock',
  'recipes',
  'distribution',
  'invoices',
  'ledger',
  'users',
] as const;

export type Area = (typeof AREAS)[number];

/** C create, R read, U update, A approve. */
export const ACCESS = ['C', 'R', 'U', 'A'] as const;

export type Access = (typeof ACCESS)[number];
