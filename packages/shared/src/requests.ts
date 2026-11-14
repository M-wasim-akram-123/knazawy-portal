import type { RecipeKind, RequestStatus } from './enums';

export const DELIVERY_POINTS = ['GATE', 'LOUNGE', 'AIRCRAFT', 'HOTEL'] as const;

export type DeliveryPoint = (typeof DELIVERY_POINTS)[number];

export const DELIVERY_POINT_LABELS: Record<DeliveryPoint, string> = {
  GATE: 'Gate',
  LOUNGE: 'Lounge',
  AIRCRAFT: 'Aircraft',
  HOTEL: 'Hotel',
};

/** Who can move a request on. An airline changes its own request until it is accepted. */
export type RequestAction = 'submit' | 'cancel' | 'accept' | 'reject';

const NEXT_STATUS: Partial<Record<RequestStatus, Partial<Record<RequestAction, RequestStatus>>>> = {
  DRAFT: { submit: 'SUBMITTED', cancel: 'CANCELLED' },
  SUBMITTED: { accept: 'ACCEPTED', reject: 'REJECTED', cancel: 'CANCELLED' },
};

/** The status a request moves to, or null when the action is not allowed from here. */
export function nextRequestStatus(
  from: RequestStatus,
  action: RequestAction,
): RequestStatus | null {
  return NEXT_STATUS[from]?.[action] ?? null;
}

/** Only a draft can change its details or its menu items. */
export function isRequestEditable(status: RequestStatus): boolean {
  return status === 'DRAFT';
}

/** Karam staff see a request once the airline has submitted it. */
export function isRequestVisibleToKaram(status: RequestStatus): boolean {
  return status !== 'DRAFT';
}

export interface PassengerSplit {
  adults: number;
  children: number;
  infants: number;
  crew: number;
  specialDiets: number;
}

export function passengerTotal(split: PassengerSplit): number {
  return split.adults + split.children + split.infants + split.crew;
}

export interface ServiceRequestLineRecord {
  recipeId: string;
  recipeName: string;
  kind: RecipeKind;
  quantity: number;
}

export interface ServiceRequestRecord {
  id: string;
  number: string;
  airlineId: string;
  airlineName: string;
  status: RequestStatus;
  flightNumber: string;
  route: string;
  serviceDate: string;
  deliveryTime: string;
  deliveryPoint: DeliveryPoint;
  deliveryDetail: string | null;
  passengers: PassengerSplit;
  specialDietNote: string | null;
  note: string | null;
  decisionNote: string | null;
  createdByName: string;
  submittedAt: string | null;
  decidedAt: string | null;
  lines: ServiceRequestLineRecord[];
}

/** A menu item an airline can order: an approved, active meal or snack recipe. */
export interface MenuItemRecord {
  id: string;
  name: string;
  kind: RecipeKind;
}
