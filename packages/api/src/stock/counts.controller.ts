import type { Actor, StockCountRecord } from '@knazawy/shared';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { CreateCountDto, SubmitCountDto } from './counts.dto';
import { CountsService } from './counts.service';

@ApiTags('Stock counts')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('stock/counts')
export class CountsController {
  constructor(private readonly counts: CountsService) {}

  @Get()
  list(@CurrentUser() actor: Actor): Promise<StockCountRecord[]> {
    return this.counts.list(actor);
  }

  @Post()
  create(@CurrentUser() actor: Actor, @Body() body: CreateCountDto): Promise<StockCountRecord> {
    return this.counts.create(actor, body);
  }

  @Post(':id/submit')
  submit(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Body() body: SubmitCountDto,
  ): Promise<StockCountRecord> {
    return this.counts.submit(actor, id, body);
  }

  @Post(':id/approve')
  approve(@CurrentUser() actor: Actor, @Param('id') id: string): Promise<StockCountRecord> {
    return this.counts.approve(actor, id);
  }

  @Post(':id/send-back')
  sendBack(@CurrentUser() actor: Actor, @Param('id') id: string): Promise<StockCountRecord> {
    return this.counts.sendBack(actor, id);
  }
}
