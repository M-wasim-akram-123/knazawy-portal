const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Calendar day in Asia/Karachi, as YYYY-MM-DD. */
export function todayInKarachi(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** DD/MM/YYYY from a YYYY-MM-DD date. */
export function formatDisplayDate(isoDate: string): string {
  const match = ISO_DATE.exec(isoDate.slice(0, 10));
  if (!match) return isoDate;
  return `${match[3]}/${match[2]}/${match[1]}`;
}
