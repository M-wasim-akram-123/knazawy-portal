import type { Actor, HotelRoomRecord, RoomFloorRecord, RoomTypeRecord } from '@knazawy/shared';
import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import {
  CreateChargeDto,
  CreateFloorDto,
  CreateHotelRoomDto,
  CreateRoomTypeDto,
  UpdateChargeDto,
  UpdateFloorDto,
  UpdateHotelRoomDto,
  UpdateRoomTypeDto,
} from './room-setup.dto';
import { RoomSetupService } from './room-setup.service';

@ApiTags('Room floors')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('room-floors')
export class RoomFloorsController {
  constructor(private readonly rooms: RoomSetupService) {}

  @Get()
  list(@CurrentUser() actor: Actor): Promise<RoomFloorRecord[]> {
    return this.rooms.listFloors(actor);
  }

  @Post()
  create(@CurrentUser() actor: Actor, @Body() body: CreateFloorDto): Promise<RoomFloorRecord> {
    return this.rooms.createFloor(actor, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Body() body: UpdateFloorDto,
  ): Promise<RoomFloorRecord> {
    return this.rooms.updateFloor(actor, id, body);
  }
}

@ApiTags('Room types')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('room-types')
export class RoomTypesController {
  constructor(private readonly rooms: RoomSetupService) {}

  @Get()
  list(@CurrentUser() actor: Actor): Promise<RoomTypeRecord[]> {
    return this.rooms.listTypes(actor);
  }

  @Post()
  create(@CurrentUser() actor: Actor, @Body() body: CreateRoomTypeDto): Promise<RoomTypeRecord> {
    return this.rooms.createType(actor, body);
  }

  @Post(':id/charges')
  addCharge(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Body() body: CreateChargeDto,
  ): Promise<RoomTypeRecord> {
    return this.rooms.addCharge(actor, id, body);
  }

  @Patch(':id/charges/:chargeId')
  updateCharge(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Param('chargeId') chargeId: string,
    @Body() body: UpdateChargeDto,
  ): Promise<RoomTypeRecord> {
    return this.rooms.updateCharge(actor, id, chargeId, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Body() body: UpdateRoomTypeDto,
  ): Promise<RoomTypeRecord> {
    return this.rooms.updateType(actor, id, body);
  }
}

@ApiTags('Hotel rooms')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('hotel-rooms')
export class HotelRoomsController {
  constructor(private readonly rooms: RoomSetupService) {}

  @Get()
  list(@CurrentUser() actor: Actor): Promise<HotelRoomRecord[]> {
    return this.rooms.listRooms(actor);
  }

  @Post()
  create(@CurrentUser() actor: Actor, @Body() body: CreateHotelRoomDto): Promise<HotelRoomRecord> {
    return this.rooms.createRoom(actor, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Body() body: UpdateHotelRoomDto,
  ): Promise<HotelRoomRecord> {
    return this.rooms.updateRoom(actor, id, body);
  }
}
