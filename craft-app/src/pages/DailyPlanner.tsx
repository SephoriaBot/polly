import { useEffect, useState } from 'react';
import { Plus, X, RotateCcw, Calendar, ShoppingCart, Heart } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DailyTask {
  id: string;
  label: string;
  done: boolean;
  created_at: string;
}

interface Appointment {
  id: string;
  title: string;
  date_time: string;
  created_at: string;
}

interface PlannerItem {
  id: string;
  type: 'need' | 'want';
  label: string;
  done: boolean;
  created_at: string;
}

interface Spark {
  id: number;
  x: number;
  y: number;
  color: string;
}

const SPARK_COLORS = [
  "#FFD6A5", // soft peach
  "#FFE8A3", // warm cream yellow
  "#F7D7A8", // light apricot
  "#FFE1B3", // honey cream
  "#EFD3A2", // muted gold
  "#FFF1C9"  // soft buttery cream
];

export default function DailyPlanner() {
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [plannerItems, setPlannerItems] = useState<PlannerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState('');
  const [newApptTitle, setNewApptTitle] = useState('');
  const [newApptDate, setNewApptDate] = useState('');
  const [newNeed, setNewNeed] = useState('');
  const [newWant, setNewWant] = useState('');
  const [sparks, setSparks] = useState<Spark[]>([]);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [tasksRes, apptsRes, plannerRes] = await Promise.all([
      supabase.from('daily_tasks').select('*').order('created_at'),
      supabase.from('appointments').select('*').order('date_time'),
      supabase.from('planner_items').select('*').order('created_at'),
    ]);
    setTasks(tasksRes.data ?? []);
    setAppointments(apptsRes.data ?? []);
    setPlannerItems(plannerRes.data ?? []);
    setLoading(false);
  }

  async function addTask() {
    const label = newTask.trim();
    if (!label) return;
    const { data } = await supabase
      .from('daily_tasks')
      .insert({ label, done: false })
      .select()
      .single();
    if (data) setTasks(prev => [...prev, data]);
    setNewTask('');
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
    }
  }

  async function deleteTask(id: string) {
    await supabase.from('daily_tasks').delete().eq('id', id);
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  async function resetAll() {
    const { error } = await supabase
      .from('daily_tasks')
      .update({ done: false })
      .in('id', tasks.map(t => t.id));
    if (error) { console.error(error); return; }
    setTasks(prev => prev.map(t => ({ ...t, done: false })));
  }

  async function addAppointment() {
  const title = newApptTitle.trim();
  if (!title || !newApptDate) return;
  // newApptDate is a naive "local wall clock" string from the
  // datetime-local input (e.g. "2026-07-01T14:00"). Convert it to a
  // real UTC ISO string so Postgres stores the correct absolute instant.
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
    await supabase.from('appointments').delete().eq('id', id);
    setAppointments(prev => prev.filter(a => a.id !== id));
  }

  function formatApptDate(dateStr: string) {
    return new Date(dateStr).toLocaleString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  }

  async function addPlannerItem(type: 'need' | 'want') {
    const label = (type === 'need' ? newNeed : newWant).trim();
    if (!label) return;
    const { data } = await supabase
      .from('planner_items')
      .insert({ type, label, done: false })
      .select()
      .single();
    if (data) setPlannerItems(prev => [...prev, data]);
    if (type === 'need') setNewNeed(''); else setNewWant('');
  }

  async function togglePlannerItem(item: PlannerItem) {
    const newDone = !item.done;
    await supabase.from('planner_items').update({ done: newDone }).eq('id', item.id);
    setPlannerItems(prev => prev.map(p => p.id === item.id ? { ...p, done: newDone } : p));
  }

  async function deletePlannerItem(id: string) {
    await supabase.from('planner_items').delete().eq('id', id);
    setPlannerItems(prev => prev.filter(p => p.id !== id));
  }

  const doneCount = tasks.filter(t => t.done).length;
  const allDone = tasks.length > 0 && doneCount === tasks.length;

  const needs = plannerItems.filter(p => p.type === 'need');
  const wants = plannerItems.filter(p => p.type === 'want');

  return (
    <div>
      {sparks.map(spark => (
        <SparkParticle key={spark.id} x={spark.x} y={spark.y} color={spark.color} />
      ))}

      <div className="page-header">
        <div>
          <h2>Daily Planner ✨</h2>
          <p style={{ color: allDone ? 'var(--cream)' : undefined }}>
            {allDone ? '🌸 All done! What a day~' : `${doneCount} of ${tasks.length} done today`}
          </p>
        </div>
        {tasks.length > 0 && (
          <button className="btn btn-ghost" onClick={resetAll}>
            <RotateCcw size={14} /> Reset
          </button>
        )}
      </div>

      <div className="page-body">

        {/* Progress bar */}
        {tasks.length > 0 && (
          <div style={{ marginBottom: 24, maxWidth: 560 }}>
            <div style={{
              height: 10,
              borderRadius: 99,
              background: 'var(--border)',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${(doneCount / tasks.length) * 100}%`,
                background: allDone
                  ? 'linear-gradient(90deg, #FFF1C9, #FFD6A5)'
                  : 'linear-gradient(90deg, #F7D7A8, #FFE8A3)',
                borderRadius: 99,
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>
        )}

        <div className="grid-2" style={{ alignItems: 'start' }}>

          {/* Dailies checklist */}
          <div className="card" style={{ borderRadius: 18, border: '1.5px solid var(--border)' }}>
            <div className="card-body">
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16
              }}>
                <span style={{ fontSize: '1.1rem' }}>🌿</span>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  My Dailies
                </span>
              </div>

              {loading ? (
                <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Loading…</p>
              ) : tasks.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                  No tasks yet — add your first daily below 🌱
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {tasks.map(task => (
                    <div
                      key={task.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 14px', borderRadius: 14,
                        background: task.done
                          ? 'linear-gradient(135deg, #FFE1B3, #EFD3A2)'
                          : 'var(--cream)',
                        border: `1.5px solid ${task.done ? '#EFD3A2' : 'var(--border)'}`,
                        transition: 'all 0.2s ease',
                        boxShadow: task.done ? '0 1px 6px rgba(201,166,240,0.15)' : 'none',
                      }}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={e => toggleTask(task, e)}
                        style={{
                          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                          border: `2px solid ${task.done ? '#EFD3A2' : 'var(--border)'}`,
                          background: task.done
                            ? 'linear-gradient(135deg, #EFD3A2, #FFE8A3)'
                            : 'var(--white)',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s ease',
                          boxShadow: task.done ? '0 1px 4px rgba(201,166,240,0.4)' : 'none',
                        }}
                      >
                        {task.done && <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>✓</span>}
                      </button>

                      <span style={{
                        flex: 1, fontSize: '0.88rem',
                        color: task.done ? '#B98A5A' : 'var(--ink-muted)',
                        textDecoration: task.done ? 'line-through' : 'none',
                        transition: 'all 0.2s ease',
                      }}>
                        {task.label}
                      </span>

                      <button
                        onClick={() => deleteTask(task.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)', padding: 0, display: 'flex', alignItems: 'center', opacity: 0.4 }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  placeholder="Add a daily task…"
                  value={newTask}
                  onChange={e => setNewTask(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTask()}
                  style={{ flex: 1, borderRadius: 12 }}
                />
                <button
                  className="btn btn-primary"
                  style={{ padding: '8px 14px', borderRadius: 12 }}
                  onClick={addTask}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Appointments */}
          <div className="card" style={{ borderRadius: 18, border: '1.5px solid var(--border)' }}>
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: '1.1rem' }}>🌸</span>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Upcoming
                </span>
              </div>

              {appointments.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                  Nothing scheduled yet 🍃
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {appointments.map(appt => (
                    <div key={appt.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px', borderRadius: 14,
                      background: 'var(--cream)',
                      border: '1.5px solid var(--border)',
                    }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 10, flexShrink: 0,
                        background: 'linear-gradient(135deg, #FFE1B3, #EFD3A2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Calendar size={13} style={{ color: '#B98A5A' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--ink-muted)' }}>{appt.title}</div>
                        <div style={{ fontSize: '0.74rem', color: '#B98A5A', marginTop: 2 }}>{formatApptDate(appt.date_time)}</div>
                      </div>
                      <button
                        onClick={() => deleteAppointment(appt.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)', padding: 0, display: 'flex', alignItems: 'center', opacity: 0.4 }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  className="form-input"
                  placeholder="Appointment title…"
                  value={newApptTitle}
                  onChange={e => setNewApptTitle(e.target.value)}
                  style={{ borderRadius: 12 }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="form-input"
                    type="datetime-local"
                    value={newApptDate}
                    onChange={e => setNewApptDate(e.target.value)}
                    style={{ flex: 1, borderRadius: 12 }}
                  />
                  <button
                    className="btn btn-primary"
                    style={{ padding: '8px 14px', borderRadius: 12 }}
                    onClick={addAppointment}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Needs / Wants */}
        <div className="grid-2" style={{ alignItems: 'start', marginTop: 20 }}>

          {/* Things We Need */}
          <div className="card" style={{ borderRadius: 18, border: '1.5px solid var(--border)' }}>
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: '1.1rem' }}>🛒</span>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Things We Need
                </span>
              </div>

              {needs.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                  Nothing urgent right now 🌱
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {needs.map(item => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 14px', borderRadius: 14,
                        background: item.done
                          ? 'linear-gradient(135deg, #FFE1B3, #EFD3A2)'
                          : 'var(--cream)',
                        border: `1.5px solid ${item.done ? '#EFD3A2' : 'var(--border)'}`,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <button
                        onClick={() => togglePlannerItem(item)}
                        style={{
                          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                          border: `2px solid ${item.done ? '#EFD3A2' : 'var(--border)'}`,
                          background: item.done
                            ? 'linear-gradient(135deg, #EFD3A2, #FFE8A3)'
                            : 'var(--white)',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {item.done && <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>✓</span>}
                      </button>

                      <span style={{
                        flex: 1, fontSize: '0.88rem',
                        color: item.done ? '#B98A5A' : 'var(--ink-muted)',
                        textDecoration: item.done ? 'line-through' : 'none',
                      }}>
                        {item.label}
                      </span>

                      <button
                        onClick={() => deletePlannerItem(item.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)', padding: 0, display: 'flex', alignItems: 'center', opacity: 0.4 }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  placeholder="Add a priority purchase…"
                  value={newNeed}
                  onChange={e => setNewNeed(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addPlannerItem('need')}
                  style={{ flex: 1, borderRadius: 12 }}
                />
                <button
                  className="btn btn-primary"
                  style={{ padding: '8px 14px', borderRadius: 12 }}
                  onClick={() => addPlannerItem('need')}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Things We Want */}
          <div className="card" style={{ borderRadius: 18, border: '1.5px solid var(--border)' }}>
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: '1.1rem' }}>💛</span>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Things We Want
                </span>
              </div>

              {wants.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                  Nothing on the wishlist yet 🌸
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {wants.map(item => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 14px', borderRadius: 14,
                        background: item.done
                          ? 'linear-gradient(135deg, #FFF1C9, #F7D7A8)'
                          : 'var(--cream)',
                        border: `1.5px solid ${item.done ? '#f0d9ff' : 'var(--border)'}`,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <button
                        onClick={() => togglePlannerItem(item)}
                        style={{
                          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                          border: `2px solid ${item.done ? '#f0d9ff' : 'var(--border)'}`,
                          background: item.done
                            ? 'linear-gradient(135deg, #F7D7A8, #FFD6A5)'
                            : 'var(--white)',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {item.done && <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>✓</span>}
                      </button>

                      <span style={{
                        flex: 1, fontSize: '0.88rem',
                        color: item.done ? '#B98A5A' : 'var(--ink-muted)',
                        textDecoration: item.done ? 'line-through' : 'none',
                      }}>
                        {item.label}
                      </span>

                      <button
                        onClick={() => deletePlannerItem(item.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)', padding: 0, display: 'flex', alignItems: 'center', opacity: 0.4 }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  placeholder="Add something to save up for…"
                  value={newWant}
                  onChange={e => setNewWant(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addPlannerItem('want')}
                  style={{ flex: 1, borderRadius: 12 }}
                />
                <button
                  className="btn btn-primary"
                  style={{ padding: '8px 14px', borderRadius: 12 }}
                  onClick={() => addPlannerItem('want')}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>

        </div>
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
