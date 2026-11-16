import type { Actor, AirlineRecord } from '@knazawy/shared';
import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import {
  CreateAirlineDto,
  CreateAirlineUserDto,
  UpdateAirlineDto,
  UpdateAirlineUserDto,
} from './airlines.dto';
import { AirlinesService } from './airlines.service';

@ApiTags('Airlines')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('airlines')
export class AirlinesController {
  constructor(private readonly airlines: AirlinesService) {}

  @Get()
  list(@CurrentUser() actor: Actor): Promise<AirlineRecord[]> {
    return this.airlines.list(actor);
  }

  @Post()
  create(@CurrentUser() actor: Actor, @Body() body: CreateAirlineDto): Promise<AirlineRecord> {
    return this.airlines.create(actor, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Body() body: UpdateAirlineDto,
  ): Promise<AirlineRecord> {
    return this.airlines.update(actor, id, body);
  }

  @Post(':id/users')
  createUser(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Body() body: CreateAirlineUserDto,
  ): Promise<AirlineRecord> {
    return this.airlines.createUser(actor, id, body);
  }

  @Patch(':id/users/:userId')
  updateUser(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() body: UpdateAirlineUserDto,
  ): Promise<AirlineRecord> {
    return this.airlines.updateUser(actor, id, userId, body);
  }
}
