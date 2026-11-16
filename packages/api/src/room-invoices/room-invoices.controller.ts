import type { Actor, RoomBillableRecord, RoomInvoiceRecord } from '@knazawy/shared';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { CreditRoomInvoiceDto, RaiseRoomInvoiceDto } from './room-invoices.dto';
import { RoomInvoicesService } from './room-invoices.service';

@ApiTags('Room invoices')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('room-invoices')
export class RoomInvoicesController {
  constructor(private readonly invoices: RoomInvoicesService) {}

  @Get()
  list(@CurrentUser() actor: Actor): Promise<RoomInvoiceRecord[]> {
    return this.invoices.list(actor);
  }

  @Get('billable')
  billable(@CurrentUser() actor: Actor): Promise<RoomBillableRecord[]> {
    return this.invoices.billable(actor);
  }

  @Post()
  raise(
    @CurrentUser() actor: Actor,
    @Body() body: RaiseRoomInvoiceDto,
  ): Promise<RoomInvoiceRecord> {
    return this.invoices.raise(actor, body.roomRequestId);
  }

  @Post(':id/credit')
  credit(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Body() body: CreditRoomInvoiceDto,
  ): Promise<RoomInvoiceRecord> {
    return this.invoices.credit(actor, id, body);
  }
}
