import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient'; // adjust path to your existing client
import { useGroqWizard } from '../hooks/useGroqWizard'; // adjust path to your existing hook

/*
  ChoreCleaningPlan
  ------------------
  Inline, expandable AI-generated cleaning checklist for a single chore.
  Drop this under a chore row in your chores list. Clicking the chore
  toggles `isOpen`; this component owns generation + persistence.

  INTEGRATION NOTE:
  I don't know the exact signature of your useGroqWizard hook, so I've
  assumed it looks like:
    const { generate, loading, error } = useGroqWizard();
    const result = await generate({ prompt: string, jsonMode?: boolean });
  Adjust the `runGeneration` function below to match your actual hook.
  The important part is: prompt in -> array of step strings out.
*/

interface ChoreCleaningPlanProps {
  choreId: string;
  choreName: string;
  choreNotes?: string; // optional extra context (e.g. "kitchen, weekly")
  isOpen: boolean;
  userId: string;
}

interface PlanStep {
  id: string;
  text: string;
  done: boolean;
}

interface StoredPlan {
  chore_id: string;
  user_id: string;
  steps: PlanStep[];
  generated_at: string;
}

export function ChoreCleaningPlan({
  choreId,
  choreName,
  choreNotes,
  isOpen,
  userId,
}: ChoreCleaningPlanProps) {
  const [steps, setSteps] = useState<PlanStep[] | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { generate } = useGroqWizard(); // <-- adjust to your real hook API

  // Load any existing saved plan when the section opens
  useEffect(() => {
    if (!isOpen || steps !== null) return;

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
        if (error) {
          console.error('Failed to load cleaning plan', error);
        } else if (data?.steps) {
          setSteps(data.steps as PlanStep[]);
        }
        setLoadingPlan(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, choreId, userId, steps]);

  const savePlan = useCallback(
    async (newSteps: PlanStep[]) => {
      const payload: StoredPlan = {
        chore_id: choreId,
        user_id: userId,
        steps: newSteps,
        generated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from('chore_cleaning_plans')
        .upsert(payload, { onConflict: 'chore_id,user_id' });
      if (error) console.error('Failed to save cleaning plan', error);
    },
    [choreId, userId]
  );

  const runGeneration = useCallback(async () => {
    setGenerating(true);
    setErrorMsg(null);
    try {
      const prompt = `Break the chore "${choreName}"${
        choreNotes ? ` (${choreNotes})` : ''
      } into a short, practical step-by-step cleaning checklist.
Return ONLY a JSON array of strings, no markdown, no extra text.
Keep it to 4-8 concrete steps a person can check off while cleaning.`;

      // ADJUST: match your actual useGroqWizard call signature
      const result = await generate({ prompt, jsonMode: true });

      let stepTexts: string[];
      try {
        stepTexts = JSON.parse(result);
      } catch {
        // fallback: split on newlines if the model didn't return clean JSON
        stepTexts = result
          .split('\n')
          .map((l: string) => l.replace(/^[-*\d.\s]+/, '').trim())
          .filter(Boolean);
      }

      const newSteps: PlanStep[] = stepTexts.map((text, i) => ({
        id: `${choreId}-${i}`,
        text,
        done: false,
      }));

      setSteps(newSteps);
      await savePlan(newSteps);
    } catch (err) {
      console.error(err);
      setErrorMsg("Couldn't generate a plan right now. Try again?");
    } finally {
      setGenerating(false);
    }
  }, [choreId, choreName, choreNotes, generate, savePlan]);

  const toggleStep = useCallback(
    (id: string) => {
      if (!steps) return;
      const newSteps = steps.map((s) =>
        s.id === id ? { ...s, done: !s.done } : s
      );
      setSteps(newSteps);
      savePlan(newSteps);
    },
    [steps, savePlan]
  );

  if (!isOpen) return null;

  const doneCount = steps?.filter((s) => s.done).length ?? 0;

  return (
    <div className="chore-cleaning-plan">
      {loadingPlan && <div className="ccp-status">Loading plan…</div>}

      {!loadingPlan && !steps && (
        <button
          className="ccp-generate-btn"
          onClick={runGeneration}
          disabled={generating}
        >
          {generating ? 'Generating…' : '✨ Generate cleaning plan'}
        </button>
      )}

      {errorMsg && <div className="ccp-error">{errorMsg}</div>}

      {steps && steps.length > 0 && (
        <div className="ccp-steps">
          <div className="ccp-progress">
            {doneCount}/{steps.length} done
          </div>
          <ul className="ccp-list">
            {steps.map((step) => (
              <li key={step.id} className="ccp-list-item">
                <label>
                  <input
                    type="checkbox"
                    checked={step.done}
                    onChange={() => toggleStep(step.id)}
                  />
                  <span className={step.done ? 'ccp-done' : ''}>
                    {step.text}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button
            className="ccp-regenerate-btn"
            onClick={runGeneration}
            disabled={generating}
          >
            {generating ? 'Regenerating…' : 'Regenerate plan'}
          </button>
        </div>
      )}
    </div>
  );
}
