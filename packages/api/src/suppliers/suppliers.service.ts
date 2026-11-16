import type { Actor, SupplierRecord } from '@knazawy/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { assertCan } from '../auth/permissions';
import { rethrowUnique } from '../common/prisma-error';
import { PrismaService } from '../prisma/prisma.service';

import type { CreateSupplierDto, UpdateSupplierDto } from './suppliers.dto';

const supplierInclude = { items: true } satisfies Prisma.SupplierInclude;

type SupplierRow = Prisma.SupplierGetPayload<{ include: typeof supplierInclude }>;

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: Actor, includeArchived: boolean): Promise<SupplierRecord[]> {
    assertCan(actor, 'purchases', 'R', 'view suppliers');
    const rows = await this.prisma.supplier.findMany({
      where: {
        organisationId: actor.organisationId,
        ...(includeArchived ? {} : { active: true }),
      },
      include: supplierInclude,
      orderBy: { name: 'asc' },
    });
    return rows.map(toSupplier);
  }

  async create(actor: Actor, input: CreateSupplierDto): Promise<SupplierRecord> {
    assertCan(actor, 'purchases', 'C', 'add suppliers');
    const itemIds = await this.assertItems(actor.organisationId, input.itemIds ?? []);
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const supplier = await tx.supplier.create({
          data: {
            organisationId: actor.organisationId,
            name: input.name.trim(),
            contactName: blankToNull(input.contactName),
            phone: blankToNull(input.phone),
            email: blankToNull(input.email),
            taxNumber: blankToNull(input.taxNumber),
            paymentTermsDays: input.paymentTermsDays,
            items: { create: itemIds.map((itemId) => ({ itemId })) },
          },
          include: supplierInclude,
        });
        await this.audit.record(tx, {
          userId: actor.id,
          entity: 'Supplier',
          entityId: supplier.id,
          action: 'create',
          after: toSupplier(supplier),
        });
        return supplier;
      });
      return toSupplier(created);
    } catch (error) {
      rethrowUnique(error, 'That supplier is already on the list.');
    }
  }

  async update(actor: Actor, id: string, input: UpdateSupplierDto): Promise<SupplierRecord> {
    assertCan(actor, 'purchases', 'U', 'change suppliers');
    const existing = await this.requireSupplier(actor.organisationId, id);
    const itemIds =
      input.itemIds === undefined ? undefined : await this.assertItems(actor.organisationId, input.itemIds);
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const supplier = await tx.supplier.update({
          where: { id: existing.id },
          data: {
            ...(input.name === undefined ? {} : { name: input.name.trim() }),
            ...(input.contactName === undefined ? {} : { contactName: blankToNull(input.contactName) }),
            ...(input.phone === undefined ? {} : { phone: blankToNull(input.phone) }),
            ...(input.email === undefined ? {} : { email: blankToNull(input.email) }),
            ...(input.taxNumber === undefined ? {} : { taxNumber: blankToNull(input.taxNumber) }),
            ...(input.paymentTermsDays === undefined
              ? {}
              : { paymentTermsDays: input.paymentTermsDays }),
            ...(input.active === undefined ? {} : { active: input.active }),
            ...(itemIds === undefined
              ? {}
              : { items: { deleteMany: {}, create: itemIds.map((itemId) => ({ itemId })) } }),
          },
          include: supplierInclude,
        });
        await this.audit.record(tx, {
          userId: actor.id,
          entity: 'Supplier',
          entityId: supplier.id,
          action: 'update',
          before: toSupplier(existing),
          after: toSupplier(supplier),
        });
        return supplier;
      });
      return toSupplier(updated);
    } catch (error) {
      rethrowUnique(error, 'That supplier is already on the list.');
    }
  }

  private async requireSupplier(organisationId: string, id: string): Promise<SupplierRow> {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, organisationId },
      include: supplierInclude,
    });
    if (!supplier) throw new NotFoundException('That supplier is not on the list.');
    return supplier;
  }

  private async assertItems(organisationId: string, itemIds: string[]): Promise<string[]> {
    const unique = [...new Set(itemIds)];
    if (unique.length === 0) return [];
    const found = await this.prisma.item.findMany({
      where: { organisationId, id: { in: unique }, active: true },
      select: { id: true },
    });
    if (found.length !== unique.length) {
      throw new BadRequestException('Choose an item that exists.');
    }
    return unique;
  }
}

function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function toSupplier(row: SupplierRow): SupplierRecord {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contactName,
    phone: row.phone,
    email: row.email,
    taxNumber: row.taxNumber,
    paymentTermsDays: row.paymentTermsDays,
    active: row.active,
    itemIds: row.items.map((link) => link.itemId),
  };
}
