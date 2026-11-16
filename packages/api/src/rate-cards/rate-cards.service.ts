import {
  isKaramRole,
  isMoney,
  rateCardsOverlap,
  todayInKarachi,
  type Actor,
  type AirlineOption,
  type RateCardRecord,
} from '@knazawy/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { assertCan } from '../auth/permissions';
import { formatIsoDate, parseIsoDate } from '../common/date';
import { nextDocumentNumber } from '../common/document-number';
import { PrismaService } from '../prisma/prisma.service';

import type { EndRateCardDto, RateCardDto } from './rate-cards.dto';

const cardInclude = {
  organisation: { select: { name: true } },
  createdBy: { select: { name: true } },
  approvedBy: { select: { name: true } },
  lines: { include: { recipe: { select: { name: true, kind: true } } } },
} satisfies Prisma.RateCardInclude;

type CardRow = Prisma.RateCardGetPayload<{ include: typeof cardInclude }>;

interface LineInput {
  recipeId: string;
  unitPrice: string;
  minimumQuantity: number;
}

@Injectable()
export class RateCardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Karam staff see every card. An airline sees only its own approved cards. */
  async list(actor: Actor, airlineId?: string): Promise<RateCardRecord[]> {
    assertCan(actor, 'service_rates', 'R', 'view rate cards');
    const where: Prisma.RateCardWhereInput = isKaramRole(actor.role)
      ? airlineId
        ? { organisationId: airlineId }
        : {}
      : { organisationId: actor.organisationId, status: 'APPROVED' };
    const rows = await this.prisma.rateCard.findMany({
      where,
      include: cardInclude,
      orderBy: [{ validFrom: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map(toCard);
  }

  async airlines(actor: Actor): Promise<AirlineOption[]> {
    assertCan(actor, 'service_rates', 'R', 'view rate cards');
    return this.prisma.organisation.findMany({
      where: isKaramRole(actor.role)
        ? { type: 'AIRLINE' }
        : { type: 'AIRLINE', id: actor.organisationId },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  /** The approved card that applies on a service date, or null when none does. */
  async current(
    actor: Actor,
    serviceDate: string,
    airlineId?: string,
  ): Promise<RateCardRecord | null> {
    assertCan(actor, 'service_rates', 'R', 'view rate cards');
    const organisationId = isKaramRole(actor.role) ? airlineId : actor.organisationId;
    if (!organisationId) throw new BadRequestException('Choose an airline.');
    const date = parseIsoDate(serviceDate);
    const row = await this.prisma.rateCard.findFirst({
      where: {
        organisationId,
        status: 'APPROVED',
        validFrom: { lte: date },
        OR: [{ validTo: null }, { validTo: { gte: date } }],
      },
      include: cardInclude,
    });
    return row ? toCard(row) : null;
  }

  async create(actor: Actor, input: RateCardDto): Promise<RateCardRecord> {
    assertCan(actor, 'service_rates', 'C', 'create a rate card');
    const karamOrgId = await this.karamOrganisationId();
    await this.assertAirline(input.airlineId);
    const period = periodFrom(input);
    const lines = linesFrom(input.lines);

    const id = await this.prisma.$transaction(async (tx) => {
      await checkRecipes(tx, karamOrgId, lines);
      const number = await nextDocumentNumber(tx, karamOrgId, 'RATE_CARD');
      const card = await tx.rateCard.create({
        data: {
          organisationId: input.airlineId,
          number,
          ...period,
          note: blankToNull(input.note),
          createdById: actor.id,
          lines: { create: lines },
        },
      });
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'RateCard',
        entityId: card.id,
        action: 'create',
        after: { number, ...input, lines },
      });
      return card.id;
    });
    return this.load(id);
  }

  async update(actor: Actor, id: string, input: RateCardDto): Promise<RateCardRecord> {
    assertCan(actor, 'service_rates', 'U', 'change a rate card');
    const existing = await this.find(id);
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('Only a draft rate card can be changed.');
    }
    const karamOrgId = await this.karamOrganisationId();
    await this.assertAirline(input.airlineId);
    const period = periodFrom(input);
    const lines = linesFrom(input.lines);

    await this.prisma.$transaction(async (tx) => {
      await checkRecipes(tx, karamOrgId, lines);
      await tx.rateCard.update({
        where: { id },
        data: {
          organisationId: input.airlineId,
          ...period,
          note: blankToNull(input.note),
        },
      });
      await tx.rateCardLine.deleteMany({ where: { rateCardId: id } });
      await tx.rateCardLine.createMany({
        data: lines.map((line) => ({ rateCardId: id, ...line })),
      });
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'RateCard',
        entityId: id,
        action: 'update',
        before: toCard(existing),
        after: { ...input, lines },
      });
    });
    return this.load(id);
  }

  /** Approval fixes the prices. Two approved cards for one airline never share a date. */
  async approve(actor: Actor, id: string): Promise<RateCardRecord> {
    assertCan(actor, 'service_rates', 'A', 'approve a rate card');
    const existing = await this.find(id);
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('This rate card is already approved.');
    }
    if (existing.lines.length === 0) {
      throw new BadRequestException('Price at least one menu item before approving.');
    }
    const period = periodOf(existing);

    await this.prisma.$transaction(async (tx) => {
      const others = await tx.rateCard.findMany({
        where: { organisationId: existing.organisationId, status: 'APPROVED', id: { not: id } },
        select: { number: true, validFrom: true, validTo: true },
      });
      const clash = others.find((other) => rateCardsOverlap(period, periodOf(other)));
      if (clash) {
        throw new BadRequestException(
          `${clash.number} already covers some of these dates. End it first or change the dates.`,
        );
      }
      await tx.rateCard.update({
        where: { id },
        data: { status: 'APPROVED', approvedAt: new Date(), approvedById: actor.id },
      });
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'RateCard',
        entityId: id,
        action: 'approve',
        before: { status: existing.status },
        after: { status: 'APPROVED' },
      });
    });
    return this.load(id);
  }

  /** Ends an approved card. Days already past keep their prices. */
  async end(actor: Actor, id: string, input: EndRateCardDto): Promise<RateCardRecord> {
    assertCan(actor, 'service_rates', 'A', 'end a rate card');
    const existing = await this.find(id);
    if (existing.status !== 'APPROVED') {
      throw new BadRequestException('Only an approved rate card can be ended.');
    }
    const validTo = parseIsoDate(input.validTo);
    const lastDay = formatIsoDate(validTo);
    if (lastDay < todayInKarachi()) {
      throw new BadRequestException('Pick an end date from today on. Past days keep their prices.');
    }
    if (lastDay < formatIsoDate(existing.validFrom)) {
      throw new BadRequestException('The end date must be on or after the start date.');
    }
    if (existing.validTo && lastDay >= formatIsoDate(existing.validTo)) {
      throw new BadRequestException('Pick an end date earlier than the current one.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rateCard.update({ where: { id }, data: { validTo } });
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'RateCard',
        entityId: id,
        action: 'end',
        before: { validTo: existing.validTo ? formatIsoDate(existing.validTo) : null },
        after: { validTo: lastDay },
      });
    });
    return this.load(id);
  }

  private async assertAirline(airlineId: string): Promise<void> {
    const airline = await this.prisma.organisation.findFirst({
      where: { id: airlineId, type: 'AIRLINE' },
      select: { id: true },
    });
    if (!airline) throw new BadRequestException('Choose an airline.');
  }

  private async karamOrganisationId(): Promise<string> {
    const karam = await this.prisma.organisation.findFirst({
      where: { type: 'KARAM' },
      select: { id: true },
    });
    if (!karam) throw new NotFoundException('The restaurant account is missing.');
    return karam.id;
  }

  private async find(id: string): Promise<CardRow> {
    const row = await this.prisma.rateCard.findUnique({ where: { id }, include: cardInclude });
    if (!row) throw new NotFoundException('That rate card was not found.');
    return row;
  }

  private async load(id: string): Promise<RateCardRecord> {
    return toCard(await this.find(id));
  }
}

function periodFrom(input: RateCardDto): { validFrom: Date; validTo: Date | null } {
  const validFrom = parseIsoDate(input.validFrom);
  const validTo = input.validTo ? parseIsoDate(input.validTo) : null;
  if (validTo && validTo < validFrom) {
    throw new BadRequestException('The end date must be on or after the start date.');
  }
  return { validFrom, validTo };
}

function periodOf(row: { validFrom: Date; validTo: Date | null }) {
  return {
    validFrom: formatIsoDate(row.validFrom),
    validTo: row.validTo ? formatIsoDate(row.validTo) : null,
  };
}

function linesFrom(lines: RateCardDto['lines']): LineInput[] {
  const seen = new Set<string>();
  return lines.map((line) => {
    if (seen.has(line.recipeId)) throw new BadRequestException('Price each menu item once.');
    seen.add(line.recipeId);
    const unitPrice = line.unitPrice.trim();
    if (!isMoney(unitPrice) || Number(unitPrice) <= 0) {
      throw new BadRequestException('Enter each price in PKR, such as 650 or 650.50.');
    }
    return { recipeId: line.recipeId, unitPrice, minimumQuantity: line.minimumQuantity };
  });
}

async function checkRecipes(
  tx: Prisma.TransactionClient,
  karamOrgId: string,
  lines: LineInput[],
): Promise<void> {
  const ids = lines.map((line) => line.recipeId);
  const available = await tx.recipe.findMany({
    where: { id: { in: ids }, organisationId: karamOrgId, active: true, status: 'APPROVED' },
    select: { id: true },
  });
  if (available.length !== ids.length) {
    throw new BadRequestException('One of the menu items is not available. Choose it again.');
  }
}

function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

function toCard(row: CardRow): RateCardRecord {
  return {
    id: row.id,
    number: row.number,
    airlineId: row.organisationId,
    airlineName: row.organisation.name,
    status: row.status,
    ...periodOf(row),
    note: row.note,
    createdByName: row.createdBy.name,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    approvedByName: row.approvedBy?.name ?? null,
    lines: [...row.lines]
      .sort((left, right) => left.recipe.name.localeCompare(right.recipe.name))
      .map((line) => ({
        recipeId: line.recipeId,
        recipeName: line.recipe.name,
        kind: line.recipe.kind,
        unitPrice: line.unitPrice.toFixed(2),
        minimumQuantity: line.minimumQuantity,
      })),
  };
}
