// Goals.tsx
// Mirrors LifeEvents.tsx's shape: a flat checklist workspace per item. The
// difference is where the checklist comes from — Life Events pull a fixed
// curated template, Goals send the goal + a desired step count to Groq
// (same JSON-mode pattern as BrainDump) and get back a sequential checklist.
// Generated once; after that it's a normal editable/checkable list like
// everything else, no regeneration in v1.

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/useToast';
import Icon from '../Icon';
import { useTheme } from '../../context/ThemeContext';

interface GoalRow {
  id: string;
  title: string;
  archived: boolean;
  created_at: string;
}

interface GoalStepRow {
  id: string;
  goal_id: string;
  label: string;
  step_order: number;
  done: boolean;
}

function buildPrompt(goal: string, stepCount: number): string {
  return `Break this goal down into exactly ${stepCount} sequential, actionable steps a person could actually follow, from getting started to done. Keep each step short and plain — a checklist label, not a sentence.

Goal: "${goal.trim()}"

Respond ONLY with a valid JSON object, no markdown, no backticks, no explanation. Use this exact shape:
{
  "steps": ["first step", "second step", "..."]
}`;
}

async function generateSteps(goal: string, stepCount: number): Promise<string[]> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 600,
      messages: [{ role: 'user', content: buildPrompt(goal, stepCount) }],
    }),
  });

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content ?? '';
  const clean = raw.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);

  if (!Array.isArray(parsed.steps)) throw new Error('bad shape');

  return parsed.steps
    .filter((s: any) => typeof s === 'string' && s.trim())
    .map((s: string) => s.trim())
    .slice(0, stepCount);
}

export default function Goals() {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [stepsByGoal, setStepsByGoal] = useState<Record<string, GoalStepRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: goalsData } = await supabase.from('goals').select('*').eq('archived', false).order('created_at');
    const rows = (goalsData as GoalRow[]) ?? [];
    setGoals(rows);
    if (rows.length > 0) {
      const { data: stepsData } = await supabase.from('goal_steps').select('*').in('goal_id', rows.map(r => r.id)).order('step_order');
      const grouped: Record<string, GoalStepRow[]> = {};
      for (const step of (stepsData as GoalStepRow[]) ?? []) {
        (grouped[step.goal_id] ??= []).push(step);
      }
      setStepsByGoal(grouped);
      if (!expanded) setExpanded(rows[0].id);
    }
    setLoading(false);
  }

  async function createGoal(title: string, stepCount: number) {
    let steps: string[];
    try {
      steps = await generateSteps(title, stepCount);
    } catch {
      showToast("Couldn't break that down — try again?", 'error');
      throw new Error('generation failed');
    }
    if (steps.length === 0) {
      showToast("Couldn't break that down — try again?", 'error');
      throw new Error('empty steps');
    }

    const { data: goal, error } = await supabase
      .from('goals')
      .insert({ title: title.trim(), archived: false })
      .select()
      .single();
    if (error || !goal) { showToast("Couldn't start that — try again?", 'error'); throw new Error('insert failed'); }

    const { data: stepRows } = await supabase
      .from('goal_steps')
      .insert(steps.map((label, idx) => ({ goal_id: goal.id, label, step_order: idx, done: false })))
      .select()
      .order('step_order');

    setGoals(prev => [...prev, goal as GoalRow]);
    setStepsByGoal(prev => ({ ...prev, [goal.id]: (stepRows as GoalStepRow[]) ?? [] }));
    setExpanded(goal.id);
    showToast(`${goal.title} broken down 🌱`);
  }

  async function toggleStep(step: GoalStepRow) {
    const newDone = !step.done;
    setStepsByGoal(prev => ({
      ...prev,
      [step.goal_id]: prev[step.goal_id].map(s => s.id === step.id ? { ...s, done: newDone } : s),
    }));
    await supabase.from('goal_steps').update({ done: newDone }).eq('id', step.id);
  }

  async function archiveGoal(id: string) {
    setGoals(prev => prev.filter(g => g.id !== id));
    if (expanded === id) setExpanded(null);
    await supabase.from('goals').update({ archived: true }).eq('id', id);
  }

  return (
    <div className="card">
      <div className="card-body">
        <div className="section-label" style={{ marginBottom: 4 }}>Goals</div>
        <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: 0, marginBottom: 14 }}>
          Tell it a goal and how many steps you want, and it breaks it down into a checklist for you.
        </p>

        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Loading…</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            {goals.map(goal => {
              const steps = stepsByGoal[goal.id] ?? [];
              const doneCount = steps.filter(s => s.done).length;
              const isOpen = expanded === goal.id;
              return (
                <div key={goal.id} style={{ border: '1.5px solid var(--border)', borderRadius: 18, overflow: 'hidden', background: 'var(--white)' }}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : goal.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      padding: '12px 14px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    <Icon name="trophy" size={20} style={{ color: 'var(--pink-dark)', flexShrink: 0 }} />
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink)' }}>{goal.title}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--ink-muted)' }}>
                        {doneCount}/{steps.length} done
                      </div>
                    </div>
                    <Icon name={isOpen ? 'icon-chevronup' : 'icon-chevrondown'} size={14} style={{ color: 'var(--ink-muted)', flexShrink: 0 }} />
                  </button>

                  {isOpen && (
                    <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {steps.map(step => (
                        <div
                          key={step.id}
                          onClick={() => toggleStep(step)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                            background: step.done ? 'var(--blush)' : 'var(--cream)',
                            border: `1.5px solid ${step.done ? 'var(--pink-light)' : 'var(--border)'}`,
                            borderRadius: 12, padding: '8px 10px',
                          }}
                        >
                          <Icon name={step.done ? (theme === 'light' ? 'full_sun' : 'full_moon') : (theme === 'light' ? 'empty_sun' : 'empty_moon')} size={16} style={{ color: step.done ? 'var(--pink-dark)' : 'var(--border)', flexShrink: 0 }} />
                          <span style={{
                            fontSize: '0.78rem', fontWeight: 600, flex: 1,
                            color: step.done ? 'var(--ink-muted)' : 'var(--ink)',
                            textDecoration: step.done ? 'line-through' : 'none',
                          }}>
                            {step.label}
                          </span>
                        </div>
                      ))}
                      <button
                        onClick={() => archiveGoal(goal.id)}
                        className="btn btn-ghost btn-sm"
                        style={{ marginTop: 4, justifyContent: 'center' }}
                      >
                        All wrapped up — archive this
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!creating ? (
          <button className="btn btn-primary" onClick={() => setCreating(true)} style={{ width: '100%', justifyContent: 'center' }}>
            <Icon name="icon-plus" size={14} /> Set a goal
          </button>
        ) : (
          <GoalCreator onCreate={createGoal} onCancel={() => setCreating(false)} />
        )}
      </div>
    </div>
  );
}

function GoalCreator({ onCreate, onCancel }: { onCreate: (title: string, stepCount: number) => Promise<void>; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [stepCount, setStepCount] = useState(5);
  const [generating, setGenerating] = useState(false);

  async function handleCreate() {
    if (!title.trim() || generating) return;
    setGenerating(true);
    try {
      await onCreate(title, stepCount);
      setTitle('');
      setStepCount(5);
      onCancel();
    } catch {
      // toast already shown by createGoal; stay open so they can retry
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div style={{ padding: 10, borderRadius: 14, background: 'var(--cream)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', fontWeight: 600 }}>What's the goal?</label>
      <input
        type="text"
        className="form-input"
        placeholder="Learn to bake sourdough"
        value={title}
        onChange={e => setTitle(e.target.value)}
        style={{ fontSize: '0.85rem' }}
        autoFocus
      />

      <label style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', fontWeight: 600 }}>
        How many steps? ({stepCount})
      </label>
      <input
        type="range"
        min={3}
        max={12}
        value={stepCount}
        onChange={e => setStepCount(Number(e.target.value))}
      />

      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={onCancel} disabled={generating}>
          Cancel
        </button>
        <button
          className="btn btn-primary btn-sm"
          style={{ flex: 1, justifyContent: 'center', opacity: generating || !title.trim() ? 0.6 : 1 }}
          onClick={handleCreate}
          disabled={generating || !title.trim()}
        >
          {generating ? 'Breaking it down…' : 'Create checklist'}
        </button>
      </div>
    </div>
  );
}
