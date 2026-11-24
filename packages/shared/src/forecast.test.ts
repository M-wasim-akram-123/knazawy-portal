import {
  addIsoDays,
  buildForecastRows,
  expectedQuantity,
  forecastDates,
  forecastSourceDates,
  type DemandLine,
} from './forecast';
import { can } from './rbac';

const TODAY = '2026-11-14';

function line(overrides: Partial<DemandLine>): DemandLine {
  return {
    airlineId: 'air-1',
    airlineName: 'Sample Air',
    recipeId: 'rec-1',
    recipeName: 'Chicken biryani',
    recipeKind: 'MEAL',
    serviceDate: TODAY,
    status: 'ACCEPTED',
    quantity: 10,
    ...overrides,
  };
}

describe('forecast dates', () => {
  it('covers today and the next six days, across a month end', () => {
    expect(forecastDates('2026-11-28')).toEqual([
      '2026-11-28',
      '2026-11-29',
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
      '2026-12-03',
      '2026-12-04',
    ]);
  });

  it('learns from the same weekday in each of the last four weeks', () => {
    expect(forecastSourceDates(TODAY)).toEqual([
      '2026-11-07',
      '2026-10-31',
      '2026-10-24',
      '2026-10-17',
    ]);
    expect(addIsoDays('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('expected quantity', () => {
  it('averages the same weekday over four weeks, counting empty weeks as zero', () => {
    const quantities: Record<string, number> = {
      '2026-11-07': 20,
      '2026-10-31': 0,
      '2026-10-24': 10,
    };
    expect(expectedQuantity(TODAY, (date) => quantities[date] ?? 0)).toBe(7.5);
  });

  it('rounds to one decimal', () => {
    const quantities: Record<string, number> = { '2026-11-07': 1, '2026-10-31': 1 };
    expect(expectedQuantity(TODAY, (date) => quantities[date] ?? 0)).toBe(0.5);
  });
});

describe('forecast rows', () => {
  it('shows what is booked and what history expects for each day', () => {
    const rows = buildForecastRows(
      [
        line({ serviceDate: '2026-11-07', quantity: 40 }),
        line({ serviceDate: '2026-10-31', quantity: 20 }),
        line({ serviceDate: TODAY, quantity: 15 }),
      ],
      TODAY,
    );
    expect(rows).toHaveLength(1);
    const today = rows[0].days[0];
    expect(today).toEqual({ date: TODAY, booked: 15, expected: 15 });
    expect(rows[0].days[1]).toEqual({ date: '2026-11-15', booked: 0, expected: 0 });
  });

  it('counts only accepted or later requests as demand', () => {
    const rows = buildForecastRows(
      [
        line({ status: 'DRAFT', quantity: 99 }),
        line({ status: 'SUBMITTED', quantity: 99 }),
        line({ status: 'REJECTED', quantity: 99 }),
        line({ status: 'CANCELLED', quantity: 99 }),
        line({ status: 'DELIVERED', quantity: 4 }),
      ],
      TODAY,
    );
    expect(rows[0].days[0].booked).toBe(4);
  });

  it('keeps airlines and items apart, and sorts them', () => {
    const rows = buildForecastRows(
      [
        line({ airlineId: 'air-2', airlineName: 'Zed Air', recipeName: 'Tea', recipeId: 'rec-2' }),
        line({ airlineName: 'Sample Air', recipeName: 'Tea', recipeId: 'rec-2' }),
        line({ airlineName: 'Sample Air', recipeName: 'Chicken biryani' }),
      ],
      TODAY,
    );
    expect(rows.map((row) => `${row.airlineName} / ${row.recipeName}`)).toEqual([
      'Sample Air / Chicken biryani',
      'Sample Air / Tea',
      'Zed Air / Tea',
    ]);
  });

  it('leaves out an item with no booking and no history', () => {
    const rows = buildForecastRows([line({ serviceDate: '2026-09-01' })], TODAY);
    expect(rows).toEqual([]);
  });
});

describe('forecast permissions', () => {
  it('lets operations, the kitchen, and administrators read it, and no airline', () => {
    expect(can('OPERATIONS_MANAGER', 'forecast', 'R')).toBe(true);
    expect(can('HEAD_CHEF', 'forecast', 'R')).toBe(true);
    expect(can('CHEF', 'forecast', 'R')).toBe(true);
    expect(can('ADMINISTRATOR', 'forecast', 'R')).toBe(true);
    expect(can('AIRLINE_REQUESTER', 'forecast', 'R')).toBe(false);
    expect(can('FINANCE_OFFICER', 'forecast', 'R')).toBe(false);
  });
});
