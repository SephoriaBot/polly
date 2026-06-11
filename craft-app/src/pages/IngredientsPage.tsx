import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { RecipeCategory } from '../types';

interface IngredientEntry {
  ingredient_name: string;
  count: number;
  categories: RecipeCategory[];
}

const CATEGORY_META: Record<RecipeCategory, { label: string; badge: string }> = {
  skincare: { label: 'Skincare', badge: 'badge-pink' },
  soap:     { label: 'Soap', badge: 'badge-lavender' },
  laundry:  { label: 'Laundry', badge: 'badge-green' },
};

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<IngredientEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { loadIngredients(); }, []);

  async function loadIngredients() {
    setLoading(true);
    const { data } = await supabase
      .from('recipe_ingredients')
      .select('ingredient_name, recipe_id, recipes(category)');

    if (!data) { setLoading(false); return; }

    const map = new Map<string, { count: number; categories: Set<RecipeCategory> }>();
    for (const row of data) {
      const name = row.ingredient_name;
      const cat = (row as any).recipes?.category as RecipeCategory;
      if (!map.has(name)) map.set(name, { count: 0, categories: new Set() });
      const entry = map.get(name)!;
      entry.count++;
      if (cat) entry.categories.add(cat);
    }

    const sorted = Array.from(map.entries())
      .map(([ingredient_name, { count, categories }]) => ({
        ingredient_name,
        count,
        categories: Array.from(categories),
      }))
      .sort((a, b) => b.count - a.count || a.ingredient_name.localeCompare(b.ingredient_name));

    setIngredients(sorted);
    setLoading(false);
  }

  const filtered = ingredients.filter(i =>
    !search || i.ingredient_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Ingredients 🧪</h2>
          <p>{ingredients.length} unique ingredient{ingredients.length !== 1 ? 's' : ''} across your recipes</p>
        </div>
      </div>

      <div className="page-body">
        <div style={{ position: 'relative', maxWidth: 360, marginBottom: 24 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-muted)' }} />
          <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Search ingredients…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="loading-spinner">Loading ingredients…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🧴</div>
            <h3>{ingredients.length === 0 ? 'No ingredients yet' : 'No results'}</h3>
            <p>Ingredients are pulled automatically from your recipes. Add a recipe to see them here.</p>
          </div>
        ) : (
          <div className="card">
            {filtered.map((ing, i) => (
              <div key={ing.ingredient_name} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--blush)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
                  🌿
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: '0.9rem', marginBottom: 4 }}>{ing.ingredient_name}</div>
                  <div className="tag-row">
                    {ing.categories.map(cat => (
                      <span key={cat} className={`badge ${CATEGORY_META[cat].badge}`}>{CATEGORY_META[cat].label}</span>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', flexShrink: 0 }}>
                  {ing.count} recipe{ing.count !== 1 ? 's' : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
