// dailyTasks.ts
// Today's recurring task instances used to be created only when the Daily
// Planner page opened, so anything that counted daily_tasks before that (like
// the dashboard radar) saw zero until you visited the Tasks tab. This makes
// sure today's instances exist, and is safe to call from anywhere, any number
// of times.
import { supabase } from './supabase';

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

let inFlight: Promise<void> | null = null;

export function ensureTodaysRecurringTasks(): Promise<void> {
  // Share one run between simultaneous callers so they can't double-insert.
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const today = todayISO();
    const weekday = new Date().getDay();

    const [templatesRes, todaysRes] = await Promise.all([
      supabase.from('daily_task_templates').select('*'),
      supabase.from('daily_tasks').select('id,template_id').eq('task_date', today),
    ]);
    if (templatesRes.error || todaysRes.error) {
      throw templatesRes.error ?? todaysRes.error;
    }

    const alreadyGenerated = new Set(
      (todaysRes.data ?? []).filter(t => t.template_id).map(t => t.template_id)
    );
    const due = (templatesRes.data ?? []).filter(
      t => t.active && t.days_of_week.includes(weekday) && !alreadyGenerated.has(t.id)
    );
    if (due.length === 0) return;

    const { error } = await supabase.from('daily_tasks').insert(
      due.map(t => ({
        label: t.label,
        done: false,
        task_date: today,
        template_id: t.id,
        priority: t.priority,
        time_of_day: t.time_of_day,
      }))
    );
    if (error) throw error;
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}
