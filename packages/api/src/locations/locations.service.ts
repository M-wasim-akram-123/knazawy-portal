import type { Actor, LocationRecord } from '@knazawy/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { assertCan } from '../auth/permissions';
import { rethrowUnique } from '../common/prisma-error';
import { PrismaService } from '../prisma/prisma.service';

import { parentCreatesCycle } from './location-tree';
import type { CreateLocationDto, UpdateLocationDto } from './locations.dto';

type LocationRow = {
  id: string;
  name: string;
  type: LocationRecord['type'];
  parentId: string | null;
  active: boolean;
};

@Injectable()
export class LocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: Actor, includeArchived: boolean): Promise<LocationRecord[]> {
    assertCan(actor, 'stock', 'R', 'view locations');
    const rows = await this.prisma.stockLocation.findMany({
      where: {
        organisationId: actor.organisationId,
        ...(includeArchived ? {} : { active: true }),
      },
      orderBy: { name: 'asc' },
    });
    return rows.map(toLocation);
  }

  async create(actor: Actor, input: CreateLocationDto): Promise<LocationRecord> {
    assertCan(actor, 'stock', 'C', 'add locations');
    const parentId = blankToNull(input.parentId);
    if (parentId) await this.ancestorIds(actor.organisationId, parentId);
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const location = await tx.stockLocation.create({
          data: {
            organisationId: actor.organisationId,
            name: input.name.trim(),
            type: input.type,
            parentId,
          },
        });
        await this.audit.record(tx, {
          userId: actor.id,
          entity: 'StockLocation',
          entityId: location.id,
          action: 'create',
          after: toLocation(location),
        });
        return location;
      });
      return toLocation(created);
    } catch (error) {
      rethrowUnique(error, 'That location is already on the list.');
    }
  }

  async update(actor: Actor, id: string, input: UpdateLocationDto): Promise<LocationRecord> {
    assertCan(actor, 'stock', 'U', 'change locations');
    const existing = await this.requireLocation(actor.organisationId, id);
    let parentId: string | null | undefined;
    if (input.parentId !== undefined) {
      parentId = blankToNull(input.parentId);
      if (parentId === id) {
        throw new BadRequestException('A location cannot sit inside itself.');
      }
      if (parentId) {
        const ancestors = await this.ancestorIds(actor.organisationId, parentId);
        if (parentCreatesCycle(id, ancestors)) {
          throw new BadRequestException('A location cannot sit inside itself.');
        }
      }
    }
    if (input.active === false) {
      const children = await this.prisma.stockLocation.count({
        where: { organisationId: actor.organisationId, parentId: id, active: true },
      });
      if (children > 0) {
        throw new BadRequestException('Archive the locations inside this one first.');
      }
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const location = await tx.stockLocation.update({
        where: { id: existing.id },
        data: {
          ...(input.name === undefined ? {} : { name: input.name.trim() }),
          ...(input.type === undefined ? {} : { type: input.type }),
          ...(parentId === undefined ? {} : { parentId }),
          ...(input.active === undefined ? {} : { active: input.active }),
        },
      });
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'StockLocation',
        entityId: location.id,
        action: 'update',
        before: toLocation(existing),
        after: toLocation(location),
      });
      return location;
    });
    return toLocation(updated);
  }

  private async requireLocation(organisationId: string, id: string): Promise<LocationRow> {
    const location = await this.prisma.stockLocation.findFirst({
      where: { id, organisationId },
    });
    if (!location) throw new NotFoundException('That location is not on the list.');
    return location;
  }

  private async ancestorIds(organisationId: string, parentId: string): Promise<string[]> {
    const ids: string[] = [];
    let current: string | null = parentId;
    const seen = new Set<string>();
    while (current) {
      if (seen.has(current)) {
        throw new BadRequestException('A location cannot sit inside itself.');
      }
      seen.add(current);
      const row: { parentId: string | null; active: boolean } | null =
        await this.prisma.stockLocation.findFirst({
          where: { id: current, organisationId },
          select: { parentId: true, active: true },
        });
      if (!row || !row.active) throw new BadRequestException('Choose an open location.');
      ids.push(current);
      current = row.parentId;
    }
    return ids;
  }
}

function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function toLocation(row: LocationRow): LocationRecord {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    parentId: row.parentId,
    active: row.active,
  };
}
