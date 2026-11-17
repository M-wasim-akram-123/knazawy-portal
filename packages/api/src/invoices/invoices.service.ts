import { randomUUID } from 'node:crypto';

import {
  amountDue,
  applyDiscount,
  formatDisplayDate,
  invoiceDueOn,
  todayInKarachi,
  canIssueInvoice,
  canRaiseInvoice,
  chargeFor,
  creditNotePosting,
  creditQuantityError,
  invoicePosting,
  isMoney,
  isKaramRole,
  priceInvoiceLines,
  requestStatusAfterInvoice,
  sumMoney,
  type Actor,
  type BillableRequestOption,
  type InvoicePricedLine,
  type InvoiceRecord,
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
import { parsePositiveDecimal } from '../common/decimal';
import { nextDocumentNumber } from '../common/document-number';
import { lockInvoice, lockRequest } from '../common/row-lock';
import { LedgerService } from '../ledger/ledger.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

import type { CreateInvoiceDto, CreateManualInvoiceDto, CreditInvoiceDto } from './invoices.dto';

const invoiceInclude = {
  organisation: { select: { name: true, taxNumber: true } },
  request: { select: { number: true, flightNumber: true, serviceDate: true, status: true } },
  rateCard: { select: { number: true } },
  sourceInvoice: { select: { number: true } },
  lines: true,
  creditNotes: {
    select: {
      id: true,
      number: true,
      reason: true,
      discountPercent: true,
      lines: { select: { recipeId: true, billedQuantity: true, amount: true } },
    },
  },
} satisfies Prisma.InvoiceInclude;

type InvoiceRow = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

interface Charge {
  rateCardId: string;
  lines: InvoicePricedLine[];
}

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ledger: LedgerService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Karam sees every invoice. An airline sees its own once they are issued. */
  async list(actor: Actor): Promise<InvoiceRecord[]> {
    assertCan(actor, 'invoices', 'R', 'view invoices');
    const rows = await this.prisma.invoice.findMany({
      where: isKaramRole(actor.role)
        ? {}
        : { organisationId: actor.organisationId, status: 'ISSUED' },
      include: invoiceInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toInvoice);
  }

  async billableRequests(actor: Actor): Promise<BillableRequestOption[]> {
    this.assertCanRaise(actor);
    const rows = await this.prisma.serviceRequest.findMany({
      where: {
        status: 'DELIVERED',
        invoices: { none: { kind: 'INVOICE' } },
      },
      select: {
        id: true,
        number: true,
        flightNumber: true,
        organisation: { select: { name: true } },
      },
      orderBy: [{ serviceDate: 'asc' }, { number: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      number: row.number,
      airlineName: row.organisation.name,
      flightNumber: row.flightNumber,
    }));
  }

  /** Prices a delivered request from the rate card that covers its service date. */
  async create(actor: Actor, input: CreateInvoiceDto): Promise<InvoiceRecord> {
    this.assertCanRaise(actor);
    const karamOrgId = await this.karamOrganisationId();

    const id = await this.prisma.$transaction(async (tx) => {
      // One invoice per request: hold the request while checking for an existing one.
      await lockRequest(tx, input.requestId);
      const request = await this.loadRequest(tx, input.requestId);
      if (!requestStatusAfterInvoice(request.status)) {
        throw new BadRequestException('Only a delivered request can be invoiced.');
      }
      const existing = await tx.invoice.findFirst({
        where: { requestId: request.id, kind: 'INVOICE' },
        select: { number: true },
      });
      if (existing)
        throw new BadRequestException(`${existing.number} already covers this request.`);
      const charge = await this.price(tx, request);
      const terms = await termsOf(tx, request.organisationId);
      const number = await nextDocumentNumber(tx, karamOrgId, 'INVOICE');
      const invoice = await tx.invoice.create({
        data: {
          organisationId: request.organisationId,
          number,
          requestId: request.id,
          rateCardId: charge.rateCardId,
          discountPercent: terms.discountPercent,
          paymentTermsDays: terms.paymentTermsDays,
          note: blankToNull(input.note),
          createdById: actor.id,
          lines: { create: charge.lines.map(lineData) },
        },
      });
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'Invoice',
        entityId: invoice.id,
        action: 'create',
        after: { number, requestId: request.id, total: totalOf(charge.lines) },
      });
      return invoice.id;
    });
    return this.load(id);
  }

  /** Creates a bill for an airline without granting it portal access. */
  async createManual(actor: Actor, input: CreateManualInvoiceDto): Promise<InvoiceRecord> {
    this.assertCanRaise(actor);
    const airlineName = input.airlineName.trim();
    if (airlineName.length < 2) throw new BadRequestException('Enter the airline name.');
    const karamOrgId = await this.karamOrganisationId();

    const id = await this.prisma.$transaction(async (tx) => {
      const lines = await this.manualLines(tx, input, karamOrgId);
      const customer = await tx.organisation.create({
        data: {
          code: `ONEOFF-${randomUUID()}`,
          type: 'ONE_OFF_AIRLINE',
          name: airlineName,
          taxNumber: blankToNull(input.taxNumber),
        },
      });
      const number = await nextDocumentNumber(tx, karamOrgId, 'INVOICE');
      const invoice = await tx.invoice.create({
        data: {
          organisationId: customer.id,
          number,
          note: blankToNull(input.note),
          createdById: actor.id,
          lines: { create: lines.map(lineData) },
        },
      });
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'Invoice',
        entityId: invoice.id,
        action: 'create',
        after: {
          number,
          customer: airlineName,
          oneOff: true,
          total: totalOf(lines),
        },
      });
      return invoice.id;
    });
    return this.load(id);
  }

  /** Locks the prices and posts the invoice. A linked request becomes invoiced. */
  async issue(actor: Actor, id: string): Promise<InvoiceRecord> {
    if (!canIssueInvoice(actor.role)) {
      throw new ForbiddenException('You cannot issue an invoice.');
    }
    const karamOrgId = await this.karamOrganisationId();
    await this.prisma.$transaction(async (tx) => {
      // Hold the invoice so a double click cannot issue or credit it twice.
      await lockInvoice(tx, id);
      const existing = await this.find(tx, id);
      if (existing.kind !== 'INVOICE' || existing.status !== 'DRAFT') {
        throw new BadRequestException('Only a draft invoice can be issued.');
      }
      let subtotal: string;
      let rateCardId: string | undefined;
      if (existing.requestId) {
        const request = await this.loadRequest(tx, existing.requestId);
        const next = requestStatusAfterInvoice(request.status);
        if (!next) throw new BadRequestException('Only a delivered request can be invoiced.');
        const charge = await this.price(tx, request);
        await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
        await tx.invoiceLine.createMany({
          data: charge.lines.map((line) => ({ invoiceId: id, ...lineData(line) })),
        });
        rateCardId = charge.rateCardId;
        await tx.serviceRequest.update({ where: { id: request.id }, data: { status: next } });
        subtotal = totalOf(charge.lines);
      } else {
        if (existing.lines.length === 0) {
          throw new BadRequestException('Add at least one menu item before issuing this invoice.');
        }
        subtotal = totalOf(existing.lines.map((line) => ({ amount: line.amount.toFixed(2) })));
      }
      // The airline's terms on the day of issue are copied onto the bill and never change after.
      const terms = await termsOf(tx, existing.organisationId);
      const priced = applyDiscount(subtotal, terms.discountPercent);
      if (!priced) throw new BadRequestException('The airline discount cannot be applied.');
      const total = priced.total;
      await tx.invoice.update({
        where: { id },
        data: {
          rateCardId,
          status: 'ISSUED',
          issuedAt: new Date(),
          issuedById: actor.id,
          discountPercent: terms.discountPercent,
          paymentTermsDays: terms.paymentTermsDays,
          dueOn: parseIsoDate(invoiceDueOn(todayInKarachi(), terms.paymentTermsDays)),
        },
      });
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'Invoice',
        entityId: id,
        action: 'issue',
        before: { status: 'DRAFT' },
        after: {
          status: 'ISSUED',
          subtotal,
          discount: priced.discount,
          total,
          paymentTermsDays: terms.paymentTermsDays,
        },
      });
      await this.ledger.post(tx, actor, {
        organisationId: existing.organisationId,
        karamOrganisationId: karamOrgId,
        sourceId: id,
        memo: `Invoice ${existing.number}`,
        lines: invoicePosting(total),
      });
      if (existing.requestId) {
        await this.notifications.notify(tx, {
          organisationId: existing.organisationId,
          role: 'AIRLINE_FINANCE',
          title: `${existing.number} was issued`,
          body: `The bill is ${total} PKR, due by ${formatDisplayDate(
            invoiceDueOn(todayInKarachi(), terms.paymentTermsDays),
          )}.`,
          entity: 'Invoice',
          entityId: id,
          exceptUserId: actor.id,
        });
      }
    });
    return this.load(id);
  }

  /** A credit note reduces what was billed. It does not change the invoice. */
  async credit(actor: Actor, id: string, input: CreditInvoiceDto): Promise<InvoiceRecord> {
    this.assertCanRaise(actor);
    const reason = input.reason.trim();
    if (reason.length < 3) throw new BadRequestException('Give a reason for this credit note.');
    const karamOrgId = await this.karamOrganisationId();
    const quantities = quantitiesFrom(input.lines);

    const creditId = await this.prisma.$transaction(async (tx) => {
      // Hold the invoice so a double click cannot issue or credit it twice.
      await lockInvoice(tx, id);
      const existing = await this.find(tx, id);
      if (existing.kind === 'CREDIT_NOTE' || existing.status !== 'ISSUED') {
        throw new BadRequestException('Credit an invoice that has been issued.');
      }
      const credited = creditedByRecipe(existing);
      const lines = [...quantities.entries()].map(([recipeId, quantity]) => {
        const source = existing.lines.find((line) => line.recipeId === recipeId);
        if (!source) throw new BadRequestException('Credit only items on this invoice.');
        const error = creditQuantityError(
          source.billedQuantity,
          credited.get(recipeId) ?? 0,
          quantity,
        );
        if (error) throw new BadRequestException(error);
        const amount = chargeFor(quantity, source.unitPrice.toFixed(2));
        if (amount === null)
          throw new BadRequestException('This invoice has a price that cannot be used.');
        return {
          recipeId,
          recipeName: source.recipeName,
          kind: source.kind,
          deliveredQuantity: 0,
          minimumQuantity: 0,
          billedQuantity: quantity,
          unitPrice: source.unitPrice.toFixed(2),
          amount,
        };
      });
      const number = await nextDocumentNumber(tx, karamOrgId, 'CREDIT_NOTE');
      const creditNote = await tx.invoice.create({
        data: {
          organisationId: existing.organisationId,
          number,
          kind: 'CREDIT_NOTE',
          status: 'ISSUED',
          requestId: existing.requestId,
          rateCardId: existing.rateCardId,
          sourceInvoiceId: existing.id,
          discountPercent: existing.discountPercent,
          reason,
          createdById: actor.id,
          issuedAt: new Date(),
          issuedById: actor.id,
          lines: { create: lines },
        },
      });
      const total = discountedTotal(totalOf(lines), existing.discountPercent);
      await this.audit.record(tx, {
        userId: actor.id,
        entity: 'Invoice',
        entityId: creditNote.id,
        action: 'credit',
        after: { number, source: existing.number, reason, total },
      });
      await this.ledger.post(tx, actor, {
        organisationId: existing.organisationId,
        karamOrganisationId: karamOrgId,
        sourceId: creditNote.id,
        memo: `Credit note ${number} on ${existing.number}`,
        lines: creditNotePosting(total),
      });
      if (existing.requestId) {
        await this.notifications.notify(tx, {
          organisationId: existing.organisationId,
          role: 'AIRLINE_FINANCE',
          title: `${number} credits ${existing.number}`,
          body: `${reason} The credit is ${total} PKR.`,
          entity: 'Invoice',
          entityId: creditNote.id,
          exceptUserId: actor.id,
        });
      }
      return creditNote.id;
    });
    return this.load(creditId);
  }

  private assertCanRaise(actor: Actor): void {
    if (!canRaiseInvoice(actor.role)) throw new ForbiddenException('You cannot raise an invoice.');
  }

  private async loadRequest(tx: Prisma.TransactionClient, requestId: string) {
    const request = await tx.serviceRequest.findUnique({
      where: { id: requestId },
      include: {
        delivery: {
          include: { lines: { include: { recipe: { select: { name: true, kind: true } } } } },
        },
      },
    });
    if (!request) throw new NotFoundException('That request was not found.');
    return request;
  }

  private async price(
    tx: Prisma.TransactionClient,
    request: Awaited<ReturnType<InvoicesService['loadRequest']>>,
  ): Promise<Charge> {
    const delivery = request.delivery;
    if (!delivery) throw new BadRequestException('Record the delivery before invoicing.');
    const card = await tx.rateCard.findFirst({
      where: {
        organisationId: request.organisationId,
        status: 'APPROVED',
        validFrom: { lte: request.serviceDate },
        OR: [{ validTo: null }, { validTo: { gte: request.serviceDate } }],
      },
      include: { lines: true },
    });
    if (!card) throw new BadRequestException('No rate card covers this service date.');
    const lines = delivery.lines.map((line) => {
      if (line.delivered === null) {
        throw new BadRequestException('Record what arrived before invoicing.');
      }
      const rate = card.lines.find((row) => row.recipeId === line.recipeId);
      if (!rate) {
        throw new BadRequestException(`${line.recipe.name} has no price on ${card.number}.`);
      }
      return {
        recipeId: line.recipeId,
        recipeName: line.recipe.name,
        kind: line.recipe.kind,
        deliveredQuantity: line.delivered,
        minimumQuantity: rate.minimumQuantity,
        unitPrice: rate.unitPrice.toFixed(2),
      };
    });
    const priced = priceInvoiceLines(lines);
    if (!priced) throw new BadRequestException('This rate card has a price that cannot be used.');
    return { rateCardId: card.id, lines: priced.lines };
  }

  private async manualLines(
    tx: Prisma.TransactionClient,
    input: CreateManualInvoiceDto,
    karamOrgId: string,
  ): Promise<InvoicePricedLine[]> {
    const recipeIds = input.lines.map((line) => line.recipeId);
    if (new Set(recipeIds).size !== recipeIds.length) {
      throw new BadRequestException('Add each menu item only once.');
    }
    const recipes = await tx.recipe.findMany({
      where: {
        organisationId: karamOrgId,
        id: { in: recipeIds },
        active: true,
        status: 'APPROVED',
      },
      select: { id: true, name: true, kind: true },
    });
    const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
    if (recipeById.size !== recipeIds.length) {
      throw new BadRequestException('Choose an active, approved menu item for every line.');
    }
    const lines = input.lines.map((line) => {
      const recipe = recipeById.get(line.recipeId);
      if (!recipe) throw new BadRequestException('Choose an active, approved menu item.');
      const price = line.unitPrice.trim();
      parsePositiveDecimal(price, 'Enter a unit price greater than zero.');
      if (!isMoney(price)) throw new BadRequestException('Enter a valid PKR unit price.');
      const amount = chargeFor(line.quantity, price);
      if (amount === null || new Prisma.Decimal(amount).gt('999999999999.99')) {
        throw new BadRequestException('This invoice line exceeds the supported amount.');
      }
      return {
        recipeId: recipe.id,
        recipeName: recipe.name,
        kind: recipe.kind,
        deliveredQuantity: line.quantity,
        minimumQuantity: 0,
        billedQuantity: line.quantity,
        unitPrice: new Prisma.Decimal(price).toFixed(2),
        amount,
      };
    });
    const total = sumMoney(lines.map((line) => line.amount));
    if (!total || new Prisma.Decimal(total).gt('999999999999.99')) {
      throw new BadRequestException('This invoice exceeds the supported total.');
    }
    return lines;
  }

  private async find(tx: Prisma.TransactionClient, id: string): Promise<InvoiceRow> {
    const row = await tx.invoice.findUnique({ where: { id }, include: invoiceInclude });
    if (!row) throw new NotFoundException('That invoice was not found.');
    return row;
  }

  private async karamOrganisationId(): Promise<string> {
    const karam = await this.prisma.organisation.findFirst({
      where: { type: 'KARAM' },
      select: { id: true },
    });
    if (!karam) throw new NotFoundException('The restaurant account is missing.');
    return karam.id;
  }

  private async load(id: string): Promise<InvoiceRecord> {
    const row = await this.prisma.invoice.findUnique({ where: { id }, include: invoiceInclude });
    if (!row) throw new NotFoundException('That invoice was not found.');
    return toInvoice(row);
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

function totalOf(lines: Array<{ amount: string }>): string {
  return sumMoney(lines.map((line) => line.amount)) ?? '0.00';
}

/** A credit note takes the same discount as the invoice it corrects. */
function discountedTotal(subtotal: string, discountPercent: Prisma.Decimal): string {
  return applyDiscount(subtotal, discountPercent.toFixed(2))?.total ?? subtotal;
}

async function termsOf(
  tx: Prisma.TransactionClient,
  organisationId: string,
): Promise<{ paymentTermsDays: number; discountPercent: string }> {
  const organisation = await tx.organisation.findUnique({
    where: { id: organisationId },
    select: { paymentTermsDays: true, discountPercent: true },
  });
  return {
    paymentTermsDays: organisation?.paymentTermsDays ?? 0,
    discountPercent: organisation?.discountPercent.toFixed(2) ?? '0.00',
  };
}

function quantitiesFrom(lines: CreditInvoiceDto['lines']): Map<string, number> {
  const quantities = new Map<string, number>();
  for (const line of lines) {
    if (quantities.has(line.recipeId)) throw new BadRequestException('Credit each menu item once.');
    quantities.set(line.recipeId, line.quantity);
  }
  return quantities;
}

function creditedByRecipe(invoice: InvoiceRow): Map<string, number> {
  const credited = new Map<string, number>();
  for (const credit of invoice.creditNotes) {
    for (const line of credit.lines) {
      credited.set(line.recipeId, (credited.get(line.recipeId) ?? 0) + line.billedQuantity);
    }
  }
  return credited;
}

function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

function toInvoice(row: InvoiceRow): InvoiceRecord {
  const credited = creditedByRecipe(row);
  const lines = [...row.lines]
    .sort((left, right) => left.recipeName.localeCompare(right.recipeName))
    .map((line) => ({
      recipeId: line.recipeId,
      recipeName: line.recipeName,
      kind: line.kind,
      deliveredQuantity: line.deliveredQuantity,
      minimumQuantity: line.minimumQuantity,
      billedQuantity: line.billedQuantity,
      creditedQuantity: credited.get(line.recipeId) ?? 0,
      unitPrice: line.unitPrice.toFixed(2),
      amount: line.amount.toFixed(2),
    }));
  const subtotal = totalOf(lines);
  const priced = applyDiscount(subtotal, row.discountPercent.toFixed(2)) ?? {
    discount: '0.00',
    total: subtotal,
  };
  const total = priced.total;
  const creditTotals = row.creditNotes.map((credit) =>
    discountedTotal(
      totalOf(credit.lines.map((line) => ({ amount: line.amount.toFixed(2) }))),
      credit.discountPercent,
    ),
  );
  const due = row.kind === 'CREDIT_NOTE' ? total : (amountDue(total, creditTotals) ?? total);
  return {
    id: row.id,
    number: row.number,
    kind: row.kind,
    status: row.status,
    airlineId: row.organisationId,
    airlineName: row.organisation.name,
    airlineTaxNumber: row.organisation.taxNumber,
    requestId: row.requestId,
    requestNumber: row.request?.number ?? null,
    flightNumber: row.request?.flightNumber ?? null,
    serviceDate: row.request ? formatIsoDate(row.request.serviceDate) : null,
    rateCardNumber: row.rateCard?.number ?? null,
    sourceInvoiceNumber: row.sourceInvoice?.number ?? null,
    note: row.note,
    reason: row.reason,
    issuedAt: row.issuedAt?.toISOString() ?? null,
    subtotal,
    discountPercent: row.discountPercent.toFixed(2).replace(/\.?0+$/, '') || '0',
    discount: priced.discount,
    paymentTermsDays: row.paymentTermsDays,
    dueOn: row.dueOn ? formatIsoDate(row.dueOn) : null,
    total,
    amountDue: due,
    lines,
    credits: row.creditNotes.map((credit, index) => ({
      id: credit.id,
      number: credit.number,
      reason: credit.reason,
      total: creditTotals[index] ?? '0.00',
    })),
  };
}
