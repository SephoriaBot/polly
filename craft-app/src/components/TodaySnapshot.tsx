// TodaySnapshot.tsx
// Tier 1, Step 1 (part 2) + item 4: makes Dashboard pull live from the
// sections that used to be isolated from each other — Planner (tasks,
// interval-based chores, appointments) and Wallet (bills) — so "Today"
// actually answers "what matters right now" instead of just holding a
// manually-typed focus list. Each row is read-only and tap-through only;
// editing still happens on the source page.
// Chores due status is computed with the same statusFor() logic the
// Chores planner card uses (see lib/chores.ts) so the two never disagree
// on what's overdue.
// Money reads from `bills` for the base name/amount/due_day, then applies
// this month's override from `bill_payments` when one exists (recurring
// bills only) — matching Wallet's own effectiveDueDay logic, so this card
// never shows an out-of-date due day for a bill you've adjusted this month.

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Icon from './Icon';
import { type Chore, statusFor } from '../lib/chores';
import { getUnpaidBillsThisMonth, pickNextBill, daySuffix } from '../lib/money';

interface SnapshotRow {
  key: string;
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  detail: string;
  page: string;
  tab?: string;
  empty?: boolean;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function TodaySnapshot({ onNavigate }: { onNavigate?: (page: string, tab?: string) => void }) {
  const [rows, setRows] = useState<SnapshotRow[] | null>(null);

  useEffect(() => {
    (async () => {
      const today = todayISO();
      const now = new Date();

      const [choresRes, dueChoresRes, apptRes, unpaidBills, cartSettingsRes] = await Promise.all([
        supabase.from('daily_tasks').select('id,label,done').eq('task_date', today).eq('done', false).order('created_at'),
        supabase.from('chores').select('id,name,interval_days,last_done_at,icon,created_at'),
        supabase.from('appointments').select('id,title,date_time').order('date_time'),
        getUnpaidBillsThisMonth(),
        supabase.from('grocery_settings').select('smart_cart_total,smart_cart_item_count,smart_cart_updated_at').eq('id', 1).maybeSingle(),
      ]);

      const tasks = choresRes.data ?? [];

      // Due status is derived, not stored — same rule the Chores card uses.
      const dueChores = ((dueChoresRes.data ?? []) as Chore[])
        .map(c => ({ chore: c, status: statusFor(c, now) }))
        .filter(x => x.status.tone === 'due')
        .sort((a, b) => b.status.overdueDays - a.status.overdueDays);

      // Window is local-midnight-today through local-midnight-day-after-tomorrow,
      // so "today/tomorrow" respects the user's clock rather than UTC.
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfTomorrow = new Date(startOfToday); startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
      const startOfDayAfter = new Date(startOfToday); startOfDayAfter.setDate(startOfDayAfter.getDate() + 2);

      const appointments = (apptRes.data ?? []).filter(a => {
        const t = new Date(a.date_time);
        return t >= startOfToday && t < startOfDayAfter;
      });

      const nextBill = pickNextBill(unpaidBills, now);

      const cartSettings = cartSettingsRes.data;
      const cartTotal = cartSettings?.smart_cart_total != null ? Number(cartSettings.smart_cart_total) : null;
      const cartItemCount = cartSettings?.smart_cart_item_count ?? 0;

      const next: SnapshotRow[] = [
        tasks.length > 0
          ? { key: 'tasks', icon: 'clipboard-check', label: `${tasks.length} quick task${tasks.length === 1 ? '' : 's'}`, detail: tasks.slice(0, 2).map(t => t.label).join(', '), page: 'dailyplanner', tab: 'tasks' }
          : { key: 'tasks', icon: 'clipboard-check', label: 'No tasks left today', detail: 'All caught up', page: 'dailyplanner', tab: 'tasks', empty: true },

        dueChores.length > 0
          ? { key: 'chores', icon: 'cleaning-spray', label: `${dueChores.length} chore${dueChores.length === 1 ? '' : 's'} due`, detail: dueChores.slice(0, 2).map(x => x.chore.name).join(', '), page: 'dailyplanner', tab: 'chores' }
          : { key: 'chores', icon: 'cleaning-spray', label: 'Chores are caught up', detail: 'Nothing due yet', page: 'dailyplanner', tab: 'chores', empty: true },

        appointments.length > 0
          ? { key: 'appointments', icon: 'calendar', label: `${appointments.length} appointment${appointments.length === 1 ? '' : 's'} coming up`, detail: appointments.slice(0, 2).map(a => `${a.title} (${apptWhen(a.date_time, startOfTomorrow)})`).join(', '), page: 'dailyplanner', tab: 'appointments' }
          : { key: 'appointments', icon: 'calendar', label: 'Nothing on the calendar', detail: 'Today or tomorrow is clear', page: 'dailyplanner', tab: 'appointments', empty: true },

        nextBill
          ? { key: 'money', icon: 'money-bag', label: `${nextBill.name} due ${nextBill.due_day ? `on the ${nextBill.due_day}${daySuffix(nextBill.due_day)}` : 'soon'}`, detail: nextBill.amount != null ? `$${Number(nextBill.amount).toFixed(2)}` : '', page: 'wallet', tab: 'bills' }
          : { key: 'money', icon: 'money-bag', label: 'No bills waiting', detail: 'Nothing due this month', page: 'wallet', tab: 'bills', empty: true },

        cartTotal != null && cartItemCount > 0
          ? { key: 'smart-cart', icon: 'shopping-cart', label: `Smart Cart: $${cartTotal.toFixed(2)}`, detail: `${cartItemCount} item${cartItemCount === 1 ? '' : 's'} · updated ${timeAgo(cartSettings!.smart_cart_updated_at!)}`, page: 'grocery', tab: 'smart-cart' }
          : { key: 'smart-cart', icon: 'shopping-cart', label: 'No smart cart total yet', detail: 'Build one from your grocery list', page: 'grocery', tab: 'smart-cart', empty: true },
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
          onClick={() => onNavigate?.(row.page, row.tab)}
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

function apptWhen(dateTime: string, startOfTomorrow: Date): string {
  const t = new Date(dateTime);
  const dayLabel = t >= startOfTomorrow ? 'Tomorrow' : 'Today';
  const timeLabel = t.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${dayLabel} ${timeLabel}`;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}