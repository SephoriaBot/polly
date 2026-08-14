// LowEnergyChecklist.tsx
// No Energy Mode. Per the doc: instead of showing everything due, reduce
// the day down to what's actually starred as priority in the Planner, plus
// three basics. Priority tasks are real daily_tasks rows — checking one off
// here marks it done for real, same as checking it off in the Planner.

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Icon from './Icon';
import { useTheme } from '../context/ThemeContext';

const CHECKLIST_KEY = 'polly-no-energy-checklist';

interface BasicsState {
  date: string;
  ate: boolean;
  water: boolean;
  reset: boolean;
}

interface PriorityTask {
  id: string;
  label: string;
  done: boolean;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadBasics(): BasicsState {
  const today = todayISO();
  try {
    const stored = JSON.parse(localStorage.getItem(CHECKLIST_KEY) || 'null');
    if (stored && stored.date === today) return stored;
  } catch { /* ignore */ }
  return { date: today, ate: false, water: false, reset: false };
}

export default function LowEnergyChecklist({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [basics, setBasics] = useState<BasicsState>(loadBasics);
  const [priorityTasks, setPriorityTasks] = useState<PriorityTask[] | null>(null);

  useEffect(() => {
    localStorage.setItem(CHECKLIST_KEY, JSON.stringify(basics));
  }, [basics]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('daily_tasks')
        .select('id,label,done')
        .eq('task_date', todayISO())
        .eq('priority', true)
        .order('created_at');
      setPriorityTasks((data as PriorityTask[]) ?? []);
    })();
  }, []);

  async function togglePriorityTask(task: PriorityTask) {
    const newDone = !task.done;
    setPriorityTasks(prev => prev ? prev.map(t => t.id === task.id ? { ...t, done: newDone } : t) : prev);
    await supabase.from('daily_tasks').update({ done: newDone }).eq('id', task.id);
  }

  function toggleBasic(key: 'ate' | 'water' | 'reset') {
    setBasics(prev => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="card">
      <div className="card-body">
        <div className="section-label" style={{ marginBottom: 4 }}>
          <Icon name="sparkle-single" size={16} /> Today, just this
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: 0, marginBottom: 12 }}>
          Everything else can wait. This is the whole list.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: priorityTasks && priorityTasks.length > 0 ? 12 : 6 }}>
          {priorityTasks === null ? (
            <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>Loading…</p>
          ) : priorityTasks.length > 0 ? (
            priorityTasks.map(task => (
              <ChecklistRow
                key={task.id}
                label={task.label}
                done={task.done}
                onToggle={() => togglePriorityTask(task)}
              />
            ))
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'var(--cream)', border: '1.5px dashed var(--border)',
              borderRadius: 18, padding: '12px 14px',
            }}>
              <span style={{ fontSize: '1.2rem' }}>★</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', fontWeight: 600 }}>
                  Nothing starred as priority yet
                </div>
                <button
                  onClick={() => onNavigate?.('dailyplanner')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pink-dark)', fontSize: '0.72rem', fontWeight: 700, padding: 0, marginTop: 2 }}
                >
                  Star one in the Planner →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChecklistRow({ label, done, onToggle }: { label: string; done: boolean; onToggle: () => void }) {
  const { theme } = useTheme();
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
        background: done ? 'var(--blush)' : 'var(--white)',
        border: `1.5px solid ${done ? 'var(--pink-light)' : 'var(--border)'}`,
        borderRadius: 18, padding: '12px 14px',
      }}
    >
      <Icon
        name={done ? (theme === 'light' ? 'full_sun' : 'full_moon') : (theme === 'light' ? 'empty_sun' : 'empty_moon')}
        size={22}
        style={{ color: done ? 'var(--pink-dark)' : 'var(--border)', flexShrink: 0 }}
      />
      <div style={{
        flex: 1, fontSize: '0.88rem', fontWeight: 600,
        color: done ? 'var(--ink-muted)' : 'var(--ink)',
        textDecoration: done ? 'line-through' : 'none',
      }}>
        {label}
      </div>
    </div>
  );
}
