import type { Actor, ProductionRecord } from '@knazawy/shared';
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { CreateProductionDto } from './production.dto';
import { ProductionService } from './production.service';

@ApiTags('Production')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('production')
export class ProductionController {
  constructor(private readonly production: ProductionService) {}

  @Get()
  list(@CurrentUser() actor: Actor): Promise<ProductionRecord[]> {
    return this.production.list(actor);
  }

  @Post()
  create(
    @CurrentUser() actor: Actor,
    @Body() body: CreateProductionDto,
  ): Promise<ProductionRecord> {
    return this.production.create(actor, body);
  }
}
