import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import './HabitTracker.css';

// ---------- types ----------

type HabitColor = 'blush' | 'lavender' | 'sage' | 'honey';
type HabitTarget = 'decrease' | 'increase';

interface Habit {
  id: string;
  name: string;
  color_key: HabitColor;
  target: HabitTarget;
  window_days: number;
  sort_order: number;
  archived?: boolean;
  created_at?: string;
}

interface HabitLog {
  habit_id: string;
  log_date: string;
  occurred: boolean;
}

// ---------- palette ----------

const PALETTE: Record<HabitColor, { struggling: string; thriving: string }> = {
  blush: {
    struggling: '#e8a0a8',
    thriving: '#a8d8b0',
  },
  lavender: {
    struggling: '#c3a6d9',
    thriving: '#a8d8b0',
  },
  sage: {
    struggling: '#c9c48f',
    thriving: '#7fb88a',
  },
  honey: {
    struggling: '#e6b877',
    thriving: '#a8d8b0',
  },
};

// ---------- date helpers ----------

function todayISO() {
  const d = new Date();

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function daysAgoISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

// a day is "good" for a decrease habit if it didn't happen,
// and "good" for an increase habit if it did happen
function isGoodDay(habit: Habit, log: HabitLog) {
  return habit.target === 'increase' ? log.occurred : !log.occurred;
}

// ---------- data hook ----------

export function useHabitTracker() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [habitsResult, logsResult] = await Promise.all([
        supabase
          .from('habits')
          .select('*')
          .eq('archived', false)
          .order('sort_order', { ascending: true }),

        supabase
          .from('habit_logs')
          .select('habit_id, log_date, occurred')
          .gte('log_date', daysAgoISO(30)),
      ]);

      if (habitsResult.error) {
        throw new Error(habitsResult.error.message);
      }

      if (logsResult.error) {
        throw new Error(logsResult.error.message);
      }

      setHabits((habitsResult.data ?? []) as Habit[]);
      setLogs((logsResult.data ?? []) as HabitLog[]);
    } catch (err) {
      console.error('Habit tracker load error:', err);

      setHabits([]);
      setLogs([]);

      setError(err instanceof Error ? err.message : 'Unable to load your habits.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addHabit = useCallback(
    async ({
      name,
      target,
      colorKey,
      windowDays,
    }: {
      name: string;
      target: HabitTarget;
      colorKey: HabitColor;
      windowDays: number;
    }) => {
      const trimmedName = name.trim();

      if (!trimmedName) {
        return { success: false, error: 'Please enter a habit name.' };
      }

      try {
        const nextSortOrder =
          habits.length > 0 ? Math.max(...habits.map((habit) => habit.sort_order)) + 1 : 0;

        const { data, error: insertError } = await supabase
          .from('habits')
          .insert({
            name: trimmedName,
            color_key: colorKey,
            target,
            window_days: windowDays,
            sort_order: nextSortOrder,
            archived: false,
          })
          .select()
          .single();

        if (insertError) {
          console.error('Add habit error:', insertError);
          return { success: false, error: insertError.message };
        }

        if (data) {
          setHabits((prev) => [...prev, data as Habit].sort((a, b) => a.sort_order - b.sort_order));
        }

        return { success: true, error: null };
      } catch (err) {
        console.error('Add habit error:', err);
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Unable to create habit.',
        };
      }
    },
    [habits]
  );

  const deleteHabit = useCallback(
    async (habitId: string) => {
      const prevHabits = habits;
      setHabits((prev) => prev.filter((habit) => habit.id !== habitId));

      const { error: archiveError } = await supabase
        .from('habits')
        .update({ archived: true })
        .eq('id', habitId);

      if (archiveError) {
        console.error('Delete habit error:', archiveError);
        setHabits(prevHabits);
      }
    },
    [habits]
  );

  const checkIn = useCallback(
    async (habitId: string, occurred: boolean) => {
      const log_date = todayISO();

      setLogs((prev) => [
        ...prev.filter((log) => !(log.habit_id === habitId && log.log_date === log_date)),
        { habit_id: habitId, log_date, occurred },
      ]);

      const { error: upsertError } = await supabase
        .from('habit_logs')
        .upsert({ habit_id: habitId, log_date, occurred }, { onConflict: 'habit_id,log_date' });

      if (upsertError) {
        console.error('Habit check-in error:', upsertError);
        await load();
      }
    },
    [load]
  );

  const ratios = useMemo(() => {
    const map: Record<
      string,
      { goodRatio: number; streak: number; todayLogged: boolean; todayOccurred: boolean }
    > = {};

    const today = todayISO();

    for (const habit of habits) {
      const windowDays = Math.max(1, habit.window_days || 1);
      const cutoff = daysAgoISO(windowDays - 1);

      const windowLogs = logs.filter(
        (log) => log.habit_id === habit.id && log.log_date >= cutoff && log.log_date <= today
      );

      const goodDays = windowLogs.filter((log) => isGoodDay(habit, log)).length;
      const goodRatio = goodDays / windowDays;

      let streak = 0;

      for (let i = 0; i < windowDays; i++) {
        const day = daysAgoISO(i);
        const entry = logs.find((log) => log.habit_id === habit.id && log.log_date === day);

        if (!entry || !isGoodDay(habit, entry)) {
          break;
        }

        streak++;
      }

      const todayEntry = logs.find((log) => log.habit_id === habit.id && log.log_date === today);

      map[habit.id] = {
        goodRatio,
        streak,
        todayLogged: Boolean(todayEntry),
        todayOccurred: todayEntry?.occurred ?? false,
      };
    }

    return map;
  }, [habits, logs]);

  return { habits, ratios, loading, error, addHabit, checkIn, deleteHabit, refresh: load };
}

// ---------- UI ----------

export default function HabitTracker() {
  const { habits, ratios, loading, error, addHabit, checkIn, deleteHabit } = useHabitTracker();
  const [showAdd, setShowAdd] = useState(false);

  if (loading) {
    return <div className="habit-tracker habit-tracker--loading">Loading your habits…</div>;
  }

  return (
    <div className="habit-tracker">
      {error && (
        <div className="habit-tracker__error">
          <strong>We couldn't load your habits.</strong>
          <span>{error}</span>
        </div>
      )}

      <div className="habit-tracker__top">
        <div>
          <h2 className="habit-tracker__title">Habit Tracker</h2>
          <p className="habit-tracker__subtitle">Keep an eye on the habits you want to change.</p>
        </div>

        <button type="button" className="habit-add-btn" onClick={() => setShowAdd((prev) => !prev)}>
          {showAdd ? 'Cancel' : '+ Add Habit'}
        </button>
      </div>

      {showAdd && <AddHabitForm onAdd={addHabit} onClose={() => setShowAdd(false)} />}

      {habits.length === 0 && !showAdd && (
        <div className="habit-tracker__empty">
          <div className="habit-tracker__empty-title">No habits yet</div>
          <div className="habit-tracker__empty-text">Add your first habit above to start tracking it.</div>
        </div>
      )}

      {habits.length > 0 && (
        <div className="habit-tracker__list">
          {habits.map((habit) => {
            const stat = ratios[habit.id];
            if (!stat) return null;

            return (
              <HabitCard
                key={habit.id}
                habit={habit}
                goodRatio={stat.goodRatio}
                streak={stat.streak}
                todayLogged={stat.todayLogged}
                todayOccurred={stat.todayOccurred}
                onCheckIn={(occurred) => checkIn(habit.id, occurred)}
                onDelete={() => deleteHabit(habit.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- add habit form ----------

function AddHabitForm({
  onAdd,
  onClose,
}: {
  onAdd: (args: {
    name: string;
    target: HabitTarget;
    colorKey: HabitColor;
    windowDays: number;
  }) => Promise<{ success: boolean; error: string | null }>;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState<HabitTarget>('decrease');
  const [windowDays, setWindowDays] = useState('30');
  const [colorKey, setColorKey] = useState<HabitColor>('lavender');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsedWindowDays = Number(windowDays);

    if (!name.trim()) {
      setFormError('Please enter a habit name.');
      return;
    }

    if (!Number.isFinite(parsedWindowDays) || parsedWindowDays < 1) {
      setFormError('Tracking window must be at least 1 day.');
      return;
    }

    setSaving(true);

    const result = await onAdd({
      name,
      target,
      colorKey,
      windowDays: parsedWindowDays,
    });

    setSaving(false);

    if (!result.success) {
      setFormError(result.error ?? 'Unable to create this habit.');
      return;
    }

    onClose();
  }

  return (
    <form className="habit-add-form" onSubmit={handleSubmit}>
      <div className="habit-add-form__heading">
        <h3>Create a habit</h3>
        <p>Add something you want to keep track of.</p>
      </div>

      <label className="habit-form-field">
        <span>Habit name</span>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Drink water"
          autoFocus
        />
      </label>

      <div className="habit-form-row">
        <label className="habit-form-field">
          <span>Direction</span>
          <div className="habit-target-toggle">
            <button
              type="button"
              className={`habit-target-option ${target === 'decrease' ? 'is-active' : ''}`}
              onClick={() => setTarget('decrease')}
            >
              Decrease
            </button>
            <button
              type="button"
              className={`habit-target-option ${target === 'increase' ? 'is-active' : ''}`}
              onClick={() => setTarget('increase')}
            >
              Increase
            </button>
          </div>
        </label>

        <label className="habit-form-field">
          <span>Window</span>
          <select value={windowDays} onChange={(event) => setWindowDays(event.target.value)}>
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
            <option value="60">60 days</option>
            <option value="90">90 days</option>
          </select>
        </label>
      </div>

      <div className="habit-form-field">
        <span>Color</span>

        <div className="habit-color-picker">
          {(['blush', 'lavender', 'sage', 'honey'] as HabitColor[]).map((color) => (
            <button
              key={color}
              type="button"
              className={`habit-color-option habit-color-option--${color} ${
                colorKey === color ? 'is-active' : ''
              }`}
              onClick={() => setColorKey(color)}
              aria-label={`Choose ${color}`}
              aria-pressed={colorKey === color}
            />
          ))}
        </div>
      </div>

      {formError && <div className="habit-add-form__error">{formError}</div>}

      <div className="habit-add-form__actions">
        <button type="button" className="habit-form-cancel" onClick={onClose} disabled={saving}>
          Cancel
        </button>

        <button type="submit" className="habit-form-save" disabled={saving}>
          {saving ? 'Saving…' : 'Save Habit'}
        </button>
      </div>
    </form>
  );
}

// ---------- habit card ----------

function HabitCard({
  habit,
  goodRatio,
  streak,
  todayLogged,
  todayOccurred,
  onCheckIn,
  onDelete,
}: {
  habit: Habit;
  goodRatio: number;
  streak: number;
  todayLogged: boolean;
  todayOccurred: boolean;
  onCheckIn: (occurred: boolean) => void;
  onDelete: () => void;
}) {
  const colors = PALETTE[habit.color_key] ?? PALETTE.lavender;
  const pct = Math.round(Math.max(0, Math.min(1, goodRatio)) * 100);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // for an "increase" habit, answering Yes is the good choice;
  // for a "decrease" habit, answering No is the good choice
  const goodChoiceIsYes = habit.target === 'increase';

  return (
    <div className="habit-card">
      <div className="habit-card__header">
        <div>
          <span className="habit-card__name">{habit.name}</span>
        </div>

        <div className="habit-card__header-right">
          {streak > 0 && <span className="habit-card__streak">{streak}-day streak</span>}

          {confirmingDelete ? (
            <span className="habit-delete-confirm">
              <button type="button" className="habit-delete-confirm__yes" onClick={onDelete}>
                Delete
              </button>
              <button
                type="button"
                className="habit-delete-confirm__no"
                onClick={() => setConfirmingDelete(false)}
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="habit-delete-btn"
              aria-label={`Delete ${habit.name}`}
              onClick={() => setConfirmingDelete(true)}
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div
        className="habit-bar"
        role="img"
        aria-label={`${pct}% good days over the last ${habit.window_days} days`}
      >
        <div
          className="habit-bar__fill"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${colors.struggling}, ${colors.thriving})`,
          }}
        />
        <span className="habit-bar__label">{pct}%</span>
      </div>

      <div className="habit-card__checkin">
        <span className="habit-card__prompt">Did it happen today?</span>

        <button
          type="button"
          className={`habit-btn ${
            todayLogged && !todayOccurred ? (goodChoiceIsYes ? 'is-bad' : 'is-good') : ''
          }`}
          onClick={() => onCheckIn(false)}
        >
          No
        </button>

        <button
          type="button"
          className={`habit-btn ${
            todayLogged && todayOccurred ? (goodChoiceIsYes ? 'is-good' : 'is-bad') : ''
          }`}
          onClick={() => onCheckIn(true)}
        >
          Yes
        </button>
      </div>
    </div>
  );
}
