import type { Actor, PurchaseRecord } from '@knazawy/shared';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { CreatePurchaseDto, PurchaseLineDto } from './purchases.dto';
import { PurchasesService } from './purchases.service';

@ApiTags('Purchases')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Get()
  list(@CurrentUser() actor: Actor): Promise<PurchaseRecord[]> {
    return this.purchases.list(actor);
  }

  @Get(':id')
  get(@CurrentUser() actor: Actor, @Param('id') id: string): Promise<PurchaseRecord> {
    return this.purchases.get(actor, id);
  }

  @Post()
  create(@CurrentUser() actor: Actor, @Body() body: CreatePurchaseDto): Promise<PurchaseRecord> {
    return this.purchases.create(actor, body);
  }

  @Post(':id/lines')
  addLine(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Body() body: PurchaseLineDto,
  ): Promise<PurchaseRecord> {
    return this.purchases.addLine(actor, id, body);
  }

  @Post(':id/send')
  send(@CurrentUser() actor: Actor, @Param('id') id: string): Promise<PurchaseRecord> {
    return this.purchases.send(actor, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() actor: Actor, @Param('id') id: string): Promise<PurchaseRecord> {
    return this.purchases.cancel(actor, id);
  }
}
