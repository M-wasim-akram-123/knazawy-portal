import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { MealCostsController } from './meal-costs.controller';
import { MealCostsService } from './meal-costs.service';

@Module({
  imports: [AuthModule],
  controllers: [MealCostsController],
  providers: [MealCostsService],
})
export class MealCostsModule {}
