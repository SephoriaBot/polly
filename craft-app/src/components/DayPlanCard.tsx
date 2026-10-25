// DayPlanCard.tsx
// Dashboard "package" for a planned day. Only appears when today has a
// plan; tap the closed package and it shakes, pops open, and the checklist
// slides out beneath it. Tap the open package to close it again. Ticking a chore marks the real chore
// done, ticking an appointment marks it attended, custom lines are plain
// checkboxes. Unticking only unticks the plan line.

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../context/AuthContext';
import { useCreatureGrowth } from '../creatures/CreatureGrowthContext';
import { completeChoreQuest, triggerActionEvent } from '../lib/questSystem';
import { localDateKey } from '../lib/dateKey';
import { type DayPlanItem, sortPlanItems, planTime } from '../lib/dayPlan';
import CheckMark from './CheckMark';

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
  const [shaking, setShaking] = useState(false);
  const shakeTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(shakeTimer.current), []);

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

  function handlePackageTap() {
    if (shaking) return;
    if (open) {
      setOpen(false);
      return;
    }
    // Little wiggle first, then the box pops open.
    setShaking(true);
    shakeTimer.current = window.setTimeout(() => {
      setShaking(false);
      setOpen(true);
    }, 420);
  }

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
      <style>{`
        @keyframes pkgShake {
          0%   { transform: rotate(0) scale(1); }
          15%  { transform: rotate(-7deg) scale(1.03); }
          30%  { transform: rotate(6deg) scale(1.03); }
          45%  { transform: rotate(-5deg) scale(1.02); }
          60%  { transform: rotate(3deg) scale(1.01); }
          100% { transform: rotate(0) scale(1); }
        }
        @keyframes pkgPop {
          0%   { transform: scale(0.88); }
          60%  { transform: scale(1.07); }
          100% { transform: scale(1); }
        }
        @keyframes planReveal {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .pkg-anim, .pkg-reveal { animation: none !important; }
        }
      `}</style>

      <button
        onClick={handlePackageTap}
        aria-expanded={open}
        aria-label={open ? "Close today's plan" : "Open today's plan"}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <div
          className="pkg-anim"
          style={{
            position: 'relative',
            width: 170,
            height: 150,
            animation: shaking ? 'pkgShake 0.42s ease-in-out' : 'none',
          }}
        >
          <img
            src="/package_closed.png"
            alt=""
            aria-hidden="true"
            draggable={false}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              opacity: open ? 0 : 1,
              transition: 'opacity 0.2s ease',
            }}
          />
          <img
            src="/package_open.png"
            alt=""
            aria-hidden="true"
            draggable={false}
            className="pkg-anim"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              opacity: open ? 1 : 0,
              transition: 'opacity 0.2s ease',
              animation: open ? 'pkgPop 0.45s ease-out' : 'none',
            }}
          />
        </div>

        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--ink)' }}>Today's plan</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
          {allDone ? 'All done!' : open ? `${doneCount}/${items.length} done` : `${doneCount}/${items.length} done · tap to open`}
        </div>
      </button>

      {open && (
        <div
          className="pkg-reveal"
          style={{
            marginTop: 12,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            background: allDone ? 'var(--blush)' : 'var(--white)',
            border: '2px dashed var(--pink-light)',
            borderRadius: 18,
            animation: 'planReveal 0.35s ease-out',
          }}
        >
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
    </section>
  );
}
