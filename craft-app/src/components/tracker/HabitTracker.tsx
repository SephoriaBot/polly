import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

// ---------- types ----------

interface Habit {
  id: string;
  name: string;
  color_key: 'blush' | 'lavender' | 'sage' | 'honey';
  window_days: number;
  sort_order: number;
  archived?: boolean;
}

interface HabitLog {
  habit_id: string;
  log_date: string;
  occurred: boolean;
}

// ---------- palette ----------

const PALETTE: Record<
  Habit['color_key'],
  { struggling: string; thriving: string }
> = {
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

function todayISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function daysAgoISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
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

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load your habits.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const checkIn = useCallback(
    async (habitId: string, occurred: boolean) => {
      const log_date = todayISO();

      // Optimistic update
      setLogs((prev) => [
        ...prev.filter(
          (log) =>
            !(
              log.habit_id === habitId &&
              log.log_date === log_date
            )
        ),
        {
          habit_id: habitId,
          log_date,
          occurred,
        },
      ]);

      const { error: upsertError } = await supabase
        .from('habit_logs')
        .upsert(
          {
            habit_id: habitId,
            log_date,
            occurred,
          },
          {
            onConflict: 'habit_id,log_date',
          }
        );

      if (upsertError) {
        console.error('Habit check-in error:', upsertError);

        // Reload from the database if the save failed.
        await load();
      }
    },
    [load]
  );

  const ratios = useMemo(() => {
    const map: Record<
      string,
      {
        goodRatio: number;
        streak: number;
        todayLogged: boolean;
        todayOccurred: boolean;
      }
    > = {};

    const today = todayISO();

    for (const habit of habits) {
      const windowDays = Math.max(1, habit.window_days || 1);
      const cutoff = daysAgoISO(windowDays - 1);

      const windowLogs = logs.filter(
        (log) =>
          log.habit_id === habit.id &&
          log.log_date >= cutoff &&
          log.log_date <= today
      );

      /*
       * A "good" day means the habit did NOT occur.
       *
       * This matches the existing tracker behavior:
       * "Did it happen today?"
       * No = good
       * Yes = occurred
       */
      const goodDays = windowLogs.filter(
        (log) => !log.occurred
      ).length;

      const goodRatio = goodDays / windowDays;

      // Current consecutive good-day streak.
      let streak = 0;

      for (let i = 0; i < windowDays; i++) {
        const day = daysAgoISO(i);

        const entry = logs.find(
          (log) =>
            log.habit_id === habit.id &&
            log.log_date === day
        );

        if (!entry || entry.occurred) {
          break;
        }

        streak++;
      }

      const todayEntry = logs.find(
        (log) =>
          log.habit_id === habit.id &&
          log.log_date === today
      );

      map[habit.id] = {
        goodRatio,
        streak,
        todayLogged: Boolean(todayEntry),
        todayOccurred: todayEntry?.occurred ?? false,
      };
    }

    return map;
  }, [habits, logs]);

  return {
    habits,
    ratios,
    loading,
    error,
    checkIn,
    refresh: load,
  };
}

// ---------- UI ----------

export default function HabitTracker() {
  const {
    habits,
    ratios,
    loading,
    error,
    checkIn,
  } = useHabitTracker();

  if (loading) {
    return (
      <div className="habit-tracker habit-tracker--loading">
        Loading your habits…
      </div>
    );
  }

  if (error) {
    return (
      <div className="habit-tracker">
        <div className="habit-tracker__error">
          <strong>We couldn't load your habits.</strong>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (habits.length === 0) {
    return (
      <div className="habit-tracker">
        <div className="habit-tracker__empty">
          <div className="habit-tracker__empty-title">
            No habits yet
          </div>

          <div className="habit-tracker__empty-text">
            Your habits will appear here once you add them.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="habit-tracker">
      {habits.map((habit) => {
        const stat = ratios[habit.id];

        if (!stat) {
          return null;
        }

        return (
          <HabitCard
            key={habit.id}
            habit={habit}
            goodRatio={stat.goodRatio}
            streak={stat.streak}
            todayLogged={stat.todayLogged}
            todayOccurred={stat.todayOccurred}
            onCheckIn={(occurred) =>
              checkIn(habit.id, occurred)
            }
          />
        );
      })}
    </div>
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
}: {
  habit: Habit;
  goodRatio: number;
  streak: number;
  todayLogged: boolean;
  todayOccurred: boolean;
  onCheckIn: (occurred: boolean) => void;
}) {
  const colors =
    PALETTE[habit.color_key] ?? PALETTE.lavender;

  const pct = Math.round(
    Math.max(0, Math.min(1, goodRatio)) * 100
  );

  return (
    <div className="habit-card">
      <div className="habit-card__header">
        <span className="habit-card__name">
          {habit.name}
        </span>

        {streak > 0 && (
          <span className="habit-card__streak">
            {streak}-day streak
          </span>
        )}
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

        <span className="habit-bar__label">
          {pct}%
        </span>
      </div>

      <div className="habit-card__checkin">
        <span className="habit-card__prompt">
          Did it happen today?
        </span>

        <button
          type="button"
          className={`habit-btn habit-btn--no ${
            todayLogged && !todayOccurred
              ? 'is-active'
              : ''
          }`}
          onClick={() => onCheckIn(false)}
        >
          No 🌿
        </button>

        <button
          type="button"
          className={`habit-btn habit-btn--yes ${
            todayLogged && todayOccurred
              ? 'is-active'
              : ''
          }`}
          onClick={() => onCheckIn(true)}
        >
          Yes
        </button>
      </div>
    </div>
  );
}