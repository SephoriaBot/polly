import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import MoonWidget from "../components/MoonWidget";
import TodaySnapshot from "../components/TodaySnapshot";
import LowEnergyChecklist from "../components/LowEnergyChecklist";
import EnergyModeSwitch from "../components/EnergyModeSwitch";
import { useEnergy } from "../context/EnergyContext";
import emptyDash from '../assets/icons/empty-dashboard.png';
import WeatherBadge from '../components/WeatherBadge';
import Icon, { type IconName } from '../components/Icon';
import { useTheme } from '../context/ThemeContext';
import EmptyState from '../components/EmptyState';

interface Focus {
  id: string;
  title: string;
  estimated_minutes: number | null;
  completed: boolean;
  date: string;
  carried_over: boolean;
  priority: boolean;
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

function StitchDivider() {
  return (
    <div className="stitch-divider">
      <span className="line" />
      <span className="mark" />
      <span className="line" />
    </div>
  );
}

export default function Dashboard({ onNavigate }: { onNavigate?: (page: string, tab?: string) => void }) {
  const { theme } = useTheme();
  const { mode } = useEnergy();
  const [focuses, setFocuses] = useState<Focus[]>([]);
  const [newFocus, setNewFocus] = useState('');
  const [newFocusMins, setNewFocusMins] = useState('');
  const [addingFocus, setAddingFocus] = useState(false);

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayName = DAY_NAMES[new Date().getDay()];

  useEffect(() => {
    loadAll();
  }, []);

  async function carryOverFocuses() {
  await supabase.from('focuses')
    .update({ date: todayStr, carried_over: true })
    .lt('date', todayStr)
    .eq('completed', false);
}

async function loadAll() {
  await carryOverFocuses();
  const { data } = await supabase.from('focuses').select('*').eq('date', todayStr).order('created_at');
  setFocuses(data || []);
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

  async function toggleFocusPriority(focus: Focus) {
    const newPriority = !focus.priority;
    setFocuses(prev => prev.map(f => f.id === focus.id ? { ...f, priority: newPriority } : f));
    await supabase.from('focuses').update({ priority: newPriority }).eq('id', focus.id);
  }

  async function deleteFocus(id: string) {
    await supabase.from('focuses').delete().eq('id', id);
    setFocuses(prev => prev.filter(f => f.id !== id));
  }

  const completedFocuses = focuses.filter(f => f.completed).length;
  const sortedFocuses = [...focuses].sort((a, b) => Number(a.completed) - Number(b.completed) || Number(b.priority) - Number(a.priority));

  return (
    <div>
      <div className="page-header dash-greeting">
  <div>
    <div className="title-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <h1>{getGreeting()}</h1>
      <MoonWidget compact />
    </div>
    <div className="dash-subdate">
      {todayName}, {new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
    </div>
    {/* WEATHER BADGE MINI WIDGET */}
    <WeatherBadge />
    <EnergyModeSwitch />
  </div>
</div>


      <div className="page-body">

        {mode !== 'normal' ? (
          <>
            {/* ── NO ENERGY MODE ── reduced to starred priority tasks + basics */}
            <section>
              <LowEnergyChecklist onNavigate={onNavigate} />
            </section>

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <Icon name="pagedivider" size={85} />
            </div>
            <section style={{ marginTop: 4 }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-muted)', marginBottom: 8 }}>
                Also on your radar
              </div>
              <TodaySnapshot onNavigate={onNavigate} />
            </section>
          </>
        ) : (
        <>

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
            
        <EmptyState image={emptyDash} message="No focuses set for today." size={65} />
    
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sortedFocuses.map(f => (
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
                          width: 24, height: 24, flexShrink: 0,
                          border: 'none', background: 'none', padding: 0,
                          cursor: 'pointer', display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        {f.completed
                          ? <Icon name={theme === 'light' ? 'full_sun' : 'full_moon'} size={22} style={{ color: 'var(--pink-dark)' }} />
                          : <Icon name={theme === 'light' ? 'empty_sun' : 'empty_moon'} size={22} style={{ color: 'var(--border)' }} />
                        }
                      </button>

                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '0.88rem', fontWeight: 600,
                      color: f.completed ? 'var(--ink-muted)' : 'var(--ink)',
                      textDecoration: f.completed ? 'line-through' : 'none',
                    }}>
                      {f.title}
                    </div>

                    {f.carried_over && !f.completed && (
  <div style={{ fontSize: '0.7rem', color: 'var(--pink-dark)', fontWeight: 700, marginTop: 2 }}>
    Not finished!
  </div>
)}
                    {f.estimated_minutes && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginTop: 2, fontFamily: 'IBM Plex Mono, monospace' }}>
                        Est. {f.estimated_minutes} min
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => toggleFocusPriority(f)}
                    aria-label={f.priority ? 'Unstar priority' : 'Mark as priority'}
                    title={f.priority ? 'Priority focus' : 'Mark as priority'}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      display: 'flex', alignItems: 'center', flexShrink: 0,
                      fontSize: '1.15rem', lineHeight: 1,
                      color: f.priority ? 'var(--gold)' : 'var(--border)',
                    }}
                  >
                    {f.priority ? '★' : '☆'}
                  </button>

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

     <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
  <Icon name="pagedivider" size={85} />
</div>

        {/* ── TODAY SNAPSHOT ── pulls live from chores, appointments, and money */}
        <section style={{ marginTop: 4 }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-muted)', marginBottom: 8 }}>
            Also on your radar
          </div>
          <TodaySnapshot onNavigate={onNavigate} />
        </section>
        </>
        )}
      </div>
    </div>
  );
}