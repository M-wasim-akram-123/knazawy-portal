import type { Actor, NotificationPing, NotificationRecord, Role } from '@knazawy/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

type PingListener = (ping: NotificationPing) => void;

/** Open streams one user may hold, such as a phone and two browser tabs. */
export const MAX_STREAMS_PER_USER = 3;

export interface NotifyInput {
  organisationId: string;
  role: Role;
  title: string;
  body: string;
  entity: string;
  entityId: string;
  exceptUserId?: string;
  /** Only people working in this branch, plus anyone not tied to a branch. */
  branchId?: string;
}

@Injectable()
export class NotificationsService {
  /** Open live streams, by user. In-process: one API instance. Move to Redis pub/sub to scale out. */
  private readonly listeners = new Map<string, Set<PingListener>>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calls `listener` for each new notification for this user. Returns the unsubscribe, or null
   * when the user already holds the most streams allowed.
   */
  subscribe(userId: string, listener: PingListener): (() => void) | null {
    const set = this.listeners.get(userId) ?? new Set<PingListener>();
    if (set.size >= MAX_STREAMS_PER_USER) return null;
    set.add(listener);
    this.listeners.set(userId, set);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(userId);
    };
  }

  /** True while the account may still receive notifications. */
  async isActive(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    return user?.status === 'ACTIVE';
  }

  /** Active users in one role, except the person who just did the thing. */
  async notify(tx: Prisma.TransactionClient, input: NotifyInput): Promise<void> {
    const users = await tx.user.findMany({
      where: {
        organisationId: input.organisationId,
        role: input.role,
        status: 'ACTIVE',
        ...(input.exceptUserId ? { id: { not: input.exceptUserId } } : {}),
        ...(input.branchId ? { OR: [{ branchId: input.branchId }, { branchId: null }] } : {}),
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
    const ping: NotificationPing = {
      title: input.title,
      body: input.body,
      entity: input.entity,
      entityId: input.entityId,
    };
    for (const user of users) {
      for (const listener of this.listeners.get(user.id) ?? []) {
        // The write commits with the caller's transaction, so a client that refetches straight
        // away may be early. The client refetches again shortly after; see watchNotifications.
        listener(ping);
      }
    }
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
