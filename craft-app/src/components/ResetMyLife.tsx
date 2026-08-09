// ResetMyLife.tsx
// Tier 2, signature feature from the doc. Someone's had a bad week and taps
// "Reset my life" instead of facing a full to-do list. Pick what feels most
// overwhelming, get back a tiny handful of real, concrete steps — not "you
// have 27 incomplete tasks" — and a hard stop at the end that says the plan
// is actually finite. Plans are session-only by design: this is meant to be
// generated fresh each time, not a persistent tracker.

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { type Chore, statusFor } from '../lib/chores';
import { getUnpaidBillsThisMonth, pickNextBill, daySuffix } from '../lib/money';
import Icon from './Icon';

type Area = 'home' | 'money' | 'food' | 'work' | 'tasks' | 'everything';

const AREAS: { key: Area; label: string; icon: Parameters<typeof Icon>[0]['name'] }[] = [
  { key: 'home', label: 'Home', icon: 'cleaning-spray' },
  { key: 'money', label: 'Money', icon: 'money-bag' },
  { key: 'food', label: 'Food', icon: 'icon-meals' },
  { key: 'work', label: 'Work / school', icon: 'clipboard-check' },
  { key: 'tasks', label: 'Tasks', icon: 'icon-listchecks' },
  { key: 'everything', label: 'Everything', icon: 'sparkle-single' },
];

interface PlanItem {
  id: string;
  label: string;
  minutes: number;
}

async function getDueChores(limit: number): Promise<PlanItem[]> {
  const now = new Date();
  const { data } = await supabase.from('chores').select('*');
  const due = ((data as Chore[]) ?? [])
    .map(c => ({ chore: c, status: statusFor(c, now) }))
    .filter(x => x.status.tone === 'due')
    .sort((a, b) => b.status.overdueDays - a.status.overdueDays)
    .slice(0, limit);
  return due.map(x => ({ id: `chore-${x.chore.id}`, label: x.chore.name, minutes: x.chore.estimated_minutes }));
}

async function getOpenTasks(limit: number): Promise<PlanItem[]> {
  const today = new Date();
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const { data } = await supabase.from('daily_tasks').select('id,label').eq('task_date', todayISO).eq('done', false).order('created_at').limit(limit);
  return (data ?? []).map(t => ({ id: `task-${t.id}`, label: t.label, minutes: 10 }));
}

async function getBillItem(): Promise<PlanItem | null> {
  const unpaid = await getUnpaidBillsThisMonth();
  const next = pickNextBill(unpaid, new Date());
  if (!next) return null;
  const dueText = next.due_day ? `due on the ${next.due_day}${daySuffix(next.due_day)}` : 'due soon';
  return { id: `bill-${next.id}`, label: `Pay ${next.name} — ${dueText}`, minutes: 5 };
}

async function buildPlan(area: Area): Promise<PlanItem[]> {
  const STOP: PlanItem = { id: 'stop', label: "Stop. You're done.", minutes: 0 };

  if (area === 'home') {
    const chores = await getDueChores(2);
    return [...(chores.length > 0 ? chores : [{ id: 'home-fallback', label: 'Nothing overdue — tidy one small spot if you want', minutes: 5 }]), STOP];
  }

  if (area === 'money') {
    const bill = await getBillItem();
    return [
      bill ?? { id: 'money-fallback', label: 'No bills waiting right now', minutes: 0 },
      { id: 'money-check', label: 'Check your Money Calendar for anything upcoming', minutes: 3 },
      STOP,
    ];
  }

  if (area === 'food') {
    return [
      { id: 'food-eat', label: 'Eat something', minutes: 10 },
      { id: 'food-water', label: 'Drink water', minutes: 1 },
      STOP,
    ];
  }

  if (area === 'work') {
    const tasks = await getOpenTasks(1);
    return [...(tasks.length > 0 ? tasks : [{ id: 'work-fallback', label: 'Pick one small piece of it — just one', minutes: 10 }]), STOP];
  }

  if (area === 'tasks') {
    const tasks = await getOpenTasks(2);
    return [...(tasks.length > 0 ? tasks : [{ id: 'tasks-fallback', label: "Nothing on today's list — you're clear", minutes: 0 }]), STOP];
  }

  // Everything: one small thing from each area, matching the doc's example
  // shape (trash, laundry, eat, bill, groceries, stop).
  const [chores, bill] = await Promise.all([getDueChores(1), getBillItem()]);
  const items: PlanItem[] = [];
  if (chores.length > 0) items.push(chores[0]);
  items.push({ id: 'everything-eat', label: 'Eat something', minutes: 10 });
  if (bill) items.push(bill);
  items.push({ id: 'everything-groceries', label: 'Add 3 things to your grocery list', minutes: 3 });
  items.push(STOP);
  return items;
}

export default function ResetMyLife() {
  const [area, setArea] = useState<Area | null>(null);
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<PlanItem[] | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});

  async function pick(a: Area) {
    setArea(a);
    setLoading(true);
    setDone({});
    const items = await buildPlan(a);
    setPlan(items);
    setLoading(false);
  }

  function toggle(id: string) {
    setDone(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function reset() {
    setArea(null);
    setPlan(null);
    setDone({});
  }

  const totalMinutes = plan?.reduce((sum, i) => sum + i.minutes, 0) ?? 0;

  return (
    <div className="card">
      <div className="card-body">
        <div className="section-label" style={{ marginBottom: 4 }}>
          <Icon name="sparkle-single" size={16} /> Reset my life
        </div>

        {!area ? (
          <>
            <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: 0, marginBottom: 14 }}>
              What's feeling most overwhelming right now?
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {AREAS.map(a => (
                <button
                  key={a.key}
                  onClick={() => pick(a.key)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    background: 'var(--white)', border: '1.5px solid var(--border)',
                    borderRadius: 16, padding: '14px 8px', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <Icon name={a.icon} size={22} style={{ color: 'var(--pink-dark)' }} />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--ink)' }}>{a.label}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <button
              onClick={reset}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)', fontSize: '0.72rem', fontWeight: 700, padding: 0, marginBottom: 10 }}
            >
              ← Choose something else
            </button>

            {loading ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>Building your reset…</p>
            ) : plan && (
              <>
                <div style={{ fontSize: '0.72rem', color: 'var(--pink-dark)', fontWeight: 700, marginBottom: 10 }}>
                  Your ~{totalMinutes}-minute reset
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {plan.map(item => {
                    const isDone = !!done[item.id];
                    const isStop = item.id === 'stop';
                    return (
                      <div
                        key={item.id}
                        onClick={() => toggle(item.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                          background: isDone ? 'var(--blush)' : isStop ? 'var(--cream)' : 'var(--white)',
                          border: `1.5px solid ${isDone ? 'var(--pink-light)' : 'var(--border)'}`,
                          borderRadius: 18, padding: '12px 14px',
                        }}
                      >
                        <Icon
                          name={isDone ? 'picnicfull' : 'picnicempty'}
                          size={20}
                          style={{ color: isDone ? 'var(--pink-dark)' : 'var(--border)', flexShrink: 0 }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: '0.85rem', fontWeight: isStop ? 800 : 600,
                            color: isDone ? 'var(--ink-muted)' : 'var(--ink)',
                            textDecoration: isDone ? 'line-through' : 'none',
                          }}>
                            {item.label}
                          </div>
                        </div>
                        {item.minutes > 0 && (
                          <span style={{ fontSize: '0.68rem', color: 'var(--ink-muted)', flexShrink: 0 }}>~{item.minutes}min</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
