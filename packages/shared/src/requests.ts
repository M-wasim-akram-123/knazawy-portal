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
  ACCEPTED: { cancel: 'CANCELLED' },
};

/** Hours before delivery when the airline can no longer change or freely cancel. Asia/Karachi, no daylight saving. */
export const CUT_OFF_HOURS = 24;

const KARACHI_OFFSET_MINUTES = 5 * 60;

/** The delivery moment as an absolute time. Null when the date or time is not usable. */
export function deliveryInstant(serviceDate: string, deliveryTime: string): Date | null {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(serviceDate);
  const time = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(deliveryTime);
  if (!date || !time) return null;
  return new Date(
    Date.UTC(
      Number(date[1]),
      Number(date[2]) - 1,
      Number(date[3]),
      Number(time[1]),
      Number(time[2]) - KARACHI_OFFSET_MINUTES,
    ),
  );
}

/** When the airline's window to change the request closes. */
export function cutOffInstant(serviceDate: string, deliveryTime: string): Date | null {
  const delivery = deliveryInstant(serviceDate, deliveryTime);
  if (!delivery) return null;
  return new Date(delivery.getTime() - CUT_OFF_HOURS * 60 * 60 * 1000);
}

/** True once the cut-off moment has been reached. A bad date is treated as past, so it cannot be sent. */
export function isPastCutOff(
  serviceDate: string,
  deliveryTime: string,
  now: Date = new Date(),
): boolean {
  const cutOff = cutOffInstant(serviceDate, deliveryTime);
  if (!cutOff) return true;
  return now.getTime() >= cutOff.getTime();
}

/**
 * An airline may change a sent request until the cut-off.
 * Karam may change it after the cut-off, until production starts.
 */
export function amendmentError(
  status: RequestStatus,
  pastCutOff: boolean,
  byKaram: boolean,
): string | null {
  if (status !== 'SUBMITTED' && status !== 'ACCEPTED') {
    return 'This request can no longer be changed.';
  }
  if (!byKaram && pastCutOff) {
    return 'The cut-off has passed. Ask Karam to change this request.';
  }
  return null;
}

/** A charge applies only when Karam has accepted the request and the cut-off has passed. */
export function cancellationChargeApplies(status: RequestStatus, pastCutOff: boolean): boolean {
  return status === 'ACCEPTED' && pastCutOff;
}

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
  cutOffAt: string | null;
  lines: ServiceRequestLineRecord[];
  amendments: RequestAmendmentRecord[];
}

/** A recorded change to a request that was already sent. The request keeps its number. */
export interface RequestAmendmentRecord {
  id: string;
  number: string;
  reason: string;
  createdByName: string;
  createdAt: string;
}

/** A menu item an airline can order: an approved, active meal or snack recipe. */
export interface MenuItemRecord {
  id: string;
  name: string;
  kind: RecipeKind;
}
