import type { Actor, AirlineOption, RateCardRecord } from '@knazawy/shared';
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { EndRateCardDto, RateCardDto } from './rate-cards.dto';
import { RateCardsService } from './rate-cards.service';

@ApiTags('Rate cards')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('rate-cards')
export class RateCardsController {
  constructor(private readonly rateCards: RateCardsService) {}

  @Get()
  list(
    @CurrentUser() actor: Actor,
    @Query('airlineId') airlineId?: string,
  ): Promise<RateCardRecord[]> {
    return this.rateCards.list(actor, airlineId);
  }

  @Get('airlines')
  airlines(@CurrentUser() actor: Actor): Promise<AirlineOption[]> {
    return this.rateCards.airlines(actor);
  }

  @Get('current')
  async current(
    @CurrentUser() actor: Actor,
    @Query('serviceDate') serviceDate: string,
    @Query('airlineId') airlineId?: string,
  ): Promise<{ card: RateCardRecord | null }> {
    const card = await this.rateCards.current(actor, serviceDate, airlineId);
    return { card };
  }

  @Post()
  create(@CurrentUser() actor: Actor, @Body() body: RateCardDto): Promise<RateCardRecord> {
    return this.rateCards.create(actor, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Body() body: RateCardDto,
  ): Promise<RateCardRecord> {
    return this.rateCards.update(actor, id, body);
  }

  @Post(':id/approve')
  approve(@CurrentUser() actor: Actor, @Param('id') id: string): Promise<RateCardRecord> {
    return this.rateCards.approve(actor, id);
  }

  @Post(':id/end')
  end(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Body() body: EndRateCardDto,
  ): Promise<RateCardRecord> {
    return this.rateCards.end(actor, id, body);
  }
}
