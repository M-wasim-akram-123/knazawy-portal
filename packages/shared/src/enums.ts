export const ORGANISATION_TYPES = {
  KARAM: 'KARAM',
  AIRLINE: 'AIRLINE',
  ONE_OFF_AIRLINE: 'ONE_OFF_AIRLINE',
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

export const BASE_UNITS = ['KG', 'LITRE', 'PIECE'] as const;

export type BaseUnit = (typeof BASE_UNITS)[number];

export const STORAGE_TYPES = ['DRY', 'CHILLED', 'FROZEN'] as const;

export type StorageType = (typeof STORAGE_TYPES)[number];

export const LOCATION_TYPES = [
  'STORE',
  'COLD_ROOM',
  'FREEZER',
  'KITCHEN',
  'VEHICLE',
  'BIN',
] as const;

export type LocationType = (typeof LOCATION_TYPES)[number];

export const PURCHASE_STATUSES = [
  'DRAFT',
  'SENT',
  'PART_RECEIVED',
  'RECEIVED',
  'CANCELLED',
] as const;

export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

/** Why stock leaves a location. Wastage and damage need a reason; the rest are routine use. */
export const STOCK_ISSUE_REASONS = ['KITCHEN_USE', 'WASTAGE', 'SPOILAGE', 'DAMAGE'] as const;

export type StockIssueReason = (typeof STOCK_ISSUE_REASONS)[number];

/** A transfer is on the way until the receiving location confirms it. */
export const TRANSFER_STATUSES = ['SENT', 'RECEIVED'] as const;

export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

/** A count is filled in, then approved, and only then changes stock. */
export const COUNT_STATUSES = ['COUNTING', 'WAITING', 'POSTED'] as const;

export type CountStatus = (typeof COUNT_STATUSES)[number];

/** A recipe is a meal or a snack. Hotel rooms are not cooked from a recipe. */
export const RECIPE_KINDS = ['MEAL', 'SNACK'] as const;

export type RecipeKind = (typeof RECIPE_KINDS)[number];

/** An approved recipe is the one production can use. A change sends it back to draft. */
export const RECIPE_STATUSES = ['DRAFT', 'APPROVED'] as const;

export type RecipeStatus = (typeof RECIPE_STATUSES)[number];

export const AREAS = [
  'service_requests',
  'room_requests',
  'rooms',
  'service_rates',
  'purchases',
  'stock',
  'recipes',
  'distribution',
  'invoices',
  'disputes',
  'ledger',
  'users',
] as const;

export type Area = (typeof AREAS)[number];

/** C create, R read, U update, A approve. */
export const ACCESS = ['C', 'R', 'U', 'A'] as const;

export type Access = (typeof ACCESS)[number];
