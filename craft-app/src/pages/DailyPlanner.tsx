import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Chores from '../components/planner/Chores';
import LifeEvents from '../components/planner/LifeEvents';
import Goals from '../components/planner/Goals';
import TrackerPage from './TrackerPage';
import DayPlanner from '../components/planner/DayPlanner';
import EmptyState from '../components/EmptyState';
import checklistImg from '../assets/illustrations/checklist.png';
import hamsterAmImg from '../assets/illustrations/hamster-am.png';
import hamsterAfternoonImg from '../assets/illustrations/hamster-afternoon.png';
import hamsterPmImg from '../assets/illustrations/hamster-pm.png';
import hamsterAnytimeImg from '../assets/illustrations/hamster-anytime.png';
import emptyPlanner from '../assets/icons/empty-planner.png';
import Icon, { type IconName } from '../components/Icon';
import PageTabs, { type PageTab } from '../components/PageTabs';
import { useTheme } from '../context/ThemeContext';
import CheckMark from '../components/CheckMark';
import { triggerActionEvent } from '../lib/questSystem';
import { useToast } from '../hooks/useToast';
import PageTitleLogo from "../components/PageTitleLogo";

interface DailyTask {
  id: string;
  label: string;
  done: boolean;
  created_at: string;
  task_date: string; // YYYY-MM-DD — the day this instance belongs to
  template_id: string | null; // set if this instance was generated from a recurring template
  priority: boolean; // starred — what No Energy Mode reduces the day down to
  time_of_day: TimeSlot; // which section it shows under
}

interface DailyTaskTemplate {
  id: string;
  label: string;
  days_of_week: number[]; // 0=Sun .. 6=Sat (matches JS Date#getDay())
  active: boolean;
  created_at: string;
  priority: boolean; // mirrors the starred state so regenerated instances inherit it
  time_of_day: TimeSlot; // mirrors onto regenerated instances, same idea as priority
}


const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'anytime';

const TIME_SLOTS: { key: TimeSlot; label: string; icon: string }[] = [
  { key: 'morning', label: 'Morning', icon: hamsterAmImg },
  { key: 'afternoon', label: 'Afternoon', icon: hamsterAfternoonImg },
  { key: 'evening', label: 'Evening', icon: hamsterPmImg },
  { key: 'anytime', label: 'Anytime', icon: hamsterAnytimeImg },
];

function groupBySlot(list: DailyTask[]) {
  const groups: Record<TimeSlot, DailyTask[]> = {
    morning: [], afternoon: [], evening: [], anytime: [],
  };
  for (const t of list) {
    groups[(t.time_of_day ?? 'anytime') as TimeSlot].push(t);
  }
  return groups;
}

interface Appointment {
  id: string;
  title: string;
  date_time: string;
  created_at: string;
  attended: boolean | null; // null = not yet marked, true = attended, false = cancelled
  notes: string | null;
}


interface Spark {
  id: number;
  x: number;
  y: number;
  color: string;
}

// Sparks pull from the same token palette as the rest of the app
// (pink-light / primary / secondary / accent / mint / gold-light)
// instead of a one-off hex set, so the celebration matches the theme.
const SPARK_COLORS = [
  'var(--pink-light-solid)',
  'var(--primary)',
  'var(--secondary)',
  'var(--pink-dark)',
  'var(--mint)',
  'var(--gold-light-solid)',
];

const PLANNER_TABS: PageTab<'tasks' | 'appointments' | 'chores' | 'events' | 'goals' | 'trackers' | 'dayplan'>[] = [
  { key: 'tasks', label: 'Tasks', icon: 'icon-listchecks' },
  { key: 'appointments', label: 'Appointments', icon: 'icon-calendar' },
  { key: 'dayplan', label: 'Plan a day', icon: 'clipboard-check' },
  { key: 'chores', label: 'Chores', icon: 'cleaning-spray' },
  { key: 'events', label: 'Life Events', icon: 'icon-heart' },
  { key: 'goals', label: 'Goals', icon: 'trophy' },
  { key: 'trackers', label: 'Trackers', icon: 'icon-trackers' },
];

function StitchDivider() {
  return (
    <div className="stitch-divider">
      <span className="line" />
      <span className="mark" />
      <span className="line" />
    </div>
  );
}

function todayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export default function DailyPlanner({ initialTab }: { initialTab?: 'tasks' | 'appointments' | 'chores' | 'events' | 'goals' | 'trackers' | 'dayplan' } = {}) {
  const { theme } = useTheme();
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [templates, setTemplates] = useState<DailyTaskTemplate[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState('');
  const [newTaskDate, setNewTaskDate] = useState(todayISO());
  const [upcomingTasks, setUpcomingTasks] = useState<DailyTask[]>([]);
  const [newApptTitle, setNewApptTitle] = useState('');
  const [newApptDate, setNewApptDate] = useState('');
  const [editingApptId, setEditingApptId] = useState<string | null>(null);
  const [editApptTitle, setEditApptTitle] = useState('');
  const [editApptDate, setEditApptDate] = useState('');
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [noteApptId, setNoteApptId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const { showToast } = useToast();
  const [repeatMode, setRepeatMode] = useState(false); // false = one-off (date picker), true = recurring (day chips)
  const [newTaskDays, setNewTaskDays] = useState<number[]>([]);
  const [newTaskSlot, setNewTaskSlot] = useState<TimeSlot>('anytime');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showAttended, setShowAttended] = useState(false); // collapsed by default so attended appts don't stack up
  const [activeTab, setActiveTab] = useState<'tasks' | 'appointments' | 'chores' | 'events' | 'goals' | 'trackers' | 'dayplan'>(initialTab ?? 'tasks');

  const upcomingAppts = appointments.filter(a => !a.attended);
  const attendedAppts = appointments.filter(a => a.attended);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const today = todayISO();
    const [tasksRes, upcomingRes, templatesRes, apptsRes] = await Promise.all([
      supabase.from('daily_tasks').select('*').eq('task_date', today).order('created_at'),
      supabase.from('daily_tasks').select('*').gt('task_date', today).order('task_date'),
      supabase.from('daily_task_templates').select('*').order('created_at'),
      supabase.from('appointments').select('*').order('date_time'),
    ]);

    const todaysTemplates: DailyTaskTemplate[] = templatesRes.data ?? [];
    const todaysTasks: DailyTask[] = tasksRes.data ?? [];
    setTemplates(todaysTemplates);
    setUpcomingTasks(upcomingRes.data ?? []);
    setAppointments(apptsRes.data ?? []);

    // Generate today's instances for any active template that applies to
    // today's weekday and doesn't already have an instance for today.
    const todayWeekday = new Date().getDay();
    const alreadyGenerated = new Set(todaysTasks.filter(t => t.template_id).map(t => t.template_id));
    const dueTemplates = todaysTemplates.filter(
      t => t.active && t.days_of_week.includes(todayWeekday) && !alreadyGenerated.has(t.id)
    );

        if (dueTemplates.length > 0) {
  const { data: inserted } = await supabase
    .from('daily_tasks')
    .insert(dueTemplates.map(t => ({ label: t.label, done: false, task_date: today, template_id: t.id, priority: t.priority, time_of_day: t.time_of_day })))
    .select();
      setTasks([...todaysTasks, ...(inserted ?? [])]);
    } else {
      setTasks(todaysTasks);
    }


    setLoading(false);
  }

  async function addTask() {
    if (repeatMode) return addTemplate();

    const label = newTask.trim();
    if (!label) return;
    const targetDate = newTaskDate || todayISO();
    const { data } = await supabase
  .from('daily_tasks')
  .insert({ label, done: false, task_date: targetDate, template_id: null, time_of_day: newTaskSlot })
  .select()
  .single();
    // Only add to today's visible list if it was actually scheduled for
    // today — anything scheduled for a future date shows up in the
    // "Scheduled" list instead, and moves into the main checklist on its day.
    if (data) {
      if (targetDate === todayISO()) {
        setTasks(prev => [...prev, data]);
      } else {
        setUpcomingTasks(prev => [...prev, data].sort((a, b) => a.task_date.localeCompare(b.task_date)));
      }
    }
    setNewTask('');
setNewTaskDate(todayISO());
setNewTaskSlot('anytime');
}

  async function toggleTask(task: DailyTask, e: React.MouseEvent) {
    const newDone = !task.done;

    // Capture what we need from the event synchronously, before the
    // `await` below — a DOM event's currentTarget is only valid while
    // the event is actively dispatching, so reading it after an await
    // can throw (it was silently killing everything below it: the spark
    // animation, and now the "all done" toast too).
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();

    await supabase.from('daily_tasks').update({ done: newDone }).eq('id', task.id);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: newDone } : t));

    if (newDone) {
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const newSparks: Spark[] = Array.from({ length: 8 }, (_, i) => ({
        id: Date.now() + i,
        x,
        y,
        color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
      }));
      setSparks(prev => [...prev, ...newSparks]);
      setTimeout(() => setSparks(prev => prev.filter(s => !newSparks.find(n => n.id === s.id))), 700);

      // If checking this task off finishes the whole list, celebrate.
      const willAllBeDone = tasks.length > 0 && tasks.every(t => t.id === task.id ? true : t.done);
      if (willAllBeDone) {
        showToast('All done! Good job. 🎉');
      }
    }
  }

    async function togglePriority(task: DailyTask) {
    const newPriority = !task.priority;
    await supabase.from('daily_tasks').update({ priority: newPriority }).eq('id', task.id);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, priority: newPriority } : t));

    // Recurring tasks regenerate daily as new rows — persist the star on the
    // template itself so tomorrow's instance is born already starred.
    if (task.template_id) {
      await supabase.from('daily_task_templates').update({ priority: newPriority }).eq('id', task.template_id);
      setTemplates(prev => prev.map(t => t.id === task.template_id ? { ...t, priority: newPriority } : t));
    }
  }


 async function deleteTask(id: string) {
  const task = tasks.find(t => t.id === id);

  // Recurring tasks regenerate from their template — delete the template
  // too, or it'll just spawn a new instance next time loadAll runs.
  if (task?.template_id) {
    await supabase.from('daily_task_templates').delete().eq('id', task.template_id);
    setTemplates(prev => prev.filter(t => t.id !== task.template_id));
  }

  await supabase.from('daily_tasks').delete().eq('id', id);
  setTasks(prev => prev.filter(t => t.id !== id));
}

  async function deleteUpcomingTask(id: string) {
    await supabase.from('daily_tasks').delete().eq('id', id);
    setUpcomingTasks(prev => prev.filter(t => t.id !== id));
  }

  function formatScheduledDate(dateStr: string) {
    return new Date(`${dateStr}T12:00:00`).toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  }

  async function resetAll() {
    const { error } = await supabase
      .from('daily_tasks')
      .update({ done: false })
      .in('id', tasks.map(t => t.id));
    if (error) { console.error(error); return; }
    setTasks(prev => prev.map(t => ({ ...t, done: false })));
  }

  function toggleNewTaskDay(day: number) {
    setNewTaskDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  }

  async function addTemplate() {
    const label = newTask.trim();
    if (!label || newTaskDays.length === 0) return;
    setSavingTemplate(true);
    try {
      const { data, error } = await supabase
  .from('daily_task_templates')
  .insert({ label, days_of_week: [...newTaskDays].sort((a, b) => a - b), active: true, time_of_day: newTaskSlot })
  .select()
  .single();
      if (error) throw error;
      setTemplates(prev => [...prev, data]);

      // If today matches the new template's days, generate today's instance
      // immediately instead of waiting for the next page load.
            if (data.days_of_week.includes(new Date().getDay())) {
       const { data: inserted } = await supabase
  .from('daily_tasks')
  .insert({ label: data.label, done: false, task_date: todayISO(), template_id: data.id, priority: data.priority, time_of_day: data.time_of_day })
  .select()
  .single();
        if (inserted) setTasks(prev => [...prev, inserted]);
      }


      setNewTask('');
setNewTaskDays([]);
setRepeatMode(false);
setNewTaskSlot('anytime');
    } catch (e) {
      console.error('failed to add recurring task', e);
    } finally {
      setSavingTemplate(false);
    }
  }

  async function stopRecurring(templateId: string) {
    if (!window.confirm("Stop this task from repeating? Today's checklist entry stays — it just won't regenerate.")) return;
    // Only stops future generation — today's already-generated instance (if
    // any) sticks around, same as any other task, since template_id is
    // ON DELETE SET NULL.
    await supabase.from('daily_task_templates').delete().eq('id', templateId);
    setTemplates(prev => prev.filter(t => t.id !== templateId));
    setTasks(prev => prev.map(t => t.template_id === templateId ? { ...t, template_id: null } : t));
  }

  async function addAppointment() {
    const title = newApptTitle.trim();
    if (!title || !newApptDate) return;
    const isoDateTime = new Date(newApptDate).toISOString();
    const { data } = await supabase
      .from('appointments')
      .insert({ title, date_time: isoDateTime })
      .select()
      .single();
    if (data) setAppointments(prev => [...prev, data].sort((a, b) => a.date_time.localeCompare(b.date_time)));
    setNewApptTitle('');
    setNewApptDate('');
  }

   async function deleteAppointment(id: string) {
    // The note lives on the appointment row itself, so it goes with it.
    await supabase.from('appointments').delete().eq('id', id);
    setAppointments(prev => prev.filter(a => a.id !== id));
  }

  // ISO timestamp -> value a datetime-local input accepts (local time, no seconds)
  function toLocalInput(iso: string) {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function startEditAppointment(appt: Appointment) {
    setEditingApptId(appt.id);
    setEditApptTitle(appt.title);
    setEditApptDate(toLocalInput(appt.date_time));
  }

  function cancelEditAppointment() {
    setEditingApptId(null);
    setEditApptTitle('');
    setEditApptDate('');
  }

  async function saveAppointmentEdit() {
    if (!editingApptId) return;
    const title = editApptTitle.trim();
    if (!title || !editApptDate) return;
    const isoDateTime = new Date(editApptDate).toISOString();
    const { error } = await supabase
      .from('appointments')
      .update({ title, date_time: isoDateTime })
      .eq('id', editingApptId);
    if (error) {
      showToast('Could not save changes — try again');
      return;
    }
    setAppointments(prev =>
      prev
        .map(a => (a.id === editingApptId ? { ...a, title, date_time: isoDateTime } : a))
        .sort((x, y) => x.date_time.localeCompare(y.date_time))
    );
    cancelEditAppointment();
  }

  // Marks an appointment attended instead of deleting it, so useCreatureGrowth's
  // credited-flag check can pick it up and award points on the next check.
  async function markAttended(id: string) {
    await supabase.from('appointments').update({ attended: true }).eq('id', id);
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, attended: true } : a));
    const { data: { user } } = await supabase.auth.getUser();
    if (user) triggerActionEvent(user.id, 'appointment_attended');
  }


  function formatApptDate(dateStr: string) {
    return new Date(dateStr).toLocaleString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  }

  function startNote(appt: Appointment) {
    setNoteApptId(appt.id);
    setNoteDraft(appt.notes ?? '');
  }

  function cancelNote() {
    setNoteApptId(null);
    setNoteDraft('');
  }

  async function saveNote() {
    if (!noteApptId) return;
    const text = noteDraft.trim();
    const hadNote = Boolean(appointments.find(a => a.id === noteApptId)?.notes);
    const { error } = await supabase
      .from('appointments')
      .update({ notes: text || null })
      .eq('id', noteApptId);
    if (error) {
      showToast('Could not save note — try again');
      return;
    }
    setAppointments(prev => prev.map(a => (a.id === noteApptId ? { ...a, notes: text || null } : a)));
    if (text && !hadNote) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) triggerActionEvent(user.id, 'appointment_note_added');
    }
    cancelNote();
  }

  const doneCount = tasks.filter(t => t.done).length;
  const allDone = tasks.length > 0 && doneCount === tasks.length;

  // Incomplete tasks first, completed tasks sink to the bottom.
  // Array.prototype.sort is stable, so order within each group is preserved.
  const sortedTasks = [...tasks].sort((a, b) => Number(a.done) - Number(b.done) || Number(b.priority) - Number(a.priority));
  const groupedTasks = groupBySlot(sortedTasks);

  return (
    <div>
      {sparks.map(spark => (
        <SparkParticle key={spark.id} x={spark.x} y={spark.y} color={spark.color} />
      ))}

      <div className="page-header">
        <div>
          <div className="title-row">
            <h2>
              <Icon name="title-planner" size={22} />
            <PageTitleLogo name="planner" height={28} />
            </h2>
           
          </div>
        </div>
      </div>

      <PageTabs tabs={PLANNER_TABS} active={activeTab} onChange={setActiveTab} />

      <div className="page-body">

        {activeTab === 'tasks' && tasks.length > 0 && (
          <div className="progress-row">
            <div className="progress">
              <div
                className={`progress-fill${allDone ? ' is-complete' : ''}`}
                style={{ width: `${(doneCount / tasks.length) * 100}%` }}
              />
            </div>
            <span className={`progress-text${allDone ? ' is-complete' : ''}`}>{doneCount}/{tasks.length}</span>
            <button className="btn btn-ghost btn-sm" onClick={resetAll}>Reset</button>
          </div>
        )}

        {activeTab === 'tasks' && (
        <section>

          {/* Dailies checklist */}
          <div className="card">
            <div className="card-body">
              <div className="section-label">Daily Tasks</div>
             

              {loading ? (
                <p className="muted-text">Loading…</p>
              ) : tasks.length === 0 ? (
                
        <EmptyState image={emptyPlanner} message="No tasks yet. Add a new or recurring one below to get started." />
    
              ) : (
                                              <>
                <div className="group-list">
                  {TIME_SLOTS.map(slot => {
                    const slotTasks = groupedTasks[slot.key];
                    if (slotTasks.length === 0) return null;
                    return (
                      <div key={slot.key}>
                        <div className="group-label">
                          <img className="group-icon" src={slot.icon} alt="" />
                          <span>{slot.label}</span>
                          <span className="group-count">
                            {slotTasks.filter(t => t.done).length}/{slotTasks.length}
                          </span>
                        </div>
                        <div className="row-list">
                          {slotTasks.map(task => (
                            <div key={task.id} className={`row-item${task.done ? ' is-done' : ''}`}>
                              <button
                                className="row-check"
                                onClick={e => toggleTask(task, e)}
                                aria-label={task.done ? 'Mark not done' : 'Mark done'}
                              >
                                <CheckMark completed={task.done} size={24} />
                              </button>
                              <div className="row-text">
                                <div className="row-title">{task.label}</div>
                              </div>
                              {task.template_id && (
                                <button
                                  type="button"
                                  className="row-icon-btn"
                                  onClick={(e) => { e.stopPropagation(); stopRecurring(task.template_id!); }}
                                  title="Repeats — tap to stop"
                                >
                                  <Icon name="icon-recur" size={20} />
                                </button>
                              )}
                              <button
                                className={`row-icon-btn row-star${task.priority ? ' is-on' : ''}`}
                                onClick={() => togglePriority(task)}
                                aria-label={task.priority ? 'Unstar priority' : 'Mark as priority'}
                                title={task.priority ? 'Priority — shows in No Energy Mode' : 'Mark as priority for No Energy Mode'}
                              >
                                {task.priority ? '★' : '☆'}
                              </button>
                              <button
                                className="row-icon-btn"
                                onClick={() => deleteTask(task.id)}
                                aria-label="Delete task"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

              <div className="add-row">
                <input
                  className="form-input grow"
                  placeholder="Add a task…"
                  value={newTask}
                  onChange={e => setNewTask(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTask()}
                />
                <button
                  type="button"
                  className={repeatMode ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
                  onClick={() => setRepeatMode(r => !r)}
                  title="Repeat on specific days instead of a one-time date"
                >
                  <Icon name="icon-calendar" size={14} /> Repeat
                </button>
                {!repeatMode && (
                  <input
                    className="form-input date-input"
                    type="date"
                    value={newTaskDate}
                    min={todayISO()}
                    onChange={e => setNewTaskDate(e.target.value)}
                    title="Defaults to today — pick a future date to schedule it instead"
                  />
                )}
                <button
                  className="btn btn-primary btn-sm"
                  onClick={addTask}
                  disabled={savingTemplate || !newTask.trim() || (repeatMode && newTaskDays.length === 0)}
                  aria-label="Add task"
                >
                  <Icon name="icon-plus" size={20} />
                </button>
              </div>

              <div className="chip-row">
                {TIME_SLOTS.map(slot => (
                  <button
                    key={slot.key}
                    type="button"
                    onClick={() => setNewTaskSlot(slot.key)}
                    className={`chip ${newTaskSlot === slot.key ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}`}
                  >
                    <img className="chip-icon" src={slot.icon} alt="" />
                    {slot.label}
                  </button>
                ))}
              </div>

              {repeatMode && (
                <div className="chip-row">
                  {DAY_LABELS.map((label, day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleNewTaskDay(day)}
                      className={`chip chip-day ${newTaskDays.includes(day) ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {upcomingTasks.length > 0 && (
                <div className="subsection">
                  <div className="section-label">Scheduled</div>
                  <div className="row-list">
                    {upcomingTasks.map(task => (
                      <div key={task.id} className="row-item is-scheduled">
                        <div className="row-text">
                          <div className="row-title">{task.label}</div>
                        </div>
                        <span className="row-date">{formatScheduledDate(task.task_date)}</span>
                        <button
                          className="row-icon-btn"
                          onClick={() => deleteUpcomingTask(task.id)}
                          aria-label="Remove scheduled task"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

        </section>
        )}

        {activeTab === 'appointments' && (
        <section>

          {/* Appointments */}
          <div className="card">
            <div className="card-body">
              <div className="section-label">Schedule &amp; Appointments</div>

              {upcomingAppts.length === 0 ? (
                <EmptyState image={emptyPlanner} message="No appointments scheduled yet" />
              ) : (
                <div className="row-list subsection">
                  {upcomingAppts.map(appt => {
                    if (editingApptId === appt.id) {
                      return (
                        <div key={appt.id} className="panel-item is-editing">
                          <input
                            className="form-input"
                            placeholder="Appointment title…"
                            value={editApptTitle}
                            onChange={e => setEditApptTitle(e.target.value)}
                          />
                          <input
                            className="form-input"
                            type="datetime-local"
                            value={editApptDate}
                            onChange={e => setEditApptDate(e.target.value)}
                          />
                          <div className="form-actions">
                            <button className="btn btn-primary btn-sm" onClick={saveAppointmentEdit}>
                              Save
                            </button>
                            <button className="text-btn" onClick={cancelEditAppointment}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      );
                    }
                    const isNoting = noteApptId === appt.id;
                    return (
                      <div key={appt.id} className="panel-item">
                        <div className="panel-head">
                          <div className="panel-icon">
                            <Icon name="icon-calendar" size={16} />
                          </div>
                          <div className="row-text">
                            <div className="row-title">{appt.title}</div>
                            <div className="row-meta">{formatApptDate(appt.date_time)}</div>
                          </div>
                          <button
                            className="row-icon-btn"
                            onClick={() => deleteAppointment(appt.id)}
                            title="Delete"
                            aria-label="Delete appointment"
                          >
                            ✕
                          </button>
                        </div>

                        {appt.notes && !isNoting && (
                          <div className="note-box">{appt.notes}</div>
                        )}

                        {isNoting ? (
                          <div className="stack">
                            <textarea
                              className="form-input"
                              rows={3}
                              placeholder="Things to bring up, questions, reminders…"
                              value={noteDraft}
                              onChange={e => setNoteDraft(e.target.value)}
                              autoFocus
                            />
                            <div className="form-actions">
                              <button className="btn btn-primary btn-sm" onClick={saveNote}>
                                Save note
                              </button>
                              <button className="text-btn" onClick={cancelNote}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="action-row">
                            <button className="text-btn" onClick={() => startNote(appt)} title="Add or edit a note">
                              {appt.notes ? 'Edit note' : 'Add note'}
                            </button>
                            <button className="text-btn" onClick={() => startEditAppointment(appt)} title="Edit title or date/time">
                              Edit
                            </button>
                            <button className="text-btn" onClick={() => markAttended(appt.id)} title="Mark attended (+10 points)">
                              Attended
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {attendedAppts.length > 0 && (
                <div className="subsection">
                  <button className="link-btn" onClick={() => setShowAttended(prev => !prev)}>
                    <Icon name={showAttended ? 'icon-chevronup' : 'icon-chevrondown'} size={12} />
                    Attended ({attendedAppts.length})
                  </button>

                  {showAttended && (
                    <div className="row-list scroll-box">
                      {attendedAppts.map(appt => (
                        <div key={appt.id} className="row-item is-done">
                          <div className="row-text">
                            <div className="row-title">{appt.title}</div>
                            <div className="row-meta">{formatApptDate(appt.date_time)}</div>
                            {appt.notes && <div className="row-meta note-text">{appt.notes}</div>}
                          </div>
                          <button
                            className="row-icon-btn"
                            onClick={() => deleteAppointment(appt.id)}
                            title="Remove"
                            aria-label="Remove appointment"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="stack subsection">
                <label className="form-label">New appointment</label>
                <input
                  className="form-input"
                  placeholder="Appointment title…"
                  value={newApptTitle}
                  onChange={e => setNewApptTitle(e.target.value)}
                />
                <label className="form-label">Date &amp; time</label>
                <div className="add-row">
                  <input
                    className="form-input grow"
                    type="datetime-local"
                    value={newApptDate}
                    onChange={e => setNewApptDate(e.target.value)}
                  />
                  <button className="btn btn-primary btn-sm" onClick={addAppointment} aria-label="Add appointment">
                    <Icon name="icon-plus" size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>

        </section>
        )}

        {/* CHORES — interval-based, time-since-last-done */}
        {activeTab === 'chores' && (
        <section>
          <Chores />
        </section>
        )}

        {/* LIFE EVENTS — temporary workspaces for big life stuff */}
        {activeTab === 'events' && (
        <section>
          <LifeEvents />
        </section>
        )}

        {/* GOALS — AI-generated step checklist for a goal you set */}
        {activeTab === 'goals' && (
        <section>
          <Goals />
        </section>
        )}

        {/* PLAN A DAY — one-off schedule for a specific date */}
        {activeTab === 'dayplan' && (
        <section>
          <DayPlanner />
        </section>
        )}

        {/* TRACKERS — habits, sleep, cycle, weight, custom */}
        {activeTab === 'trackers' && (
        <section>
          <TrackerPage />
        </section>
        )}

      </div>
    </div>
  );
}

function SparkParticle({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * 360;
        const distance = 40 + Math.random() * 30;
        const rad = (angle * Math.PI) / 180;
        const tx = Math.cos(rad) * distance;
        const ty = Math.sin(rad) * distance;
        return (
          <div
            key={i}
            style={{
              position: 'fixed',
              left: x,
              top: y,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: color,
              pointerEvents: 'none',
              zIndex: 9999,
              animation: 'sparkFly 0.6s ease-out forwards',
              // @ts-ignore
              '--tx': `${tx}px`,
              '--ty': `${ty}px`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes sparkFly {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
        }
      `}</style>
    </>
  );
}