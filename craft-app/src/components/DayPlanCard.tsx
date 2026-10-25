// DayPlanCard.tsx
// Dashboard "package" for a planned day. Only appears when today has a
// plan; tap it to open the checklist. Ticking a chore marks the real chore
// done, ticking an appointment marks it attended, custom lines are plain
// checkboxes. Unticking only unticks the plan line.

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../context/AuthContext';
import { useCreatureGrowth } from '../creatures/CreatureGrowthContext';
import { completeChoreQuest, triggerActionEvent } from '../lib/questSystem';
import { localDateKey } from '../lib/dateKey';
import { type DayPlanItem, sortPlanItems, planTime } from '../lib/dayPlan';
import CheckMark from './CheckMark';
import Icon from './Icon';

export default function DayPlanCard({
  onNavigate,
}: {
  onNavigate?: (page: string, tab?: string) => void;
}) {
  const { showToast } = useToast();
  const { user } = useAuth();
  const { notifyGrowth } = useCreatureGrowth();
  const [items, setItems] = useState<DayPlanItem[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase
      .from('day_plan_items')
      .select('*')
      .eq('plan_date', localDateKey())
      .then(({ data }) => setItems((data as DayPlanItem[]) ?? []));
  }, []);

  if (!items || items.length === 0) return null;

  const sorted = sortPlanItems(items);
  const doneCount = items.filter(i => i.done).length;
  const allDone = doneCount === items.length;

  async function toggle(item: DayPlanItem) {
    const nowDone = !item.done;
    setItems(prev => (prev ?? []).map(i => (i.id === item.id ? { ...i, done: nowDone } : i)));

    const { error } = await supabase.from('day_plan_items').update({ done: nowDone }).eq('id', item.id);
    if (error) {
      setItems(prev => (prev ?? []).map(i => (i.id === item.id ? { ...i, done: item.done } : i)));
      showToast("Couldn't save that — try again?", 'error');
      return;
    }
    if (!nowDone || !item.ref_id) return;

    if (item.kind === 'chore') {
      const { error: choreError } = await supabase
        .from('chores')
        .update({ last_done_at: new Date().toISOString() })
        .eq('id', item.ref_id);
      if (!choreError) {
        notifyGrowth();
        if (user) completeChoreQuest(user.id, item.ref_id);
      }
    } else if (item.kind === 'appointment') {
      const { error: apptError } = await supabase
        .from('appointments')
        .update({ attended: true })
        .eq('id', item.ref_id);
      if (!apptError && user) triggerActionEvent(user.id, 'appointment_attended');
    }
  }

  return (
    <section style={{ marginTop: 14 }}>
      <div
        style={{
          background: allDone ? 'var(--blush)' : 'var(--white)',
          border: '2px dashed var(--pink-light)',
          borderRadius: 18,
          overflow: 'hidden',
        }}
      >
        <button
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 16px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <Icon name="clipboard-check" size={26} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--ink)' }}>Today's plan</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginTop: 2 }}>
              {allDone ? 'All done!' : `${doneCount}/${items.length} done`}
            </div>
          </div>
          <Icon name={open ? 'icon-chevronup' : 'icon-chevrondown'} size={20} />
        </button>

        {open && (
          <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sorted.map(item => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 14,
                  background: item.done ? 'var(--blush)' : 'var(--cream)',
                  border: '1.5px solid var(--border)',
                }}
              >
                <button
                  onClick={() => toggle(item)}
                  aria-label={item.done ? 'Mark not done' : 'Mark done'}
                  style={{
                    width: 24,
                    height: 24,
                    flexShrink: 0,
                    border: 'none',
                    background: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CheckMark completed={item.done} size={22} />
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '0.86rem',
                      fontWeight: 600,
                      color: item.done ? 'var(--ink-muted)' : 'var(--ink)',
                      textDecoration: item.done ? 'line-through' : 'none',
                    }}
                  >
                    {item.label}
                  </div>
                  {item.starts_at && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginTop: 2 }}>
                      {planTime(item.starts_at)}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {onNavigate && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ alignSelf: 'flex-start', marginTop: 2 }}
                onClick={() => onNavigate('dailyplanner', 'dayplan')}
              >
                Edit plan
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
