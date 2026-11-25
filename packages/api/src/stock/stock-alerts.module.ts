import { Module } from '@nestjs/common';

import { StockAlertsService } from './stock-alerts.service';

@Module({
  providers: [StockAlertsService],
  exports: [StockAlertsService],
})
export class StockAlertsModule {}
