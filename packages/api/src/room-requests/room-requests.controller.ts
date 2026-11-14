import type { Actor, FreeRoomRecord, RoomOfferRecord, RoomRequestRecord } from '@knazawy/shared';
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { CheckInRoomsDto, RejectRoomRequestDto, RoomRequestDto } from './room-requests.dto';
import { RoomRequestsService } from './room-requests.service';

@ApiTags('Room requests')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('room-requests')
export class RoomRequestsController {
  constructor(private readonly requests: RoomRequestsService) {}

  @Get()
  list(@CurrentUser() actor: Actor): Promise<RoomRequestRecord[]> {
    return this.requests.list(actor);
  }

  @Get('offers')
  offers(
    @CurrentUser() actor: Actor,
    @Query('branchId') branchId: string,
  ): Promise<RoomOfferRecord[]> {
    return this.requests.offers(actor, branchId ?? '');
  }

  @Post()
  create(@CurrentUser() actor: Actor, @Body() body: RoomRequestDto): Promise<RoomRequestRecord> {
    return this.requests.create(actor, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Body() body: RoomRequestDto,
  ): Promise<RoomRequestRecord> {
    return this.requests.update(actor, id, body);
  }

  @Post(':id/submit')
  submit(@CurrentUser() actor: Actor, @Param('id') id: string): Promise<RoomRequestRecord> {
    return this.requests.submit(actor, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() actor: Actor, @Param('id') id: string): Promise<RoomRequestRecord> {
    return this.requests.cancel(actor, id);
  }

  @Post(':id/accept')
  accept(@CurrentUser() actor: Actor, @Param('id') id: string): Promise<RoomRequestRecord> {
    return this.requests.accept(actor, id);
  }

  @Post(':id/reject')
  reject(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Body() body: RejectRoomRequestDto,
  ): Promise<RoomRequestRecord> {
    return this.requests.reject(actor, id, body);
  }

  @Get(':id/free-rooms')
  freeRooms(@CurrentUser() actor: Actor, @Param('id') id: string): Promise<FreeRoomRecord[]> {
    return this.requests.freeRooms(actor, id);
  }

  @Post(':id/check-in')
  checkIn(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Body() body: CheckInRoomsDto,
  ): Promise<RoomRequestRecord> {
    return this.requests.checkIn(actor, id, body);
  }

  @Post(':id/stays/:stayId/check-out')
  checkOut(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Param('stayId') stayId: string,
  ): Promise<RoomRequestRecord> {
    return this.requests.checkOut(actor, id, stayId);
  }
}
