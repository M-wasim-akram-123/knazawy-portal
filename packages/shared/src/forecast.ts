import type { RecipeKind } from './enums';

/** The forecast learns from the same weekday over this many past weeks. */
export const FORECAST_WEEKS = 4;

/** The forecast covers today and the next six days. */
export const FORECAST_DAYS = 7;

/** Requests that were accepted count as demand. Draft, submitted, rejected, and cancelled ones do not. */
export const FORECAST_DEMAND_STATUSES = [
  'ACCEPTED',
  'IN_PRODUCTION',
  'DISPATCHED',
  'DELIVERED',
  'INVOICED',
] as const;

export function isForecastDemand(status: string): boolean {
  return (FORECAST_DEMAND_STATUSES as readonly string[]).includes(status);
}

/** One requested portion line, as the API reads it: an airline asked for a quantity of one recipe on one service date. */
export interface DemandLine {
  airlineId: string;
  airlineName: string;
  recipeId: string;
  recipeName: string;
  recipeKind: RecipeKind;
  serviceDate: string;
  status: string;
  quantity: number;
}

export interface ForecastDayRecord {
  date: string;
  /** Already accepted for this day. */
  booked: number;
  /** Expected from the same weekday in the past weeks. */
  expected: number;
}

export interface ForecastRowRecord {
  airlineId: string;
  airlineName: string;
  recipeId: string;
  recipeName: string;
  recipeKind: RecipeKind;
  days: ForecastDayRecord[];
}

export interface ForecastRecord {
  from: string;
  to: string;
  rows: ForecastRowRecord[];
}

/** Adds whole days to a YYYY-MM-DD date. */
export function addIsoDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The days the forecast covers: today, then the next six. */
export function forecastDates(today: string): string[] {
  return Array.from({ length: FORECAST_DAYS }, (_, index) => addIsoDays(today, index));
}

/** The earlier dates a forecast day learns from: the same weekday in each of the past weeks. */
export function forecastSourceDates(target: string): string[] {
  return Array.from({ length: FORECAST_WEEKS }, (_, index) => addIsoDays(target, -7 * (index + 1)));
}

/** Expected portions for one day: the average of the same weekday, to one decimal. A day with no request counts as zero. */
export function expectedQuantity(target: string, quantityOn: (isoDate: string) => number): number {
  const total = forecastSourceDates(target).reduce((sum, isoDate) => sum + quantityOn(isoDate), 0);
  return Math.round((total / FORECAST_WEEKS) * 10) / 10;
}

/**
 * Builds the forecast rows from accepted request lines. Only lines in the look-back window
 * and the forecast days are needed. Rows with no booking and no expectation are left out.
 */
export function buildForecastRows(lines: DemandLine[], today: string): ForecastRowRecord[] {
  const quantities = new Map<string, number>();
  const rowsByKey = new Map<string, Omit<ForecastRowRecord, 'days'>>();
  for (const line of lines) {
    if (!isForecastDemand(line.status)) continue;
    const key = `${line.airlineId}|${line.recipeId}`;
    const dayKey = `${key}|${line.serviceDate}`;
    quantities.set(dayKey, (quantities.get(dayKey) ?? 0) + line.quantity);
    if (!rowsByKey.has(key)) {
      rowsByKey.set(key, {
        airlineId: line.airlineId,
        airlineName: line.airlineName,
        recipeId: line.recipeId,
        recipeName: line.recipeName,
        recipeKind: line.recipeKind,
      });
    }
  }

  const rows: ForecastRowRecord[] = [];
  for (const [key, row] of rowsByKey) {
    const quantityOn = (isoDate: string) => quantities.get(`${key}|${isoDate}`) ?? 0;
    const days = forecastDates(today).map((date) => ({
      date,
      booked: quantityOn(date),
      expected: expectedQuantity(date, quantityOn),
    }));
    if (days.every((day) => day.booked === 0 && day.expected === 0)) continue;
    rows.push({ ...row, days });
  }

  return rows.sort(
    (a, b) =>
      a.airlineName.localeCompare(b.airlineName) || a.recipeName.localeCompare(b.recipeName),
  );
}
