import { useState } from 'react';
import { ArrowLeft, ArrowRight, Wand2, RotateCcw, X, Clock, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Recipe, RecipeIngredient, RecipeStep, RecipeCategory } from '../types';

const CATEGORY_META: Record<RecipeCategory, { label: string; emoji: string; className: string; badge: string }> = {
  skincare: { label: 'Skincare', emoji: '🌸', className: 'cat-skincare', badge: 'badge-pink' },
  soap:     { label: 'Soap Making', emoji: '🫧', className: 'cat-soap', badge: 'badge-lavender' },
  laundry:  { label: 'Laundry & Cleaning', emoji: '🧺', className: 'cat-laundry', badge: 'badge-green' },
};

const DIFF_BADGE: Record<string, string> = {
  easy: 'badge-green', medium: 'badge-amber', advanced: 'badge-pink',
};

interface WizardStep {
  id: string;
  question: string;
  subtitle?: string;
  options: string[];
  type: 'single' | 'multi';
  key: string;
}

const FLOW: WizardStep[] = [
  {
    id: 'category',
    question: 'What would you like to make?',
    subtitle: 'Choose your craft category to begin.',
    options: ['Skincare (lotions, serums, toners)', 'Soap Making', 'Laundry & Cleaning'],
    type: 'single',
    key: 'category',
  },
  {
    id: 'goal',
    question: 'What\'s your main goal?',
    subtitle: 'Pick all that apply — we\'ll find the best match.',
    options: [], // populated dynamically
    type: 'multi',
    key: 'goal',
  },
  {
    id: 'difficulty',
    question: 'How comfortable are you with this type of crafting?',
    subtitle: 'We\'ll match recipes to your experience level.',
    options: ['Beginner — keep it simple', 'Some experience — ready for more steps', 'Experienced — bring on the complexity'],
    type: 'single',
    key: 'difficulty',
  },
  {
    id: 'time',
    question: 'How much time do you have?',
    subtitle: 'This helps narrow down what\'s practical right now.',
    options: ['Under 30 minutes', '30–60 minutes', 'I have all the time I need'],
    type: 'single',
    key: 'time',
  },
];

const GOAL_OPTIONS: Record<string, string[]> = {
  'Skincare (lotions, serums, toners)': ['Moisturizing & hydration', 'Brightening', 'Anti-aging', 'Soothing sensitive skin', 'Acne-prone skin'],
  'Soap Making': ['Gentle & moisturizing', 'Exfoliating', 'Scented / aromatherapy', 'Unscented / fragrance-free', 'Specialty shapes or colors'],
  'Laundry & Cleaning': ['Gentle on clothes', 'Heavy-duty stain removal', 'Scented with essential oils', 'Fragrance-free / sensitive skin', 'Eco-friendly formula'],
};

const DIFF_MAP: Record<string, string[]> = {
  'Beginner — keep it simple': ['easy'],
  'Some experience — ready for more steps': ['easy', 'medium'],
  'Experienced — bring on the complexity': ['easy', 'medium', 'advanced'],
};

const CAT_MAP: Record<string, RecipeCategory> = {
  'Skincare (lotions, serums, toners)': 'skincare',
  'Soap Making': 'soap',
  'Laundry & Cleaning': 'laundry',
};

export default function WizardPage() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [results, setResults] = useState<Recipe[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [recipeSteps, setRecipeSteps] = useState<RecipeStep[]>([]);

  const currentFlow = FLOW.map(f => {
    if (f.id === 'goal') {
      const cat = answers['category'] as string;
      return { ...f, options: GOAL_OPTIONS[cat] || [] };
    }
    return f;
  });

  const currentStep = currentFlow[step];
  const totalSteps = currentFlow.length;

  function toggleAnswer(key: string, option: string, type: 'single' | 'multi') {
    if (type === 'single') {
      setAnswers(a => ({ ...a, [key]: option }));
    } else {
      setAnswers(a => {
        const prev = (a[key] as string[]) || [];
        const has = prev.includes(option);
        return { ...a, [key]: has ? prev.filter(x => x !== option) : [...prev, option] };
      });
    }
  }

  function isSelected(key: string, option: string) {
    const val = answers[key];
    if (!val) return false;
    return Array.isArray(val) ? val.includes(option) : val === option;
  }

  function canProceed() {
    const val = answers[currentStep?.key];
    if (!val) return false;
    return Array.isArray(val) ? val.length > 0 : true;
  }

  async function runSearch() {
    setLoading(true);
    const cat = CAT_MAP[answers['category'] as string];
    const diffs = DIFF_MAP[answers['difficulty'] as string] || ['easy', 'medium', 'advanced'];
    const timeLimit = answers['time'] as string;

    let query = supabase.from('recipes').select('*').eq('category', cat).in('difficulty', diffs);

    if (timeLimit === 'Under 30 minutes') {
      query = query.or('prep_time_min.is.null,prep_time_min.lte.30');
    } else if (timeLimit === '30–60 minutes') {
      query = query.or('prep_time_min.is.null,prep_time_min.lte.60');
    }

    const { data } = await query.limit(6);
    setResults(data || []);
    setLoading(false);
  }

  async function openRecipe(recipe: Recipe) {
    setSelected(recipe);
    const [ingRes, stepRes] = await Promise.all([
      supabase.from('recipe_ingredients').select('*').eq('recipe_id', recipe.id).order('sort_order'),
      supabase.from('recipe_steps').select('*').eq('recipe_id', recipe.id).order('step_number'),
    ]);
    setIngredients(ingRes.data || []);
    setRecipeSteps(stepRes.data || []);
  }

  function reset() {
    setStep(0);
    setAnswers({});
    setResults(null);
  }

  if (results !== null) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h2>Your Recommendations ✨</h2>
            <p>Based on your preferences</p>
          </div>
          <button className="btn btn-ghost" onClick={reset}><RotateCcw size={14} /> Start Over</button>
        </div>
        <div className="page-body">
          <div style={{ background: 'var(--lavender-light)', borderRadius: 12, padding: '14px 18px', marginBottom: 24, fontSize: '0.875rem', color: 'var(--lavender-dark)' }}>
            🪄 Showing <strong>{CAT_MAP[answers['category'] as string]}</strong> recipes matching your difficulty and time preferences.
            {results.length === 0 && ' No recipes found yet — try adding some to your library first!'}
          </div>
          {results.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <h3>No matches yet</h3>
              <p>Your library doesn't have recipes for these criteria yet. Add some formulas to get started!</p>
            </div>
          ) : (
            <div className="grid-3">
              {results.map(recipe => {
                const meta = CATEGORY_META[recipe.category];
                return (
                  <div key={recipe.id} className="card" style={{ cursor: 'pointer' }} onClick={() => openRecipe(recipe)}>
                    <div className="card-body">
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                        <div className={`recipe-category-icon ${meta.className}`}>{meta.emoji}</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 4 }}>{recipe.name}</div>
                          <div style={{ display: 'flex', gap: 5 }}>
                            <span className={`badge ${DIFF_BADGE[recipe.difficulty]}`}>{recipe.difficulty}</span>
                            {recipe.prep_time_min && <span className="badge badge-lavender">{recipe.prep_time_min} min</span>}
                          </div>
                        </div>
                      </div>
                      {recipe.description && <p style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', lineHeight: 1.5 }}>{recipe.description}</p>}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                        <ChevronRight size={14} style={{ color: 'var(--pink)' }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {selected && (
          <div className="modal-overlay" onClick={() => setSelected(null)}>
            <div className="modal" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className={`recipe-category-icon ${CATEGORY_META[selected.category].className}`}>{CATEGORY_META[selected.category].emoji}</div>
                  <div>
                    <h3>{selected.name}</h3>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <span className={`badge ${DIFF_BADGE[selected.difficulty]}`}>{selected.difficulty}</span>
                      {selected.prep_time_min && <span className="badge badge-lavender"><Clock size={10} style={{ marginRight: 2 }} />{selected.prep_time_min} min</span>}
                    </div>
                  </div>
                </div>
                <button className="close-btn" onClick={() => setSelected(null)}><X size={18} /></button>
              </div>
              <div className="modal-body">
                {selected.description && <p style={{ fontSize: '0.9rem', color: 'var(--ink-soft)', lineHeight: 1.6, marginBottom: 20, fontStyle: 'italic' }}>{selected.description}</p>}
                {ingredients.length > 0 && (
                  <>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 10, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ingredients</div>
                    <div style={{ marginBottom: 24 }}>
                      {ingredients.map(ing => (
                        <div key={ing.id} className="ingredient-row">
                          <span className="ingredient-amount">{ing.amount}{ing.unit ? ` ${ing.unit}` : ''}</span>
                          <span>{ing.ingredient_name}</span>
                          {ing.notes && <span style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', fontStyle: 'italic' }}>{ing.notes}</span>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {recipeSteps.length > 0 && (
                  <>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 14, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Steps</div>
                    {recipeSteps.map(s => (
                      <div key={s.id} className="step-row">
                        <div className="step-number">{s.step_number}</div>
                        <div className="step-text">{s.instruction}</div>
                      </div>
                    ))}
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setSelected(null)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Recipe Wizard 🪄</h2>
          <p>Answer a few questions to find your perfect formula</p>
        </div>
      </div>
      <div className="page-body">
        <div className="wizard-container">
          <div className="wizard-progress">
            {currentFlow.map((_, i) => (
              <div key={i} className={`wizard-step-dot ${i === step ? 'active' : i < step ? 'done' : ''}`} />
            ))}
          </div>

          <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Step {step + 1} of {totalSteps}
          </div>

          <div className="wizard-question">{currentStep.question}</div>
          {currentStep.subtitle && <div className="wizard-subtitle">{currentStep.subtitle}</div>}

          {currentStep.options.length > 0 ? (
            <div className="wizard-options">
              {currentStep.options.map(opt => (
                <button key={opt} className={`wizard-option ${isSelected(currentStep.key, opt) ? 'selected' : ''}`}
                  onClick={() => toggleAnswer(currentStep.key, opt, currentStep.type)}>
                  <div className="wizard-option-check">
                    {isSelected(currentStep.key, opt) && <span style={{ fontSize: '0.7rem' }}>✓</span>}
                  </div>
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--ink-muted)', fontSize: '0.9rem', padding: '20px 0' }}>
              Please select a category first to see options.
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28 }}>
            <button className="btn btn-ghost" onClick={() => step === 0 ? reset() : setStep(s => s - 1)} disabled={loading}>
              <ArrowLeft size={14} /> {step === 0 ? 'Reset' : 'Back'}
            </button>
            {step < totalSteps - 1 ? (
              <button className="btn btn-primary" disabled={!canProceed()} onClick={() => setStep(s => s + 1)}>
                Next <ArrowRight size={14} />
              </button>
            ) : (
              <button className="btn btn-primary" disabled={!canProceed() || loading} onClick={runSearch}>
                {loading ? 'Searching…' : <><Wand2 size={14} /> Find Recipes</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
