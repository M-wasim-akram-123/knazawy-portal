import type { Actor, ItemRecord } from '@knazawy/shared';
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { CreateItemDto, UpdateItemDto } from './items.dto';
import { ItemsService } from './items.service';

@ApiTags('Items')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('items')
export class ItemsController {
  constructor(private readonly items: ItemsService) {}

  @Get()
  list(
    @CurrentUser() actor: Actor,
    @Query('includeArchived') includeArchived?: string,
  ): Promise<ItemRecord[]> {
    return this.items.list(actor, includeArchived === 'true');
  }

  @Post()
  create(@CurrentUser() actor: Actor, @Body() body: CreateItemDto): Promise<ItemRecord> {
    return this.items.create(actor, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Body() body: UpdateItemDto,
  ): Promise<ItemRecord> {
    return this.items.update(actor, id, body);
  }
}
