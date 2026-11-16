import type { Actor, StockTransferRecord } from '@knazawy/shared';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { CreateTransferDto, ReceiveTransferDto } from './transfers.dto';
import { TransfersService } from './transfers.service';

@ApiTags('Stock transfers')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('stock/transfers')
export class TransfersController {
  constructor(private readonly transfers: TransfersService) {}

  @Get()
  list(@CurrentUser() actor: Actor): Promise<StockTransferRecord[]> {
    return this.transfers.list(actor);
  }

  @Post()
  create(
    @CurrentUser() actor: Actor,
    @Body() body: CreateTransferDto,
  ): Promise<StockTransferRecord> {
    return this.transfers.create(actor, body);
  }

  @Post(':id/receive')
  receive(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Body() body: ReceiveTransferDto,
  ): Promise<StockTransferRecord> {
    return this.transfers.receive(actor, id, body);
  }
}
