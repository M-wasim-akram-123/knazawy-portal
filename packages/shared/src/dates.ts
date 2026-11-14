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

/** DD/MM/YYYY HH:MM in Asia/Karachi. */
export function formatKarachiDateTime(instant: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return `${part('day')}/${part('month')}/${part('year')} ${part('hour')}:${part('minute')}`;
}

/** DD/MM/YYYY from a YYYY-MM-DD date. */
export function formatDisplayDate(isoDate: string): string {
  const match = ISO_DATE.exec(isoDate.slice(0, 10));
  if (!match) return isoDate;
  return `${match[3]}/${match[2]}/${match[1]}`;
}
