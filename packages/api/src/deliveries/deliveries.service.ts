import {
  deliveredQuantityError,
  dispatchQuantityError,
  isKaramRole,
  requestStatusAfterDelivery,
  type Actor,
  type DeliveryRecord,
} from '@knazawy/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { assertCan } from '../auth/permissions';
import { formatIsoDate } from '../common/date';
import { nextDocumentNumber } from '../common/document-number';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

import type { DispatchDeliveryDto, RecordDeliveryDto, StartDeliveryDto } from './deliveries.dto';

const deliveryInclude = {
  organisation: { select: { name: true } },
  request: {
    select: {
      number: true,
      status: true,
      flightNumber: true,
      route: true,
      serviceDate: true,
      deliveryPoint: true,
    },
  },
  lines: { include: { recipe: { select: { name: true, kind: true } } } },
} satisfies Prisma.DeliveryInclude;

type DeliveryRow = Prisma.DeliveryGetPayload<{ include: typeof deliveryInclude }>;

@Injectable()
export class DeliveriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Karam sees every delivery. An airline sees only its own. */
  async list(actor: Actor): Promise<DeliveryRecord[]> {
    assertCan(actor, 'distribution', 'R', 'view deliveries');
    const rows = await this.prisma.delivery.findMany({
      where: isKaramRole(actor.role) ? {} : { organisationId: actor.organisationId },
      include: deliveryInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDelivery);
  }

  /** Starts a delivery for an accepted request. The request moves into production. */
  async start(actor: Actor, input: StartDeliveryDto): Promise<DeliveryRecord> {
    assertCan(actor, 'distribution', 'C', 'start a delivery');
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: input.requestId },
      include: { lines: true, delivery: { select: { id: true } } },
    });
    if (!request) throw new NotFoundException('That request was not found.');
    const next = requestStatusAfterDelivery(request.status, 'start');
    if (!next) throw new BadRequestException('Only an accepted request can go into production.');
    if (request.delivery) throw new BadRequestException('This request already has a delivery.');
    if (request.lines.length === 0) {
      throw new BadRequestException('This request has no menu items.');
    }
    const karamOrgId = await this.karamOrganisationId();

    const id = await this.prisma.$transaction(async (tx) => {
      const number = await nextDocumentNumber(tx, karamOrgId, 'DELIVERY');
      const delivery = await tx.delivery.create({
        data: {
          organisationId: request.organisationId,
          requestId: request.id,
          number,
          createdById: actor.id,
          lines: {
            create: request.lines.map((line) => ({
              recipeId: line.recipeId,
              ordered: line.quantity,
            })),
          },
        },
      });
      await tx.serviceRequest.update({ where: { id: request.id }, data: { status: next } });
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'Delivery',
        entityId: delivery.id,
        action: 'start',
        after: { number, requestId: request.id, status: next },
      });
      await this.notifications.notify(tx, {
        organisationId: request.organisationId,
        role: 'AIRLINE_REQUESTER',
        title: `${request.number} is in production`,
        body: `${request.flightNumber} is being prepared.`,
        entity: 'ServiceRequest',
        entityId: request.id,
        exceptUserId: actor.id,
      });
      return delivery.id;
    });
    return this.load(id);
  }

  /** Records what left the kitchen. The request is then on its way. */
  async dispatch(actor: Actor, id: string, input: DispatchDeliveryDto): Promise<DeliveryRecord> {
    assertCan(actor, 'distribution', 'U', 'dispatch a delivery');
    const existing = await this.find(id);
    const next = requestStatusAfterDelivery(existing.request.status, 'dispatch');
    if (!next) throw new BadRequestException('Only a delivery in production can be sent out.');
    const quantities = quantitiesFrom(input.lines);
    const ordered = new Map(existing.lines.map((line) => [line.recipeId, line.ordered]));
    const error = dispatchQuantityError(
      [...ordered.entries()].map(([recipeId, quantity]) => ({
        ordered: quantity,
        quantity: requireQuantity(quantities, recipeId, ordered),
      })),
    );
    if (error) throw new BadRequestException(error);

    await this.prisma.$transaction(async (tx) => {
      for (const line of existing.lines) {
        await tx.deliveryLine.update({
          where: { id: line.id },
          data: { dispatched: quantities.get(line.recipeId) },
        });
      }
      await tx.delivery.update({
        where: { id },
        data: {
          dispatchedAt: new Date(),
          dispatchedById: actor.id,
          vehicleNote: blankToNull(input.vehicleNote),
        },
      });
      await tx.serviceRequest.update({ where: { id: existing.requestId }, data: { status: next } });
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'Delivery',
        entityId: id,
        action: 'dispatch',
        before: { status: existing.request.status },
        after: { status: next, lines: input.lines },
      });
      await this.notifications.notify(tx, {
        organisationId: existing.organisationId,
        role: 'AIRLINE_REQUESTER',
        title: `${existing.request.number} has left the kitchen`,
        body: `${existing.number} is on the way for ${existing.request.flightNumber}.`,
        entity: 'Delivery',
        entityId: id,
        exceptUserId: actor.id,
      });
    });
    return this.load(id);
  }

  /** Records what arrived. These portions are what the invoice will bill. */
  async deliver(actor: Actor, id: string, input: RecordDeliveryDto): Promise<DeliveryRecord> {
    assertCan(actor, 'distribution', 'U', 'record a delivery');
    const existing = await this.find(id);
    const next = requestStatusAfterDelivery(existing.request.status, 'deliver');
    if (!next) throw new BadRequestException('Only a delivery that has left can be recorded.');
    const quantities = quantitiesFrom(input.lines);
    const sent = new Map(existing.lines.map((line) => [line.recipeId, line.dispatched ?? 0]));
    const error = deliveredQuantityError(
      [...sent.entries()].map(([recipeId, dispatched]) => ({
        dispatched,
        quantity: requireQuantity(quantities, recipeId, sent),
      })),
    );
    if (error) throw new BadRequestException(error);
    const note = blankToNull(input.note);
    const nothingArrived = [...sent.keys()].every((recipeId) => quantities.get(recipeId) === 0);
    if (nothingArrived && (note?.length ?? 0) < 3) {
      throw new BadRequestException('Say why nothing arrived.');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const line of existing.lines) {
        await tx.deliveryLine.update({
          where: { id: line.id },
          data: { delivered: quantities.get(line.recipeId) },
        });
      }
      await tx.delivery.update({
        where: { id },
        data: {
          deliveredAt: new Date(),
          deliveredById: actor.id,
          receivedBy: blankToNull(input.receivedBy),
          note,
        },
      });
      await tx.serviceRequest.update({ where: { id: existing.requestId }, data: { status: next } });
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'Delivery',
        entityId: id,
        action: 'deliver',
        before: { status: existing.request.status },
        after: { status: next, lines: input.lines, note },
      });
      await this.notifications.notify(tx, {
        organisationId: existing.organisationId,
        role: 'AIRLINE_REQUESTER',
        title: `${existing.request.number} has arrived`,
        body: `${existing.number} was recorded for ${existing.request.flightNumber}.`,
        entity: 'Delivery',
        entityId: id,
        exceptUserId: actor.id,
      });
    });
    return this.load(id);
  }

  private async karamOrganisationId(): Promise<string> {
    const karam = await this.prisma.organisation.findFirst({
      where: { type: 'KARAM' },
      select: { id: true },
    });
    if (!karam) throw new NotFoundException('The restaurant account is missing.');
    return karam.id;
  }

  private async find(id: string): Promise<DeliveryRow> {
    const row = await this.prisma.delivery.findUnique({ where: { id }, include: deliveryInclude });
    if (!row) throw new NotFoundException('That delivery was not found.');
    return row;
  }

  private async load(id: string): Promise<DeliveryRecord> {
    return toDelivery(await this.find(id));
  }
}

function quantitiesFrom(lines: Array<{ recipeId: string; quantity: number }>): Map<string, number> {
  const quantities = new Map<string, number>();
  for (const line of lines) {
    if (quantities.has(line.recipeId)) throw new BadRequestException('Use each menu item once.');
    quantities.set(line.recipeId, line.quantity);
  }
  return quantities;
}

/** Every item on the delivery must be answered, and no extra item is accepted. */
function requireQuantity(
  quantities: Map<string, number>,
  recipeId: string,
  expected: Map<string, number>,
): number {
  if (quantities.size !== expected.size || !quantities.has(recipeId)) {
    throw new BadRequestException('Give a quantity for each menu item on this delivery.');
  }
  return quantities.get(recipeId) ?? 0;
}

function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

function toDelivery(row: DeliveryRow): DeliveryRecord {
  return {
    id: row.id,
    number: row.number,
    requestId: row.requestId,
    requestNumber: row.request.number,
    airlineId: row.organisationId,
    airlineName: row.organisation.name,
    flightNumber: row.request.flightNumber,
    route: row.request.route,
    serviceDate: formatIsoDate(row.request.serviceDate),
    deliveryPoint: row.request.deliveryPoint,
    status: row.request.status,
    vehicleNote: row.vehicleNote,
    receivedBy: row.receivedBy,
    note: row.note,
    dispatchedAt: row.dispatchedAt?.toISOString() ?? null,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    lines: [...row.lines]
      .sort((left, right) => left.recipe.name.localeCompare(right.recipe.name))
      .map((line) => ({
        recipeId: line.recipeId,
        recipeName: line.recipe.name,
        kind: line.recipe.kind,
        ordered: line.ordered,
        dispatched: line.dispatched,
        delivered: line.delivered,
      })),
  };
}
