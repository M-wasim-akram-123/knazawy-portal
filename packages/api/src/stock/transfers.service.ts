import { BASE_UNIT_LABELS, type Actor, type StockTransferRecord } from '@knazawy/shared';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { assertCan } from '../auth/permissions';
import { formatIsoDate, parseIsoDate } from '../common/date';
import { parsePositiveDecimal } from '../common/decimal';
import { nextDocumentNumber } from '../common/document-number';
import { PrismaService } from '../prisma/prisma.service';

import { drawFifo } from './fifo';
import type { CreateTransferDto, ReceiveTransferDto } from './transfers.dto';

const transferInclude = {
  fromLocation: true,
  toLocation: true,
  lines: { include: { item: true, draws: true } },
} satisfies Prisma.StockTransferInclude;

type TransferRow = Prisma.StockTransferGetPayload<{ include: typeof transferInclude }>;

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: Actor): Promise<StockTransferRecord[]> {
    assertCan(actor, 'stock', 'R', 'view stock transfers');
    const rows = await this.prisma.stockTransfer.findMany({
      where: { organisationId: actor.organisationId },
      include: transferInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toTransfer);
  }

  async create(actor: Actor, input: CreateTransferDto): Promise<StockTransferRecord> {
    assertCan(actor, 'stock', 'C', 'send a stock transfer');
    if (input.fromLocationId === input.toLocationId) {
      throw new BadRequestException('Choose two different locations.');
    }
    const sentOn = parseIsoDate(input.sentOn);
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
      throw new BadRequestException('Transfer each item once.');
    }

    const transferId = await this.prisma.$transaction(async (tx) => {
      const from = await openLocation(tx, actor.organisationId, input.fromLocationId);
      const to = await openLocation(tx, actor.organisationId, input.toLocationId);
      const items = await tx.item.findMany({
        where: { organisationId: actor.organisationId, id: { in: itemIds }, active: true },
      });
      const itemsById = new Map(items.map((item) => [item.id, item]));
      if (itemsById.size !== itemIds.length) {
        throw new BadRequestException('Choose an item that exists.');
      }

      const number = await nextDocumentNumber(tx, actor.organisationId, 'STOCK_TRANSFER');
      const transfer = await tx.stockTransfer.create({
        data: {
          organisationId: actor.organisationId,
          number,
          fromLocationId: from.id,
          toLocationId: to.id,
          sentOn,
        },
      });

      for (const line of requested) {
        const item = itemsById.get(line.itemId);
        if (!item) throw new BadRequestException('Choose an item that exists.');
        const layers = await tx.stockLayer.findMany({
          where: {
            organisationId: actor.organisationId,
            itemId: item.id,
            locationId: from.id,
            quantityBase: { gt: 0 },
          },
          orderBy: [{ receivedOn: 'asc' }, { createdAt: 'asc' }],
        });
        const plan = drawFifo(layers, line.quantity, {
          item: item.name,
          location: from.name,
          unit: BASE_UNIT_LABELS[item.baseUnit],
        });
        const transferLine = await tx.stockTransferLine.create({
          data: {
            transferId: transfer.id,
            itemId: item.id,
            quantityBase: line.quantity,
            cost: plan.cost,
          },
        });
        for (const draw of plan.draws) {
          const source = layers.find((layer) => layer.id === draw.layerId);
          if (!source) throw new BadRequestException('Choose an item that exists.');
          const taken = await tx.stockLayer.updateMany({
            where: { id: draw.layerId, quantityBase: { gte: draw.quantityBase } },
            data: { quantityBase: { decrement: draw.quantityBase } },
          });
          if (taken.count !== 1) {
            throw new ConflictException(
              'Stock changed while you were transferring. Check the quantity and try again.',
            );
          }
          await tx.stockTransferDraw.create({
            data: {
              lineId: transferLine.id,
              quantityBase: draw.quantityBase,
              unitCost: draw.unitCost,
              receivedOn: source.receivedOn,
            },
          });
          await tx.stockMovement.create({
            data: {
              organisationId: actor.organisationId,
              itemId: item.id,
              locationId: from.id,
              layerId: draw.layerId,
              transferId: transfer.id,
              type: 'TRANSFER_OUT',
              quantityBase: draw.quantityBase.neg(),
              unitCost: draw.unitCost,
            },
          });
        }
      }

      const full = await tx.stockTransfer.findUnique({
        where: { id: transfer.id },
        include: transferInclude,
      });
      if (!full) throw new NotFoundException('That transfer was not found.');
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'StockTransfer',
        entityId: transfer.id,
        action: 'create',
        after: toTransfer(full),
      });
      return transfer.id;
    });

    return this.load(transferId);
  }

  async receive(actor: Actor, id: string, input: ReceiveTransferDto): Promise<StockTransferRecord> {
    assertCan(actor, 'stock', 'U', 'receive a stock transfer');
    const receivedOn = parseIsoDate(input.receivedOn);

    await this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findFirst({
        where: { id, organisationId: actor.organisationId },
        include: { lines: { include: { draws: true } } },
      });
      if (!transfer) throw new NotFoundException('That transfer was not found.');
      if (transfer.status !== 'SENT') {
        throw new BadRequestException('This transfer has already been received.');
      }
      const destination = await openLocation(tx, actor.organisationId, transfer.toLocationId);
      const claimed = await tx.stockTransfer.updateMany({
        where: { id: transfer.id, status: 'SENT' },
        data: { status: 'RECEIVED', receivedOn },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException('This transfer has already been received.');
      }

      for (const line of transfer.lines) {
        for (const draw of line.draws) {
          const layer = await tx.stockLayer.create({
            data: {
              organisationId: actor.organisationId,
              itemId: line.itemId,
              locationId: destination.id,
              transferDrawId: draw.id,
              quantityBase: draw.quantityBase,
              unitCost: draw.unitCost,
              receivedOn: draw.receivedOn,
            },
          });
          await tx.stockMovement.create({
            data: {
              organisationId: actor.organisationId,
              itemId: line.itemId,
              locationId: destination.id,
              layerId: layer.id,
              transferId: transfer.id,
              type: 'TRANSFER_IN',
              quantityBase: draw.quantityBase,
              unitCost: draw.unitCost,
            },
          });
        }
      }

      const full = await tx.stockTransfer.findUnique({
        where: { id: transfer.id },
        include: transferInclude,
      });
      if (!full) throw new NotFoundException('That transfer was not found.');
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'StockTransfer',
        entityId: transfer.id,
        action: 'receive',
        after: toTransfer(full),
      });
    });

    return this.load(id);
  }

  private async load(id: string): Promise<StockTransferRecord> {
    const row = await this.prisma.stockTransfer.findUnique({
      where: { id },
      include: transferInclude,
    });
    if (!row) throw new NotFoundException('That transfer was not found.');
    return toTransfer(row);
  }
}

async function openLocation(
  tx: Prisma.TransactionClient,
  organisationId: string,
  id: string,
): Promise<{ id: string; name: string }> {
  const location = await tx.stockLocation.findFirst({
    where: { id, organisationId, active: true },
  });
  if (!location) throw new BadRequestException('Choose an open location.');
  return location;
}

function toTransfer(row: TransferRow): StockTransferRecord {
  return {
    id: row.id,
    number: row.number,
    fromLocationId: row.fromLocationId,
    fromLocationName: row.fromLocation.name,
    toLocationId: row.toLocationId,
    toLocationName: row.toLocation.name,
    status: row.status,
    sentOn: formatIsoDate(row.sentOn),
    receivedOn: row.receivedOn ? formatIsoDate(row.receivedOn) : null,
    lines: row.lines.map((line) => ({
      itemName: line.item.name,
      baseUnit: line.item.baseUnit,
      quantityBase: line.quantityBase.toString(),
      cost: line.cost.toString(),
    })),
  };
}
