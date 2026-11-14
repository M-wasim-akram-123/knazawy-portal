import {
  isKaramRole,
  journalBalanceError,
  journalCsv,
  ledgerAccountName,
  sumMoney,
  type Actor,
  type JournalEntryRecord,
  type JournalPosting,
} from '@knazawy/shared';
import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { assertCan } from '../auth/permissions';
import { nextDocumentNumber } from '../common/document-number';
import { PrismaService } from '../prisma/prisma.service';

const entryInclude = {
  organisation: { select: { name: true } },
  lines: true,
} satisfies Prisma.JournalEntryInclude;

type EntryRow = Prisma.JournalEntryGetPayload<{ include: typeof entryInclude }>;

export interface PostJournalInput {
  organisationId: string;
  karamOrganisationId: string;
  sourceId: string;
  memo: string;
  lines: JournalPosting[];
}

@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Karam sees the whole book. An airline sees only the entries about itself. */
  async list(actor: Actor): Promise<JournalEntryRecord[]> {
    assertCan(actor, 'ledger', 'R', 'view the ledger');
    const rows = await this.prisma.journalEntry.findMany({
      where: isKaramRole(actor.role) ? {} : { organisationId: actor.organisationId },
      include: entryInclude,
      orderBy: { postedAt: 'desc' },
    });
    return rows.map(toEntry);
  }

  async exportCsv(actor: Actor): Promise<string> {
    return journalCsv(await this.list(actor));
  }

  /** Writes one balanced entry for a document. A zero bill is not posted. An entry is never changed. */
  async post(tx: Prisma.TransactionClient, actor: Actor, input: PostJournalInput): Promise<void> {
    assertCan(actor, 'ledger', 'C', 'post to the ledger');
    const error = journalBalanceError(input.lines);
    if (error === 'There is nothing to post.') return;
    if (error) throw new BadRequestException(error);
    const existing = await tx.journalEntry.findUnique({
      where: { sourceType_sourceId: { sourceType: 'Invoice', sourceId: input.sourceId } },
      select: { number: true },
    });
    if (existing) throw new BadRequestException(`${existing.number} already posts this document.`);
    const number = await nextDocumentNumber(tx, input.karamOrganisationId, 'JOURNAL');
    const entry = await tx.journalEntry.create({
      data: {
        organisationId: input.organisationId,
        number,
        sourceType: 'Invoice',
        sourceId: input.sourceId,
        memo: input.memo,
        postedById: actor.id,
        lines: {
          create: input.lines.map((line) => ({
            account: line.account,
            side: line.side,
            amount: line.amount,
          })),
        },
      },
    });
    await this.audit.record(tx, {
      userId: actor.id,
      entity: 'JournalEntry',
      entityId: entry.id,
      action: 'post',
      after: { number, memo: input.memo, lines: input.lines },
    });
  }
}

function toEntry(row: EntryRow): JournalEntryRecord {
  const lines = row.lines.map((line) => ({
    account: line.account,
    accountName: ledgerAccountName(line.account),
    side: line.side,
    amount: line.amount.toFixed(2),
  }));
  const total =
    sumMoney(lines.filter((line) => line.side === 'DEBIT').map((line) => line.amount)) ?? '0.00';
  return {
    id: row.id,
    number: row.number,
    airlineId: row.organisationId,
    airlineName: row.organisation.name,
    memo: row.memo,
    postedAt: row.postedAt.toISOString(),
    total,
    lines,
  };
}
