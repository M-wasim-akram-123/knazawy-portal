import type { Actor, DisputeRecord } from '@knazawy/shared';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { DecideDisputeDto, OpenDisputeDto } from './disputes.dto';
import { DisputesService } from './disputes.service';

@ApiTags('Disputes')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Get()
  list(@CurrentUser() actor: Actor): Promise<DisputeRecord[]> {
    return this.disputes.list(actor);
  }

  @Post()
  open(@CurrentUser() actor: Actor, @Body() body: OpenDisputeDto): Promise<DisputeRecord> {
    return this.disputes.open(actor, body);
  }

  @Post(':id/accept')
  accept(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Body() body: DecideDisputeDto,
  ): Promise<DisputeRecord> {
    return this.disputes.accept(actor, id, body);
  }

  @Post(':id/reject')
  reject(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Body() body: DecideDisputeDto,
  ): Promise<DisputeRecord> {
    return this.disputes.reject(actor, id, body);
  }
}
