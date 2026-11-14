import type { Actor, LocationRecord } from '@knazawy/shared';
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { CreateLocationDto, UpdateLocationDto } from './locations.dto';
import { LocationsService } from './locations.service';

@ApiTags('Locations')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get()
  list(
    @CurrentUser() actor: Actor,
    @Query('includeArchived') includeArchived?: string,
  ): Promise<LocationRecord[]> {
    return this.locations.list(actor, includeArchived === 'true');
  }

  @Post()
  create(@CurrentUser() actor: Actor, @Body() body: CreateLocationDto): Promise<LocationRecord> {
    return this.locations.create(actor, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Body() body: UpdateLocationDto,
  ): Promise<LocationRecord> {
    return this.locations.update(actor, id, body);
  }
}
