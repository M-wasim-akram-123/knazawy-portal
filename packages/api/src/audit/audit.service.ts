import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

@Injectable()
export class AuditService {
  async record(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      entity: string;
      entityId: string;
      action: string;
      before?: unknown;
      after?: unknown;
    },
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        userId: input.userId,
        entity: input.entity,
        entityId: input.entityId,
        action: input.action,
        before: asJson(input.before),
        after: asJson(input.after),
      },
    });
  }
}

function asJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
