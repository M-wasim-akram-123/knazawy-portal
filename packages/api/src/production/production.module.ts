import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { StockAlertsModule } from '../stock/stock-alerts.module';

import { ProductionController } from './production.controller';
import { ProductionService } from './production.service';

@Module({
  imports: [AuthModule, StockAlertsModule],
  controllers: [ProductionController],
  providers: [ProductionService],
})
export class ProductionModule {}
