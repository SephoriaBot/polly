import { useEffect, useState } from 'react';
import { Leaf, BookOpen, PawPrint, ShoppingCart, Archive, Sparkles, Plus, Check, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DashboardProps {
  onNavigate: (page: string) => void;
}

interface ReminderItem {
  id: string;
  label: string;
  detail: string;
  dueDate: Date;
  page: string;
  emoji: string;
}

interface Focus {
  id: string;
  title: string;
  estimated_minutes: number | null;
  completed: boolean;
  date: string;
}

interface MealEntry {
  meal_type: string;
  meal_name: string;
}

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [stats, setStats] = useState({
    plants: 0,
    recipes: 0,
    pets: 0,
    groceryItems: 0,
  });
  const [soonReminders, setSoonReminders] = useState<ReminderItem[]>([]);
  const [laterReminders, setLaterReminders] = useState<ReminderItem[]>([]);
  const [focuses, setFocuses] = useState<Focus[]>([]);
  const [todayMeals, setTodayMeals] = useState<MealEntry[]>([]);
  const [newFocus, setNewFocus] = useState('');
  const [newFocusMins, setNewFocusMins] = useState('');
  const [addingFocus, setAddingFocus] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayName = DAY_NAMES[new Date().getDay()];

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const [
      plantsRes, recipesRes, petsRes, groceryRes,
      vaccinationsRes, apptsRes, focusRes, mealsRes,
    ] = await Promise.all([
      supabase.from('garden_plants').select('id', { count: 'exact', head: true }),
      supabase.from('recipes').select('id', { count: 'exact', head: true }),
      supabase.from('pets').select('id, name'),
      supabase.from('grocery_items').select('id', { count: 'exact', head: true }).eq('checked', false),
      supabase.from('pet_vaccinations').select('id, name, pet_id, next_due'),
      supabase.from('appointments').select('id, title, date_time'),
      supabase.from('focuses').select('*').eq('date', todayStr).order('created_at'),
      supabase.from('week_plans').select('meal_type, meal_name').eq('day', todayName),
    ]);

    const pets = petsRes.data || [];
    const vaccinations = vaccinationsRes.data || [];
    const today = new Date();

    setStats({
      plants: plantsRes.count || 0,
      recipes: recipesRes.count || 0,
      pets: pets.length,
      groceryItems: groceryRes.count || 0,
    });

    setFocuses(focusRes.data || []);
    setTodayMeals(mealsRes.data || []);

    const allReminders: ReminderItem[] = [];
    vaccinations.forEach(v => {
      if (!v.next_due) return;
      const pet = pets.find(p => p.id === v.pet_id);
      allReminders.push({
        id: `vax-${v.id}`,
        label: `${pet?.name ?? 'Pet'} — ${v.name}`,
        detail: new Date(v.next_due) < today ? 'vaccine overdue' : 'vaccine due',
        dueDate: new Date(v.next_due),
        page: 'pets',
        emoji: '💉',
      });
    });
    (apptsRes.data ?? []).forEach(a => {
      allReminders.push({
        id: `appt-${a.id}`,
        label: a.title,
        detail: 'appointment',
        dueDate: new Date(a.date_time),
        page: 'dailyplanner',
        emoji: '📅',
      });
    });

    const soon = allReminders.filter(r => (r.dueDate.getTime() - today.getTime()) / 86400000 <= 30)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    const later = allReminders.filter(r => (r.dueDate.getTime() - today.getTime()) / 86400000 > 30)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    setSoonReminders(soon);
    setLaterReminders(later);
  }

  async function addFocus() {
    if (!newFocus.trim()) return;
    const { data } = await supabase.from('focuses').insert({
      title: newFocus.trim(),
      estimated_minutes: newFocusMins ? parseInt(newFocusMins) : null,
      date: todayStr,
      completed: false,
    }).select().single();
    if (data) setFocuses(prev => [...prev, data]);
    setNewFocus('');
    setNewFocusMins('');
    setAddingFocus(false);
  }

  async function toggleFocus(focus: Focus) {
    const { data } = await supabase.from('focuses')
      .update({ completed: !focus.completed })
      .eq('id', focus.id)
      .select().single();
    if (data) setFocuses(prev => prev.map(f => f.id === focus.id ? data : f));
  }

  async function deleteFocus(id: string) {
    await supabase.from('focuses').delete().eq('id', id);
    setFocuses(prev => prev.filter(f => f.id !== id));
  }

  function formatDueLabel(date: Date) {
    const today = new Date();
    const diffDays = Math.round((date.getTime() - today.getTime()) / 86400000);
    if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'tomorrow';
    if (diffDays <= 30) return `in ${diffDays}d`;
    const isNextYear = date.getFullYear() !== today.getFullYear();
return date.toLocaleDateString(undefined, {
  month: 'short',
  day: 'numeric',
  year: isNextYear ? 'numeric' : undefined,
});

  }

  const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];
  const sortedMeals = [...todayMeals].sort(
    (a, b) => MEAL_ORDER.indexOf(a.meal_type.toLowerCase()) - MEAL_ORDER.indexOf(b.meal_type.toLowerCase())
  );

  const completedFocuses = focuses.filter(f => f.completed).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{todayName} · {new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</h1>
        </div>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>


        {/* ── TODAY'S FOCUS ── */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>
              ✨ Today's Focus
              {focuses.length > 0 && (
                <span style={{ marginLeft: 8, fontWeight: 600, color: 'var(--pink-dark)', fontSize: '0.65rem' }}>
                  {completedFocuses}/{focuses.length} done
                </span>
              )}
            </div>
            <button
              onClick={() => setAddingFocus(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 12,
                background: 'var(--blush)', border: '1.5px solid var(--border)',
                color: 'var(--pink-dark)', fontSize: '0.7rem', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
              }}
            >
              <Plus size={11} /> Add
            </button>
          </div>

          {addingFocus && (
            <div style={{
              background: 'var(--white)', border: '1.5px solid var(--border)',
              borderRadius: 18, padding: 14, marginBottom: 10,
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <input
                className="form-input"
                placeholder="What's the focus? e.g. Bathroom Reset"
                value={newFocus}
                onChange={e => setNewFocus(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addFocus()}
                style={{ fontSize: '0.85rem' }}
              />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="form-input"
                  placeholder="Est. minutes (optional)"
                  value={newFocusMins}
                  onChange={e => setNewFocusMins(e.target.value)}
                  style={{ fontSize: '0.82rem', flex: 1 }}
                  type="number"
                />
                <button className="btn btn-primary btn-sm" onClick={addFocus}>Save</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setAddingFocus(false)}>Cancel</button>
              </div>
            </div>
          )}

          {focuses.length === 0 && !addingFocus ? (
            <div style={{
              background: 'var(--white)', border: '1.5px dashed var(--border)',
              borderRadius: 18, padding: '18px 16px', textAlign: 'center',
              color: 'var(--ink-muted)', fontSize: '0.82rem',
            }}>
              No focuses set for today — add one to get started 🌸
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {focuses.map(f => (
                <div
                  key={f.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: f.completed ? 'var(--blush)' : 'var(--white)',
                    border: `1.5px solid ${f.completed ? 'var(--pink-light)' : 'var(--border)'}`,
                    borderRadius: 18, padding: '12px 14px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <button
                    onClick={() => toggleFocus(f)}
                    style={{
                      width: 22, height: 22, borderRadius: '50%',
                      border: `2px solid ${f.completed ? 'var(--pink-dark)' : 'var(--border)'}`,
                      background: f.completed ? 'var(--pink-dark)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', flexShrink: 0,
                    }}
                  >
                    {f.completed && <Check size={12} color="white" />}
                  </button>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '0.88rem', fontWeight: 600,
                      color: f.completed ? 'var(--ink-muted)' : 'var(--ink)',
                      textDecoration: f.completed ? 'line-through' : 'none',
                    }}>
                      {f.title}
                    </div>
                    {f.estimated_minutes && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: 'var(--ink-muted)', marginTop: 2 }}>
                        <Clock size={10} /> Est. {f.estimated_minutes} min
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => deleteFocus(f.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)', fontSize: '0.75rem', padding: '2px 4px' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── TODAY'S MEALS ── */}
        {sortedMeals.length > 0 && (
          <section>
            <div className="section-label">Today's Meals</div>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
              {sortedMeals.map((m, i) => (
                <div
                  key={i}
                  style={{
                    flexShrink: 0,
                    background: 'var(--white)', border: '1.5px solid var(--border)',
                    borderRadius: 18, padding: '10px 14px', minWidth: 120,
                  }}
                >
                  <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-muted)', marginBottom: 4 }}>
                    {m.meal_type}
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>
                    {m.meal_name}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── UPCOMING REMINDERS ── */}
        {(soonReminders.length > 0 || laterReminders.length > 0) && (
          <section>
            <div className="section-label">Upcoming</div>

            {soonReminders.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--pink-dark)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Soon
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {soonReminders.map(r => (
                    <ReminderRow key={r.id} r={r} onNavigate={onNavigate} formatDueLabel={formatDueLabel} muted={false} />
                  ))}
                </div>
              </div>
            )}

            {laterReminders.length > 0 && (
              <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Later
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {laterReminders.map(r => (
                    <ReminderRow key={r.id} r={r} onNavigate={onNavigate} formatDueLabel={formatDueLabel} muted={true} />
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

      </div>
    </div>
  );
}

// ── MINI STAT CARD ──
function MiniStatCard({ emoji, label, value, addLabel, onAdd, onClick }: {
  emoji: string; label: string; value: number | null;
  addLabel?: string; onAdd?: () => void; onClick: () => void;
}) {
  return (
    <div
      className="card"
      style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
      onClick={onClick}
    >
      <div className="card-body" style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: '1.3rem' }}>{emoji}</span>
          {value !== null && (
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}>{value}</span>
          )}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
          {label}
        </div>
        {onAdd && (
          <button
            onClick={e => { e.stopPropagation(); onAdd(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: 10,
              background: 'var(--blush)', border: '1px solid var(--border)',
              color: 'var(--pink-dark)', fontSize: '0.65rem', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
            }}
          >
            <Plus size={9} /> {addLabel}
          </button>
        )}
      </div>
    </div>
  );
}

// ── REMINDER ROW ──
function ReminderRow({ r, onNavigate, formatDueLabel, muted }: {
  r: ReminderItem; onNavigate: (p: string) => void;
  formatDueLabel: (d: Date) => string; muted: boolean;
}) {
  return (
    <div
      onClick={() => onNavigate(r.page)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: muted ? 'var(--blush)' : 'var(--white)',
        border: '1.5px solid var(--border)',
        borderRadius: 14, padding: '9px 13px', cursor: 'pointer',
        fontSize: '0.82rem', opacity: muted ? 0.8 : 1,
      }}
    >
      <span style={{ fontSize: '1rem' }}>{r.emoji}</span>
      <span style={{ flex: 1, color: muted ? 'var(--ink-soft)' : 'var(--ink)' }}>
        {r.label} <span style={{ color: 'var(--ink-muted)' }}>· {r.detail}</span>
      </span>
      <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', whiteSpace: 'nowrap' }}>
        {formatDueLabel(r.dueDate)}
      </span>
    </div>
  );
}
