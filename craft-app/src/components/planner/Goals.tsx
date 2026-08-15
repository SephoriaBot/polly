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
  parent_step_id: string | null;
}

function buildPrompt(goal: string, stepCount: number): string {
  return `Break this goal down into exactly ${stepCount} sequential, actionable steps a person could actually follow, from getting started to done. Keep each step short and plain — a checklist label, not a sentence.

Goal: "${goal.trim()}"

Respond ONLY with a valid JSON object, no markdown, no backticks, no explanation. Use this exact shape:
{
  "steps": ["first step", "second step", "..."]
}`;
}

// A single step can turn out to be a whole task on its own ("Book flights" during
// a bigger "Plan the trip" goal). This breaks just that one step into its own
// sub-checklist, one level deep — sub-steps don't get a further breakdown option.
function buildSubstepPrompt(goalTitle: string, stepLabel: string, stepCount: number): string {
  return `A person is working toward this overall goal: "${goalTitle.trim()}"

One of the steps toward that goal is: "${stepLabel.trim()}"

That step turned out to be a task of its own. Break ONLY that step down into exactly ${stepCount} smaller, sequential, actionable sub-steps. Keep each short and plain — a checklist label, not a sentence.

Respond ONLY with a valid JSON object, no markdown, no backticks, no explanation. Use this exact shape:
{
  "steps": ["first sub-step", "second sub-step", "..."]
}`;
}

async function callGroqForSteps(prompt: string, stepCount: number): Promise<string[]> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
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

async function generateSteps(goal: string, stepCount: number): Promise<string[]> {
  return callGroqForSteps(buildPrompt(goal, stepCount), stepCount);
}

async function generateSubsteps(goalTitle: string, stepLabel: string, stepCount: number): Promise<string[]> {
  return callGroqForSteps(buildSubstepPrompt(goalTitle, stepLabel, stepCount), stepCount);
}

export default function Goals() {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [stepsByGoal, setStepsByGoal] = useState<Record<string, GoalStepRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  // Which top-level step is currently showing its "how many sub-steps?" picker
  const [breakingDownStep, setBreakingDownStep] = useState<string | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState<string | null>(null);
  // Sub-steps collapse under their parent by default state; true = expanded
  const [substepsOpen, setSubstepsOpen] = useState<Record<string, boolean>>({});

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

  async function breakdownStep(goalTitle: string, step: GoalStepRow, subCount: number) {
    setBreakdownLoading(step.id);
    let substeps: string[];
    try {
      substeps = await generateSubsteps(goalTitle, step.label, subCount);
    } catch {
      showToast("Couldn't break that step down — try again?", 'error');
      setBreakdownLoading(null);
      return;
    }
    if (substeps.length === 0) {
      showToast("Couldn't break that step down — try again?", 'error');
      setBreakdownLoading(null);
      return;
    }

    const { data: subRows, error } = await supabase
      .from('goal_steps')
      .insert(substeps.map((label, idx) => ({
        goal_id: step.goal_id,
        label,
        step_order: idx,
        done: false,
        parent_step_id: step.id,
      })))
      .select()
      .order('step_order');

    setBreakdownLoading(null);
    if (error) { showToast("Couldn't break that step down — try again?", 'error'); return; }

    setStepsByGoal(prev => ({
      ...prev,
      [step.goal_id]: [...prev[step.goal_id], ...((subRows as GoalStepRow[]) ?? [])],
    }));
    setSubstepsOpen(prev => ({ ...prev, [step.id]: true }));
    setBreakingDownStep(null);
    showToast('Broken down into sub-steps 🌱');
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
              const topSteps = steps.filter(s => !s.parent_step_id).sort((a, b) => a.step_order - b.step_order);
              const childrenOf = (parentId: string) =>
                steps.filter(s => s.parent_step_id === parentId).sort((a, b) => a.step_order - b.step_order);
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
                      {topSteps.map(step => {
                        const children = childrenOf(step.id);
                        const hasChildren = children.length > 0;
                        const subOpen = substepsOpen[step.id] ?? true;
                        const isPicking = breakingDownStep === step.id;
                        const isBreakingDown = breakdownLoading === step.id;
                        return (
                          <div key={step.id}>
                            <div
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                background: step.done ? 'var(--blush)' : 'var(--cream)',
                                border: `1.5px solid ${step.done ? 'var(--pink-light)' : 'var(--border)'}`,
                                borderRadius: 12, padding: '8px 10px',
                              }}
                            >
                              <div
                                onClick={() => toggleStep(step)}
                                style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: 'pointer', minWidth: 0 }}
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

                              {hasChildren ? (
                                <button
                                  onClick={() => setSubstepsOpen(prev => ({ ...prev, [step.id]: !subOpen }))}
                                  aria-label={subOpen ? 'Collapse sub-steps' : 'Expand sub-steps'}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)', flexShrink: 0, display: 'flex' }}
                                >
                                  <Icon name={subOpen ? 'icon-chevronup' : 'icon-chevrondown'} size={13} />
                                </button>
                              ) : (
                                <button
                                  onClick={() => setBreakingDownStep(isPicking ? null : step.id)}
                                  disabled={isBreakingDown}
                                  title="This is a whole task itself — break it into steps"
                                  aria-label="Break this step into sub-steps"
                                  style={{
                                    background: 'none', border: 'none', cursor: isBreakingDown ? 'default' : 'pointer',
                                    color: 'var(--pink-dark)', flexShrink: 0, display: 'flex',
                                    opacity: isBreakingDown ? 0.5 : 1,
                                  }}
                                >
                                  <Icon name="icon-listchecks" size={14} />
                                </button>
                              )}
                            </div>

                            {isPicking && (
                              <SubstepPicker
                                loading={isBreakingDown}
                                onCancel={() => setBreakingDownStep(null)}
                                onConfirm={count => breakdownStep(goal.title, step, count)}
                              />
                            )}

                            {hasChildren && subOpen && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 5, marginLeft: 20, paddingLeft: 10, borderLeft: '2px solid var(--border)' }}>
                                {children.map(sub => (
                                  <div
                                    key={sub.id}
                                    onClick={() => toggleStep(sub)}
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                                      background: sub.done ? 'var(--blush)' : 'var(--cream)',
                                      border: `1.5px solid ${sub.done ? 'var(--pink-light)' : 'var(--border)'}`,
                                      borderRadius: 10, padding: '6px 9px',
                                    }}
                                  >
                                    <Icon name={sub.done ? (theme === 'light' ? 'full_sun' : 'full_moon') : (theme === 'light' ? 'empty_sun' : 'empty_moon')} size={13} style={{ color: sub.done ? 'var(--pink-dark)' : 'var(--border)', flexShrink: 0 }} />
                                    <span style={{
                                      fontSize: '0.72rem', fontWeight: 600, flex: 1,
                                      color: sub.done ? 'var(--ink-muted)' : 'var(--ink)',
                                      textDecoration: sub.done ? 'line-through' : 'none',
                                    }}>
                                      {sub.label}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
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

function SubstepPicker({ loading, onConfirm, onCancel }: { loading: boolean; onConfirm: (count: number) => void; onCancel: () => void }) {
  const [count, setCount] = useState(3);

  return (
    <div style={{ marginTop: 5, padding: 8, borderRadius: 10, background: 'var(--cream)', border: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: '0.68rem', color: 'var(--ink-muted)', fontWeight: 600 }}>
        Break this into how many sub-steps? ({count})
      </label>
      <input
        type="range"
        min={2}
        max={8}
        value={count}
        onChange={e => setCount(Number(e.target.value))}
        disabled={loading}
      />
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={onCancel} disabled={loading}>
          Cancel
        </button>
        <button
          className="btn btn-primary btn-sm"
          style={{ flex: 1, justifyContent: 'center', opacity: loading ? 0.6 : 1 }}
          onClick={() => onConfirm(count)}
          disabled={loading}
        >
          {loading ? 'Breaking it down…' : 'Break it down'}
        </button>
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
