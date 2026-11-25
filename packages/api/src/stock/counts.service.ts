import { BASE_UNIT_LABELS, type Actor, type StockCountRecord } from '@knazawy/shared';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { assertCan } from '../auth/permissions';
import { requireBranch } from '../common/branch';
import { formatIsoDate, parseIsoDate } from '../common/date';
import { parseNonNegativeDecimal } from '../common/decimal';
import { nextDocumentNumber } from '../common/document-number';
import { PrismaService } from '../prisma/prisma.service';

import type { CreateCountDto, SubmitCountDto } from './counts.dto';
import { drawFifo } from './fifo';
import { StockAlertsService } from './stock-alerts.service';

const countInclude = {
  location: true,
  lines: { include: { item: true } },
} satisfies Prisma.StockCountInclude;

type CountRow = Prisma.StockCountGetPayload<{ include: typeof countInclude }>;
type CountLineRow = CountRow['lines'][number];

const OPEN_STATUSES = ['COUNTING', 'WAITING'] as const;

@Injectable()
export class CountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly alerts: StockAlertsService,
  ) {}

  async list(actor: Actor): Promise<StockCountRecord[]> {
    assertCan(actor, 'stock', 'R', 'view stock counts');
    const rows = await this.prisma.stockCount.findMany({
      where: { organisationId: actor.organisationId, location: { branchId: requireBranch(actor) } },
      include: countInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toCount);
  }

  async create(actor: Actor, input: CreateCountDto): Promise<StockCountRecord> {
    assertCan(actor, 'stock', 'C', 'start a stock count');
    const countedOn = parseIsoDate(input.countedOn);
    const note = input.note?.trim() || null;

    const countId = await this.prisma.$transaction(async (tx) => {
      const location = await tx.stockLocation.findFirst({
        where: {
          id: input.locationId,
          organisationId: actor.organisationId,
          branchId: requireBranch(actor),
          active: true,
        },
      });
      if (!location) throw new BadRequestException('Choose an open location.');

      const open = await tx.stockCount.findFirst({
        where: {
          organisationId: actor.organisationId,
          locationId: location.id,
          status: { in: [...OPEN_STATUSES] },
        },
      });
      if (open) {
        throw new BadRequestException(`${location.name} already has a count in progress.`);
      }

      const books = await booksAt(tx, actor.organisationId, location.id);
      const number = await nextDocumentNumber(tx, actor.organisationId, 'STOCK_COUNT');
      let count;
      try {
        count = await tx.stockCount.create({
          data: {
            organisationId: actor.organisationId,
            number,
            locationId: location.id,
            countedOn,
            note,
          },
        });
      } catch (error) {
        if (!isUniqueConflict(error)) throw error;
        throw new BadRequestException(`${location.name} already has a count in progress.`);
      }

      for (const [itemId, bookQuantity] of books) {
        await tx.stockCountLine.create({
          data: { countId: count.id, itemId, bookQuantity },
        });
      }

      const full = await tx.stockCount.findUnique({
        where: { id: count.id },
        include: countInclude,
      });
      if (!full) throw new NotFoundException('That count was not found.');
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'StockCount',
        entityId: count.id,
        action: 'create',
        after: toCount(full),
      });
      return count.id;
    });

    return this.reload(countId);
  }

  async submit(actor: Actor, id: string, input: SubmitCountDto): Promise<StockCountRecord> {
    assertCan(actor, 'stock', 'C', 'submit a stock count');
    const requested = parseCountedLines(input.lines);

    const drifted = await this.prisma.$transaction(async (tx) => {
      const count = await this.load(tx, actor.organisationId, id);
      if (count.status !== 'COUNTING') {
        throw new BadRequestException('This count is not open for counting.');
      }

      const known = new Map(count.lines.map((line) => [line.itemId, line]));
      for (const line of count.lines) {
        if (!requested.has(line.itemId)) {
          throw new BadRequestException(`Enter the counted quantity for ${line.item.name}.`);
        }
      }
      const addedIds = [...requested.keys()].filter((itemId) => !known.has(itemId));
      if (addedIds.length > 0) {
        const items = await tx.item.findMany({
          where: { organisationId: actor.organisationId, id: { in: addedIds }, active: true },
        });
        if (items.length !== addedIds.length) {
          throw new BadRequestException('Choose an item that exists.');
        }
      }

      const books = await booksAt(tx, actor.organisationId, count.locationId);
      const moved = count.lines.some(
        (line) => !sameQty(line.bookQuantity, bookFor(books, line.itemId)),
      );
      if (moved) {
        for (const line of count.lines) {
          await tx.stockCountLine.update({
            where: { id: line.id },
            data: {
              bookQuantity: bookFor(books, line.itemId),
              countedQuantity: requested.get(line.itemId),
            },
          });
        }
        for (const itemId of addedIds) {
          await tx.stockCountLine.create({
            data: {
              countId: count.id,
              itemId,
              bookQuantity: bookFor(books, itemId),
              countedQuantity: requested.get(itemId),
            },
          });
        }
        return true;
      }

      for (const line of count.lines) {
        await tx.stockCountLine.update({
          where: { id: line.id },
          data: { countedQuantity: requested.get(line.itemId) },
        });
      }
      for (const itemId of addedIds) {
        await tx.stockCountLine.create({
          data: {
            countId: count.id,
            itemId,
            bookQuantity: bookFor(books, itemId),
            countedQuantity: requested.get(itemId),
          },
        });
      }
      await tx.stockCount.update({ where: { id: count.id }, data: { status: 'WAITING' } });
      const full = await tx.stockCount.findUnique({
        where: { id: count.id },
        include: countInclude,
      });
      if (!full) throw new NotFoundException('That count was not found.');
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'StockCount',
        entityId: count.id,
        action: 'submit',
        after: toCount(full),
      });
      return false;
    });

    if (drifted) {
      throw new ConflictException(
        'Stock changed while you were counting. The sheet now shows the current quantities. Check them and submit again.',
      );
    }
    return this.reload(id);
  }

  async approve(actor: Actor, id: string): Promise<StockCountRecord> {
    assertCan(actor, 'stock', 'A', 'approve a stock count');

    await this.prisma.$transaction(async (tx) => {
      const count = await this.load(tx, actor.organisationId, id);
      if (count.status !== 'WAITING') {
        throw new BadRequestException('This count is not waiting for approval.');
      }
      const books = await booksAt(tx, actor.organisationId, count.locationId);
      const moved = count.lines.some(
        (line) => !sameQty(line.bookQuantity, bookFor(books, line.itemId)),
      );
      if (moved) {
        throw new ConflictException(
          'Stock changed while this count was waiting. Send it back and count again.',
        );
      }

      const claimed = await tx.stockCount.updateMany({
        where: { id: count.id, status: 'WAITING' },
        data: { status: 'POSTED' },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException('This count is not waiting for approval.');
      }

      const before = await this.alerts.levels(
        tx,
        actor.organisationId,
        count.location.branchId,
        count.lines.map((line) => line.itemId),
      );

      for (const line of count.lines) {
        const counted = line.countedQuantity;
        if (!counted)
          throw new BadRequestException(`Enter the counted quantity for ${line.item.name}.`);
        const variance = counted.minus(line.bookQuantity);
        const varianceCost = variance.isZero()
          ? new Prisma.Decimal(0)
          : variance.lt(0)
            ? await this.postShortage(tx, actor.organisationId, count, line, variance.neg())
            : await this.postSurplus(tx, actor.organisationId, count, line, variance);
        await tx.stockCountLine.update({
          where: { id: line.id },
          data: { varianceCost },
        });
      }

      await this.alerts.notifyCrossed(tx, {
        organisationId: actor.organisationId,
        branchId: count.location.branchId,
        before,
      });

      const full = await tx.stockCount.findUnique({
        where: { id: count.id },
        include: countInclude,
      });
      if (!full) throw new NotFoundException('That count was not found.');
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'StockCount',
        entityId: count.id,
        action: 'approve',
        after: toCount(full),
      });
    });

    return this.reload(id);
  }

  async sendBack(actor: Actor, id: string): Promise<StockCountRecord> {
    assertCan(actor, 'stock', 'A', 'send a stock count back');

    await this.prisma.$transaction(async (tx) => {
      const count = await this.load(tx, actor.organisationId, id);
      if (count.status !== 'WAITING') {
        throw new BadRequestException('This count is not waiting for approval.');
      }
      const claimed = await tx.stockCount.updateMany({
        where: { id: count.id, status: 'WAITING' },
        data: { status: 'COUNTING' },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException('This count is not waiting for approval.');
      }
      const books = await booksAt(tx, actor.organisationId, count.locationId);
      for (const line of count.lines) {
        await tx.stockCountLine.update({
          where: { id: line.id },
          data: { bookQuantity: bookFor(books, line.itemId) },
        });
      }
      const full = await tx.stockCount.findUnique({
        where: { id: count.id },
        include: countInclude,
      });
      if (!full) throw new NotFoundException('That count was not found.');
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'StockCount',
        entityId: count.id,
        action: 'send-back',
        after: toCount(full),
      });
    });

    return this.reload(id);
  }

  private async postShortage(
    tx: Prisma.TransactionClient,
    organisationId: string,
    count: CountRow,
    line: CountLineRow,
    quantity: Prisma.Decimal,
  ): Promise<Prisma.Decimal> {
    const layers = await tx.stockLayer.findMany({
      where: {
        organisationId,
        itemId: line.itemId,
        locationId: count.locationId,
        quantityBase: { gt: 0 },
      },
      orderBy: [{ receivedOn: 'asc' }, { createdAt: 'asc' }],
    });
    const plan = drawFifo(layers, quantity, {
      item: line.item.name,
      location: count.location.name,
      unit: BASE_UNIT_LABELS[line.item.baseUnit],
    });
    for (const draw of plan.draws) {
      const taken = await tx.stockLayer.updateMany({
        where: { id: draw.layerId, quantityBase: { gte: draw.quantityBase } },
        data: { quantityBase: { decrement: draw.quantityBase } },
      });
      if (taken.count !== 1) {
        throw new ConflictException(
          'Stock changed while this count was being posted. Send it back and count again.',
        );
      }
      await tx.stockMovement.create({
        data: {
          organisationId,
          itemId: line.itemId,
          locationId: count.locationId,
          layerId: draw.layerId,
          countId: count.id,
          countLineId: line.id,
          type: 'COUNT',
          quantityBase: draw.quantityBase.neg(),
          unitCost: draw.unitCost,
        },
      });
    }
    return plan.cost.neg();
  }

  private async postSurplus(
    tx: Prisma.TransactionClient,
    organisationId: string,
    count: CountRow,
    line: CountLineRow,
    quantity: Prisma.Decimal,
  ): Promise<Prisma.Decimal> {
    const unitCost = await latestUnitCost(tx, organisationId, count.locationId, line);
    const layer = await tx.stockLayer.create({
      data: {
        organisationId,
        itemId: line.itemId,
        locationId: count.locationId,
        countLineId: line.id,
        quantityBase: quantity,
        unitCost,
        receivedOn: count.countedOn,
      },
    });
    await tx.stockMovement.create({
      data: {
        organisationId,
        itemId: line.itemId,
        locationId: count.locationId,
        layerId: layer.id,
        countId: count.id,
        countLineId: line.id,
        type: 'COUNT',
        quantityBase: quantity,
        unitCost,
      },
    });
    return quantity.mul(unitCost).toDecimalPlaces(2);
  }

  private async load(
    tx: Prisma.TransactionClient,
    organisationId: string,
    id: string,
  ): Promise<CountRow> {
    const count = await tx.stockCount.findFirst({
      where: { id, organisationId },
      include: countInclude,
    });
    if (!count) throw new NotFoundException('That count was not found.');
    return count;
  }

  private async reload(id: string): Promise<StockCountRecord> {
    const row = await this.prisma.stockCount.findUnique({ where: { id }, include: countInclude });
    if (!row) throw new NotFoundException('That count was not found.');
    return toCount(row);
  }
}

function parseCountedLines(lines: SubmitCountDto['lines']): Map<string, Prisma.Decimal> {
  const requested = new Map<string, Prisma.Decimal>();
  for (const line of lines) {
    if (requested.has(line.itemId)) throw new BadRequestException('Count each item once.');
    const counted = parseNonNegativeDecimal(line.counted, 'Enter a quantity of zero or more.');
    if (counted.decimalPlaces() > 3) {
      throw new BadRequestException('Enter the quantity with up to 3 decimal places.');
    }
    requested.set(line.itemId, counted);
  }
  return requested;
}

async function booksAt(
  tx: Prisma.TransactionClient,
  organisationId: string,
  locationId: string,
): Promise<Map<string, Prisma.Decimal>> {
  const rows = await tx.stockLayer.groupBy({
    by: ['itemId'],
    where: { organisationId, locationId, quantityBase: { gt: 0 } },
    _sum: { quantityBase: true },
  });
  const books = new Map<string, Prisma.Decimal>();
  for (const row of rows) {
    if (row._sum.quantityBase && row._sum.quantityBase.gt(0)) {
      books.set(row.itemId, row._sum.quantityBase);
    }
  }
  return books;
}

function bookFor(books: Map<string, Prisma.Decimal>, itemId: string): Prisma.Decimal {
  return books.get(itemId) ?? new Prisma.Decimal(0);
}

function sameQty(left: Prisma.Decimal, right: Prisma.Decimal): boolean {
  return left.equals(right);
}

async function latestUnitCost(
  tx: Prisma.TransactionClient,
  organisationId: string,
  locationId: string,
  line: CountLineRow,
): Promise<Prisma.Decimal> {
  const here = await tx.stockLayer.findFirst({
    where: { organisationId, itemId: line.itemId, locationId },
    orderBy: [{ receivedOn: 'desc' }, { createdAt: 'desc' }],
  });
  if (here) return here.unitCost;
  const anywhere = await tx.stockLayer.findFirst({
    where: { organisationId, itemId: line.itemId },
    orderBy: [{ receivedOn: 'desc' }, { createdAt: 'desc' }],
  });
  if (anywhere) return anywhere.unitCost;
  const received = await tx.goodsReceiptLine.findFirst({
    where: { itemId: line.itemId, receipt: { organisationId } },
    orderBy: { receipt: { receivedOn: 'desc' } },
  });
  if (received) return received.unitCost;
  throw new BadRequestException(
    `${line.item.name} has no cost yet. Receive it before you count extra in.`,
  );
}

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function toCount(row: CountRow): StockCountRecord {
  return {
    id: row.id,
    number: row.number,
    locationId: row.locationId,
    locationName: row.location.name,
    countedOn: formatIsoDate(row.countedOn),
    status: row.status,
    note: row.note,
    lines: [...row.lines]
      .sort((left, right) => left.item.name.localeCompare(right.item.name))
      .map((line) => ({
        itemId: line.itemId,
        itemName: line.item.name,
        baseUnit: line.item.baseUnit,
        bookQuantity: line.bookQuantity.toString(),
        countedQuantity: line.countedQuantity ? line.countedQuantity.toString() : null,
        varianceCost: line.varianceCost ? line.varianceCost.toString() : null,
      })),
  };
}
