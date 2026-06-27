import { useEffect, useState } from 'react';
import { Search, Plus, X, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CraftIngredient {
  id: string;
  name: string;
  category: string | null;
  notes: string | null;
  created_at: string;
}

const CATEGORY_OPTIONS = ['Skincare', 'Soap', 'Laundry', 'Other'];

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<CraftIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [apiResult, setApiResult] = useState<IngredientInfo | null>(null);
  const [loadingApi, setLoadingApi] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CraftIngredient | null>(null);
  const [form, setForm] = useState({ name: '', category: 'Other', notes: '' });

  useEffect(() => { loadIngredients(); }, []);

  async function loadIngredients() {
    setLoading(true);
    const { data } = await supabase
      .from('craft_ingredients')
      .select('*')
      .order('name');
    setIngredients(data ?? []);
    setLoading(false);
  }

  function openAdd() {
    setEditing(null);
    setForm({ name: '', category: 'Other', notes: '' });
    setShowModal(true);
  }

  function openEdit(ing: CraftIngredient) {
    setEditing(ing);
    setForm({ name: ing.name, category: ing.category ?? 'Other', notes: ing.notes ?? '' });
    setShowModal(true);
  }

  async function saveIngredient() {
    if (!form.name.trim()) return;
    if (editing) {
      const { data } = await supabase
        .from('craft_ingredients')
        .update({ name: form.name.trim(), category: form.category, notes: form.notes.trim() })
        .eq('id', editing.id)
        .select().single();
      if (data) setIngredients(prev => prev.map(i => i.id === editing.id ? data : i).sort((a, b) => a.name.localeCompare(b.name)));
    } else {
      const { data } = await supabase
        .from('craft_ingredients')
        .insert({ name: form.name.trim(), category: form.category, notes: form.notes.trim() })
        .select().single();
      if (data) setIngredients(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    }
    setShowModal(false);
  }

  async function deleteIngredient(id: string) {
    if (!confirm('Delete this ingredient?')) return;
    await supabase.from('craft_ingredients').delete().eq('id', id);
    setIngredients(prev => prev.filter(i => i.id !== id));
  }

  function lookupIngredient() {
    if (!search.trim()) return;
    setLoadingApi(true);
    setApiResult(null);
    const key = search.trim().toLowerCase();
    const match = INGREDIENT_DB[key] ?? Object.values(INGREDIENT_DB).find(v =>
      v.ingredient_name.toLowerCase().includes(key) || key.includes(v.ingredient_name.toLowerCase())
    ) ?? null;
    setApiResult(match ?? {
      ingredient_name: search.trim(),
      description: 'This ingredient isn\'t in the database yet. Try a common name like "shea butter", "glycerin", or "niacinamide".',
      benefits: [],
      best_for: [],
      usage_rate: '',
      category: '',
      ph_notes: null,
      cautions: null,
    });
    setLoadingApi(false);
  }

  const filtered = ingredients.filter(i =>
    !search || i.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Ingredients 🧪</h2>
          <p>{ingredients.length} ingredient{ingredients.length !== 1 ? 's' : ''} in your pantry</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={14} /> Add Ingredient
          </button>
          <button className="btn btn-primary" onClick={lookupIngredient} disabled={loadingApi || !search.trim()}>
            {loadingApi ? 'Looking up…' : '🔬 Lookup'}
          </button>
        </div>
      </div>

      <div className="page-body">
        <div style={{ position: 'relative', maxWidth: 360, marginBottom: 24 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-muted)' }} />
          <input
            className="form-input"
            style={{ paddingLeft: 32 }}
            placeholder="Search or look up an ingredient…"
            value={search}
            onChange={e => { setSearch(e.target.value); setApiResult(null); }}
            onKeyDown={e => e.key === 'Enter' && lookupIngredient()}
          />
        </div>

        {apiResult && (
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--ink)', marginBottom: 4 }}>{apiResult.ingredient_name}</div>
                  {apiResult.category && <span className="badge badge-pink">{apiResult.category}</span>}
                </div>
                <button onClick={() => setApiResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)', padding: 0 }}>
                  <X size={16} />
                </button>
              </div>

              <p style={{ fontSize: '0.875rem', color: 'var(--ink-soft)', lineHeight: 1.6, marginBottom: 14 }}>{apiResult.description}</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                {apiResult.benefits?.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Benefits</div>
                    {apiResult.benefits.map((b, i) => (
                      <div key={i} style={{ fontSize: '0.82rem', color: 'var(--ink-soft)', marginBottom: 3 }}>• {b}</div>
                    ))}
                  </div>
                )}
                {apiResult.best_for?.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Best For</div>
                    {apiResult.best_for.map((b, i) => (
                      <div key={i} style={{ fontSize: '0.82rem', color: 'var(--ink-soft)', marginBottom: 3 }}>• {b}</div>
                    ))}
                  </div>
                )}
              </div>

              {apiResult.usage_rate && (
                <div style={{ fontSize: '0.82rem', color: 'var(--ink-soft)', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600 }}>Usage rate:</span> {apiResult.usage_rate}
                </div>
              )}
              {apiResult.ph_notes && (
                <div style={{ fontSize: '0.82rem', color: 'var(--ink-soft)', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600 }}>pH notes:</span> {apiResult.ph_notes}
                </div>
              )}
              {apiResult.cautions && (
                <div style={{ fontSize: '0.82rem', color: '#b45309', background: '#fef3c7', borderRadius: 8, padding: '8px 12px', marginTop: 8 }}>
                  ⚠ {apiResult.cautions}
                </div>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <div className="loading-spinner">Loading ingredients…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🧴</div>
            <h3>{ingredients.length === 0 ? 'No ingredients yet' : 'No results'}</h3>
            <p>Add ingredients to build your personal craft pantry.</p>
          </div>
        ) : (
          <div className="card">
            {filtered.map((ing, i) => (
              <div key={ing.id} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--blush)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
                  🌿
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>{ing.name}</div>
                  <div className="tag-row" style={{ alignItems: 'center', gap: 8 }}>
                    {ing.category && <span className="badge badge-pink">{ing.category}</span>}
                    {ing.notes && <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>{ing.notes}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(ing)}>
                    <Pencil size={13} />
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteIngredient(ing.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing ? 'Edit Ingredient' : 'Add Ingredient'}</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Shea Butter" />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Where to buy, substitutions, etc." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveIngredient}>{editing ? 'Save Changes' : 'Add Ingredient'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
