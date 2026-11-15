import type { Actor, NotificationRecord, Role } from '@knazawy/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

export interface NotifyInput {
  organisationId: string;
  role: Role;
  title: string;
  body: string;
  entity: string;
  entityId: string;
  exceptUserId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active users in one role, except the person who just did the thing. */
  async notify(tx: Prisma.TransactionClient, input: NotifyInput): Promise<void> {
    const users = await tx.user.findMany({
      where: {
        organisationId: input.organisationId,
        role: input.role,
        status: 'ACTIVE',
        ...(input.exceptUserId ? { id: { not: input.exceptUserId } } : {}),
      },
      select: { id: true },
    });
    if (users.length === 0) return;
    await tx.notification.createMany({
      data: users.map((user) => ({
        userId: user.id,
        title: input.title,
        body: input.body,
        entity: input.entity,
        entityId: input.entityId,
      })),
    });
  }

  async list(actor: Actor): Promise<NotificationRecord[]> {
    const rows = await this.prisma.notification.findMany({
      where: { userId: actor.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map(toNotification);
  }

  unreadCount(actor: Actor): Promise<number> {
    return this.prisma.notification.count({ where: { userId: actor.id, readAt: null } });
  }

  async markRead(actor: Actor, id: string): Promise<NotificationRecord> {
    const updated = await this.prisma.notification.updateMany({
      where: { id, userId: actor.id, readAt: null },
      data: { readAt: new Date() },
    });
    if (updated.count === 0) {
      const existing = await this.prisma.notification.findFirst({
        where: { id, userId: actor.id },
      });
      if (!existing) throw new NotFoundException('That notification was not found.');
      return toNotification(existing);
    }
    const row = await this.prisma.notification.findFirst({ where: { id, userId: actor.id } });
    if (!row) throw new NotFoundException('That notification was not found.');
    return toNotification(row);
  }

  async markAllRead(actor: Actor): Promise<{ count: number; readAt: string }> {
    const readAt = new Date();
    const updated = await this.prisma.notification.updateMany({
      where: { userId: actor.id, readAt: null },
      data: { readAt },
    });
    return { count: updated.count, readAt: readAt.toISOString() };
  }
}

function toNotification(row: {
  id: string;
  title: string;
  body: string;
  entity: string;
  entityId: string;
  readAt: Date | null;
  createdAt: Date;
}): NotificationRecord {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    entity: row.entity,
    entityId: row.entityId,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
