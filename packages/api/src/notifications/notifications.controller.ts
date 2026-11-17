import type { Actor, NotificationPing, NotificationRecord } from '@knazawy/shared';
import { Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { CurrentUser } from '../auth/current-user';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard';

import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly jwt: JwtService,
  ) {}

  @Get()
  list(@CurrentUser() actor: Actor): Promise<NotificationRecord[]> {
    return this.notifications.list(actor);
  }

  /**
   * Server-sent events. Each new notification for the signed-in user arrives as a
   * `notification` event. A comment line every 25 seconds keeps proxies from closing it.
   */
  @Get('stream')
  stream(@CurrentUser() actor: Actor, @Req() request: Request, @Res() response: Response): void {
    let closed = false;
    const listener = (ping: NotificationPing) => {
      if (!closed) response.write(`event: notification\ndata: ${JSON.stringify(ping)}\n\n`);
    };
    const unsubscribe = this.notifications.subscribe(actor.id, listener);
    if (!unsubscribe) {
      response.status(429).json({
        statusCode: 429,
        message: 'Too many live connections. Close another tab and try again.',
      });
      return;
    }

    response.status(200);
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    // no-transform stops compression middleware, which would hold events back.
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();
    response.write(': connected\n\n');

    const close = () => {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      clearTimeout(expiry);
      unsubscribe();
      response.end();
    };
    // The guard checked the token once. End the stream when that token expires, and drop it
    // early if the account is disabled meanwhile, so a signed-out user stops hearing anything.
    const expiry = setTimeout(close, millisecondsLeft(this.jwt, request as AuthenticatedRequest));
    const heartbeat = setInterval(() => {
      void this.notifications.isActive(actor.id).then((active) => {
        if (!active) close();
        else if (!closed) response.write(': ping\n\n');
      });
    }, 25_000);
    request.on('close', close);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() actor: Actor): Promise<number> {
    return this.notifications.unreadCount(actor);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() actor: Actor): Promise<{ count: number; readAt: string }> {
    return this.notifications.markAllRead(actor);
  }

  @Post(':id/read')
  markRead(@CurrentUser() actor: Actor, @Param('id') id: string): Promise<NotificationRecord> {
    return this.notifications.markRead(actor, id);
  }
}

/** Time until the caller's access token expires, at most 30 minutes. */
function millisecondsLeft(jwt: JwtService, request: AuthenticatedRequest): number {
  const ceiling = 30 * 60 * 1000;
  const token = request.accessToken ?? '';
  const payload: unknown = token ? jwt.decode(token) : null;
  const exp =
    payload && typeof payload === 'object' && 'exp' in payload ? Number(payload.exp) : NaN;
  if (!Number.isFinite(exp)) return ceiling;
  return Math.max(0, Math.min(ceiling, exp * 1000 - Date.now()));
}
