import {
  amendmentError,
  cancellationChargeApplies,
  checkFulfilment,
  cutOffInstant,
  invoicePosting,
  isKaramRole,
  isPastCutOff,
  isRequestEditable,
  nextRequestStatus,
  passengerTotal,
  previewCharges,
  todayInKarachi,
  type Actor,
  type FulfilmentRecipe,
  type FulfilmentRecord,
  type InvoicePricedLine,
  type MenuItemRecord,
  type PassengerSplit,
  type RequestAction,
  type ServiceRequestRecord,
} from '@knazawy/shared';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { assertCan } from '../auth/permissions';
import { formatIsoDate, parseIsoDate } from '../common/date';
import { nextDocumentNumber } from '../common/document-number';
import { lockRequestStatus } from '../common/row-lock';
import { LedgerService } from '../ledger/ledger.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

import type {
  AmendServiceRequestDto,
  RejectServiceRequestDto,
  ServiceRequestDto,
} from './requests.dto';

const requestInclude = {
  organisation: { select: { name: true } },
  createdBy: { select: { name: true } },
  lines: { include: { recipe: { select: { name: true, kind: true } } } },
  amendments: { include: { createdBy: { select: { name: true } } } },
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
    private readonly notifications: NotificationsService,
    private readonly ledger: LedgerService,
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
      await lockRequestStatus(tx, existing.id, existing.status);
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
    const serviceDate = formatIsoDate(existing.serviceDate);
    checkServiceDate(serviceDate);
    if (isPastCutOff(serviceDate, existing.deliveryTime)) {
      throw new BadRequestException('Send the request at least 24 hours before delivery.');
    }
    const karamOrgId = await this.karamOrganisationId();
    const lines = existing.lines.map((line) => ({
      recipeId: line.recipeId,
      quantity: line.quantity,
    }));

    await this.prisma.$transaction(async (tx) => {
      await lockRequestStatus(tx, existing.id, existing.status);
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
      await this.notifications.notify(tx, {
        organisationId: karamOrgId,
        role: 'OPERATIONS_MANAGER',
        title: `${existing.number} was sent`,
        body: `${existing.organisation.name} sent ${existing.number} for ${existing.flightNumber}.`,
        entity: 'ServiceRequest',
        entityId: id,
        exceptUserId: actor.id,
      });
    });
    return this.load(id);
  }

  /** Changes a sent request. The airline can do this until the cut-off; Karam can until production. */
  async amend(
    actor: Actor,
    id: string,
    input: AmendServiceRequestDto,
  ): Promise<ServiceRequestRecord> {
    assertCan(actor, 'service_requests', 'U', 'change a request');
    const existing = isKaramRole(actor.role)
      ? await this.findAny(id)
      : await this.findOwn(actor, id);
    const blocked = amendmentError(
      existing.status,
      isPastCutOff(formatIsoDate(existing.serviceDate), existing.deliveryTime),
      isKaramRole(actor.role),
    );
    if (blocked) throw new BadRequestException(blocked);
    const reason = input.reason.trim();
    if (reason.length < 3) throw new BadRequestException('Give a reason for this change.');
    const fields = requestFields(input);
    const serviceDate = checkServiceDate(input.serviceDate);
    if (!isKaramRole(actor.role) && isPastCutOff(input.serviceDate, fields.deliveryTime)) {
      throw new BadRequestException('The new delivery is inside the 24-hour cut-off.');
    }
    const lines = linesFrom(input.lines);
    if (lines.length === 0) {
      throw new BadRequestException('Add a menu item before you change the request.');
    }
    const karamOrgId = await this.karamOrganisationId();

    await this.prisma.$transaction(async (tx) => {
      await lockRequestStatus(tx, existing.id, existing.status);
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
      const number = await nextDocumentNumber(tx, karamOrgId, 'AMENDMENT');
      await tx.requestAmendment.create({
        data: { requestId: id, number, reason, createdById: actor.id },
      });
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'ServiceRequest',
        entityId: id,
        action: 'amend',
        before: toRequest(existing),
        after: { number, reason, ...fields, lines },
      });
      await this.notifications.notify(tx, {
        organisationId: isKaramRole(actor.role) ? existing.organisationId : karamOrgId,
        role: isKaramRole(actor.role) ? 'AIRLINE_REQUESTER' : 'OPERATIONS_MANAGER',
        title: `${existing.number} was changed`,
        body: reason,
        entity: 'ServiceRequest',
        entityId: id,
        exceptUserId: actor.id,
      });
    });
    return this.load(id);
  }

  async cancel(
    actor: Actor,
    id: string,
    input: { acceptCharge?: boolean } = {},
  ): Promise<ServiceRequestRecord> {
    assertCan(actor, 'service_requests', 'U', 'cancel a request');
    const existing = await this.findOwn(actor, id);
    const next = nextRequestStatus(existing.status, 'cancel');
    if (!next) throw new BadRequestException('This request can no longer be cancelled.');
    const pastCutOff = isPastCutOff(formatIsoDate(existing.serviceDate), existing.deliveryTime);
    if (!cancellationChargeApplies(existing.status, pastCutOff)) {
      await this.decide(actor, existing, 'cancel', next, null);
      return this.load(id);
    }
    const quote = await this.quoteCancellation(existing);
    if (quote.total === '0.00') {
      await this.decide(actor, existing, 'cancel', next, null);
      return this.load(id);
    }
    if (!input.acceptCharge) {
      throw new BadRequestException(`Cancelling now costs ${quote.total} SAR. Confirm the charge.`);
    }
    const karamOrgId = await this.karamOrganisationId();
    await this.prisma.$transaction(async (tx) => {
      await lockRequestStatus(tx, existing.id, existing.status);
      const number = await nextDocumentNumber(tx, karamOrgId, 'INVOICE');
      const invoice = await tx.invoice.create({
        data: {
          organisationId: existing.organisationId,
          number,
          kind: 'CANCELLATION',
          status: 'ISSUED',
          requestId: existing.id,
          rateCardId: quote.rateCardId,
          reason: 'Cancelled after the cut-off',
          createdById: actor.id,
          issuedAt: new Date(),
          issuedById: actor.id,
          lines: { create: quote.lines.map(lineData) },
        },
      });
      await tx.serviceRequest.update({
        where: { id },
        data: {
          status: next,
          decidedAt: new Date(),
          decidedById: actor.id,
          decisionNote: `Cancellation charge ${quote.total} SAR`,
        },
      });
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'ServiceRequest',
        entityId: id,
        action: 'cancel',
        before: { status: existing.status },
        after: { status: next, invoice: number, total: quote.total },
      });
      await this.ledger.postFromDocument(tx, actor, {
        organisationId: existing.organisationId,
        karamOrganisationId: karamOrgId,
        sourceId: invoice.id,
        memo: `Cancellation ${number} for ${existing.number}`,
        lines: invoicePosting(quote.total),
      });
      const charged = `${existing.number} was cancelled. The charge is ${quote.total} SAR.`;
      await this.notifications.notify(tx, {
        organisationId: karamOrgId,
        role: 'OPERATIONS_MANAGER',
        title: `${existing.number} was cancelled`,
        body: charged,
        entity: 'ServiceRequest',
        entityId: id,
        exceptUserId: actor.id,
      });
      await this.notifications.notify(tx, {
        organisationId: karamOrgId,
        role: 'FINANCE_OFFICER',
        title: `${number} bills a cancellation`,
        body: charged,
        entity: 'Invoice',
        entityId: invoice.id,
        exceptUserId: actor.id,
      });
      await this.notifications.notify(tx, {
        organisationId: existing.organisationId,
        role: 'AIRLINE_FINANCE',
        title: `${number} bills a cancellation`,
        body: charged,
        entity: 'Invoice',
        entityId: invoice.id,
        exceptUserId: actor.id,
      });
    });
    return this.load(id);
  }

  /**
   * Whether Karam's stock covers this request. Stock held for other accepted requests that have
   * not gone into production is set aside first. Karam staff only: an airline never sees stock.
   */
  async fulfilment(actor: Actor, id: string): Promise<FulfilmentRecord> {
    assertCan(actor, 'service_requests', 'R', 'check stock for a request');
    if (!isKaramRole(actor.role)) throw new ForbiddenException('You cannot see stock levels.');
    const request = await this.findAny(id);
    const karamOrgId = await this.karamOrganisationId();
    const promised = await this.prisma.serviceRequestLine.findMany({
      where: { request: { status: 'ACCEPTED', id: { not: request.id } } },
      select: { recipeId: true, quantity: true },
    });
    const recipeIds = [...new Set([...request.lines, ...promised].map((line) => line.recipeId))];
    const recipeRows = await this.prisma.recipe.findMany({
      where: { id: { in: recipeIds } },
      select: {
        id: true,
        name: true,
        kind: true,
        wastagePercent: true,
        lines: {
          select: {
            itemId: true,
            quantityPerPortion: true,
            item: { select: { name: true, baseUnit: true } },
          },
        },
      },
    });
    const recipes = new Map<string, FulfilmentRecipe>(
      recipeRows.map((recipe) => [
        recipe.id,
        {
          recipeId: recipe.id,
          recipeName: recipe.name,
          kind: recipe.kind,
          wastagePercent: recipe.wastagePercent.toString(),
          ingredients: recipe.lines.map((line) => ({
            itemId: line.itemId,
            itemName: line.item.name,
            baseUnit: line.item.baseUnit,
            quantityPerPortion: line.quantityPerPortion.toString(),
          })),
        },
      ]),
    );
    const itemIds = [
      ...new Set(recipeRows.flatMap((recipe) => recipe.lines.map((line) => line.itemId))),
    ];
    const stock = await this.prisma.stockLayer.groupBy({
      by: ['itemId'],
      where: { organisationId: karamOrgId, itemId: { in: itemIds }, quantityBase: { gt: 0 } },
      _sum: { quantityBase: true },
    });
    return checkFulfilment({
      requestId: request.id,
      lines: request.lines.map((line) => ({ recipeId: line.recipeId, quantity: line.quantity })),
      recipes,
      onHand: new Map(stock.map((row) => [row.itemId, row._sum.quantityBase?.toString() ?? '0'])),
      promisedLines: promised,
    });
  }

  async accept(actor: Actor, id: string): Promise<ServiceRequestRecord> {
    assertCan(actor, 'service_requests', 'A', 'accept a request');
    const existing = await this.findAny(id);
    const next = nextRequestStatus(existing.status, 'accept');
    if (!next) throw new BadRequestException('Only a submitted request can be accepted.');
    await this.decide(actor, existing, 'accept', next, null);
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
    await this.decide(actor, existing, 'reject', next, reason);
    return this.load(id);
  }

  private async decide(
    actor: Actor,
    existing: RequestRow,
    action: RequestAction,
    next: RequestRow['status'],
    decisionNote: string | null,
  ): Promise<void> {
    const decided = action === 'accept' || action === 'reject';
    await this.prisma.$transaction(async (tx) => {
      await lockRequestStatus(tx, existing.id, existing.status);
      await tx.serviceRequest.update({
        where: { id: existing.id },
        data: {
          status: next,
          ...(decided ? { decidedAt: new Date(), decidedById: actor.id, decisionNote } : {}),
        },
      });
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'ServiceRequest',
        entityId: existing.id,
        action,
        before: { status: existing.status },
        after: { status: next, decisionNote },
      });
      const karam = await tx.organisation.findFirst({
        where: { type: 'KARAM' },
        select: { id: true },
      });
      if (action === 'cancel' && karam) {
        await this.notifications.notify(tx, {
          organisationId: karam.id,
          role: 'OPERATIONS_MANAGER',
          title: `${existing.number} was cancelled`,
          body: `${existing.organisation.name} cancelled ${existing.number}.`,
          entity: 'ServiceRequest',
          entityId: existing.id,
          exceptUserId: actor.id,
        });
      }
      if (action === 'accept' || action === 'reject') {
        await this.notifications.notify(tx, {
          organisationId: existing.organisationId,
          role: 'AIRLINE_REQUESTER',
          title:
            action === 'accept'
              ? `${existing.number} is accepted`
              : `${existing.number} was rejected`,
          body: decisionNote ?? `${existing.flightNumber}, ${existing.route}.`,
          entity: 'ServiceRequest',
          entityId: existing.id,
          exceptUserId: actor.id,
        });
      }
    });
  }

  /** The charge is what the request would have billed, including each item's minimum. */
  private async quoteCancellation(
    row: RequestRow,
  ): Promise<{ rateCardId: string; total: string; lines: InvoicePricedLine[] }> {
    const card = await this.prisma.rateCard.findFirst({
      where: {
        organisationId: row.organisationId,
        status: 'APPROVED',
        validFrom: { lte: row.serviceDate },
        OR: [{ validTo: null }, { validTo: { gte: row.serviceDate } }],
      },
      include: { lines: true },
    });
    if (!card) {
      throw new BadRequestException(
        'No rate card covers this service date, so the cancellation cannot be priced.',
      );
    }
    const preview = previewCharges(
      row.lines.map((line) => ({ recipeId: line.recipeId, quantity: line.quantity })),
      {
        lines: card.lines.map((line) => {
          const recipe = row.lines.find((item) => item.recipeId === line.recipeId);
          return {
            recipeId: line.recipeId,
            recipeName: recipe?.recipe.name ?? '',
            kind: recipe?.recipe.kind ?? 'MEAL',
            unitPrice: line.unitPrice.toFixed(2),
            minimumQuantity: line.minimumQuantity,
          };
        }),
      },
    );
    if (!preview.total) {
      throw new BadRequestException(
        'One of the menu items has no price, so the cancellation cannot be priced.',
      );
    }
    const lines = row.lines.map((line) => {
      const priced = preview.lines.find((item) => item.recipeId === line.recipeId);
      const rate = card.lines.find((item) => item.recipeId === line.recipeId);
      if (!priced?.amount || !priced.unitPrice || !rate) {
        throw new BadRequestException(
          'One of the menu items has no price, so the cancellation cannot be priced.',
        );
      }
      return {
        recipeId: line.recipeId,
        recipeName: line.recipe.name,
        kind: line.recipe.kind,
        deliveredQuantity: 0,
        minimumQuantity: rate.minimumQuantity,
        billedQuantity: priced.billedQuantity,
        unitPrice: priced.unitPrice,
        amount: priced.amount,
      };
    });
    return { rateCardId: card.id, total: preview.total, lines };
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

function lineData(line: InvoicePricedLine) {
  return {
    recipeId: line.recipeId,
    recipeName: line.recipeName,
    kind: line.kind,
    deliveredQuantity: line.deliveredQuantity,
    minimumQuantity: line.minimumQuantity,
    billedQuantity: line.billedQuantity,
    unitPrice: line.unitPrice,
    amount: line.amount,
  };
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
    cutOffAt:
      cutOffInstant(formatIsoDate(row.serviceDate), row.deliveryTime)?.toISOString() ?? null,
    amendments: [...row.amendments]
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .map((amendment) => ({
        id: amendment.id,
        number: amendment.number,
        reason: amendment.reason,
        createdByName: amendment.createdBy.name,
        createdAt: amendment.createdAt.toISOString(),
      })),
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
