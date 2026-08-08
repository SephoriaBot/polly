// TodaySnapshot.tsx
// Tier 1, Step 1 (part 2): makes Dashboard pull live from the sections that
// used to be isolated from each other — Planner (chores + appointments) and
// Wallet — so "Today" actually answers "what matters right now" instead of
// just holding a manually-typed focus list. Each row is read-only and
// tap-through only; editing still happens on the source page.

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Icon from './Icon';

interface SnapshotRow {
  key: string;
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  detail: string;
  page: string;
  empty?: boolean;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function TodaySnapshot({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [rows, setRows] = useState<SnapshotRow[] | null>(null);

  useEffect(() => {
    (async () => {
      const today = todayISO();
      const now = new Date();

      const [choresRes, apptRes, paymentsRes] = await Promise.all([
        supabase.from('daily_tasks').select('id,label,done').eq('task_date', today).eq('done', false).order('created_at'),
        supabase.from('appointments').select('id,title,date_time').order('date_time'),
        supabase.from('bill_payments')
          .select('id,name,amount,due_day,paid,month,year')
          .eq('paid', false)
          .eq('month', now.getMonth() + 1)
          .eq('year', now.getFullYear())
          .order('due_day'),
      ]);

      const chores = choresRes.data ?? [];
      const payments = paymentsRes.data ?? [];

      // Window is local-midnight-today through local-midnight-day-after-tomorrow,
      // so "today/tomorrow" respects the user's clock rather than UTC.
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfTomorrow = new Date(startOfToday); startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
      const startOfDayAfter = new Date(startOfToday); startOfDayAfter.setDate(startOfDayAfter.getDate() + 2);

      const appointments = (apptRes.data ?? []).filter(a => {
        const t = new Date(a.date_time);
        return t >= startOfToday && t < startOfDayAfter;
      });

      // Prefer the next bill that hasn't hit its due day yet; fall back to
      // the earliest unpaid one this month (i.e. already overdue) if none.
      const currentDay = now.getDate();
      const nextBill =
        payments.find(p => (p.due_day ?? 0) >= currentDay) ?? payments[0] ?? null;

      const next: SnapshotRow[] = [
        chores.length > 0
          ? { key: 'chores', icon: 'clipboard-check', label: `${chores.length} quick chore${chores.length === 1 ? '' : 's'}`, detail: chores.slice(0, 2).map(c => c.label).join(', '), page: 'dailyplanner' }
          : { key: 'chores', icon: 'clipboard-check', label: 'No chores left today', detail: 'All caught up', page: 'dailyplanner', empty: true },

        appointments.length > 0
          ? { key: 'appointments', icon: 'calendar', label: `${appointments.length} appointment${appointments.length === 1 ? '' : 's'} coming up`, detail: appointments.slice(0, 2).map(a => `${a.title} (${apptWhen(a.date_time, startOfTomorrow)})`).join(', '), page: 'dailyplanner' }
          : { key: 'appointments', icon: 'calendar', label: 'Nothing on the calendar', detail: 'Today or tomorrow is clear', page: 'dailyplanner', empty: true },

        nextBill
          ? { key: 'money', icon: 'money-bag', label: `${nextBill.name} due ${nextBill.due_day ? `on the ${nextBill.due_day}${daySuffix(nextBill.due_day)}` : 'soon'}`, detail: nextBill.amount != null ? `$${Number(nextBill.amount).toFixed(2)}` : '', page: 'wallet' }
          : { key: 'money', icon: 'money-bag', label: 'No bills waiting', detail: 'Nothing due this month', page: 'wallet', empty: true },
      ];

      setRows(next);
    })();
  }, []);

  if (!rows) {
    return (
      <div className="card">
        <div className="card-body" style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-muted)' }}>
          gathering today...
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map(row => (
        <button
          key={row.key}
          onClick={() => onNavigate?.(row.page)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
            background: 'var(--white)', border: '1.5px solid var(--border)',
            borderRadius: 18, padding: '12px 14px', cursor: onNavigate ? 'pointer' : 'default',
            width: '100%', fontFamily: 'inherit',
          }}
        >
          <Icon name={row.icon} size={28} style={{ opacity: row.empty ? 0.55 : 1, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: row.empty ? 'var(--ink-muted)' : 'var(--ink)' }}>
              {row.label}
            </div>
            {row.detail && (
              <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.detail}
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

function daySuffix(day: number): string {
  if (day % 10 === 1 && day !== 11) return 'st';
  if (day % 10 === 2 && day !== 12) return 'nd';
  if (day % 10 === 3 && day !== 13) return 'rd';
  return 'th';
}

function apptWhen(dateTime: string, startOfTomorrow: Date): string {
  const t = new Date(dateTime);
  const dayLabel = t >= startOfTomorrow ? 'Tomorrow' : 'Today';
  const timeLabel = t.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${dayLabel} ${timeLabel}`;
}
