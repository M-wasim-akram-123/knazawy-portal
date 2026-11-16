import type { RecipeKind, RequestStatus } from './enums';
import type { DeliveryPoint } from './requests';

/** The three moves operations makes on a request once it is accepted. */
export type DeliveryStep = 'start' | 'dispatch' | 'deliver';

const MOVE: Record<DeliveryStep, { from: RequestStatus; to: RequestStatus }> = {
  start: { from: 'ACCEPTED', to: 'IN_PRODUCTION' },
  dispatch: { from: 'IN_PRODUCTION', to: 'DISPATCHED' },
  deliver: { from: 'DISPATCHED', to: 'DELIVERED' },
};

/** The request status after a delivery step, or null when the request is not at that step. */
export function requestStatusAfterDelivery(
  status: RequestStatus,
  step: DeliveryStep,
): RequestStatus | null {
  const move = MOVE[step];
  return status === move.from ? move.to : null;
}

export interface QuantityCheck {
  ordered: number;
  quantity: number;
}

/** Portions leaving the kitchen. Nothing leaves above what was ordered, and something must leave. */
export function dispatchQuantityError(lines: QuantityCheck[]): string | null {
  if (lines.some((line) => line.quantity > line.ordered)) {
    return 'Send no more than was ordered.';
  }
  if (lines.every((line) => line.quantity === 0)) return 'Send at least one portion.';
  return null;
}

/** Portions signed for on arrival. Nothing is recorded above what was sent. */
export function deliveredQuantityError(
  lines: Array<{ dispatched: number; quantity: number }>,
): string | null {
  if (lines.some((line) => line.quantity > line.dispatched)) {
    return 'Record no more than was sent.';
  }
  return null;
}

export interface DeliveryLineRecord {
  recipeId: string;
  recipeName: string;
  kind: RecipeKind;
  ordered: number;
  dispatched: number | null;
  delivered: number | null;
}

export interface DeliveryRecord {
  id: string;
  number: string;
  requestId: string;
  requestNumber: string;
  airlineId: string;
  airlineName: string;
  flightNumber: string;
  route: string;
  serviceDate: string;
  deliveryPoint: DeliveryPoint;
  status: RequestStatus;
  vehicleNote: string | null;
  receivedBy: string | null;
  note: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  lines: DeliveryLineRecord[];
}
