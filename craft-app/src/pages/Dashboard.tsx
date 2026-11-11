import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import MoonWidget from "../components/MoonWidget";
import TodaySnapshot from "../components/TodaySnapshot";
import LowEnergyChecklist from "../components/LowEnergyChecklist";
import { useEnergy } from "../context/EnergyContext";
import emptyDash from '../assets/icons/empty-dashboard.png';
import WeatherBadge from '../components/WeatherBadge';
import EmptyState from '../components/EmptyState';
import { Polly } from '../lib';
import { getPollyMessage } from '../lib/pollyMessages';
import PollyBubble from '../components/PollyBubble';
import CheckMark from '../components/CheckMark';
import { triggerActionEvent } from '../lib/questSystem';
import QuestBoard from '../components/QuestBoard';
import DayPlanCard from '../components/DayPlanCard';
import { useAuth } from '../context/AuthContext';


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

export default function Dashboard({ onNavigate }: { onNavigate?: (page: string, tab?: string) => void }) {
  const { mode, setMode } = useEnergy();
  const { user } = useAuth();
  const [focuses, setFocuses] = useState<Focus[]>([]);
  const [newFocus, setNewFocus] = useState('');
  const [newFocusMins, setNewFocusMins] = useState('');
  const [addingFocus, setAddingFocus] = useState(false);

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayName = DAY_NAMES[new Date().getDay()];
  
  const neutralMessage = useMemo(() => getPollyMessage('neutral'), []);
  const yawningMessage = useMemo(() => getPollyMessage('yawning'), []);


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
    const newCompleted = !focus.completed;
    const { data } = await supabase.from('focuses')
      .update({ completed: newCompleted })
      .eq('id', focus.id)
      .select().single();
    if (data) setFocuses(prev => prev.map(f => f.id === focus.id ? data : f));
    if (newCompleted) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) triggerActionEvent(user.id, 'focus_completed');
    }
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
      <header className="page-header">
        <div>
          <h1>{getGreeting()}</h1>
          <div className="page-subtitle">
            {todayName}, {new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
          </div>
        </div>
        <button
          className={`pill-toggle${mode !== 'normal' ? ' is-on' : ''}`}
          onClick={() => setMode(mode === 'normal' ? 'noEnergy' : 'normal')}
          aria-pressed={mode !== 'normal'}
        >
          {mode === 'normal' ? 'Low energy day?' : 'Back to normal'}
        </button>
      </header>

      <div className="chips">
        <WeatherBadge />
        <MoonWidget compact />
      </div>

      <div className="page-body">
        {mode !== 'normal' ? (
          <>
            <section>
              <LowEnergyChecklist onNavigate={onNavigate} />
            </section>

            <div className="polly-stage">
              {yawningMessage && <PollyBubble message={yawningMessage} size="medium" />}
              <Polly mood="yawning" size="medium" />
            </div>

            {user && (
              <section>
                <QuestBoard userId={user.id} />
              </section>
            )}
          </>
        ) : (
          <>
            <div className="polly-stage">
              {neutralMessage && <PollyBubble message={neutralMessage} size="medium" />}
              <Polly mood="neutral" size="medium" />
            </div>

            <section>
              <div className="section-head">
                <div className="section-label">
                  Today&apos;s Focus
                  {focuses.length > 0 && (
                    <span className="section-count">{completedFocuses}/{focuses.length} done</span>
                  )}
                </div>
                <button className="pill-btn" onClick={() => setAddingFocus(true)}>+ Add</button>
              </div>

              {addingFocus && (
                <div className="form-panel">
                  <input
                    className="form-input"
                    placeholder="What's the focus?"
                    value={newFocus}
                    onChange={e => setNewFocus(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addFocus()}
                  />
                  <input
                    className="form-input"
                    placeholder="Est. minutes (optional)"
                    value={newFocusMins}
                    onChange={e => setNewFocusMins(e.target.value)}
                    type="number"
                  />
                  <div className="form-actions">
                    <button className="btn btn-primary" onClick={addFocus}>Save</button>
                    <button className="btn btn-ghost" onClick={() => setAddingFocus(false)}>Cancel</button>
                  </div>
                </div>
              )}

              {focuses.length === 0 && !addingFocus ? (
                <EmptyState image={emptyDash} message="No focuses set for today." size={70} />
              ) : (
                <div className="row-list">
                  {sortedFocuses.map(f => (
                    <div key={f.id} className={`row-item${f.completed ? ' is-done' : ''}`}>
                      <button
                        className="row-check"
                        onClick={() => toggleFocus(f)}
                        aria-label={f.completed ? 'Mark not done' : 'Mark done'}
                      >
                        <CheckMark completed={f.completed} size={24} />
                      </button>

                      <div className="row-text">
                        <div className="row-title">{f.title}</div>
                        {f.carried_over && !f.completed && (
                          <div className="row-note">Not finished!</div>
                        )}
                        {f.estimated_minutes && (
                          <div className="row-meta">Est. {f.estimated_minutes} min</div>
                        )}
                      </div>

                      <button
                        className={`row-icon-btn row-star${f.priority ? ' is-on' : ''}`}
                        onClick={() => toggleFocusPriority(f)}
                        aria-label={f.priority ? 'Unstar priority' : 'Mark as priority'}
                      >
                        {f.priority ? '★' : '☆'}
                      </button>
                      <button
                        className="row-icon-btn"
                        onClick={() => deleteFocus(f.id)}
                        aria-label="Remove focus"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <DayPlanCard onNavigate={onNavigate} />

            <section>
              <div className="section-label">Also on your radar</div>
              <TodaySnapshot onNavigate={onNavigate} />
            </section>

            {user && (
              <section>
                <QuestBoard userId={user.id} />
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}