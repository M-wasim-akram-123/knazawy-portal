import {
  BASE_UNIT_LABELS,
  type Actor,
  type StockIssueRecord,
} from '@knazawy/shared';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { assertCan } from '../auth/permissions';
import { formatIsoDate, parseIsoDate } from '../common/date';
import { parsePositiveDecimal } from '../common/decimal';
import { nextDocumentNumber } from '../common/document-number';
import { PrismaService } from '../prisma/prisma.service';

import { drawFifo } from './fifo';
import type { CreateIssueDto } from './issues.dto';

const issueInclude = {
  location: true,
  lines: { include: { item: true } },
} satisfies Prisma.StockIssueInclude;

type IssueRow = Prisma.StockIssueGetPayload<{ include: typeof issueInclude }>;

@Injectable()
export class IssuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: Actor): Promise<StockIssueRecord[]> {
    assertCan(actor, 'stock', 'R', 'view stock issues');
    const rows = await this.prisma.stockIssue.findMany({
      where: { organisationId: actor.organisationId },
      include: issueInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toIssue);
  }

  async create(actor: Actor, input: CreateIssueDto): Promise<StockIssueRecord> {
    assertCan(actor, 'stock', 'C', 'issue stock');
    const issuedOn = parseIsoDate(input.issuedOn);
    const requested = input.lines.map((line) => ({
      itemId: line.itemId,
      quantity: parsePositiveDecimal(line.quantity, 'Enter a quantity above zero.'),
    }));
    for (const line of requested) {
      if (line.quantity.decimalPlaces() > 3) {
        throw new BadRequestException('Enter the quantity with up to 3 decimal places.');
      }
    }
    const itemIds = requested.map((line) => line.itemId);
    if (new Set(itemIds).size !== itemIds.length) {
      throw new BadRequestException('Issue each item once.');
    }
    const note = input.note?.trim() || null;

    const issueId = await this.prisma.$transaction(async (tx) => {
      const location = await tx.stockLocation.findFirst({
        where: { id: input.locationId, organisationId: actor.organisationId, active: true },
      });
      if (!location) throw new BadRequestException('Choose an open location.');

      const items = await tx.item.findMany({
        where: { organisationId: actor.organisationId, id: { in: itemIds }, active: true },
      });
      const itemsById = new Map(items.map((item) => [item.id, item]));
      if (itemsById.size !== itemIds.length) {
        throw new BadRequestException('Choose an item that exists.');
      }

      const number = await nextDocumentNumber(tx, actor.organisationId, 'STOCK_ISSUE');
      const issue = await tx.stockIssue.create({
        data: {
          organisationId: actor.organisationId,
          number,
          locationId: location.id,
          issuedOn,
          reason: input.reason,
          note,
        },
      });

      for (const line of requested) {
        const item = itemsById.get(line.itemId);
        if (!item) throw new BadRequestException('Choose an item that exists.');
        const layers = await tx.stockLayer.findMany({
          where: {
            organisationId: actor.organisationId,
            itemId: item.id,
            locationId: location.id,
            quantityBase: { gt: 0 },
          },
          orderBy: [{ receivedOn: 'asc' }, { createdAt: 'asc' }],
        });
        const plan = drawFifo(layers, line.quantity, {
          item: item.name,
          location: location.name,
          unit: BASE_UNIT_LABELS[item.baseUnit],
        });

        const issueLine = await tx.stockIssueLine.create({
          data: {
            issueId: issue.id,
            itemId: item.id,
            quantityBase: line.quantity,
            cost: plan.cost,
          },
        });

        for (const draw of plan.draws) {
          const taken = await tx.stockLayer.updateMany({
            where: { id: draw.layerId, quantityBase: { gte: draw.quantityBase } },
            data: { quantityBase: { decrement: draw.quantityBase } },
          });
          if (taken.count !== 1) {
            throw new ConflictException(
              'Stock changed while you were issuing. Check the quantity and try again.',
            );
          }
          await tx.stockMovement.create({
            data: {
              organisationId: actor.organisationId,
              itemId: item.id,
              locationId: location.id,
              layerId: draw.layerId,
              issueId: issue.id,
              issueLineId: issueLine.id,
              type: 'ISSUE',
              quantityBase: draw.quantityBase.neg(),
              unitCost: draw.unitCost,
            },
          });
        }
      }

      const full = await tx.stockIssue.findUnique({ where: { id: issue.id }, include: issueInclude });
      if (!full) throw new NotFoundException('That issue was not found.');
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'StockIssue',
        entityId: issue.id,
        action: 'create',
        after: toIssue(full),
      });
      return issue.id;
    });

    const row = await this.prisma.stockIssue.findUnique({
      where: { id: issueId },
      include: issueInclude,
    });
    if (!row) throw new NotFoundException('That issue was not found.');
    return toIssue(row);
  }
}

function toIssue(row: IssueRow): StockIssueRecord {
  return {
    id: row.id,
    number: row.number,
    locationId: row.locationId,
    locationName: row.location.name,
    issuedOn: formatIsoDate(row.issuedOn),
    reason: row.reason,
    note: row.note,
    lines: row.lines.map((line) => ({
      itemName: line.item.name,
      baseUnit: line.item.baseUnit,
      quantityBase: line.quantityBase.toString(),
      cost: line.cost.toString(),
    })),
  };
}
