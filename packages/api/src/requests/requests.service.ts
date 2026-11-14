import {
  isKaramRole,
  isRequestEditable,
  nextRequestStatus,
  passengerTotal,
  todayInKarachi,
  type Actor,
  type MenuItemRecord,
  type PassengerSplit,
  type RequestAction,
  type ServiceRequestRecord,
} from '@knazawy/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { assertCan } from '../auth/permissions';
import { formatIsoDate, parseIsoDate } from '../common/date';
import { nextDocumentNumber } from '../common/document-number';
import { PrismaService } from '../prisma/prisma.service';

import type { RejectServiceRequestDto, ServiceRequestDto } from './requests.dto';

const requestInclude = {
  organisation: { select: { name: true } },
  createdBy: { select: { name: true } },
  lines: { include: { recipe: { select: { name: true, kind: true } } } },
} satisfies Prisma.ServiceRequestInclude;

type RequestRow = Prisma.ServiceRequestGetPayload<{ include: typeof requestInclude }>;

interface RequestFields {
  flightNumber: string;
  route: string;
  deliveryTime: string;
  deliveryPoint: ServiceRequestDto['deliveryPoint'];
  deliveryDetail: string | null;
  adults: number;
  children: number;
  infants: number;
  crew: number;
  specialDiets: number;
  specialDietNote: string | null;
  note: string | null;
}

interface LineInput {
  recipeId: string;
  quantity: number;
}

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Karam staff see every airline's requests once they are sent. An airline sees only its own. */
  async list(actor: Actor): Promise<ServiceRequestRecord[]> {
    assertCan(actor, 'service_requests', 'R', 'view requests');
    const rows = await this.prisma.serviceRequest.findMany({
      where: isKaramRole(actor.role)
        ? { status: { not: 'DRAFT' } }
        : { organisationId: actor.organisationId },
      include: requestInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toRequest);
  }

  /** Approved, active meals and snacks. Recipe costs are never sent to an airline. */
  async menu(actor: Actor): Promise<MenuItemRecord[]> {
    assertCan(actor, 'service_requests', 'R', 'view the menu');
    const karamOrgId = await this.karamOrganisationId();
    const recipes = await this.prisma.recipe.findMany({
      where: { organisationId: karamOrgId, active: true, status: 'APPROVED' },
      select: { id: true, name: true, kind: true },
      orderBy: { name: 'asc' },
    });
    return recipes.map((recipe) => ({ id: recipe.id, name: recipe.name, kind: recipe.kind }));
  }

  async create(actor: Actor, input: ServiceRequestDto): Promise<ServiceRequestRecord> {
    assertCan(actor, 'service_requests', 'C', 'create a request');
    const karamOrgId = await this.karamOrganisationId();
    const fields = requestFields(input);
    const serviceDate = checkServiceDate(input.serviceDate);
    const lines = linesFrom(input.lines);

    const id = await this.prisma.$transaction(async (tx) => {
      await checkMenu(tx, karamOrgId, lines);
      const number = await nextDocumentNumber(tx, karamOrgId, 'SERVICE_REQUEST');
      const request = await tx.serviceRequest.create({
        data: {
          organisationId: actor.organisationId,
          number,
          createdById: actor.id,
          serviceDate,
          ...fields,
          lines: {
            create: lines.map((line) => ({ recipeId: line.recipeId, quantity: line.quantity })),
          },
        },
      });
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'ServiceRequest',
        entityId: request.id,
        action: 'create',
        after: { number, status: 'DRAFT', ...fields, lines },
      });
      return request.id;
    });
    return this.load(id);
  }

  async update(actor: Actor, id: string, input: ServiceRequestDto): Promise<ServiceRequestRecord> {
    assertCan(actor, 'service_requests', 'U', 'change a request');
    const existing = await this.findOwn(actor, id);
    if (!isRequestEditable(existing.status)) {
      throw new BadRequestException('Only a draft can be changed.');
    }
    const karamOrgId = await this.karamOrganisationId();
    const fields = requestFields(input);
    const serviceDate = checkServiceDate(input.serviceDate);
    const lines = linesFrom(input.lines);

    await this.prisma.$transaction(async (tx) => {
      await checkMenu(tx, karamOrgId, lines);
      await tx.serviceRequest.update({ where: { id }, data: { serviceDate, ...fields } });
      await tx.serviceRequestLine.deleteMany({ where: { requestId: id } });
      await tx.serviceRequestLine.createMany({
        data: lines.map((line) => ({
          requestId: id,
          recipeId: line.recipeId,
          quantity: line.quantity,
        })),
      });
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'ServiceRequest',
        entityId: id,
        action: 'update',
        before: toRequest(existing),
        after: { ...fields, lines },
      });
    });
    return this.load(id);
  }

  async submit(actor: Actor, id: string): Promise<ServiceRequestRecord> {
    assertCan(actor, 'service_requests', 'U', 'send a request');
    const existing = await this.findOwn(actor, id);
    const next = nextRequestStatus(existing.status, 'submit');
    if (!next) throw new BadRequestException('Only a draft can be sent.');
    if (existing.lines.length === 0) {
      throw new BadRequestException('Add a menu item before you send the request.');
    }
    checkServiceDate(formatIsoDate(existing.serviceDate));
    const karamOrgId = await this.karamOrganisationId();
    const lines = existing.lines.map((line) => ({
      recipeId: line.recipeId,
      quantity: line.quantity,
    }));

    await this.prisma.$transaction(async (tx) => {
      await checkMenu(tx, karamOrgId, lines);
      await tx.serviceRequest.update({
        where: { id },
        data: { status: next, submittedAt: new Date() },
      });
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'ServiceRequest',
        entityId: id,
        action: 'submit',
        before: { status: existing.status },
        after: { status: next },
      });
    });
    return this.load(id);
  }

  async cancel(actor: Actor, id: string): Promise<ServiceRequestRecord> {
    assertCan(actor, 'service_requests', 'U', 'cancel a request');
    const existing = await this.findOwn(actor, id);
    const next = nextRequestStatus(existing.status, 'cancel');
    if (!next) throw new BadRequestException('This request can no longer be cancelled.');
    await this.decide(actor, id, existing.status, 'cancel', next, null);
    return this.load(id);
  }

  async accept(actor: Actor, id: string): Promise<ServiceRequestRecord> {
    assertCan(actor, 'service_requests', 'A', 'accept a request');
    const existing = await this.findAny(id);
    const next = nextRequestStatus(existing.status, 'accept');
    if (!next) throw new BadRequestException('Only a submitted request can be accepted.');
    await this.decide(actor, id, existing.status, 'accept', next, null);
    return this.load(id);
  }

  async reject(
    actor: Actor,
    id: string,
    input: RejectServiceRequestDto,
  ): Promise<ServiceRequestRecord> {
    assertCan(actor, 'service_requests', 'A', 'reject a request');
    const reason = input.reason.trim();
    if (reason.length < 3) {
      throw new BadRequestException('Give a reason for rejecting this request.');
    }
    const existing = await this.findAny(id);
    const next = nextRequestStatus(existing.status, 'reject');
    if (!next) throw new BadRequestException('Only a submitted request can be rejected.');
    await this.decide(actor, id, existing.status, 'reject', next, reason);
    return this.load(id);
  }

  private async decide(
    actor: Actor,
    id: string,
    from: RequestRow['status'],
    action: RequestAction,
    next: RequestRow['status'],
    decisionNote: string | null,
  ): Promise<void> {
    const decided = action === 'accept' || action === 'reject';
    await this.prisma.$transaction(async (tx) => {
      await tx.serviceRequest.update({
        where: { id },
        data: {
          status: next,
          ...(decided ? { decidedAt: new Date(), decidedById: actor.id, decisionNote } : {}),
        },
      });
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'ServiceRequest',
        entityId: id,
        action,
        before: { status: from },
        after: { status: next, decisionNote },
      });
    });
  }

  /** An airline reads only its own request. Anything else is reported as not found. */
  private async findOwn(actor: Actor, id: string): Promise<RequestRow> {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id },
      include: requestInclude,
    });
    if (!request || request.organisationId !== actor.organisationId) {
      throw new NotFoundException('That request was not found.');
    }
    return request;
  }

  /** Karam decisions are made on any airline's request. */
  private async findAny(id: string): Promise<RequestRow> {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id },
      include: requestInclude,
    });
    if (!request) throw new NotFoundException('That request was not found.');
    return request;
  }

  private async karamOrganisationId(): Promise<string> {
    const karam = await this.prisma.organisation.findFirst({
      where: { type: 'KARAM' },
      select: { id: true },
    });
    if (!karam) throw new NotFoundException('The restaurant account is missing.');
    return karam.id;
  }

  private async load(id: string): Promise<ServiceRequestRecord> {
    const row = await this.prisma.serviceRequest.findUnique({
      where: { id },
      include: requestInclude,
    });
    if (!row) throw new NotFoundException('That request was not found.');
    return toRequest(row);
  }
}

function requestFields(input: ServiceRequestDto): RequestFields {
  const flightNumber = input.flightNumber.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,8}$/.test(flightNumber)) {
    throw new BadRequestException('Enter the flight number, such as PK301.');
  }
  const route = input.route.trim();
  if (route.length < 2) throw new BadRequestException('Enter the route, such as KHI-DXB.');
  const deliveryTime = input.deliveryTime.trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(deliveryTime)) {
    throw new BadRequestException('Enter the delivery time as HH:MM.');
  }
  const passengers: PassengerSplit = {
    adults: input.adults,
    children: input.children,
    infants: input.infants,
    crew: input.crew,
    specialDiets: input.specialDiets,
  };
  if (passengerTotal(passengers) < 1)
    throw new BadRequestException('Enter at least one passenger.');
  if (passengers.specialDiets > passengerTotal(passengers)) {
    throw new BadRequestException('Special diets cannot be more than the passengers.');
  }
  return {
    flightNumber,
    route,
    deliveryTime,
    deliveryPoint: input.deliveryPoint,
    deliveryDetail: blankToNull(input.deliveryDetail),
    adults: passengers.adults,
    children: passengers.children,
    infants: passengers.infants,
    crew: passengers.crew,
    specialDiets: passengers.specialDiets,
    specialDietNote: blankToNull(input.specialDietNote),
    note: blankToNull(input.note),
  };
}

function checkServiceDate(value: string): Date {
  const date = parseIsoDate(value);
  if (formatIsoDate(date) < todayInKarachi()) {
    throw new BadRequestException('Pick a service date from today on.');
  }
  return date;
}

function linesFrom(lines: ServiceRequestDto['lines']): LineInput[] {
  return lines.map((line) => ({ recipeId: line.recipeId, quantity: line.quantity }));
}

async function checkMenu(
  tx: Prisma.TransactionClient,
  karamOrgId: string,
  lines: LineInput[],
): Promise<void> {
  const ids = new Set<string>();
  for (const line of lines) {
    if (ids.has(line.recipeId)) throw new BadRequestException('Use each menu item once.');
    ids.add(line.recipeId);
  }
  if (ids.size === 0) return;
  const available = await tx.recipe.findMany({
    where: { id: { in: [...ids] }, organisationId: karamOrgId, active: true, status: 'APPROVED' },
    select: { id: true },
  });
  if (available.length !== ids.size) {
    throw new BadRequestException('One of the menu items is not available. Choose it again.');
  }
}

function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

function toRequest(row: RequestRow): ServiceRequestRecord {
  return {
    id: row.id,
    number: row.number,
    airlineId: row.organisationId,
    airlineName: row.organisation.name,
    status: row.status,
    flightNumber: row.flightNumber,
    route: row.route,
    serviceDate: formatIsoDate(row.serviceDate),
    deliveryTime: row.deliveryTime,
    deliveryPoint: row.deliveryPoint,
    deliveryDetail: row.deliveryDetail,
    passengers: {
      adults: row.adults,
      children: row.children,
      infants: row.infants,
      crew: row.crew,
      specialDiets: row.specialDiets,
    },
    specialDietNote: row.specialDietNote,
    note: row.note,
    decisionNote: row.decisionNote,
    createdByName: row.createdBy.name,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    lines: [...row.lines]
      .sort((left, right) => left.recipe.name.localeCompare(right.recipe.name))
      .map((line) => ({
        recipeId: line.recipeId,
        recipeName: line.recipe.name,
        kind: line.recipe.kind,
        quantity: line.quantity,
      })),
  };
}
