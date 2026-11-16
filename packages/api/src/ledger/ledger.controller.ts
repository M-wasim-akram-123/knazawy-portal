import type { Actor, JournalEntryRecord } from '@knazawy/shared';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { LedgerService } from './ledger.service';

@ApiTags('Ledger')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get()
  list(@CurrentUser() actor: Actor): Promise<JournalEntryRecord[]> {
    return this.ledger.list(actor);
  }

  @Get('export')
  async export(@CurrentUser() actor: Actor): Promise<{ csv: string }> {
    return { csv: await this.ledger.exportCsv(actor) };
  }
}
