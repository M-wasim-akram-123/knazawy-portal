import type { Actor, NotificationRecord } from '@knazawy/shared';
import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() actor: Actor): Promise<NotificationRecord[]> {
    return this.notifications.list(actor);
  }

  @Post(':id/read')
  markRead(@CurrentUser() actor: Actor, @Param('id') id: string): Promise<NotificationRecord> {
    return this.notifications.markRead(actor, id);
  }
}
