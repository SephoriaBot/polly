import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

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

interface Glance {
  plants: number;
  pets: number;
  recipes: number;
  groceryItems: number;
}

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];


function getGreeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Still up?';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Winding down';
}

function Sprig() {
  return (
    <svg className="sprig" width="30" height="30" viewBox="0 0 30 30" fill="none">
      <path d="M15 27 C14 19 14 12 15 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M15 18 C12 16 9 16 7 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M15 12 C18 10 20 10 22 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="15" cy="4" r="2.2" fill="currentColor" />
    </svg>
  );
}

function StitchDivider() {
  return (
    <div className="stitch-divider">
      <span className="line" />
      <span className="mark" />
      <span className="line" />
    </div>
  );
}

export default function Dashboard({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [focuses, setFocuses] = useState<Focus[]>([]);
  const [todayMeals, setTodayMeals] = useState<MealEntry[]>([]);
  const [glance, setGlance] = useState<Glance>({ plants: 0, pets: 0, recipes: 0, groceryItems: 0 });
  const [newFocus, setNewFocus] = useState('');
  const [newFocusMins, setNewFocusMins] = useState('');
  const [addingFocus, setAddingFocus] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayName = DAY_NAMES[new Date().getDay()];

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const [focusRes, mealsRes, plantsRes, petsRes, recipesRes, groceryRes] = await Promise.all([
      supabase.from('focuses').select('*').eq('date', todayStr).order('created_at'),
      supabase.from('week_plans').select('meal_type, meal_name').eq('day', todayName),
      supabase.from('garden_plants').select('id', { count: 'exact', head: true }),
      supabase.from('pets').select('id', { count: 'exact', head: true }),
      supabase.from('recipes').select('id', { count: 'exact', head: true }),
      supabase.from('grocery_items').select('id', { count: 'exact', head: true }).eq('checked', false),
    ]);

    setFocuses(focusRes.data || []);
    setTodayMeals(mealsRes.data || []);
    setGlance({
      plants: plantsRes.count || 0,
      pets: petsRes.count || 0,
      recipes: recipesRes.count || 0,
      groceryItems: groceryRes.count || 0,
    });
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

  const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];
  const sortedMeals = [...todayMeals].sort(
    (a, b) => MEAL_ORDER.indexOf(a.meal_type.toLowerCase()) - MEAL_ORDER.indexOf(b.meal_type.toLowerCase())
  );

  const completedFocuses = focuses.filter(f => f.completed).length;

  return (
    <div>
      <div className="page-header dash-greeting">
        <div>
          <h1>{getGreeting()}</h1>
          <div className="dash-subdate">
            {todayName}, {new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
          </div>
        </div>
        <Sprig />
      </div>

      <div className="page-body">

        {/* ── AT A GLANCE ── */}
        <section>
          <div className="section-label">At a Glance</div>
         <div className="dashboard-grid">
  <div className="glance-wrap">
    <div className="card stat-card glance-card" onClick={() => onNavigate('plants')}>
      <div className="glance-value">{glance.plants}</div>
      <div className="glance-label">Plants</div>
    </div>
  </div>
  <div className="glance-wrap">
    <div className="card stat-card glance-card" onClick={() => onNavigate('pets')}>
      <div className="glance-value">{glance.pets}</div>
      <div className="glance-label">Pets</div>
    </div>
  </div>
  <div className="glance-wrap">
    <div className="card stat-card glance-card" onClick={() => onNavigate('recipes')}>
      <div className="glance-value">{glance.recipes}</div>
      <div className="glance-label">Recipes</div>
    </div>
  </div>
  <div className="glance-wrap">
    <div className="card stat-card glance-card" onClick={() => onNavigate('grocery')}>
      <div className="glance-value">{glance.groceryItems}</div>
      <div className="glance-label">On the List</div>
    </div>
  </div>
</div>

        </section>

        <StitchDivider />

        {/* ── TODAY'S FOCUS ── */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>
              Today's Focus
              {focuses.length > 0 && (
                <span style={{ marginLeft: 8, fontWeight: 600, color: 'var(--pink-dark)', fontSize: '0.65rem' }}>
                  {completedFocuses}/{focuses.length} done
                </span>
              )}
            </div>
            <button
              onClick={() => setAddingFocus(true)}
              style={{
                padding: '4px 10px', borderRadius: 12,
                background: 'var(--blush)', border: '1.5px solid var(--border)',
                color: 'var(--pink-dark)', fontSize: '0.7rem', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace',
              }}
            >
              + Add
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
                placeholder="What's the focus?"
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
              No focuses set for today — add one to get started
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
                    aria-label={f.completed ? 'Mark not done' : 'Mark done'}
                    style={{
                      width: 20, height: 20, borderRadius: '50%',
                      border: `2px solid ${f.completed ? 'var(--pink-dark)' : 'var(--border)'}`,
                      background: f.completed ? 'var(--pink-dark)' : 'transparent',
                      cursor: 'pointer', flexShrink: 0, padding: 0,
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '0.88rem', fontWeight: 600,
                      color: f.completed ? 'var(--ink-muted)' : 'var(--ink)',
                      textDecoration: f.completed ? 'line-through' : 'none',
                    }}>
                      {f.title}
                    </div>
                    {f.estimated_minutes && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginTop: 2, fontFamily: 'IBM Plex Mono, monospace' }}>
                        Est. {f.estimated_minutes} min
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => deleteFocus(f.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--ink-muted)', fontSize: '0.65rem', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      fontFamily: 'IBM Plex Mono, monospace', padding: '2px 4px',
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <StitchDivider />

        {/* ── TODAY'S MEALS ── */}
        <section>
          <div className="section-label">Today's Meals</div>
          {sortedMeals.length > 0 ? (
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
              {sortedMeals.map((m, i) => (
  <div
    key={i}
    onClick={() => onNavigate('planner')}
    style={{
      flexShrink: 0,
      background: 'var(--white)', border: '1.5px solid var(--border)',
      borderRadius: 18, padding: '10px 14px', minWidth: 120,
      cursor: 'pointer',
    }}
  >
    <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-muted)', marginBottom: 4, fontFamily: 'IBM Plex Mono, monospace' }}>
      {m.meal_type}
    </div>
    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>
      {m.meal_name}
    </div>
  </div>
))}

            </div>
          ) : (
            <div className="meals-empty">
              <span>Nothing planned for today yet</span>
              <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('planner')}>Plan meals</button>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
