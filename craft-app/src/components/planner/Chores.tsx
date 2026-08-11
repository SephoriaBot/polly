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

interface Chore extends ChoreBase {
  icon: IconName;
}

const CHORE_ICONS: IconName[] = ['cleaning-spray', 'washing-machine', 'sparkle-single', 'trash-can', 'clipboard-check'];

export default function Chores() {
  const { showToast } = useToast();
  const [chores, setChores] = useState<Chore[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [intervalDays, setIntervalDays] = useState('7');
  const [estimatedMinutes, setEstimatedMinutes] = useState('10');
  const [icon, setIcon] = useState<IconName>('cleaning-spray');
  const [adding, setAdding] = useState(false);

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
  }

  async function removeChore(id: string) {
    setChores(prev => prev.filter(c => c.id !== id));
    await supabase.from('chores').delete().eq('id', id);
  }

  const now = new Date();
  const sorted = [...chores].sort((a, b) => statusFor(b, now).overdueDays - statusFor(a, now).overdueDays);

  return (
    <div className="card">
      <div className="card-body">
        <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Chores</span>
        </div>

        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Loading…</p>
        ) : sorted.length === 0 ? (
          <EmptyState image={checklistImg} message="No chores tracked yet. Add one below — Polly will remind you based on how long it's been, not a fixed schedule." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {sorted.map(chore => {
              const status = statusFor(chore, now);
              return (
                <div
                  key={chore.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 16,
                    background: 'var(--white)', border: '1.5px solid var(--border)',
                  }}
                >
                  <div style={{
                    width: 30, height: 30, borderRadius: 'var(--radius-sm)', flexShrink: 0,
                    background: status.tone === 'due' ? 'var(--blush)' : 'var(--cream)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon name={chore.icon} size={15} style={{ color: 'var(--pink-dark)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--ink)' }}>{chore.name}</div>
                    <div style={{ fontSize: '0.72rem', marginTop: 2, fontWeight: status.tone === 'due' ? 700 : 500, color: status.tone === 'due' ? 'var(--pink-dark)' : 'var(--ink-muted)' }}>
                      {status.label} · every {chore.interval_days}d · ~{chore.estimated_minutes}min
                    </div>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ fontSize: '0.68rem', padding: '5px 9px', flexShrink: 0 }}
                    onClick={() => markDone(chore)}
                  >
                    Mark done
                  </button>
                  <button
                    onClick={() => removeChore(chore.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)', padding: 0, opacity: 0.4, flexShrink: 0 }}
                    aria-label="Remove chore"
                  >
                    <Icon name="icon-clear" size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="form-input"
              placeholder="Chore name (e.g. Wash bedding)…"
              value={name}
              onChange={e => setName(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-primary"
              style={{ padding: '10px 14px' }}
              onClick={addChore}
              disabled={adding || !name.trim()}
            >
              <Icon name="icon-plus" size={14} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>Every</span>
            <input
              className="form-input"
              type="number"
              min={1}
              value={intervalDays}
              onChange={e => setIntervalDays(e.target.value)}
              style={{ width: 56 }}
            />
            <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>days,</span>
            <input
              className="form-input"
              type="number"
              min={1}
              value={estimatedMinutes}
              onChange={e => setEstimatedMinutes(e.target.value)}
              style={{ width: 56 }}
            />
            <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>min</span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {CHORE_ICONS.map(i => (
              <button
                key={i}
                onClick={() => setIcon(i)}
                style={{
                  width: 26, height: 26, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: icon === i ? 'var(--blush)' : 'transparent',
                  border: icon === i ? '1.5px solid var(--pink-dark)' : '1.5px solid var(--border)',
                  cursor: 'pointer',
                }}
                aria-label={i}
              >
                <Icon name={i} size={13} style={{ color: 'var(--pink-dark)' }} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
