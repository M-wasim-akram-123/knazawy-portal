import { JOURNAL_SIDE_LABELS, type JournalEntryRecord } from '@knazawy/shared';

export function EntryLines({ entry }: { entry: JournalEntryRecord }) {
  return (
    <div className="kz-table-wrap">
      <table className="kz-table">
        <thead>
          <tr>
            <th>Account</th>
            <th>Side</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {entry.lines.map((line) => (
            <tr key={`${line.account}-${line.side}`}>
              <td>{line.accountName}</td>
              <td>{JOURNAL_SIDE_LABELS[line.side]}</td>
              <td>{line.amount} PKR</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
