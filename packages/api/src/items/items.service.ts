import type { Actor, ItemRecord } from '@knazawy/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { assertCan } from '../auth/permissions';
import { parseNonNegativeDecimal, parsePositiveDecimal } from '../common/decimal';
import { rethrowUnique } from '../common/prisma-error';
import { PrismaService } from '../prisma/prisma.service';

import type { CreateItemDto, UpdateItemDto } from './items.dto';

const itemInclude = { suppliers: true } satisfies Prisma.ItemInclude;

type ItemRow = Prisma.ItemGetPayload<{ include: typeof itemInclude }>;

@Injectable()
export class ItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: Actor, includeArchived: boolean): Promise<ItemRecord[]> {
    assertCan(actor, 'stock', 'R', 'view items');
    const rows = await this.prisma.item.findMany({
      where: {
        organisationId: actor.organisationId,
        ...(includeArchived ? {} : { active: true }),
      },
      include: itemInclude,
      orderBy: { name: 'asc' },
    });
    return rows.map(toItem);
  }

  async create(actor: Actor, input: CreateItemDto): Promise<ItemRecord> {
    assertCan(actor, 'stock', 'C', 'add items');
    const supplierIds = await this.assertSuppliers(actor.organisationId, input.supplierIds ?? []);
    const data = {
      organisationId: actor.organisationId,
      code: input.code.trim(),
      name: input.name.trim(),
      category: input.category.trim(),
      baseUnit: input.baseUnit,
      purchaseUnit: input.purchaseUnit.trim(),
      conversionToBase: parsePositiveDecimal(
        input.conversionToBase,
        'Enter how many base units are in one purchase unit. Use a number above zero.',
      ),
      reorderLevel: parseNonNegativeDecimal(
        input.reorderLevel,
        'Enter a reorder level of zero or more.',
      ),
      shelfLifeDays: input.shelfLifeDays,
      storageType: input.storageType,
      suppliers: { create: supplierIds.map((supplierId) => ({ supplierId })) },
    };
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const item = await tx.item.create({ data, include: itemInclude });
        await this.audit.record(tx, {
          userId: actor.id,
          entity: 'Item',
          entityId: item.id,
          action: 'create',
          after: toItem(item),
        });
        return item;
      });
      return toItem(created);
    } catch (error) {
      rethrowUnique(error, 'That code is already used.');
    }
  }

  async update(actor: Actor, id: string, input: UpdateItemDto): Promise<ItemRecord> {
    assertCan(actor, 'stock', 'U', 'change items');
    const existing = await this.requireItem(actor.organisationId, id);
    const supplierIds =
      input.supplierIds === undefined
        ? undefined
        : await this.assertSuppliers(actor.organisationId, input.supplierIds);
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const item = await tx.item.update({
          where: { id: existing.id },
          data: {
            ...(input.code === undefined ? {} : { code: input.code.trim() }),
            ...(input.name === undefined ? {} : { name: input.name.trim() }),
            ...(input.category === undefined ? {} : { category: input.category.trim() }),
            ...(input.baseUnit === undefined ? {} : { baseUnit: input.baseUnit }),
            ...(input.purchaseUnit === undefined ? {} : { purchaseUnit: input.purchaseUnit.trim() }),
            ...(input.conversionToBase === undefined
              ? {}
              : {
                  conversionToBase: parsePositiveDecimal(
                    input.conversionToBase,
                    'Enter how many base units are in one purchase unit. Use a number above zero.',
                  ),
                }),
            ...(input.reorderLevel === undefined
              ? {}
              : {
                  reorderLevel: parseNonNegativeDecimal(
                    input.reorderLevel,
                    'Enter a reorder level of zero or more.',
                  ),
                }),
            ...(input.shelfLifeDays === undefined ? {} : { shelfLifeDays: input.shelfLifeDays }),
            ...(input.storageType === undefined ? {} : { storageType: input.storageType }),
            ...(input.active === undefined ? {} : { active: input.active }),
            ...(supplierIds === undefined
              ? {}
              : {
                  suppliers: {
                    deleteMany: {},
                    create: supplierIds.map((supplierId) => ({ supplierId })),
                  },
                }),
          },
          include: itemInclude,
        });
        await this.audit.record(tx, {
          userId: actor.id,
          entity: 'Item',
          entityId: item.id,
          action: 'update',
          before: toItem(existing),
          after: toItem(item),
        });
        return item;
      });
      return toItem(updated);
    } catch (error) {
      rethrowUnique(error, 'That code is already used.');
    }
  }

  private async requireItem(organisationId: string, id: string): Promise<ItemRow> {
    const item = await this.prisma.item.findFirst({
      where: { id, organisationId },
      include: itemInclude,
    });
    if (!item) throw new NotFoundException('That item is not on the list.');
    return item;
  }

  private async assertSuppliers(organisationId: string, supplierIds: string[]): Promise<string[]> {
    const unique = [...new Set(supplierIds)];
    if (unique.length === 0) return [];
    const found = await this.prisma.supplier.findMany({
      where: { organisationId, id: { in: unique }, active: true },
      select: { id: true },
    });
    if (found.length !== unique.length) {
      throw new BadRequestException('Choose a supplier that exists.');
    }
    return unique;
  }
}

function toItem(row: ItemRow): ItemRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    baseUnit: row.baseUnit,
    purchaseUnit: row.purchaseUnit,
    conversionToBase: row.conversionToBase.toString(),
    reorderLevel: row.reorderLevel.toString(),
    shelfLifeDays: row.shelfLifeDays,
    storageType: row.storageType,
    active: row.active,
    supplierIds: row.suppliers.map((link) => link.supplierId),
  };
}
