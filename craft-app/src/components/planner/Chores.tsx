// Chores.tsx
// Tier 1, item 4 (second chain): "Wash bedding → every 2 weeks → due today."
// This is deliberately a different model from daily_task_templates — those
// fire on fixed weekdays; chores here are driven by *time since last done*,
// per the doc: "chores can be based on time since last done, not arbitrary
// recurring schedules." Marking a chore done just stamps last_done_at; due
// status is always derived from that plus interval_days, never stored.

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/useToast';
import Icon, { type IconName } from '../Icon';
import EmptyState from '../EmptyState';
import checklistImg from '../../assets/illustrations/checklist.png';
import { type Chore as ChoreBase, statusFor } from '../../lib/chores';
import { useCreatureGrowth } from '../../creatures/CreatureGrowthContext';
import ChoreCleaningPlan from './ChoreCleaningPlan';
import { useAuth } from '../../context/AuthContext';
import { completeChoreQuest } from '../../lib/questSystem';

interface Chore extends ChoreBase {
  icon: IconName;
}

const CHORE_ICONS: IconName[] = ['cleaning-spray', 'washing-machine', 'sparkle-single', 'icon-trash2', 'clipboard-check'];

export default function Chores() {
  const { showToast } = useToast();
  const { notifyGrowth } = useCreatureGrowth();
  const { user } = useAuth();
  const [chores, setChores] = useState<Chore[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [intervalDays, setIntervalDays] = useState('7');
  const [estimatedMinutes, setEstimatedMinutes] = useState('10');
  const [icon, setIcon] = useState<IconName>('cleaning-spray');
  const [adding, setAdding] = useState(false);
  const [openChoreId, setOpenChoreId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('chores').select('*').order('created_at');
    setChores((data as Chore[]) ?? []);
    setLoading(false);
  }

  async function addChore() {
    const trimmed = name.trim();
    const interval = parseInt(intervalDays, 10);
    const minutes = parseInt(estimatedMinutes, 10) || 10;
    if (!trimmed || !interval || interval < 1) return;
    setAdding(true);
    const { data, error } = await supabase
      .from('chores')
      .insert({ name: trimmed, interval_days: interval, icon, last_done_at: null, estimated_minutes: minutes })
      .select()
      .single();
    setAdding(false);
    if (error) { showToast("Couldn't add that chore — try again?", 'error'); return; }
    if (data) setChores(prev => [...prev, data as Chore]);
    setName('');
    setIntervalDays('7');
    setEstimatedMinutes('10');
  }

  async function markDone(chore: Chore) {
    const nowIso = new Date().toISOString();
    setChores(prev => prev.map(c => c.id === chore.id ? { ...c, last_done_at: nowIso } : c));
    const { error } = await supabase.from('chores').update({ last_done_at: nowIso }).eq('id', chore.id);
    if (error) { showToast("Couldn't save that — try again?", 'error'); load(); return; }
    showToast(`${chore.name} — nice work! 🧺`);
    notifyGrowth();
    if (user) completeChoreQuest(user.id, chore.id);
  }

  async function removeChore(id: string) {
  const previous = chores;
  setChores(prev => prev.filter(c => c.id !== id));
  if (openChoreId === id) setOpenChoreId(null);

  const { data, error } = await supabase
    .from('chores')
    .delete()
    .eq('id', id)
    .select();

  if (error) {
    showToast(`Delete error: ${error.message}`, 'error');
    setChores(previous);
    return;
  }
  if (!data || data.length === 0) {
    showToast('Delete matched 0 rows', 'error');
    setChores(previous);
  }
}

  function toggleOpen(id: string) {
    setOpenChoreId(prev => (prev === id ? null : id));
  }

  const now = new Date();
  const sorted = [...chores].sort((a, b) => statusFor(b, now).overdueDays - statusFor(a, now).overdueDays);

  return (
    <div className="card">
      <div className="card-body">
        <div className="section-label">Chores</div>

        {loading ? (
          <p className="muted-text">Loading…</p>
        ) : sorted.length === 0 ? (
          <EmptyState image={checklistImg} message="No chores tracked yet. Add one below — Polly will remind you based on how long it's been, not a fixed schedule." />
        ) : (
          <div className="row-list subsection-end">
            {sorted.map(chore => {
              const status = statusFor(chore, now);
              const isOpen = openChoreId === chore.id;
              const isDue = status.tone === 'due';
              return (
                <div key={chore.id}>
                  <div
                    className={`row-item is-clickable${isOpen ? ' is-open' : ''}`}
                    onClick={() => toggleOpen(chore.id)}
                  >
                    <div className={`panel-icon${isDue ? ' is-due' : ''}`}>
                      <Icon name={chore.icon} size={18} />
                    </div>
                    <div className="row-text">
                      <div className="row-title">{chore.name}</div>
                      <div className={`row-meta${isDue ? ' is-due' : ''}`}>
                        {status.label} · every {chore.interval_days}d · ~{chore.estimated_minutes}min
                      </div>
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={(e) => { e.stopPropagation(); markDone(chore); }}
                    >
                      Done
                    </button>
                    <button
                      className="row-icon-btn"
                      onClick={(e) => { e.stopPropagation(); removeChore(chore.id); }}
                      aria-label="Remove chore"
                    >
                      ✕
                    </button>
                  </div>
                  <ChoreCleaningPlan choreId={chore.id} choreName={chore.name} isOpen={isOpen} />
                </div>
              );
            })}
          </div>
        )}

        <div className="stack">
          <div className="add-row">
            <input
              className="form-input grow"
              placeholder="Chore name (e.g. Wash bedding)…"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={addChore}
              disabled={adding || !name.trim()}
              aria-label="Add chore"
            >
              <Icon name="icon-plus" size={20} />
            </button>
          </div>
          <div className="add-row">
            <span className="inline-label">Every</span>
            <input
              className="form-input num-input"
              type="number"
              min={1}
              value={intervalDays}
              onChange={e => setIntervalDays(e.target.value)}
            />
            <span className="inline-label">days,</span>
            <input
              className="form-input num-input"
              type="number"
              min={1}
              value={estimatedMinutes}
              onChange={e => setEstimatedMinutes(e.target.value)}
            />
            <span className="inline-label">min</span>
          </div>
          <div className="icon-picker">
            {CHORE_ICONS.map(i => (
              <button
                key={i}
                className={`icon-choice${icon === i ? ' is-selected' : ''}`}
                onClick={() => setIcon(i)}
                aria-label={i}
              >
                <Icon name={i} size={22} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}