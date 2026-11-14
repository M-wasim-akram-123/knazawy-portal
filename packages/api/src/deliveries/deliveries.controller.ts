import type { Actor, DeliveryRecord } from '@knazawy/shared';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { DispatchDeliveryDto, RecordDeliveryDto, StartDeliveryDto } from './deliveries.dto';
import { DeliveriesService } from './deliveries.service';

@ApiTags('Deliveries')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('deliveries')
export class DeliveriesController {
  constructor(private readonly deliveries: DeliveriesService) {}

  @Get()
  list(@CurrentUser() actor: Actor): Promise<DeliveryRecord[]> {
    return this.deliveries.list(actor);
  }

  @Post()
  start(@CurrentUser() actor: Actor, @Body() body: StartDeliveryDto): Promise<DeliveryRecord> {
    return this.deliveries.start(actor, body);
  }

  @Post(':id/dispatch')
  dispatch(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Body() body: DispatchDeliveryDto,
  ): Promise<DeliveryRecord> {
    return this.deliveries.dispatch(actor, id, body);
  }

  @Post(':id/deliver')
  deliver(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Body() body: RecordDeliveryDto,
  ): Promise<DeliveryRecord> {
    return this.deliveries.deliver(actor, id, body);
  }
}
