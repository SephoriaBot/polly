import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import AppointmentNotesPanel from '../components/planner/AppointmentNotesPanel';
import type { AppointmentNoteSelection } from '../components/planner/AppointmentNotesPanel';
import Chores from '../components/planner/Chores';
import LifeEvents from '../components/planner/LifeEvents';
import { useAppointmentNoteMap } from '../hooks/useAppointmentNoteMap';
import Lantern from "../components/Lantern";
import EmptyState from '../components/EmptyState';
import checklistImg from '../assets/illustrations/checklist.png';
import celebrationImg from '../assets/illustrations/celebration.png';
import emptyPlanner from '../assets/icons/empty-planner.png';
import Icon, { type IconName } from '../components/Icon';

interface DailyTask {
  id: string;
  label: string;
  done: boolean;
  created_at: string;
  task_date: string; // YYYY-MM-DD — the day this instance belongs to
  template_id: string | null; // set if this instance was generated from a recurring template
  priority: boolean; // starred — what No Energy Mode reduces the day down to
}

interface DailyTaskTemplate {
  id: string;
  label: string;
  days_of_week: number[]; // 0=Sun .. 6=Sat (matches JS Date#getDay())
  active: boolean;
  created_at: string;
  priority: boolean; // mirrors the starred state so regenerated instances inherit it
}


const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Appointment {
  id: string;
  title: string;
  date_time: string;
  created_at: string;
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
  'var(--pink-light)',
  'var(--primary)',
  'var(--secondary)',
  'var(--pink-dark)',
  'var(--mint)',
  'var(--gold-light)',
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
  return new Date().toISOString().slice(0, 10);
}

export default function DailyPlanner() {
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [templates, setTemplates] = useState<DailyTaskTemplate[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState('');
  const [newTaskDate, setNewTaskDate] = useState(todayISO());
  const [upcomingTasks, setUpcomingTasks] = useState<DailyTask[]>([]);
  const [newApptTitle, setNewApptTitle] = useState('');
  const [newApptDate, setNewApptDate] = useState('');
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [focusNote, setFocusNote] = useState<AppointmentNoteSelection | null>(null);
  const [showAllDoneCelebration, setShowAllDoneCelebration] = useState(false);
  const [repeatMode, setRepeatMode] = useState(false); // false = one-off (date picker), true = recurring (day chips)
  const [newTaskDays, setNewTaskDays] = useState<number[]>([]);
  const [savingTemplate, setSavingTemplate] = useState(false);

  const { map: noteMap, refresh: refreshNoteMap } = useAppointmentNoteMap(appointments.map(a => a.id));

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
        .insert(dueTemplates.map(t => ({ label: t.label, done: false, task_date: today, template_id: t.id, priority: t.priority })))
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
      .insert({ label, done: false, task_date: targetDate, template_id: null })
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
  }

  async function toggleTask(task: DailyTask, e: React.MouseEvent) {
    const newDone = !task.done;
    await supabase.from('daily_tasks').update({ done: newDone }).eq('id', task.id);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: newDone } : t));

    if (newDone) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
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
        setShowAllDoneCelebration(true);
        setTimeout(() => setShowAllDoneCelebration(false), 3200);
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
        .insert({ label, days_of_week: [...newTaskDays].sort((a, b) => a - b), active: true })
        .select()
        .single();
      if (error) throw error;
      setTemplates(prev => [...prev, data]);

      // If today matches the new template's days, generate today's instance
      // immediately instead of waiting for the next page load.
            if (data.days_of_week.includes(new Date().getDay())) {
        const { data: inserted } = await supabase
          .from('daily_tasks')
          .insert({ label: data.label, done: false, task_date: todayISO(), template_id: data.id, priority: data.priority })
          .select()
          .single();
        if (inserted) setTasks(prev => [...prev, inserted]);
      }


      setNewTask('');
      setNewTaskDays([]);
      setRepeatMode(false);
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
    // Notes survive this now — appointment_id is ON DELETE SET NULL, so
    // attached notes just detach and stay available as carry-over material.
    await supabase.from('appointments').delete().eq('id', id);
    setAppointments(prev => prev.filter(a => a.id !== id));
  }

  function formatApptDate(dateStr: string) {
    return new Date(dateStr).toLocaleString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  }

  function openNoteFor(appt: Appointment) {
    const noteType = noteMap[appt.id];
    if (!noteType) return;
    setFocusNote({ appointmentId: appt.id, noteType, label: appt.title });
  }

  const doneCount = tasks.filter(t => t.done).length;
  const allDone = tasks.length > 0 && doneCount === tasks.length;

  // Incomplete tasks first, completed tasks sink to the bottom.
  // Array.prototype.sort is stable, so order within each group is preserved.
  const sortedTasks = [...tasks].sort((a, b) => Number(a.done) - Number(b.done) || Number(b.priority) - Number(a.priority));

  return (
    <div>
      {sparks.map(spark => (
        <SparkParticle key={spark.id} x={spark.x} y={spark.y} color={spark.color} />
      ))}

      {showAllDoneCelebration && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', zIndex: 9999,
        }}>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            background: 'var(--white)', border: '2px solid var(--border)',
            borderRadius: 32, padding: '20px 28px', textAlign: 'center',
            animation: 'plannerCelebrationPop 0.4s ease-out',
          }}>
            <img src={celebrationImg} alt="" style={{ width: 140 }} />
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--pink-dark)', marginTop: 4 }}>
              All done for today!
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 2 }}>
              Every task checked off. Nicely done.
            </div>
          </div>
          <style>{`
            @keyframes plannerCelebrationPop {
              0% { transform: scale(0.7); opacity: 0; }
              100% { transform: scale(1); opacity: 1; }
            }
          `}</style>
        </div>
      )}

      <div className="page-header">
        <div>
          <div className="title-row">
            <h2>Planner</h2>
            <Lantern />
          </div>
          <p style={{ color: allDone ? 'var(--pink-dark)' : 'var(--ink-muted)' }}>
            {allDone ? 'All done! Good job.' : `${doneCount} of ${tasks.length} done today`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {tasks.length > 0 && (
            <button className="btn btn-ghost" onClick={resetAll}>
              <Icon name="icon-recur" size={14} /> Reset
            </button>
          )}
        </div>
      </div>

      <div className="page-body">

        {tasks.length > 0 && (
          <div style={{ marginBottom: 4, maxWidth: 560 }}>
            <div style={{
              height: 10,
              borderRadius: 999,
              background: 'var(--border)',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${(doneCount / tasks.length) * 100}%`,
                background: allDone
                  ? 'linear-gradient(90deg, var(--pink-light), var(--pink-dark))'
                  : 'linear-gradient(90deg, var(--secondary), var(--accent))',
                borderRadius: 999,
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>
        )}

        <section className="grid-2" style={{ alignItems: 'start' }}>

          {/* Dailies checklist */}
          <div className="card">
            <div className="card-body">
              <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>Daily Tasks</span>
              </div>
             

              {loading ? (
                <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Loading…</p>
              ) : tasks.length === 0 ? (
                
        <EmptyState image={emptyPlanner} message="No tasks yet. Add a new or recurring one below to get started." />
    
              ) : (
                <p className="daily-tasks-subtitle">Tap the toast to give it some jam</p>,
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                  {sortedTasks.map(task => (
                    <div
                      key={task.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '16px 18px', borderRadius: 'var(--radius-md)',
                        background: task.done ? 'var(--blush)' : 'var(--white)',
                        border: `1.5px solid ${task.done ? 'var(--pink-light)' : 'var(--border)'}`,
                        opacity: task.done ? 0.55 : 1,
                      }}
                    >
                      <button
                        onClick={e => toggleTask(task, e)}
                        aria-label={task.done ? 'Mark not done' : 'Mark done'}
                        style={{
                          width: 24, height: 24, flexShrink: 0,
                          border: 'none', background: 'none', padding: 0,
                          cursor: 'pointer', display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        {task.done
                          ? <Icon name="toastfull" size={22} style={{ color: 'var(--pink-dark)' }} />
                          : <Icon name="toastempty" size={22} style={{ color: 'var(--border)' }} />
                        }
                      </button>

                      <span style={{
                        flex: 1, fontSize: '0.92rem', fontWeight: 600,
                        letterSpacing: '0.01em', lineHeight: 1.4,
                        color: task.done ? 'var(--ink-muted)' : 'var(--ink)',
                        textDecoration: task.done ? 'line-through' : 'none',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        {task.label}
                        {task.template_id && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); stopRecurring(task.template_id!); }}
                            title="Repeats — tap to stop"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: 'var(--ink-muted)', opacity: 0.6, flexShrink: 0 }}
                          >
                            <Icon name="icon-recur" size={11} />
                          </button>
                        )}
                      </span>

                      <button
                        onClick={() => togglePriority(task)}
                        aria-label={task.priority ? 'Unstar priority' : 'Mark as priority'}
                        title={task.priority ? 'Priority — shows in No Energy Mode' : 'Mark as priority for No Energy Mode'}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                          display: 'flex', alignItems: 'center', flexShrink: 0,
                          fontSize: '1.05rem', lineHeight: 1,
                          color: task.priority ? 'var(--gold)' : 'var(--border)',
                        }}
                      >
                        {task.priority ? '★' : '☆'}
                      </button>

                      <button
                        onClick={() => deleteTask(task.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)', padding: 0, display: 'flex', alignItems: 'center', opacity: 0.4 }}
                      >
                        <Icon name="icon-clear" size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  className="form-input"
                  placeholder="Add a task…"
                  value={newTask}
                  onChange={e => setNewTask(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTask()}
                  style={{ flex: 1, minWidth: 140 }}
                />
                <button
                  type="button"
                  className={repeatMode ? 'btn btn-primary' : 'btn btn-ghost'}
                  onClick={() => setRepeatMode(r => !r)}
                  title="Repeat on specific days instead of a one-time date"
                  style={{ padding: '10px 12px' }}
                >
                  <Icon name="icon-calendar" size={14} /> Repeat
                </button>
                {!repeatMode && (
                  <input
                    className="form-input"
                    type="date"
                    value={newTaskDate}
                    min={todayISO()}
                    onChange={e => setNewTaskDate(e.target.value)}
                    title="Defaults to today — pick a future date to schedule it instead"
                    style={{ width: 150 }}
                  />
                )}
                <button
                  className="btn btn-primary"
                  style={{ padding: '10px 14px' }}
                  onClick={addTask}
                  disabled={savingTemplate || !newTask.trim() || (repeatMode && newTaskDays.length === 0)}
                >
                  <Icon name="icon-plus" size={14} />
                </button>
              </div>

              {repeatMode && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {DAY_LABELS.map((label, day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleNewTaskDay(day)}
                      className={newTaskDays.includes(day) ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
                      style={{ minWidth: 44 }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {upcomingTasks.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div className="section-label" style={{ fontSize: 11, marginBottom: 8 }}>Scheduled</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {upcomingTasks.map(task => (
                      <div key={task.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                        border: '1.5px dashed var(--border)',
                      }}>
                        <span style={{ flex: 1, fontSize: 13 }}>{task.label}</span>
                        <span style={{ fontSize: 10, color: 'var(--ink-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
                          {formatScheduledDate(task.task_date)}
                        </span>
                        <button
                          onClick={() => deleteUpcomingTask(task.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)', padding: 0, display: 'flex', alignItems: 'center', opacity: 0.4 }}
                        >
                          <Icon name="icon-clear" size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
  <Icon name="pagedivider" size={85} />
</div>

          {/* Appointments */}
          <div className="card">
            <div className="card-body">
              <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>Schedule & Appointments</span>
              </div>

              {appointments.length === 0 ? (
              
        <EmptyState image={emptyPlanner} message="No appointments scheduled yet" />
    
            ) : (

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {appointments.map(appt => {
                    const hasNote = Boolean(noteMap[appt.id]);
                    return (
                      <div key={appt.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '12px 14px', borderRadius: 18,
                        background: 'var(--white)',
                        border: '1.5px solid var(--border)',
                      }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: 'var(--radius-sm)', flexShrink: 0,
                          background: 'var(--blush)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Icon name="icon-calendar" size={13} style={{ color: 'var(--pink-dark)' }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--ink)' }}>{appt.title}</div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--ink-muted)', marginTop: 2, fontFamily: "'IBM Plex Mono', monospace" }}>
                            {formatApptDate(appt.date_time)}
                          </div>
                        </div>
                        {hasNote && (
                          <button
                            onClick={() => openNoteFor(appt)}
                            title="View attached note"
                            style={{
                              background: 'var(--blush)',
                              border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Icon name="icon-notebook" size={13} style={{ color: 'var(--pink-dark)' }} />
                          </button>
                        )}
                        <button
                          onClick={() => deleteAppointment(appt.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)', padding: 0, display: 'flex', alignItems: 'center', opacity: 0.4 }}
                        >
                          <Icon name="icon-clear" size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  className="form-input"
                  placeholder="Appointment title…"
                  value={newApptTitle}
                  onChange={e => setNewApptTitle(e.target.value)}
                />
                    <div style={{ fontSize: 12, marginBottom: 4 }}>
                    Date & Time
                    </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="form-input"
                    type="datetime-local"
                    value={newApptDate}
                    onChange={e => setNewApptDate(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button
                    className="btn btn-primary"
                    style={{ padding: '10px 14px' }}
                    onClick={addAppointment}
                  >
                    <Icon name="icon-plus" size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>

        </section>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
  <Icon name="pagedivider" size={85} />
</div>

        {/* CHORES — interval-based, time-since-last-done */}
        <section>
          <Chores />
        </section>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
  <Icon name="pagedivider" size={85} />
</div>

        {/* LIFE EVENTS — temporary workspaces for big life stuff */}
        <section>
          <LifeEvents />
        </section>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
  <Icon name="pagedivider" size={85} />
</div>

        {/* APPOINTMENT NOTES PANEL */}

        <section>
          <AppointmentNotesPanel
            externalSelection={focusNote}
            onExternalSelectionConsumed={() => setFocusNote(null)}
            onNotesChanged={refreshNoteMap}
          />
        </section>

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
