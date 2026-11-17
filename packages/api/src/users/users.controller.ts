import type { Actor, UserAccountRecord } from '@knazawy/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { CreateUserDto, SetPasswordDto, UpdateUserDto } from './users.dto';
import { UsersService } from './users.service';

/** Every account, staff and airline. Administrators only. */
@ApiTags('Users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@CurrentUser() actor: Actor): Promise<UserAccountRecord[]> {
    return this.users.list(actor);
  }

  @Post()
  create(@CurrentUser() actor: Actor, @Body() body: CreateUserDto): Promise<UserAccountRecord> {
    return this.users.create(actor, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
  ): Promise<UserAccountRecord> {
    return this.users.update(actor, id, body);
  }

  @Post(':id/password')
  setPassword(
    @CurrentUser() actor: Actor,
    @Param('id') id: string,
    @Body() body: SetPasswordDto,
  ): Promise<UserAccountRecord> {
    return this.users.setPassword(actor, id, body.password);
  }

  @Post(':id/revoke')
  revoke(@CurrentUser() actor: Actor, @Param('id') id: string): Promise<UserAccountRecord> {
    return this.users.setStatus(actor, id, 'DISABLED');
  }

  @Post(':id/restore')
  restore(@CurrentUser() actor: Actor, @Param('id') id: string): Promise<UserAccountRecord> {
    return this.users.setStatus(actor, id, 'ACTIVE');
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() actor: Actor, @Param('id') id: string): Promise<void> {
    return this.users.remove(actor, id);
  }
}
