// chores.ts
// Shared "is this chore due" logic. Status is always derived from
// last_done_at + interval_days, never stored — used by both the Chores
// planner card and the Dashboard Today snapshot so the two never drift
// out of sync on what counts as due.

import { calendarDaysBetween } from './dateKey';

export interface Chore {
  id: string;
  name: string;
  interval_days: number;
  last_done_at: string | null;
  icon: string;
  created_at: string;
  estimated_minutes: number;
}

export interface ChoreStatus {
  label: string;
  overdueDays: number; // higher = more overdue; used for sorting
  tone: 'due' | 'ok';
}

export function daysSince(iso: string, now: Date): number {
  // Calendar days (local midnight), not elapsed 24h blocks.
  return calendarDaysBetween(iso, now);
}

export function statusFor(chore: Chore, now: Date): ChoreStatus {
  if (!chore.last_done_at) {
    return { label: 'Never done', overdueDays: Infinity, tone: 'due' };
  }
  const since = daysSince(chore.last_done_at, now);
  const remaining = chore.interval_days - since;
  if (remaining <= 0) {
    const overdueDays = -remaining;
    return {
      label: overdueDays === 0 ? 'Due today' : `${overdueDays}d overdue`,
      overdueDays,
      tone: 'due',
    };
  }
  return { label: `Due in ${remaining}d`, overdueDays: remaining - 9999, tone: 'ok' };
}
