import {
  canDecideDispute,
  canDisputeInvoice,
  canDisputeRoomInvoice,
  canOpenDispute,
  isKaramRole,
  nextDisputeStatus,
  sumMoney,
  type Actor,
  type DisputeAction,
  type DisputeRecord,
  type DisputeSource,
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
import { nextDocumentNumber } from '../common/document-number';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

import type { DecideDisputeDto, OpenDisputeDto } from './disputes.dto';

const disputeInclude = {
  organisation: { select: { name: true } },
  invoice: { select: { number: true, lines: { select: { amount: true } } } },
  roomInvoice: { select: { number: true, lines: { select: { amount: true } } } },
  openedBy: { select: { name: true } },
  decidedBy: { select: { name: true } },
} satisfies Prisma.DisputeInclude;

type DisputeRow = Prisma.DisputeGetPayload<{ include: typeof disputeInclude }>;

@Injectable()
export class DisputesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Karam sees every dispute. An airline sees only its own. */
  async list(actor: Actor): Promise<DisputeRecord[]> {
    assertCan(actor, 'disputes', 'R', 'view disputes');
    const rows = await this.prisma.dispute.findMany({
      where: isKaramRole(actor.role) ? {} : { organisationId: actor.organisationId },
      include: disputeInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDispute);
  }

  /** Airline finance opens one dispute on an issued bill. The bill is not changed. */
  async open(actor: Actor, input: OpenDisputeDto): Promise<DisputeRecord> {
    if (!canOpenDispute(actor.role)) {
      throw new ForbiddenException('You cannot open a dispute.');
    }
    const reason = input.reason.trim();
    if (reason.length < 3) throw new BadRequestException('Give a reason for this dispute.');
    if (Boolean(input.invoiceId) === Boolean(input.roomInvoiceId)) {
      throw new BadRequestException('Choose one bill to dispute.');
    }
    const karamOrgId = await this.karamOrganisationId();

    const id = await this.prisma.$transaction(async (tx) => {
      const target = input.invoiceId
        ? await this.mealTarget(tx, actor.organisationId, input.invoiceId)
        : await this.roomTarget(tx, actor.organisationId, input.roomInvoiceId ?? '');
      const number = await nextDocumentNumber(tx, karamOrgId, 'DISPUTE');
      const dispute = await tx.dispute.create({
        data: {
          organisationId: target.organisationId,
          invoiceId: target.source === 'INVOICE' ? target.id : null,
          roomInvoiceId: target.source === 'ROOM_INVOICE' ? target.id : null,
          number,
          reason,
          openedById: actor.id,
        },
      });
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'Dispute',
        entityId: dispute.id,
        action: 'open',
        after: { number, source: target.source, billId: target.id, reason },
      });
      await this.notifications.notify(tx, {
        organisationId: karamOrgId,
        role: 'FINANCE_OFFICER',
        title: `${number} disputes ${target.number}`,
        body: reason,
        entity: 'Dispute',
        entityId: dispute.id,
        exceptUserId: actor.id,
      });
      return dispute.id;
    });
    return this.load(id);
  }

  async accept(actor: Actor, id: string, input: DecideDisputeDto): Promise<DisputeRecord> {
    return this.decide(actor, id, 'accept', input);
  }

  async reject(actor: Actor, id: string, input: DecideDisputeDto): Promise<DisputeRecord> {
    return this.decide(actor, id, 'reject', input);
  }

  private async decide(
    actor: Actor,
    id: string,
    action: DisputeAction,
    input: DecideDisputeDto,
  ): Promise<DisputeRecord> {
    if (!canDecideDispute(actor.role)) {
      throw new ForbiddenException('You cannot decide a dispute.');
    }
    const resolution = input.resolution.trim();
    if (resolution.length < 3) throw new BadRequestException('Give a reason for this decision.');

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.dispute.findUnique({
        where: { id },
        include: {
          invoice: { select: { number: true } },
          roomInvoice: { select: { number: true } },
        },
      });
      if (!existing) throw new NotFoundException('That dispute was not found.');
      const next = nextDisputeStatus(existing.status, action);
      if (!next) throw new BadRequestException('This dispute is already decided.');
      await tx.dispute.update({
        where: { id },
        data: { status: next, resolution, decidedAt: new Date(), decidedById: actor.id },
      });
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'Dispute',
        entityId: id,
        action,
        before: { status: existing.status },
        after: { status: next, resolution },
      });
      const outcome = next === 'ACCEPTED' ? 'accepted' : 'rejected';
      await this.notifications.notify(tx, {
        organisationId: existing.organisationId,
        role: 'AIRLINE_FINANCE',
        title: `${existing.number} was ${outcome}`,
        body: `${existing.invoice?.number ?? existing.roomInvoice?.number}: ${resolution}`,
        entity: 'Dispute',
        entityId: id,
        exceptUserId: actor.id,
      });
    });
    return this.load(id);
  }

  private async mealTarget(
    tx: Prisma.TransactionClient,
    organisationId: string,
    invoiceId: string,
  ): Promise<BillTarget> {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: { dispute: { select: { number: true } } },
    });
    if (!invoice || invoice.organisationId !== organisationId) {
      throw new NotFoundException('That invoice was not found.');
    }
    if (!canDisputeInvoice(invoice.kind, invoice.status)) {
      throw new BadRequestException('Dispute an invoice that has been issued.');
    }
    if (invoice.dispute) {
      throw new BadRequestException(`${invoice.dispute.number} already covers this invoice.`);
    }
    return { source: 'INVOICE', id: invoice.id, organisationId, number: invoice.number };
  }

  private async roomTarget(
    tx: Prisma.TransactionClient,
    organisationId: string,
    roomInvoiceId: string,
  ): Promise<BillTarget> {
    const bill = await tx.roomInvoice.findUnique({
      where: { id: roomInvoiceId },
      include: { dispute: { select: { number: true } } },
    });
    if (!bill || bill.organisationId !== organisationId) {
      throw new NotFoundException('That room bill was not found.');
    }
    if (!canDisputeRoomInvoice(bill.kind)) {
      throw new BadRequestException('Dispute a room bill. A credit note is not disputed.');
    }
    if (bill.dispute) {
      throw new BadRequestException(`${bill.dispute.number} already covers this room bill.`);
    }
    return { source: 'ROOM_INVOICE', id: bill.id, organisationId, number: bill.number };
  }

  private async karamOrganisationId(): Promise<string> {
    const karam = await this.prisma.organisation.findFirst({
      where: { type: 'KARAM' },
      select: { id: true },
    });
    if (!karam) throw new NotFoundException('The restaurant account is missing.');
    return karam.id;
  }

  private async load(id: string): Promise<DisputeRecord> {
    const row = await this.prisma.dispute.findUnique({ where: { id }, include: disputeInclude });
    if (!row) throw new NotFoundException('That dispute was not found.');
    return toDispute(row);
  }
}

interface BillTarget {
  source: DisputeSource;
  id: string;
  organisationId: string;
  number: string;
}

function toDispute(row: DisputeRow): DisputeRecord {
  const lines = row.invoice?.lines ?? row.roomInvoice?.lines ?? [];
  const total = sumMoney(lines.map((line) => line.amount.toFixed(2))) ?? '0.00';
  const source: DisputeSource = row.roomInvoiceId ? 'ROOM_INVOICE' : 'INVOICE';
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    airlineId: row.organisationId,
    airlineName: row.organisation.name,
    source,
    invoiceId: row.invoiceId,
    roomInvoiceId: row.roomInvoiceId,
    invoiceNumber: row.invoice?.number ?? row.roomInvoice?.number ?? '',
    invoiceTotal: total,
    reason: row.reason,
    resolution: row.resolution,
    openedByName: row.openedBy.name,
    decidedByName: row.decidedBy?.name ?? null,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
