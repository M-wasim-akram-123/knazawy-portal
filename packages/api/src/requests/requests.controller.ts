import type { Actor, MenuItemRecord, ServiceRequestRecord } from '@knazawy/shared';
import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { RejectServiceRequestDto, ServiceRequestDto } from './requests.dto';
import { RequestsService } from './requests.service';

@ApiTags('Requests')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('requests')
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  @Get()
  list(@CurrentUser() actor: Actor): Promise<ServiceRequestRecord[]> {
    return this.requests.list(actor);
  }

  @Get('menu')
  menu(@CurrentUser() actor: Actor): Promise<MenuItemRecord[]> {
    return this.requests.menu(actor);
  }

  @Post()
  create(
    @CurrentUser() actor: Actor,
    @Body() body: ServiceRequestDto,
  ): Promise<ServiceRequestRecord> {
    return this.requests.create(actor, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Body() body: ServiceRequestDto,
  ): Promise<ServiceRequestRecord> {
    return this.requests.update(actor, id, body);
  }

  @Post(':id/submit')
  submit(@CurrentUser() actor: Actor, @Param('id') id: string): Promise<ServiceRequestRecord> {
    return this.requests.submit(actor, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() actor: Actor, @Param('id') id: string): Promise<ServiceRequestRecord> {
    return this.requests.cancel(actor, id);
  }

  @Post(':id/accept')
  accept(@CurrentUser() actor: Actor, @Param('id') id: string): Promise<ServiceRequestRecord> {
    return this.requests.accept(actor, id);
  }

  @Post(':id/reject')
  reject(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Body() body: RejectServiceRequestDto,
  ): Promise<ServiceRequestRecord> {
    return this.requests.reject(actor, id, body);
  }
}
