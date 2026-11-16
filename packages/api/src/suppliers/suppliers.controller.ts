import type { Actor, SupplierRecord } from '@knazawy/shared';
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { CreateSupplierDto, UpdateSupplierDto } from './suppliers.dto';
import { SuppliersService } from './suppliers.service';

@ApiTags('Suppliers')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  list(
    @CurrentUser() actor: Actor,
    @Query('includeArchived') includeArchived?: string,
  ): Promise<SupplierRecord[]> {
    return this.suppliers.list(actor, includeArchived === 'true');
  }

  @Post()
  create(@CurrentUser() actor: Actor, @Body() body: CreateSupplierDto): Promise<SupplierRecord> {
    return this.suppliers.create(actor, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Body() body: UpdateSupplierDto,
  ): Promise<SupplierRecord> {
    return this.suppliers.update(actor, id, body);
  }
}
