// LowEnergyChecklist.tsx
// Tier 1, item 5. Per the doc: instead of showing everything due, ask for
// one important thing, plus three basics. The "pick my one thing" button
// reuses the same chore due-status logic as Chores.tsx/TodaySnapshot.tsx —
// most-overdue chore first, then the oldest open task — so it's grounded in
// what's actually outstanding rather than inventing a suggestion.

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Icon from './Icon';
import { type Chore, statusFor } from '../lib/chores';

const CHECKLIST_KEY = 'polly-low-energy-checklist';

interface CheckState {
  date: string;
  ate: boolean;
  water: boolean;
  reset: boolean;
  oneThing: string;
  oneThingDone: boolean;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadState(): CheckState {
  const today = todayISO();
  try {
    const stored = JSON.parse(localStorage.getItem(CHECKLIST_KEY) || 'null');
    if (stored && stored.date === today) return stored;
  } catch { /* ignore */ }
  return { date: today, ate: false, water: false, reset: false, oneThing: '', oneThingDone: false };
}

export default function LowEnergyChecklist() {
  const [state, setState] = useState<CheckState>(loadState);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    localStorage.setItem(CHECKLIST_KEY, JSON.stringify(state));
  }, [state]);

  async function pickOneThing() {
    setPicking(true);
    const now = new Date();
    const today = todayISO();
    const [choresRes, tasksRes] = await Promise.all([
      supabase.from('chores').select('id,name,interval_days,last_done_at,icon,created_at'),
      supabase.from('daily_tasks').select('id,label,done').eq('task_date', today).eq('done', false).order('created_at').limit(1),
    ]);

    const dueChores = ((choresRes.data ?? []) as Chore[])
      .map(c => ({ chore: c, status: statusFor(c, now) }))
      .filter(x => x.status.tone === 'due')
      .sort((a, b) => b.status.overdueDays - a.status.overdueDays);

    const pick = dueChores.length > 0
      ? dueChores[0].chore.name
      : (tasksRes.data ?? [])[0]?.label ?? '';

    setState(prev => ({ ...prev, oneThing: pick || 'Pick anything small — you get to choose', oneThingDone: false }));
    setPicking(false);
  }

  function toggle(key: 'ate' | 'water' | 'reset' | 'oneThingDone') {
    setState(prev => ({ ...prev, [key]: !prev[key] }));
  }

  const items: { key: 'oneThingDone' | 'ate' | 'water' | 'reset'; label: string; sub?: string }[] = [
    { key: 'oneThingDone', label: state.oneThing || 'Do one important thing', sub: state.oneThing ? undefined : "Tap \"pick for me\" below, or just decide" },
    { key: 'ate', label: 'Eat something' },
    { key: 'water', label: 'Drink water' },
    { key: 'reset', label: '5-minute reset — tidy one small spot, then stop' },
  ];

  return (
    <div className="card">
      <div className="card-body">
        <div className="section-label" style={{ marginBottom: 4 }}>
          <Icon name="sparkle-single" size={16} /> Today, just this
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: 0, marginBottom: 12 }}>
          Everything else can wait. This is the whole list.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {items.map(item => {
            const done = state[item.key];
            return (
              <div
                key={item.key}
                onClick={() => toggle(item.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                  background: done ? 'var(--blush)' : 'var(--white)',
                  border: `1.5px solid ${done ? 'var(--pink-light)' : 'var(--border)'}`,
                  borderRadius: 18, padding: '12px 14px',
                }}
              >
                <Icon
                  name={done ? 'picnicfull' : 'picnicempty'}
                  size={22}
                  style={{ color: done ? 'var(--pink-dark)' : 'var(--border)', flexShrink: 0 }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '0.88rem', fontWeight: 600,
                    color: done ? 'var(--ink-muted)' : 'var(--ink)',
                    textDecoration: done ? 'line-through' : 'none',
                  }}>
                    {item.label}
                  </div>
                  {item.sub && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginTop: 2 }}>{item.sub}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button
          className="btn btn-ghost btn-sm"
          onClick={pickOneThing}
          disabled={picking}
          style={{ width: '100%', justifyContent: 'center', opacity: picking ? 0.6 : 1 }}
        >
          {picking ? 'Thinking…' : state.oneThing ? 'Pick something else for me' : 'Want me to pick your one thing?'}
        </button>
      </div>
    </div>
  );
}
