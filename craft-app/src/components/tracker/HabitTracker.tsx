import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase'; // adjust to Polly's actual client path

// ---------- types ----------

interface Habit {
  id: string;
  name: string;
  color_key: 'blush' | 'lavender' | 'sage' | 'honey';
  window_days: number;
  sort_order: number;
}

interface HabitLog {
  habit_id: string;
  log_date: string; // YYYY-MM-DD
  occurred: boolean;
}

// palette tokens — swap these for Polly's existing CSS variables if defined globally
const PALETTE: Record<Habit['color_key'], { struggling: string; thriving: string }> = {
  blush: { struggling: '#e8a0a8', thriving: '#a8d8b0' },
  lavender: { struggling: '#c3a6d9', thriving: '#a8d8b0' },
  sage: { struggling: '#c9c48f', thriving: '#7fb88a' },
  honey: { struggling: '#e6b877', thriving: '#a8d8b0' },
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// ---------- data hook ----------

export function useHabitTracker() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: h }, { data: l }] = await Promise.all([
      supabase.from('habits').select('*').eq('archived', false).order('sort_order'),
      supabase
        .from('habit_logs')
        .select('habit_id, log_date, occurred')
        .gte('log_date', daysAgoISO(30)),
    ]);
    setHabits(h ?? []);
    setLogs(l ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const checkIn = useCallback(
    async (habitId: string, occurred: boolean) => {
      const log_date = todayISO();
      // optimistic update so the bar animates immediately
      setLogs((prev) => [...prev.filter((l) => !(l.habit_id === habitId && l.log_date === log_date)), { habit_id: habitId, log_date, occurred }]);
      await supabase.from('habit_logs').upsert({ habit_id: habitId, log_date, occurred }, { onConflict: 'habit_id,log_date' });
    },
    []
  );

  // good-day ratio per habit over its own rolling window
  const ratios = useMemo(() => {
    const map: Record<string, { goodRatio: number; streak: number; todayLogged: boolean; todayOccurred: boolean }> = {};
    for (const habit of habits) {
      const cutoff = daysAgoISO(habit.window_days - 1);
      const windowLogs = logs.filter((l) => l.habit_id === habit.id && l.log_date >= cutoff);
      const goodDays = windowLogs.filter((l) => !l.occurred).length;
      const goodRatio = habit.window_days > 0 ? goodDays / habit.window_days : 0;

      // current streak of consecutive good days counting back from today
      let streak = 0;
      for (let i = 0; i < habit.window_days; i++) {
        const day = daysAgoISO(i);
        const entry = logs.find((l) => l.habit_id === habit.id && l.log_date === day);
        if (!entry || entry.occurred) break;
        streak++;
      }

      const todayEntry = logs.find((l) => l.habit_id === habit.id && l.log_date === todayISO());
      map[habit.id] = {
        goodRatio,
        streak,
        todayLogged: !!todayEntry,
        todayOccurred: todayEntry?.occurred ?? false,
      };
    }
    return map;
  }, [habits, logs]);

  return { habits, ratios, loading, checkIn, refresh: load };
}

// ---------- UI ----------

export default function HabitTracker() {
  const { habits, ratios, loading, checkIn } = useHabitTracker();

  if (loading) return <div className="habit-tracker habit-tracker--loading">Loading your habits…</div>;

  return (
    <div className="habit-tracker">
      {habits.map((habit) => {
        const stat = ratios[habit.id];
        return (
          <HabitCard
            key={habit.id}
            habit={habit}
            goodRatio={stat.goodRatio}
            streak={stat.streak}
            todayLogged={stat.todayLogged}
            todayOccurred={stat.todayOccurred}
            onCheckIn={(occurred) => checkIn(habit.id, occurred)}
          />
        );
      })}
    </div>
  );
}

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
  const colors = PALETTE[habit.color_key];
  const pct = Math.round(goodRatio * 100);

  return (
    <div className="habit-card">
      <div className="habit-card__header">
        <span className="habit-card__name">{habit.name}</span>
        {streak > 0 && <span className="habit-card__streak">{streak}-day streak</span>}
      </div>

      <div className="habit-bar" role="img" aria-label={`${pct}% good days over the last ${habit.window_days} days`}>
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
          className={`habit-btn habit-btn--no ${todayLogged && !todayOccurred ? 'is-active' : ''}`}
          onClick={() => onCheckIn(false)}
        >
          No 🌿
        </button>
        <button
          className={`habit-btn habit-btn--yes ${todayLogged && todayOccurred ? 'is-active' : ''}`}
          onClick={() => onCheckIn(true)}
        >
          Yes
        </button>
      </div>
    </div>
  );
}
