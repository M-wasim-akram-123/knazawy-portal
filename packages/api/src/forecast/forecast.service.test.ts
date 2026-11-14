import { ForbiddenException } from '@nestjs/common';

import { ForecastService } from './forecast.service';

const karam = {
  id: 'user-1',
  email: 'ops@karam.local',
  name: 'Operations Manager',
  role: 'OPERATIONS_MANAGER' as const,
  organisationId: 'org-karam',
};

// Karachi 14 Nov 2026, mid-morning.
const NOW = new Date('2026-11-14T05:00:00Z');

function day(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00Z`);
}

function lineRow(overrides: { date: string; quantity: number; status?: string }) {
  return {
    recipeId: 'rec-1',
    quantity: overrides.quantity,
    recipe: { name: 'Chicken biryani', kind: 'MEAL' },
    request: {
      organisationId: 'org-pia',
      status: overrides.status ?? 'ACCEPTED',
      serviceDate: day(overrides.date),
      organisation: { name: 'Sample Air' },
    },
  };
}

function serviceFor(findMany: jest.Mock): ForecastService {
  return new ForecastService({ serviceRequestLine: { findMany } } as never);
}

describe('ForecastService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('refuses an airline requester', async () => {
    const service = serviceFor(jest.fn());
    await expect(
      service.view({ ...karam, role: 'AIRLINE_REQUESTER', organisationId: 'org-pia' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('reads accepted demand for the look-back window and forecast days', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    await serviceFor(findMany).view(karam);

    const where = findMany.mock.calls[0][0].where;
    expect(where.request.serviceDate.gte).toEqual(day('2026-10-17'));
    expect(where.request.serviceDate.lte).toEqual(day('2026-11-20'));
    expect(where.request.status.in).toEqual(
      expect.arrayContaining(['ACCEPTED', 'DELIVERED', 'INVOICED']),
    );
    expect(where.request.status.in).not.toContain('CANCELLED');
  });

  it('forecasts the same weekday from the last four weeks', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValue([
        lineRow({ date: '2026-11-07', quantity: 20 }),
        lineRow({ date: '2026-10-31', quantity: 20 }),
        lineRow({ date: '2026-11-14', quantity: 10 }),
        lineRow({ date: '2026-11-07', quantity: 99, status: 'CANCELLED' }),
      ]);
    const view = await serviceFor(findMany).view(karam);

    expect(view.from).toBe('2026-10-17');
    expect(view.to).toBe('2026-11-20');
    expect(view.rows).toHaveLength(1);
    expect(view.rows[0]).toMatchObject({
      airlineName: 'Sample Air',
      recipeName: 'Chicken biryani',
      recipeKind: 'MEAL',
    });
    expect(view.rows[0].days[0]).toEqual({ date: '2026-11-14', booked: 10, expected: 10 });
  });
});
