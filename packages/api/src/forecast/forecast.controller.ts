import type { Actor, ForecastRecord } from '@knazawy/shared';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { ForecastService } from './forecast.service';

@ApiTags('Forecast')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('forecast')
export class ForecastController {
  constructor(private readonly forecast: ForecastService) {}

  @Get()
  view(@CurrentUser() actor: Actor): Promise<ForecastRecord> {
    return this.forecast.view(actor);
  }
}
