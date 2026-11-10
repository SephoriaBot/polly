import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import MoonWidget from "../components/MoonWidget";
import TodaySnapshot from "../components/TodaySnapshot";
import LowEnergyChecklist from "../components/LowEnergyChecklist";
import EnergyModeSwitch from "../components/EnergyModeSwitch";
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
import PageTabs, { type PageTab } from '../components/PageTabs';
import './Dashboard.css';


interface Focus {
  id: string;
  title: string;
  estimated_minutes: number | null;
  completed: boolean;
  date: string;
  carried_over: boolean;
  priority: boolean;
}

type DashTab = 'main' | 'radar';

const DASH_TABS: PageTab<DashTab>[] = [
  { key: 'main', label: 'Main', icon: 'icon-home' },
  { key: 'radar', label: 'Radar', icon: 'sparkle-single' },
];

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
  const { mode } = useEnergy();
  const { user } = useAuth();
  const [focuses, setFocuses] = useState<Focus[]>([]);
  const [newFocus, setNewFocus] = useState('');
  const [newFocusMins, setNewFocusMins] = useState('');
  const [addingFocus, setAddingFocus] = useState(false);
  const [tab, setTab] = useState<DashTab>('main');

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
    <div className="dash">
      <header className="dash-hero">
        <h1>{getGreeting()}</h1>
        <div className="dash-subdate">
          {todayName}, {new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
        </div>
        <div className="dash-chips">
          <WeatherBadge />
          <MoonWidget compact />
        </div>
        <EnergyModeSwitch />
      </header>

      <PageTabs tabs={DASH_TABS} active={tab} onChange={setTab} />

      <div className="dash-body">
        {tab === 'radar' ? (
          <section>
            <div className="dash-label">Also on your radar</div>
            <TodaySnapshot onNavigate={onNavigate} />
          </section>
        ) : mode !== 'normal' ? (
          <>
            <section>
              <LowEnergyChecklist onNavigate={onNavigate} />
            </section>

            <div className="dash-polly">
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
            <div className="dash-polly">
              {neutralMessage && <PollyBubble message={neutralMessage} size="medium" />}
              <Polly mood="neutral" size="medium" />
            </div>

            <section>
              <div className="dash-section-head">
                <div className="dash-label">
                  Today&apos;s Focus
                  {focuses.length > 0 && (
                    <span className="dash-count">{completedFocuses}/{focuses.length} done</span>
                  )}
                </div>
                <button className="dash-add" onClick={() => setAddingFocus(true)}>+ Add</button>
              </div>

              {addingFocus && (
                <div className="dash-form">
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
                  <div className="dash-form-actions">
                    <button className="btn btn-primary" onClick={addFocus}>Save</button>
                    <button className="btn btn-ghost" onClick={() => setAddingFocus(false)}>Cancel</button>
                  </div>
                </div>
              )}

              {focuses.length === 0 && !addingFocus ? (
                <EmptyState image={emptyDash} message="No focuses set for today." size={90} />
              ) : (
                <div className="dash-focus-list">
                  {sortedFocuses.map(f => (
                    <div key={f.id} className={`dash-focus${f.completed ? ' is-done' : ''}`}>
                      <button
                        className="dash-check"
                        onClick={() => toggleFocus(f)}
                        aria-label={f.completed ? 'Mark not done' : 'Mark done'}
                      >
                        <CheckMark completed={f.completed} size={30} />
                      </button>

                      <div className="dash-focus-text">
                        <div className="dash-focus-title">{f.title}</div>
                        {f.carried_over && !f.completed && (
                          <div className="dash-focus-note">Not finished!</div>
                        )}
                        {f.estimated_minutes && (
                          <div className="dash-focus-meta">Est. {f.estimated_minutes} min</div>
                        )}
                      </div>

                      <button
                        className={`dash-icon-btn dash-star${f.priority ? ' is-on' : ''}`}
                        onClick={() => toggleFocusPriority(f)}
                        aria-label={f.priority ? 'Unstar priority' : 'Mark as priority'}
                      >
                        {f.priority ? '★' : '☆'}
                      </button>
                      <button
                        className="dash-icon-btn"
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
