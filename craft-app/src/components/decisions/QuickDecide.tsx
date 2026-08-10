// QuickDecide.tsx
// Tier 2, item 1: "What should I do?" decision support — the doc's
// "Should I cook or order food?" example, plus a couple of related presets.
// Deliberately rule-based and transparent rather than an AI black box: the
// person can see exactly why a recommendation came out the way it did, with
// their own numbers quoted back at them (the doc's "it costs ~$6, and it'll
// take 20 minutes" style). Energy pulls from the real EnergyContext instead
// of asking a question we can already answer.

import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useEnergy } from '../../context/EnergyContext';
import Icon from '../Icon';
import { type Chore, statusFor } from '../../lib/chores';
import ResetMyLife from '../ResetMyLife';

type Preset = 'reset' | 'cook-or-order' | 'what-to-eat' | 'what-to-clean';

const ENERGY_LABEL: Record<string, string> = {
  normal: 'Normal',
  noEnergy: 'No energy',
};

export default function QuickDecide() {
  const [preset, setPreset] = useState<Preset | null>(null);

  if (!preset) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="section-label" style={{ marginBottom: 4 }}>Help me decide</div>
          <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: 0, marginBottom: 14 }}>
            A few quick questions, then a real recommendation — not just "up to you."
          </p>
          <button
            onClick={() => setPreset('reset')}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', width: '100%',
              background: 'var(--blush)', border: '1.5px solid var(--pink-dark)',
              borderRadius: 18, padding: '14px 16px', cursor: 'pointer', fontFamily: 'inherit',
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>🫠</span>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--pink-dark)' }}>Reset my life</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--pink-dark)', opacity: 0.8 }}>Had a rough one? Get a tiny plan, not a full list.</div>
            </div>
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <PresetButton icon="cooking-pot" title="Should I cook or order food?" onClick={() => setPreset('cook-or-order')} />
            <PresetButton icon="icon-meals" title="What should I eat?" onClick={() => setPreset('what-to-eat')} />
            <PresetButton icon="cleaning-spray" title="What should I clean?" onClick={() => setPreset('what-to-clean')} />
          </div>
          <p style={{ fontSize: '0.68rem', color: 'var(--ink-muted)', marginTop: 12, marginBottom: 0 }}>
            More decision types are coming — groceries, bills, packing.
          </p>
        </div>
      </div>
    );
  }

  if (preset === 'reset') {
    return (
      <div>
        <BackButton onClick={() => setPreset(null)} />
        <ResetMyLife />
      </div>
    );
  }
  if (preset === 'cook-or-order') return <CookOrOrder onBack={() => setPreset(null)} />;
  if (preset === 'what-to-eat') return <WhatToEat onBack={() => setPreset(null)} />;
  if (preset === 'what-to-clean') return <WhatToClean onBack={() => setPreset(null)} />;
  return null;
}

function PresetButton({ icon, title, onClick }: { icon: Parameters<typeof Icon>[0]['name']; title: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
        background: 'var(--white)', border: '1.5px solid var(--border)',
        borderRadius: 18, padding: '12px 14px', cursor: 'pointer', width: '100%',
        fontFamily: 'inherit',
      }}
    >
      <Icon name={icon} size={22} style={{ color: 'var(--pink-dark)', flexShrink: 0 }} />
      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink)' }}>{title}</span>
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)', fontSize: '0.72rem', fontWeight: 700, padding: 0, marginBottom: 10 }}
    >
      ← Back
    </button>
  );
}

function EnergyBadge() {
  const { mode } = useEnergy();
  return (
    <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginBottom: 12 }}>
      Using your current energy: <strong style={{ color: 'var(--pink-dark)' }}>{ENERGY_LABEL[mode]}</strong>
      {mode !== 'normal' && ' (from Low Energy Mode)'}
    </div>
  );
}

function CookOrOrder({ onBack }: { onBack: () => void }) {
  const { mode: energyMode } = useEnergy();
  const [budget, setBudget] = useState('');
  const [minutes, setMinutes] = useState('');
  const [haveFood, setHaveFood] = useState<'yes' | 'some' | 'no' | null>(null);
  const [result, setResult] = useState<{ choice: 'cook' | 'order'; reasons: string[] } | null>(null);

  function decide() {
    const budgetNum = parseFloat(budget) || 0;
    const minsNum = parseInt(minutes, 10) || 0;
    const lowEnergy = energyMode !== 'normal';
    const reasons: string[] = [];

    // Hard constraint first: if there's realistically no order budget,
    // cooking wins regardless of energy — matches the doc's own framing
    // where budget can override how tired you are.
    const canAffordOrder = budgetNum >= 12;

    let choice: 'cook' | 'order';

    if (haveFood !== 'no' && !canAffordOrder) {
      choice = 'cook';
      reasons.push(budgetNum > 0 ? `Ordering isn't really in the $${budgetNum.toFixed(0)} budget tonight.` : "No budget entered for ordering, so cooking keeps it free.");
      if (haveFood === 'yes') reasons.push('You already have the ingredients.');
    } else if (lowEnergy && canAffordOrder) {
      choice = 'order';
      reasons.push(`Your energy is set to ${ENERGY_LABEL[energyMode].toLowerCase()} right now.`);
      reasons.push(`Budget allows ~$${budgetNum.toFixed(0)} tonight.`);
    } else if (haveFood === 'no') {
      choice = canAffordOrder ? 'order' : 'cook';
      reasons.push(canAffordOrder ? "Nothing at home to cook with, and there's budget for it." : "Nothing at home and not much budget — might be worth a store run instead of either.");
    } else if (minsNum > 0 && minsNum < 15 && !lowEnergy) {
      choice = canAffordOrder ? 'order' : 'cook';
      reasons.push(`Only ${minsNum} min available — that's tight for cooking.`);
    } else {
      choice = 'cook';
      if (haveFood === 'yes') reasons.push('You have the ingredients on hand.');
      if (minsNum > 0) reasons.push(`Fits in the ${minsNum} min you've got.`);
      if (budgetNum > 0) reasons.push(`Costs roughly nothing extra vs. the ~$${budgetNum.toFixed(0)} order budget.`);
    }

    if (reasons.length === 0) reasons.push("Closest fit for what you told me — feel free to weigh in and pick the other one.");
    setResult({ choice, reasons });
  }

  return (
    <div className="card">
      <div className="card-body">
        <BackButton onClick={onBack} />
        <div className="section-label" style={{ marginBottom: 10 }}>Cook or order?</div>
        <EnergyBadge />

        {!result ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', fontWeight: 600 }}>Budget for tonight ($)</label>
              <input className="form-input" type="number" min={0} value={budget} onChange={e => setBudget(e.target.value)} placeholder="e.g. 15" style={{ marginTop: 4 }} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', fontWeight: 600 }}>Minutes you have</label>
              <input className="form-input" type="number" min={0} value={minutes} onChange={e => setMinutes(e.target.value)} placeholder="e.g. 20" style={{ marginTop: 4 }} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', fontWeight: 600 }}>Food at home?</label>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                {(['yes', 'some', 'no'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setHaveFood(v)}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 12, textTransform: 'capitalize',
                      background: haveFood === v ? 'var(--blush)' : 'var(--white)',
                      border: `1.5px solid ${haveFood === v ? 'var(--pink-dark)' : 'var(--border)'}`,
                      color: haveFood === v ? 'var(--pink-dark)' : 'var(--ink-muted)',
                      fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn btn-primary" onClick={decide} disabled={haveFood === null}>
              Decide for me
            </button>
          </div>
        ) : (
          <ResultCard
            title={result.choice === 'cook' ? 'Cook' : 'Order'}
            icon={result.choice === 'cook' ? 'cooking-pot' : 'icon-meals'}
            reasons={result.reasons}
            onRetry={() => setResult(null)}
          />
        )}
      </div>
    </div>
  );
}

interface MealOption { id: string; name: string }

function WhatToEat({ onBack }: { onBack: () => void }) {
  const { mode: energyMode } = useEnergy();
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [pick, setPick] = useState<MealOption | null>(null);
  const [poolSize, setPoolSize] = useState(0);

  async function suggest() {
    setLoading(true);
    setChecked(true);
    const { data } = await supabase.from('meals').select('id,name');
    const meals = (data as MealOption[]) ?? [];
    setPoolSize(meals.length);
    setPick(meals.length > 0 ? meals[Math.floor(Math.random() * meals.length)] : null);
    setLoading(false);
  }

  return (
    <div className="card">
      <div className="card-body">
        <BackButton onClick={onBack} />
        <div className="section-label" style={{ marginBottom: 10 }}>What should I eat?</div>
        <EnergyBadge />

        {!checked ? (
          <button className="btn btn-primary" onClick={suggest}>
            Suggest something
          </button>
        ) : loading ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>Thinking…</p>
        ) : pick ? (
          <ResultCard
            title={pick.name}
            icon="icon-meals"
            reasons={[
              `Picked from your ${poolSize} saved meal${poolSize === 1 ? '' : 's'}.`,
              energyMode !== 'normal' ? "Your energy's set low right now — check RecipeBox for how quick this one is before committing." : 'Head to RecipeBox to see the full recipe or add ingredients to your grocery list.',
            ]}
            onRetry={suggest}
            retryLabel="Suggest another"
          />
        ) : (
          <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
            No saved meals yet — add some in RecipeBox first and this'll have something to pick from.
          </p>
        )}
      </div>
    </div>
  );
}

function WhatToClean({ onBack }: { onBack: () => void }) {
  const [budgetMinutes, setBudgetMinutes] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<{ picks: Chore[]; totalMinutes: number; remainingDue: number } | null>(null);

  async function buildPlan(minutes: number) {
    setBudgetMinutes(minutes);
    setLoading(true);
    const { data } = await supabase.from('chores').select('*');
    const now = new Date();
    const due = ((data as Chore[]) ?? [])
      .map(c => ({ chore: c, status: statusFor(c, now) }))
      .filter(x => x.status.tone === 'due')
      .sort((a, b) => b.status.overdueDays - a.status.overdueDays);

    // Greedy: take the most-overdue chores first, as many as fit the window.
    const picks: Chore[] = [];
    let used = 0;
    for (const { chore } of due) {
      if (used + chore.estimated_minutes <= minutes) {
        picks.push(chore);
        used += chore.estimated_minutes;
      }
    }
    setPlan({ picks, totalMinutes: used, remainingDue: due.length - picks.length });
    setLoading(false);
  }

  return (
    <div className="card">
      <div className="card-body">
        <BackButton onClick={onBack} />
        <div className="section-label" style={{ marginBottom: 10 }}>What should I clean?</div>

        {budgetMinutes === null ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', margin: 0 }}>How much time do you have?</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[5, 15, 30, 60].map(m => (
                <button
                  key={m}
                  className="btn btn-ghost btn-sm"
                  onClick={() => buildPlan(m)}
                  style={{ flex: '1 1 auto' }}
                >
                  {m} min
                </button>
              ))}
            </div>
          </div>
        ) : loading ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>Checking what's overdue…</p>
        ) : plan && plan.picks.length > 0 ? (
          <div>
            <div style={{
              background: 'var(--blush)', border: '1.5px solid var(--pink-light)',
              borderRadius: 18, padding: '14px 16px', marginBottom: 10,
            }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--pink-dark)', fontWeight: 700, marginBottom: 8 }}>
                With {budgetMinutes} min, I'd do:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {plan.picks.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name={c.icon as Parameters<typeof Icon>[0]['name']} size={16} style={{ color: 'var(--pink-dark)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink)', flex: 1 }}>{c.name}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>~{c.estimated_minutes}min</span>
                  </div>
                ))}
              </div>
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginTop: 0 }}>
              That's ~{plan.totalMinutes} of your {budgetMinutes} min, picking the most overdue first.
              {plan.remainingDue > 0 && ` ${plan.remainingDue} more chore${plan.remainingDue === 1 ? ' is' : 's are'} due but didn't fit this window.`}
            </p>
            <button className="btn btn-ghost btn-sm" onClick={() => setBudgetMinutes(null)} style={{ width: '100%', justifyContent: 'center' }}>
              Try a different amount of time
            </button>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
              Nothing's actually overdue right now — chores are caught up. Add more in the Planner if you're tracking a bigger list.
            </p>
            <button className="btn btn-ghost btn-sm" onClick={() => setBudgetMinutes(null)} style={{ width: '100%', justifyContent: 'center' }}>
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultCard({
  title, icon, reasons, onRetry, retryLabel = 'Ask again',
}: {
  title: string
  icon: Parameters<typeof Icon>[0]['name']
  reasons: string[]
  onRetry: () => void
  retryLabel?: string
}) {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--blush)', border: '1.5px solid var(--pink-light)',
        borderRadius: 18, padding: '14px 16px', marginBottom: 10,
      }}>
        <Icon name={icon} size={28} style={{ color: 'var(--pink-dark)', flexShrink: 0 }} />
        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--pink-dark)' }}>{title}</div>
      </div>
      <ul style={{ margin: 0, marginBottom: 12, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {reasons.map((r, i) => (
          <li key={i} style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>{r}</li>
        ))}
      </ul>
      <button className="btn btn-ghost btn-sm" onClick={onRetry} style={{ width: '100%', justifyContent: 'center' }}>
        {retryLabel}
      </button>
    </div>
  );
}
