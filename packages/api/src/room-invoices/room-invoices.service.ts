import {
  canRaiseRoomInvoice,
  creditNotePosting,
  invoicePosting,
  isKaramRole,
  roomBillError,
  roomCreditError,
  roomNights,
  stayLineAmount,
  stayTotal,
  sumMoney,
  type Actor,
  type RoomBillableRecord,
  type RoomInvoiceLineRecord,
  type RoomInvoiceRecord,
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
import { formatIsoDate } from '../common/date';
import { nextDocumentNumber } from '../common/document-number';
import { rethrowUnique } from '../common/prisma-error';
import { LedgerService } from '../ledger/ledger.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const stayInclude = {
  organisation: { select: { name: true } },
  lines: { include: { roomType: { select: { name: true } } } },
  roomInvoices: { where: { openRequestId: { not: null } }, select: { id: true } },
} satisfies Prisma.RoomRequestInclude;

type StayRow = Prisma.RoomRequestGetPayload<{ include: typeof stayInclude }>;

const invoiceInclude = {
  organisation: { select: { name: true } },
  roomRequest: { select: { number: true, checkIn: true, checkOut: true } },
  sourceInvoice: { select: { number: true } },
  creditNotes: { select: { number: true } },
  lines: true,
} satisfies Prisma.RoomInvoiceInclude;

type InvoiceRow = Prisma.RoomInvoiceGetPayload<{ include: typeof invoiceInclude }>;

interface PricedLine extends RoomInvoiceLineRecord {
  roomTypeId: string;
}

interface PricedStay {
  nights: number;
  allPriced: boolean;
  total: string;
  lines: PricedLine[];
}

@Injectable()
export class RoomInvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ledger: LedgerService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Karam sees every room bill. An airline sees its own. */
  async list(actor: Actor): Promise<RoomInvoiceRecord[]> {
    assertCan(actor, 'invoices', 'R', 'view invoices');
    const rows = await this.prisma.roomInvoice.findMany({
      where: isKaramRole(actor.role) ? {} : { organisationId: actor.organisationId },
      include: invoiceInclude,
      orderBy: { issuedAt: 'desc' },
    });
    return rows.map(toRoomInvoice);
  }

  /** Accepted stays with no bill in force, priced at the nightly price fixed on acceptance. */
  async billable(actor: Actor): Promise<RoomBillableRecord[]> {
    this.assertCanRaise(actor);
    const rows = await this.prisma.roomRequest.findMany({
      where: { status: 'ACCEPTED', roomInvoices: { none: { openRequestId: { not: null } } } },
      include: stayInclude,
      orderBy: { checkIn: 'asc' },
    });
    return rows.flatMap((row) => {
      const priced = priceStay(row);
      if (!priced.allPriced) return [];
      return [
        {
          roomRequestId: row.id,
          number: row.number,
          airlineName: row.organisation.name,
          checkIn: formatIsoDate(row.checkIn),
          checkOut: formatIsoDate(row.checkOut),
          nights: priced.nights,
          total: priced.total,
        },
      ];
    });
  }

  /** Bills an accepted stay for every booked night. The bill is issued at once and posted to the ledger. */
  async raise(actor: Actor, roomRequestId: string): Promise<RoomInvoiceRecord> {
    this.assertCanRaise(actor);
    const karamOrgId = await this.karamOrganisationId();

    const id = await this.prisma.$transaction(async (tx) => {
      const request = await tx.roomRequest.findUnique({
        where: { id: roomRequestId },
        include: stayInclude,
      });
      if (!request) throw new NotFoundException('That room request was not found.');
      const priced = priceStay(request);
      const error = roomBillError(
        request.status,
        request.roomInvoices.length > 0,
        priced.allPriced,
      );
      if (error) throw new BadRequestException(error);

      const number = await nextDocumentNumber(tx, karamOrgId, 'INVOICE');
      const invoice = await tx.roomInvoice
        .create({
          data: {
            organisationId: request.organisationId,
            number,
            kind: 'INVOICE',
            roomRequestId: request.id,
            openRequestId: request.id,
            createdById: actor.id,
            issuedAt: new Date(),
            lines: {
              create: priced.lines.map((line) => ({
                roomTypeId: line.roomTypeId,
                roomTypeName: line.roomTypeName,
                rooms: line.rooms,
                nights: line.nights,
                nightly: line.nightly,
                amount: line.amount,
              })),
            },
          },
        })
        .catch((caught: unknown) => rethrowUnique(caught, 'This stay is already billed.'));

      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'RoomInvoice',
        entityId: invoice.id,
        action: 'create',
        after: { number, roomRequest: request.number, total: priced.total },
      });
      await this.ledger.post(tx, actor, {
        organisationId: request.organisationId,
        karamOrganisationId: karamOrgId,
        sourceId: invoice.id,
        memo: `Room bill ${number} for ${request.number}`,
        lines: invoicePosting(priced.total),
      });
      await this.notifications.notify(tx, {
        organisationId: request.organisationId,
        role: 'AIRLINE_FINANCE',
        title: `${number} was issued`,
        body: `${request.number} is billed at ${priced.total} PKR.`,
        entity: 'RoomInvoice',
        entityId: invoice.id,
        exceptUserId: actor.id,
      });
      return invoice.id;
    });
    return this.load(id);
  }

  /** A credit note reverses a whole room bill. It is issued once, and the bill itself does not change. */
  async credit(actor: Actor, id: string, input: { reason: string }): Promise<RoomInvoiceRecord> {
    this.assertCanRaise(actor);
    const reason = input.reason.trim();
    if (reason.length < 3) throw new BadRequestException('Give a reason for this credit note.');
    const karamOrgId = await this.karamOrganisationId();

    const creditId = await this.prisma.$transaction(async (tx) => {
      const source = await tx.roomInvoice.findUnique({
        where: { id },
        include: { lines: true, creditNotes: { select: { id: true } } },
      });
      if (!source) throw new NotFoundException('That room bill was not found.');
      const error = roomCreditError(source.kind, source.creditNotes.length > 0);
      if (error) throw new BadRequestException(error);

      const lines = source.lines.map((line) => ({
        roomTypeId: line.roomTypeId,
        roomTypeName: line.roomTypeName,
        rooms: line.rooms,
        nights: line.nights,
        nightly: line.nightly.toFixed(2),
        amount: line.amount.toFixed(2),
      }));
      const total = totalOf(lines);
      const number = await nextDocumentNumber(tx, karamOrgId, 'CREDIT_NOTE');
      const creditNote = await tx.roomInvoice
        .create({
          data: {
            organisationId: source.organisationId,
            number,
            kind: 'CREDIT_NOTE',
            roomRequestId: source.roomRequestId,
            sourceInvoiceId: source.id,
            reason,
            createdById: actor.id,
            issuedAt: new Date(),
            lines: { create: lines },
          },
        })
        .catch((caught: unknown) => rethrowUnique(caught, 'This room bill is already credited.'));

      await tx.roomInvoice.update({
        where: { id: source.id },
        data: { openRequestId: null },
      });

      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'RoomInvoice',
        entityId: creditNote.id,
        action: 'credit',
        after: { number, source: source.number, reason, total },
      });
      await this.ledger.post(tx, actor, {
        organisationId: source.organisationId,
        karamOrganisationId: karamOrgId,
        sourceId: creditNote.id,
        memo: `Room credit note ${number} on ${source.number}`,
        lines: creditNotePosting(total),
      });
      await this.notifications.notify(tx, {
        organisationId: source.organisationId,
        role: 'AIRLINE_FINANCE',
        title: `${number} credits ${source.number}`,
        body: `${reason} The credit is ${total} PKR.`,
        entity: 'RoomInvoice',
        entityId: creditNote.id,
        exceptUserId: actor.id,
      });
      return creditNote.id;
    });
    return this.load(creditId);
  }

  private assertCanRaise(actor: Actor): void {
    if (!canRaiseRoomInvoice(actor.role)) {
      throw new ForbiddenException('You cannot raise a room bill.');
    }
  }

  private async karamOrganisationId(): Promise<string> {
    const karam = await this.prisma.organisation.findFirst({
      where: { type: 'KARAM' },
      select: { id: true },
    });
    if (!karam) throw new NotFoundException('The restaurant account is missing.');
    return karam.id;
  }

  private async load(id: string): Promise<RoomInvoiceRecord> {
    const row = await this.prisma.roomInvoice.findUnique({
      where: { id },
      include: invoiceInclude,
    });
    if (!row) throw new NotFoundException('That room bill was not found.');
    return toRoomInvoice(row);
  }
}

/** Prices every booked night of a stay. A stay with any line that has no fixed price cannot be billed. */
function priceStay(row: StayRow): PricedStay {
  const nights = roomNights(formatIsoDate(row.checkIn), formatIsoDate(row.checkOut)) ?? 0;
  const unpriced: PricedStay = { nights, allPriced: false, total: '0.00', lines: [] };
  if (nights < 1) return unpriced;

  const lines: PricedLine[] = [];
  for (const line of row.lines) {
    const nightly = line.nightlyQuoted?.toFixed(2);
    if (!nightly) return unpriced;
    const amount = stayLineAmount(line.quantity, nights, nightly);
    if (amount === null) return unpriced;
    lines.push({
      roomTypeId: line.roomTypeId,
      roomTypeName: line.roomType.name,
      rooms: line.quantity,
      nights,
      nightly,
      amount,
    });
  }
  const total = stayTotal(
    lines.map((line) => ({ rooms: line.rooms, nightly: line.nightly })),
    nights,
  );
  if (total === null) return unpriced;
  return { nights, allPriced: true, total, lines };
}

function totalOf(lines: Array<{ amount: string }>): string {
  return sumMoney(lines.map((line) => line.amount)) ?? '0.00';
}

function toRoomInvoice(row: InvoiceRow): RoomInvoiceRecord {
  const lines = [...row.lines]
    .sort((left, right) => left.roomTypeName.localeCompare(right.roomTypeName))
    .map((line) => ({
      roomTypeName: line.roomTypeName,
      rooms: line.rooms,
      nights: line.nights,
      nightly: line.nightly.toFixed(2),
      amount: line.amount.toFixed(2),
    }));
  return {
    id: row.id,
    number: row.number,
    kind: row.kind,
    airlineId: row.organisationId,
    airlineName: row.organisation.name,
    roomRequestId: row.roomRequestId,
    roomRequestNumber: row.roomRequest.number,
    checkIn: formatIsoDate(row.roomRequest.checkIn),
    checkOut: formatIsoDate(row.roomRequest.checkOut),
    nights:
      roomNights(formatIsoDate(row.roomRequest.checkIn), formatIsoDate(row.roomRequest.checkOut)) ??
      0,
    sourceInvoiceNumber: row.sourceInvoice?.number ?? null,
    creditNumber: row.creditNotes[0]?.number ?? null,
    reason: row.reason,
    issuedAt: row.issuedAt.toISOString(),
    total: totalOf(lines),
    lines,
  };
}
