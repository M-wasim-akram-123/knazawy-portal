import type { Prisma } from '@prisma/client';

const PREFIX = {
  PURCHASE: 'PO',
  GOODS_RECEIPT: 'GR',
  STOCK_ISSUE: 'IS',
  STOCK_TRANSFER: 'TR',
  STOCK_COUNT: 'SC',
  PRODUCTION: 'PB',
} as const;

export async function nextDocumentNumber(
  tx: Prisma.TransactionClient,
  organisationId: string,
  kind: keyof typeof PREFIX,
): Promise<string> {
  const row = await tx.documentSequence.upsert({
    where: { organisationId_kind: { organisationId, kind } },
    create: { organisationId, kind, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  return `${PREFIX[kind]}-${String(row.lastNumber).padStart(5, '0')}`;
}
