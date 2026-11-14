import type { Actor, BranchRecord } from '@knazawy/shared';
import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { CreateBranchDto, UpdateBranchDto, UseBranchDto } from './branches.dto';
import { BranchesService } from './branches.service';

@ApiTags('Branches')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('branches')
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Get()
  list(@CurrentUser() actor: Actor): Promise<BranchRecord[]> {
    return this.branches.list(actor);
  }

  @Get('open')
  open(@CurrentUser() actor: Actor): Promise<BranchRecord[]> {
    return this.branches.open(actor);
  }

  @Get('for-stays')
  forStays(@CurrentUser() actor: Actor): Promise<BranchRecord[]> {
    return this.branches.forStays(actor);
  }

  @Post('current')
  use(@CurrentUser() actor: Actor, @Body() body: UseBranchDto): Promise<BranchRecord> {
    return this.branches.use(actor, body.branchId);
  }

  @Post()
  create(@CurrentUser() actor: Actor, @Body() body: CreateBranchDto): Promise<BranchRecord> {
    return this.branches.create(actor, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Body() body: UpdateBranchDto,
  ): Promise<BranchRecord> {
    return this.branches.update(actor, id, body);
  }
}
