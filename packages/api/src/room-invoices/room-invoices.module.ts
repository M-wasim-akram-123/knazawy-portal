import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { LedgerModule } from '../ledger/ledger.module';

import { RoomInvoicesController } from './room-invoices.controller';
import { RoomInvoicesService } from './room-invoices.service';

@Module({
  imports: [AuthModule, LedgerModule],
  controllers: [RoomInvoicesController],
  providers: [RoomInvoicesService],
})
export class RoomInvoicesModule {}
