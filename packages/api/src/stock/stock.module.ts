import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { CountsController } from './counts.controller';
import { CountsService } from './counts.service';
import { IssuesController } from './issues.controller';
import { IssuesService } from './issues.service';
import { StockAlertsModule } from './stock-alerts.module';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';

@Module({
  imports: [AuthModule, StockAlertsModule],
  controllers: [StockController, IssuesController, TransfersController, CountsController],
  providers: [StockService, IssuesService, TransfersService, CountsService],
})
export class StockModule {}
