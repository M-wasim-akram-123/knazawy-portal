import {
  canDecideDispute,
  canDisputeInvoice,
  canOpenDispute,
  isKaramRole,
  nextDisputeStatus,
  sumMoney,
  type Actor,
  type DisputeAction,
  type DisputeRecord,
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

  /** Airline finance opens one dispute on an issued invoice. The invoice is not changed. */
  async open(actor: Actor, input: OpenDisputeDto): Promise<DisputeRecord> {
    if (!canOpenDispute(actor.role)) {
      throw new ForbiddenException('You cannot open a dispute.');
    }
    const reason = input.reason.trim();
    if (reason.length < 3) throw new BadRequestException('Give a reason for this dispute.');
    const karamOrgId = await this.karamOrganisationId();

    const id = await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: input.invoiceId },
        include: { dispute: { select: { number: true } } },
      });
      if (!invoice || invoice.organisationId !== actor.organisationId) {
        throw new NotFoundException('That invoice was not found.');
      }
      if (!canDisputeInvoice(invoice.kind, invoice.status)) {
        throw new BadRequestException('Dispute an invoice that has been issued.');
      }
      if (invoice.dispute) {
        throw new BadRequestException(`${invoice.dispute.number} already covers this invoice.`);
      }
      const number = await nextDocumentNumber(tx, karamOrgId, 'DISPUTE');
      const dispute = await tx.dispute.create({
        data: {
          organisationId: invoice.organisationId,
          invoiceId: invoice.id,
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
        after: { number, invoiceId: invoice.id, reason },
      });
      await this.notifications.notify(tx, {
        organisationId: karamOrgId,
        role: 'FINANCE_OFFICER',
        title: `${number} disputes ${invoice.number}`,
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
        include: { invoice: { select: { number: true } } },
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
        body: `${existing.invoice.number}: ${resolution}`,
        entity: 'Dispute',
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

  private async load(id: string): Promise<DisputeRecord> {
    const row = await this.prisma.dispute.findUnique({ where: { id }, include: disputeInclude });
    if (!row) throw new NotFoundException('That dispute was not found.');
    return toDispute(row);
  }
}

function toDispute(row: DisputeRow): DisputeRecord {
  const total = sumMoney(row.invoice.lines.map((line) => line.amount.toFixed(2))) ?? '0.00';
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    airlineId: row.organisationId,
    airlineName: row.organisation.name,
    invoiceId: row.invoiceId,
    invoiceNumber: row.invoice.number,
    invoiceTotal: total,
    reason: row.reason,
    resolution: row.resolution,
    openedByName: row.openedBy.name,
    decidedByName: row.decidedBy?.name ?? null,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
