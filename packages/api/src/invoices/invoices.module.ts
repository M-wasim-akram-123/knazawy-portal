import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { LedgerModule } from '../ledger/ledger.module';

import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [AuthModule, LedgerModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
})
export class InvoicesModule {}
