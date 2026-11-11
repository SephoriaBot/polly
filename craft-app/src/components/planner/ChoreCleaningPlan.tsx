// ChoreCleaningPlan.tsx
// Inline, expandable AI-generated cleaning checklist for a single chore.
// Rendered under a chore row in Chores.tsx when that chore is the "open" one.

import { authedFetch } from '../../lib/apiClient';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/useToast';
import Icon from '../Icon';

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

export default function ChoreCleaningPlan({
  choreId,
  choreName,
  isOpen,
}: ChoreCleaningPlanProps) {
  const { showToast } = useToast();

  const [userId, setUserId] = useState<string | null>(null);
  const [steps, setSteps] = useState<PlanStep[] | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Get the current user.
  useEffect(() => {
    let cancelled = false;

    supabase.auth.getUser().then(({ data, error }) => {
      if (cancelled) return;

      if (error) {
        console.error('Failed to get current user', error);
        setUserId(null);
        return;
      }

      setUserId(data.user?.id ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Load an existing saved cleaning plan when the chore is opened.
  useEffect(() => {
    if (!isOpen || steps !== null || !userId) return;

    let cancelled = false;

    const loadPlan = async () => {
      setLoadingPlan(true);

      try {
        const { data, error } = await supabase
          .from('chore_cleaning_plans')
          .select('steps')
          .eq('chore_id', choreId)
          .eq('user_id', userId)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.error('Failed to load cleaning plan', error);
        } else if (data?.steps) {
          setSteps(data.steps as PlanStep[]);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load cleaning plan', error);
        }
      } finally {
        if (!cancelled) {
          setLoadingPlan(false);
        }
      }
    };

    loadPlan();

    return () => {
      cancelled = true;
    };
  }, [isOpen, choreId, userId, steps]);

  // Save the current checklist to Supabase.
  const savePlan = useCallback(
    async (newSteps: PlanStep[]) => {
      if (!userId) return;

      const { error } = await supabase
        .from('chore_cleaning_plans')
        .upsert(
          {
            chore_id: choreId,
            user_id: userId,
            steps: newSteps,
            generated_at: new Date().toISOString(),
          },
          {
            onConflict: 'chore_id,user_id',
          }
        );

      if (error) {
        console.error('Failed to save cleaning plan', error);
      }
    },
    [choreId, userId]
  );

  // Ask our server-side AI endpoint to generate the checklist.
  const runGeneration = useCallback(async () => {
    setGenerating(true);

    try {
      const response = await authedFetch('/api/generate-cleaning-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          choreName,
        }),
      });

      if (!response.ok) {
        throw new Error(`Cleaning plan request failed: ${response.status}`);
      }

      const data = await response.json();

      if (!Array.isArray(data.steps)) {
        throw new Error('AI returned an invalid cleaning plan');
      }

      const stepTexts = data.steps
        .map((step: unknown) => String(step).trim())
        .filter(Boolean)
        .slice(0, 8);

      if (stepTexts.length === 0) {
        throw new Error('AI returned an empty cleaning plan');
      }

      const newSteps: PlanStep[] = stepTexts.map((text, index) => ({
        id: `${choreId}-${Date.now()}-${index}`,
        text,
        done: false,
      }));

      setSteps(newSteps);
      await savePlan(newSteps);
    } catch (error) {
      console.error('Failed to generate cleaning plan', error);

      showToast(
        "Couldn't generate a plan — please try again.",
        'error'
      );
    } finally {
      setGenerating(false);
    }
  }, [choreId, choreName, savePlan, showToast]);

  // Toggle a checklist item.
  const toggleStep = useCallback(
    async (id: string) => {
      if (!steps) return;

      const newSteps = steps.map((step) =>
        step.id === id
          ? { ...step, done: !step.done }
          : step
      );

      setSteps(newSteps);
      await savePlan(newSteps);
    },
    [steps, savePlan]
  );

  // Don't render anything when this chore isn't open.
  if (!isOpen) return null;

  const doneCount =
    steps?.filter((step) => step.done).length ?? 0;

  return (
    <div className="plan-drawer">
      {loadingPlan && <p className="muted-text">Loading plan…</p>}

      {!loadingPlan && !steps && (
        <button
          className="btn btn-primary btn-sm"
          onClick={runGeneration}
          disabled={generating}
        >
          {generating ? 'Generating…' : '✨ Generate cleaning plan'}
        </button>
      )}

      {steps && steps.length > 0 && (
        <div>
          <div className="row-meta drawer-count">
            {doneCount}/{steps.length} done
          </div>

          <div className="check-list">
            {steps.map((step) => (
              <label key={step.id} className={`check-line${step.done ? ' is-done' : ''}`}>
                <input
                  type="checkbox"
                  checked={step.done}
                  onChange={() => toggleStep(step.id)}
                />
                <span>{step.text}</span>
              </label>
            ))}
          </div>

          <div className="drawer-foot">
            <button className="link-btn" onClick={runGeneration} disabled={generating}>
              <Icon name="icon-refresh" size={12} />
              {generating ? 'Regenerating…' : 'Regenerate plan'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}