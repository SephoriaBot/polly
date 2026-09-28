// dateKey.ts
// Single source of truth for "what calendar day is it" in Polly.
//
// Never build a day key from Date#toISOString() — it is always UTC, so it
// flips to "tomorrow" at UTC midnight (8pm Eastern in summer, 7pm in winter).
// These helpers use the device's local calendar date instead.

/** Local calendar date as YYYY-MM-DD (zero-padded, sorts correctly as text). */
export function localDateKey(d: Date = new Date()): string {
  return (
    `${d.getFullYear()}-` +
    `${String(d.getMonth() + 1).padStart(2, '0')}-` +
    `${String(d.getDate()).padStart(2, '0')}`
  );
}

/** Local calendar date N days before today, as YYYY-MM-DD. */
export function localDaysAgoKey(days: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - days);
  return localDateKey(d);
}

/**
 * Whole calendar days between two moments, counted by local midnight rather
 * than elapsed 24-hour blocks. Done at 3pm Monday => 1 day ago from 12:01am
 * Tuesday. Math.round absorbs the 23/25-hour days around DST changes.
 */
export function calendarDaysBetween(from: Date | string, to: Date = new Date()): number {
  const a = new Date(from);
  a.setHours(0, 0, 0, 0);
  const b = new Date(to);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}
