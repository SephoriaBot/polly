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

  return (
    <div className="card">
      <div className="card-body">
        <div className="section-label">Plan a day</div>

        {/* DATE PICKER */}
        <div className="add-row">
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
            className="form-input auto"
            type="date"
            value={date}
            min={todayKey}
            onChange={e => e.target.value && setDate(e.target.value)}
          />
        </div>
        <div className="date-heading">{dateHeading}</div>

        {loading ? (
          <p className="muted-text">Loading…</p>
        ) : (
          <>
            {/* THE PLAN */}
            <div className="section-label">
              On the plan{planned.length > 0 ? ` · ${planned.length}` : ''}
            </div>
            {planned.length === 0 ? (
              <p className="hint-text">Nothing planned yet. Tap things in below.</p>
            ) : (
              <div className="row-list subsection-end">
                {planned.map(item => (
                  <div key={item.id} className="row-item">
                    <div className="row-text">
                      <div className="row-title">{item.label}</div>
                      <div className="row-meta">
                        {KIND_LABEL[item.kind]}
                        {item.starts_at ? ` · ${planTime(item.starts_at)}` : ''}
                      </div>
                    </div>
                    <button
                      className="row-icon-btn"
                      onClick={() => removeItem(item.id)}
                      aria-label="Remove from plan"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* CHORES */}
            <div className="section-label">Add from chores</div>
            {availableChores.length === 0 ? (
              <p className="hint-text">
                {chores.length === 0 ? 'No chores set up yet.' : 'All your chores are on the plan.'}
              </p>
            ) : (
              <div className="row-list subsection-end">
                {availableChores.map(({ chore, status }) => (
                  <div key={chore.id} className="row-item">
                    <div className="row-text">
                      <div className="row-title">{chore.name}</div>
                      <div className={`row-meta${status.tone === 'due' ? ' is-due' : ''}`}>
                        {status.label} · ~{chore.estimated_minutes}min
                      </div>
                    </div>
                    <button
                      className="row-add-btn"
                      disabled={saving}
                      aria-label={`Add ${chore.name} to the plan`}
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
              <p className="hint-text">
                {appts.length === 0 ? 'No appointments on this day.' : 'All of them are on the plan.'}
              </p>
            ) : (
              <div className="row-list subsection-end">
                {availableAppts.map(appt => (
                  <div key={appt.id} className="row-item">
                    <div className="row-text">
                      <div className="row-title">{appt.title}</div>
                      <div className="row-meta">{planTime(appt.date_time)}</div>
                    </div>
                    <button
                      className="row-add-btn"
                      disabled={saving}
                      aria-label={`Add ${appt.title} to the plan`}
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
            <div className="add-row">
              <input
                className="form-input grow"
                placeholder="What do you want to do?"
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustom()}
              />
              <input
                className="form-input auto"
                type="time"
                value={customTime}
                onChange={e => setCustomTime(e.target.value)}
                aria-label="Time (optional)"
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