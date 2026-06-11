import { useEffect, useState } from 'react';
import { Search, X, ChevronRight, Clock, Wand2 } from 'lucide-react';
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

interface RecipesPageProps {
  onNavigate: (page: string) => void;
}

export default function RecipesPage({ onNavigate }: RecipesPageProps) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<RecipeCategory | 'all'>('all');
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [steps, setSteps] = useState<RecipeStep[]>([]);

  useEffect(() => { loadRecipes(); }, []);

  async function loadRecipes() {
    setLoading(true);
    const { data } = await supabase.from('recipes').select('*').order('created_at', { ascending: false });
    setRecipes(data || []);
    setLoading(false);
  }

  async function openRecipe(recipe: Recipe) {
    setSelected(recipe);
    const [ingRes, stepRes] = await Promise.all([
      supabase.from('recipe_ingredients').select('*').eq('recipe_id', recipe.id).order('sort_order'),
      supabase.from('recipe_steps').select('*').eq('recipe_id', recipe.id).order('step_number'),
    ]);
    setIngredients(ingRes.data || []);
    setSteps(stepRes.data || []);
  }

  const filtered = recipes.filter(r => {
    const matchesCat = filterCat === 'all' || r.category === filterCat;
    const matchesSearch = !search || r.name.toLowerCase().includes(search.toLowerCase()) || (r.description || '').toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Recipe Library ⚗️</h2>
          <p>{recipes.length} formula{recipes.length !== 1 ? 's' : ''} in your apothecary</p>
        </div>
        <button className="btn btn-primary" onClick={() => onNavigate('wizard')}>
          <Wand2 size={14} /> Recipe Wizard
        </button>
      </div>

      <div className="page-body">
        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 22, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-muted)' }} />
            <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Search recipes…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['all', 'skincare', 'soap', 'laundry'] as const).map(cat => (
              <button key={cat} className={`btn btn-sm ${filterCat === cat ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilterCat(cat)}>
                {cat === 'all' ? 'All' : CATEGORY_META[cat as RecipeCategory].label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="loading-spinner">Loading recipes…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📖</div>
            <h3>{recipes.length === 0 ? 'No recipes yet' : 'No results'}</h3>
            <p>{recipes.length === 0 ? 'Add your first formula to start building your apothecary library.' : 'Try a different search or filter.'}</p>
            {recipes.length === 0 && <button className="btn btn-primary" onClick={() => onNavigate('add-recipe')}>Add Recipe</button>}
          </div>
        ) : (
          <div className="grid-3">
            {filtered.map(recipe => {
              const meta = CATEGORY_META[recipe.category];
              return (
                <div key={recipe.id} className="card" style={{ cursor: 'pointer' }} onClick={() => openRecipe(recipe)}>
                  <div className="card-body">
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                      <div className={`recipe-category-icon ${meta.className}`}>{meta.emoji}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 4, lineHeight: 1.3 }}>{recipe.name}</div>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          <span className={`badge ${meta.badge}`}>{meta.label}</span>
                          <span className={`badge ${DIFF_BADGE[recipe.difficulty]}`}>{recipe.difficulty}</span>
                        </div>
                      </div>
                    </div>
                    {recipe.description && <p style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', lineHeight: 1.5, marginBottom: 10 }}>{recipe.description}</p>}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                      {recipe.prep_time_min ? <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> {recipe.prep_time_min} min</span> : <span />}
                      <ChevronRight size={14} style={{ color: 'var(--pink)' }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recipe Detail Modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className={`recipe-category-icon ${CATEGORY_META[selected.category].className}`}>{CATEGORY_META[selected.category].emoji}</div>
                <div>
                  <h3>{selected.name}</h3>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <span className={`badge ${CATEGORY_META[selected.category].badge}`}>{CATEGORY_META[selected.category].label}</span>
                    <span className={`badge ${DIFF_BADGE[selected.difficulty]}`}>{selected.difficulty}</span>
                    {selected.prep_time_min && <span className="badge badge-lavender"><Clock size={10} style={{ marginRight: 2 }} />{selected.prep_time_min} min</span>}
                  </div>
                </div>
              </div>
              <button className="close-btn" onClick={() => setSelected(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {selected.description && (
                <p style={{ fontSize: '0.9rem', color: 'var(--ink-soft)', lineHeight: 1.6, marginBottom: 20, fontStyle: 'italic' }}>{selected.description}</p>
              )}

              {ingredients.length > 0 && (
                <>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 10, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Ingredients ({ingredients.length})
                  </div>
                  <div style={{ marginBottom: 24 }}>
                    {ingredients.map(ing => (
                      <div key={ing.id} className="ingredient-row">
                        <span className="ingredient-amount">{ing.amount}{ing.unit ? ` ${ing.unit}` : ''}</span>
                        <span style={{ flex: 1 }}>{ing.ingredient_name}</span>
                        {ing.notes && <span style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', fontStyle: 'italic' }}>{ing.notes}</span>}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {steps.length > 0 && (
                <>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 14, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Steps
                  </div>
                  {steps.map(step => (
                    <div key={step.id} className="step-row">
                      <div className="step-number">{step.step_number}</div>
                      <div className="step-text">{step.instruction}</div>
                    </div>
                  ))}
                </>
              )}

              {selected.tags && selected.tags.length > 0 && (
                <div className="tag-row" style={{ marginTop: 16 }}>
                  {selected.tags.map(tag => <span key={tag} className="badge badge-lavender">{tag}</span>)}
                </div>
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
