import {
  addIsoDays,
  buildForecastRows,
  FORECAST_DAYS,
  FORECAST_DEMAND_STATUSES,
  FORECAST_WEEKS,
  todayInKarachi,
  type Actor,
  type DemandLine,
  type ForecastRecord,
} from '@knazawy/shared';
import { Injectable } from '@nestjs/common';

import { assertCan } from '../auth/permissions';
import { formatIsoDate, parseIsoDate } from '../common/date';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ForecastService {
  constructor(private readonly prisma: PrismaService) {}

  /** Expected meals and snacks per airline and item, for today and the next six days. */
  async view(actor: Actor): Promise<ForecastRecord> {
    assertCan(actor, 'forecast', 'R', 'view the forecast');
    const today = todayInKarachi();
    const from = addIsoDays(today, -FORECAST_WEEKS * 7);
    const to = addIsoDays(today, FORECAST_DAYS - 1);

    const lines = await this.prisma.serviceRequestLine.findMany({
      where: {
        recipe: { organisationId: actor.organisationId },
        request: {
          status: { in: [...FORECAST_DEMAND_STATUSES] },
          serviceDate: { gte: parseIsoDate(from), lte: parseIsoDate(to) },
        },
      },
      include: {
        recipe: true,
        request: { include: { organisation: true } },
      },
    });

    const demand: DemandLine[] = lines.map((line) => ({
      airlineId: line.request.organisationId,
      airlineName: line.request.organisation.name,
      recipeId: line.recipeId,
      recipeName: line.recipe.name,
      recipeKind: line.recipe.kind,
      serviceDate: formatIsoDate(line.request.serviceDate),
      status: line.request.status,
      quantity: line.quantity,
    }));

    return { from, to, rows: buildForecastRows(demand, today) };
  }
}
