// dayPlan.ts
// Shared types and helpers for "Plan a day": a one-off schedule for a
// specific date, built from chores, appointments, and custom lines.
// Separate from daily_tasks (the always-running dailies) on purpose.

import { localDateKey } from './dateKey';

export type DayPlanKind = 'chore' | 'appointment' | 'custom';

export interface DayPlanItem {
  id: string;
  plan_date: string; // YYYY-MM-DD
  kind: DayPlanKind;
  ref_id: string | null; // chores.id / appointments.id, null for custom lines
  label: string;
  starts_at: string | null; // ISO timestamp, set when the item has a time
  done: boolean;
  created_at: string;
}

/** Timed items first (earliest to latest), then untimed in the order added. */
export function sortPlanItems(items: DayPlanItem[]): DayPlanItem[] {
  return [...items].sort((a, b) => {
    if (a.starts_at && b.starts_at) return a.starts_at.localeCompare(b.starts_at);
    if (a.starts_at) return -1;
    if (b.starts_at) return 1;
    return a.created_at.localeCompare(b.created_at);
  });
}

export function planTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Local date key for today plus N days (0 = today, 1 = tomorrow). */
export function dayKeyFromToday(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return localDateKey(d);
}

/** Local-noon Date for a YYYY-MM-DD key (avoids midnight/DST edge cases). */
export function dateFromKey(key: string): Date {
  return new Date(`${key}T12:00:00`);
}
