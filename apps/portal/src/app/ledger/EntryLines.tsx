import { portalLedgerCopy } from '@knazawy/i18n';
import { JOURNAL_SIDE_LABELS, type JournalEntryRecord } from '@knazawy/shared';

import { useCopy, useLabel } from '../../lib/i18n';

export function EntryLines({ entry }: { entry: JournalEntryRecord }) {
  const t = useCopy(portalLedgerCopy);
  const label = useLabel();
  return (
    <div className="kz-table-wrap">
      <table className="kz-table">
        <thead>
          <tr>
            <th>{t.account}</th>
            <th>{t.side}</th>
            <th>{t.amount}</th>
          </tr>
        </thead>
        <tbody>
          {entry.lines.map((line) => (
            <tr key={`${line.account}-${line.side}`}>
              <td>{line.accountName}</td>
              <td>{label(JOURNAL_SIDE_LABELS[line.side])}</td>
              <td>{line.amount} SAR</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
