import { formatDisplayDate, todayInKarachi } from './dates';
import { subtractMoney, sumMoney } from './rates';

/** The two accounts this platform posts. It is not a full chart of accounts. */
export const LEDGER_ACCOUNTS = {
  RECEIVABLE: { code: '1100', name: 'Accounts receivable' },
  SALES: { code: '4000', name: 'Meal sales' },
} as const;

export const JOURNAL_SIDES = ['DEBIT', 'CREDIT'] as const;

export type JournalSide = (typeof JOURNAL_SIDES)[number];

export const JOURNAL_SIDE_LABELS: Record<JournalSide, string> = {
  DEBIT: 'Debit',
  CREDIT: 'Credit',
};

export function ledgerAccountName(code: string): string {
  const account = Object.values(LEDGER_ACCOUNTS).find((row) => row.code === code);
  return account?.name ?? code;
}

export interface JournalPosting {
  account: string;
  side: JournalSide;
  amount: string;
}

/** An invoice raises what the airline owes and records the sale. */
export function invoicePosting(total: string): JournalPosting[] {
  return [
    { account: LEDGER_ACCOUNTS.RECEIVABLE.code, side: 'DEBIT', amount: total },
    { account: LEDGER_ACCOUNTS.SALES.code, side: 'CREDIT', amount: total },
  ];
}

/** A credit note reduces the sale and what the airline owes. */
export function creditNotePosting(total: string): JournalPosting[] {
  return [
    { account: LEDGER_ACCOUNTS.SALES.code, side: 'DEBIT', amount: total },
    { account: LEDGER_ACCOUNTS.RECEIVABLE.code, side: 'CREDIT', amount: total },
  ];
}

/** Null when the debits equal the credits and there is something to post. */
export function journalBalanceError(lines: JournalPosting[]): string | null {
  const debit = sumMoney(lines.filter((line) => line.side === 'DEBIT').map((line) => line.amount));
  const credit = sumMoney(
    lines.filter((line) => line.side === 'CREDIT').map((line) => line.amount),
  );
  if (debit === null || credit === null) return 'An amount on this entry is not valid.';
  if (debit === '0.00' && credit === '0.00') return 'There is nothing to post.';
  if (subtractMoney(debit, credit) !== '0.00') return 'The entry does not balance.';
  return null;
}

export interface JournalLineRecord {
  account: string;
  accountName: string;
  side: JournalSide;
  amount: string;
}

export interface JournalEntryRecord {
  id: string;
  number: string;
  airlineId: string;
  airlineName: string;
  memo: string;
  postedAt: string;
  total: string;
  lines: JournalLineRecord[];
}

/** One row per line, so the file can be opened in a spreadsheet. */
export function journalCsv(entries: JournalEntryRecord[]): string {
  const header = ['Date', 'Number', 'Airline', 'Account', 'Side', 'Amount', 'Memo'];
  const rows = entries.flatMap((entry) =>
    entry.lines.map((line) => [
      formatDisplayDate(todayInKarachi(new Date(entry.postedAt))),
      entry.number,
      entry.airlineName,
      line.accountName,
      JOURNAL_SIDE_LABELS[line.side],
      line.amount,
      entry.memo,
    ]),
  );
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

/**
 * A text cell that Excel or Sheets will not run as a formula. A cell starting with = + - @ or a
 * tab gets a leading apostrophe; amounts are numbers and are left alone.
 */
export function csvCell(value: string): string {
  const looksLikeNumber = /^-?\d+(?:\.\d+)?$/.test(value);
  const safe = !looksLikeNumber && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}
