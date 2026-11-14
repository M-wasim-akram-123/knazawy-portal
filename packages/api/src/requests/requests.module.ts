import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { LedgerModule } from '../ledger/ledger.module';

import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';

@Module({
  imports: [AuthModule, LedgerModule],
  controllers: [RequestsController],
  providers: [RequestsService],
})
export class RequestsModule {}
