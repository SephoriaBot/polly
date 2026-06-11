import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { RecipeCategory } from '../types';
import { useToast } from '../hooks/useToast';

interface IngredientRow { id: string; name: string; amount: string; unit: string; notes: string; }
interface StepRow { id: string; instruction: string; }

function uid() { return Math.random().toString(36).slice(2); }

interface AddRecipeProps {
  onNavigate: (page: string) => void;
}

export default function AddRecipePage({ onNavigate }: AddRecipeProps) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);

  const [meta, setMeta] = useState({
    name: '', category: 'skincare' as RecipeCategory, description: '',
    difficulty: 'easy' as 'easy' | 'medium' | 'advanced', prep_time_min: '', tags: '',
  });

  const [ingredients, setIngredients] = useState<IngredientRow[]>([
    { id: uid(), name: '', amount: '', unit: '', notes: '' },
  ]);

  const [steps, setSteps] = useState<StepRow[]>([
    { id: uid(), instruction: '' },
  ]);

  function updateIngredient(id: string, field: keyof IngredientRow, value: string) {
    setIngredients(rows => rows.map(r => r.id === id ? { ...r, [field]: value } : r));
  }

  function addIngredient() {
    setIngredients(rows => [...rows, { id: uid(), name: '', amount: '', unit: '', notes: '' }]);
  }

  function removeIngredient(id: string) {
    setIngredients(rows => rows.filter(r => r.id !== id));
  }

  function updateStep(id: string, value: string) {
    setSteps(rows => rows.map(r => r.id === id ? { ...r, instruction: value } : r));
  }

  function addStep() {
    setSteps(rows => [...rows, { id: uid(), instruction: '' }]);
  }

  function removeStep(id: string) {
    setSteps(rows => rows.filter(r => r.id !== id));
  }

  async function save() {
    if (!meta.name.trim()) { showToast('Recipe name is required', 'error'); return; }
    const validIngredients = ingredients.filter(i => i.name.trim());
    const validSteps = steps.filter(s => s.instruction.trim());

    setSaving(true);
    const tagArray = meta.tags ? meta.tags.split(',').map(t => t.trim()).filter(Boolean) : null;

    const { data: recipe, error } = await supabase.from('recipes').insert({
      name: meta.name.trim(),
      category: meta.category,
      description: meta.description.trim() || null,
      difficulty: meta.difficulty,
      prep_time_min: meta.prep_time_min ? parseInt(meta.prep_time_min) : null,
      tags: tagArray,
    }).select().single();

    if (error || !recipe) {
      showToast('Error saving recipe', 'error');
      setSaving(false);
      return;
    }

    if (validIngredients.length) {
      await supabase.from('recipe_ingredients').insert(
        validIngredients.map((ing, i) => ({
          recipe_id: recipe.id,
          ingredient_name: ing.name.trim(),
          amount: ing.amount.trim(),
          unit: ing.unit.trim() || null,
          notes: ing.notes.trim() || null,
          sort_order: i,
        }))
      );
    }

    if (validSteps.length) {
      await supabase.from('recipe_steps').insert(
        validSteps.map((s, i) => ({
          recipe_id: recipe.id,
          step_number: i + 1,
          instruction: s.instruction.trim(),
        }))
      );
    }

    showToast(`"${meta.name}" added to your library!`);
    setSaving(false);
    onNavigate('recipes');
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Add a Recipe ✨</h2>
          <p>Build your apothecary formula</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => onNavigate('recipes')}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save Recipe'}
          </button>
        </div>
      </div>

      <div className="page-body" style={{ maxWidth: 720 }}>
        {/* Meta */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-body">
            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 16, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Recipe Details
            </div>
            <div className="form-group">
              <label className="form-label">Recipe Name *</label>
              <input className="form-input" placeholder="e.g. Lavender Rose Body Lotion" value={meta.name} onChange={e => setMeta(m => ({ ...m, name: e.target.value }))} />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={meta.category} onChange={e => setMeta(m => ({ ...m, category: e.target.value as RecipeCategory }))}>
                  <option value="skincare">🌸 Skincare</option>
                  <option value="soap">🫧 Soap Making</option>
                  <option value="laundry">🧺 Laundry & Cleaning</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Difficulty</label>
                <select className="form-select" value={meta.difficulty} onChange={e => setMeta(m => ({ ...m, difficulty: e.target.value as 'easy' | 'medium' | 'advanced' }))}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Prep Time (minutes)</label>
                <input className="form-input" type="number" min="1" placeholder="e.g. 30" value={meta.prep_time_min} onChange={e => setMeta(m => ({ ...m, prep_time_min: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Tags (comma-separated)</label>
                <input className="form-input" placeholder="e.g. hydrating, lavender, beginner" value={meta.tags} onChange={e => setMeta(m => ({ ...m, tags: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" placeholder="What does this recipe do? Who is it for?" value={meta.description} onChange={e => setMeta(m => ({ ...m, description: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* Ingredients */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Ingredients
              </div>
              <button className="btn btn-ghost btn-sm" onClick={addIngredient}><Plus size={13} /> Add</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr 36px', gap: '6px 10px', marginBottom: 6 }}>
              {['Ingredient', 'Amount', 'Unit', 'Notes', ''].map(h => (
                <div key={h} style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-muted)' }}>{h}</div>
              ))}
            </div>

            {ingredients.map((ing) => (
              <div key={ing.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr 36px', gap: '6px 10px', marginBottom: 8, alignItems: 'center' }}>
                <input className="form-input" placeholder="e.g. Shea butter" value={ing.name} onChange={e => updateIngredient(ing.id, 'name', e.target.value)} />
                <input className="form-input" placeholder="2" value={ing.amount} onChange={e => updateIngredient(ing.id, 'amount', e.target.value)} />
                <input className="form-input" placeholder="tbsp" value={ing.unit} onChange={e => updateIngredient(ing.id, 'unit', e.target.value)} />
                <input className="form-input" placeholder="optional note" value={ing.notes} onChange={e => updateIngredient(ing.id, 'notes', e.target.value)} />
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)', padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={() => removeIngredient(ing.id)} disabled={ingredients.length === 1}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Steps */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Steps
              </div>
              <button className="btn btn-ghost btn-sm" onClick={addStep}><Plus size={13} /> Add Step</button>
            </div>

            {steps.map((s, i) => (
              <div key={s.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                <div className="step-number" style={{ marginTop: 8, flexShrink: 0 }}>{i + 1}</div>
                <textarea className="form-textarea" style={{ flex: 1, minHeight: 64 }} placeholder={`Step ${i + 1} instruction…`} value={s.instruction} onChange={e => updateStep(s.id, e.target.value)} />
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)', padding: 6, borderRadius: 6, marginTop: 8 }}
                  onClick={() => removeStep(s.id)} disabled={steps.length === 1}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => onNavigate('recipes')}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save Recipe'}
          </button>
        </div>
      </div>
    </div>
  );
}
