import type { Actor, MealCostRecord } from '@knazawy/shared';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { MealCostsService } from './meal-costs.service';

@ApiTags('Meal cost')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('meal-costs')
export class MealCostsController {
  constructor(private readonly mealCosts: MealCostsService) {}

  @Get()
  list(@CurrentUser() actor: Actor): Promise<MealCostRecord[]> {
    return this.mealCosts.list(actor);
  }
}
