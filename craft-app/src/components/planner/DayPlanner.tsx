// DayPlanner.tsx
// "Plan a day" — pick a date, then build that day's schedule by tapping
// chores and appointments in, or adding your own lines (with an optional
// time). Edits save instantly; there is no separate Save step. On the day
// itself the plan shows up on the Dashboard as a checklist card.

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/useToast';
import Icon, { type IconName } from '../Icon';
import { localDateKey } from '../../lib/dateKey';
import { statusFor, type Chore } from '../../lib/chores';
import {
  type DayPlanItem,
  type DayPlanKind,
  sortPlanItems,
  planTime,
  dayKeyFromToday,
  dateFromKey,
} from '../../lib/dayPlan';

interface PlanAppt {
  id: string;
  title: string;
  date_time: string;
  attended: boolean | null;
}

const KIND_LABEL: Record<DayPlanKind, string> = {
  chore: 'Chore',
  appointment: 'Appointment',
  custom: 'Yours',
};

export default function DayPlanner() {
  const { showToast } = useToast();
  const todayKey = localDateKey();

  const [date, setDate] = useState(dayKeyFromToday(1));
  const [items, setItems] = useState<DayPlanItem[]>([]);
  const [chores, setChores] = useState<Chore[]>([]);
  const [appts, setAppts] = useState<PlanAppt[]>([]);
  const [loading, setLoading] = useState(true);
  const [customText, setCustomText] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [saving, setSaving] = useState(false);

  // Chores load once; the plan and that day's appointments reload per date.
  useEffect(() => {
    supabase
      .from('chores')
      .select('*')
      .order('created_at')
      .then(({ data }) => setChores((data as Chore[]) ?? []));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const start = new Date(`${date}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    Promise.all([
      supabase.from('day_plan_items').select('*').eq('plan_date', date),
      supabase
        .from('appointments')
        .select('id,title,date_time,attended')
        .gte('date_time', start.toISOString())
        .lt('date_time', end.toISOString())
        .order('date_time'),
    ]).then(([itemsRes, apptsRes]) => {
      if (cancelled) return;
      setItems((itemsRes.data as DayPlanItem[]) ?? []);
      setAppts(((apptsRes.data as PlanAppt[]) ?? []).filter(a => a.attended !== true));
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [date]);

  async function addItem(input: {
    kind: DayPlanKind;
    ref_id: string | null;
    label: string;
    starts_at: string | null;
  }) {
    setSaving(true);
    const { data, error } = await supabase
      .from('day_plan_items')
      .insert({ plan_date: date, done: false, ...input })
      .select()
      .single();
    setSaving(false);
    if (error || !data) {
      showToast("Couldn't add that — try again?", 'error');
      return false;
    }
    setItems(prev => [...prev, data as DayPlanItem]);
    return true;
  }

  async function removeItem(id: string) {
    const previous = items;
    setItems(prev => prev.filter(i => i.id !== id));
    const { error } = await supabase.from('day_plan_items').delete().eq('id', id);
    if (error) {
      setItems(previous);
      showToast("Couldn't remove that — try again?", 'error');
    }
  }

  async function addCustom() {
    const label = customText.trim();
    if (!label) return;
    const starts_at = customTime ? new Date(`${date}T${customTime}`).toISOString() : null;
    const ok = await addItem({ kind: 'custom', ref_id: null, label, starts_at });
    if (ok) {
      setCustomText('');
      setCustomTime('');
    }
  }

  const planned = sortPlanItems(items);
  const plannedRefs = new Set(items.filter(i => i.ref_id).map(i => `${i.kind}:${i.ref_id}`));

  // Show chore status as of the planned day, so "due tomorrow" reads right.
  const asOf = dateFromKey(date);
  const availableChores = chores
    .filter(c => !plannedRefs.has(`chore:${c.id}`))
    .map(c => ({ chore: c, status: statusFor(c, asOf) }))
    .sort((a, b) => b.status.overdueDays - a.status.overdueDays);
  const availableAppts = appts.filter(a => !plannedRefs.has(`appointment:${a.id}`));

  const dateHeading = dateFromKey(date).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 16,
    background: 'var(--white)',
    border: '1.5px solid var(--border)',
  } as const;

  const addBtnStyle = {
    background: 'var(--blush)',
    border: '1.5px solid var(--border)',
    borderRadius: '50%',
    width: 30,
    height: 30,
    flexShrink: 0,
    cursor: 'pointer',
    color: 'var(--pink-dark)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  } as const;

  return (
    <div className="card">
      <div className="card-body">
        <div className="section-label">Plan a day</div>

        {/* DATE PICKER */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
          <button
            className={date === todayKey ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
            onClick={() => setDate(todayKey)}
          >
            Today
          </button>
          <button
            className={date === dayKeyFromToday(1) ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
            onClick={() => setDate(dayKeyFromToday(1))}
          >
            Tomorrow
          </button>
          <input
            className="form-input"
            type="date"
            value={date}
            min={todayKey}
            onChange={e => e.target.value && setDate(e.target.value)}
            style={{ width: 'auto', fontSize: '0.85rem' }}
          />
        </div>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--pink-dark)', marginBottom: 14 }}>
          {dateHeading}
        </div>

        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Loading…</p>
        ) : (
          <>
            {/* THE PLAN */}
            <div className="section-label" style={{ marginTop: 4 }}>
              On the plan{planned.length > 0 ? ` · ${planned.length}` : ''}
            </div>
            {planned.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--ink-muted)', margin: '0 0 14px' }}>
                Nothing planned yet. Tap things in below.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {planned.map(item => (
                  <div key={item.id} style={rowStyle}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--ink)' }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginTop: 2 }}>
                        {KIND_LABEL[item.kind]}
                        {item.starts_at ? ` · ${planTime(item.starts_at)}` : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      aria-label="Remove from plan"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)', padding: 0, opacity: 0.5, flexShrink: 0 }}
                    >
                      <Icon name="icon-clear" size={24} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* CHORES */}
            <div className="section-label">Add from chores</div>
            {availableChores.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--ink-muted)', margin: '0 0 14px' }}>
                {chores.length === 0 ? 'No chores set up yet.' : 'All your chores are on the plan.'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {availableChores.map(({ chore, status }) => (
                  <div key={chore.id} style={rowStyle}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--ink)' }}>{chore.name}</div>
                      <div
                        style={{
                          fontSize: '0.72rem',
                          marginTop: 2,
                          fontWeight: status.tone === 'due' ? 700 : 500,
                          color: status.tone === 'due' ? 'var(--pink-dark)' : 'var(--ink-muted)',
                        }}
                      >
                        {status.label} · ~{chore.estimated_minutes}min
                      </div>
                    </div>
                    <button
                      disabled={saving}
                      aria-label={`Add ${chore.name} to the plan`}
                      style={addBtnStyle}
                      onClick={() =>
                        addItem({ kind: 'chore', ref_id: String(chore.id), label: chore.name, starts_at: null })
                      }
                    >
                      <Icon name={'icon-plus' as IconName} size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* APPOINTMENTS */}
            <div className="section-label">Appointments that day</div>
            {availableAppts.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--ink-muted)', margin: '0 0 14px' }}>
                {appts.length === 0 ? 'No appointments on this day.' : 'All of them are on the plan.'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {availableAppts.map(appt => (
                  <div key={appt.id} style={rowStyle}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--ink)' }}>{appt.title}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginTop: 2 }}>
                        {planTime(appt.date_time)}
                      </div>
                    </div>
                    <button
                      disabled={saving}
                      aria-label={`Add ${appt.title} to the plan`}
                      style={addBtnStyle}
                      onClick={() =>
                        addItem({
                          kind: 'appointment',
                          ref_id: String(appt.id),
                          label: appt.title,
                          starts_at: appt.date_time,
                        })
                      }
                    >
                      <Icon name={'icon-plus' as IconName} size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* CUSTOM */}
            <div className="section-label">Add your own</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                className="form-input"
                placeholder="What do you want to do?"
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustom()}
                style={{ flex: 1, minWidth: 160, fontSize: '0.85rem' }}
              />
              <input
                className="form-input"
                type="time"
                value={customTime}
                onChange={e => setCustomTime(e.target.value)}
                aria-label="Time (optional)"
                style={{ width: 'auto', fontSize: '0.85rem' }}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={addCustom}
                disabled={saving || !customText.trim()}
              >
                Add
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
