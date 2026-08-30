// ChoreCleaningPlan.tsx
// Inline, expandable AI-generated cleaning checklist for a single chore.
// Rendered under a chore row in Chores.tsx when that chore is the "open" one.

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/useToast';
import Icon from '../Icon';
// ADJUST: point this at your actual Groq wizard hook (used by DrDietGroq / MaidWizard)
import { useGroqWizard } from '../../hooks/useGroqWizard';

interface PlanStep {
  id: string;
  text: string;
  done: boolean;
}

interface ChoreCleaningPlanProps {
  choreId: string;
  choreName: string;
  isOpen: boolean;
}

export default function ChoreCleaningPlan({ choreId, choreName, isOpen }: ChoreCleaningPlanProps) {
  const { showToast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [steps, setSteps] = useState<PlanStep[] | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [generating, setGenerating] = useState(false);

  // ADJUST: replace with your real call signature, e.g. const { generate } = useGroqWizard();
  const { generate } = useGroqWizard();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!isOpen || steps !== null || !userId) return;
    let cancelled = false;
    setLoadingPlan(true);
    supabase
      .from('chore_cleaning_plans')
      .select('steps')
      .eq('chore_id', choreId)
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error('Failed to load cleaning plan', error);
        else if (data?.steps) setSteps(data.steps as PlanStep[]);
        setLoadingPlan(false);
      });
    return () => { cancelled = true; };
  }, [isOpen, choreId, userId, steps]);

  const savePlan = useCallback(async (newSteps: PlanStep[]) => {
    if (!userId) return;
    const { error } = await supabase
      .from('chore_cleaning_plans')
      .upsert(
        { chore_id: choreId, user_id: userId, steps: newSteps, generated_at: new Date().toISOString() },
        { onConflict: 'chore_id,user_id' }
      );
    if (error) console.error('Failed to save cleaning plan', error);
  }, [choreId, userId]);

  const runGeneration = useCallback(async () => {
    setGenerating(true);
    try {
      const prompt = `Break the chore "${choreName}" into a short, practical step-by-step cleaning checklist.
Return ONLY a JSON array of strings, no markdown, no extra text.
Keep it to 4-8 concrete steps a person can check off while cleaning.`;

      // ADJUST: match your real hook's call shape
      const result = await generate({ prompt, jsonMode: true });

      let stepTexts: string[];
      try {
        stepTexts = JSON.parse(result);
      } catch {
        stepTexts = result
          .split('\n')
          .map((l: string) => l.replace(/^[-*\d.\s]+/, '').trim())
          .filter(Boolean);
      }

      const newSteps: PlanStep[] = stepTexts.map((text, i) => ({ id: `${choreId}-${i}`, text, done: false }));
      setSteps(newSteps);
      await savePlan(newSteps);
    } catch (err) {
      console.error(err);
      showToast("Couldn't generate a plan — try again?", 'error');
    } finally {
      setGenerating(false);
    }
  }, [choreId, choreName, generate, savePlan, showToast]);

  const toggleStep = useCallback((id: string) => {
    if (!steps) return;
    const newSteps = steps.map(s => s.id === id ? { ...s, done: !s.done } : s);
    setSteps(newSteps);
    savePlan(newSteps);
  }, [steps, savePlan]);

  if (!isOpen) return null;

  const doneCount = steps?.filter(s => s.done).length ?? 0;

  return (
    <div
      style={{
        margin: '-2px 0 0 0',
        padding: '10px 12px 12px 12px',
        borderRadius: '0 0 16px 16px',
        background: 'var(--cream)',
        border: '1.5px solid var(--border)',
        borderTop: 'none',
      }}
    >
      {loadingPlan && (
        <p style={{ fontSize: 12, color: 'var(--ink-muted)', margin: 0 }}>Loading plan…</p>
      )}

      {!loadingPlan && !steps && (
        <button
          className="btn btn-primary btn-sm"
          style={{ fontSize: '0.72rem', padding: '6px 10px' }}
          onClick={runGeneration}
          disabled={generating}
        >
          {generating ? 'Generating…' : '✨ Generate cleaning plan'}
        </button>
      )}

      {steps && steps.length > 0 && (
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--ink-muted)', marginBottom: 6 }}>
            {doneCount}/{steps.length} done
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {steps.map(step => (
              <label
                key={step.id}
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={step.done}
                  onChange={() => toggleStep(step.id)}
                  style={{ width: 15, height: 15, flexShrink: 0, accentColor: 'var(--pink-dark)' }}
                />
                <span
                  style={{
                    fontSize: '0.78rem',
                    color: step.done ? 'var(--ink-muted)' : 'var(--ink)',
                    textDecoration: step.done ? 'line-through' : 'none',
                  }}
                >
                  {step.text}
                </span>
              </label>
            ))}
          </div>
          <button
            onClick={runGeneration}
            disabled={generating}
            style={{
              marginTop: 10, background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: '0.68rem', color: 'var(--ink-muted)', padding: 0,
            }}
          >
            <Icon name="icon-refresh" size={12} />
            {generating ? 'Regenerating…' : 'Regenerate plan'}
          </button>
        </div>
      )}
    </div>
  );
}