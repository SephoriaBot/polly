import { useEffect, useState } from 'react';
import { Search, Plus, X, Pencil, Trash2 } from 'lucide-react';
import { searchIngredient } from "../../api/ingredientApi";
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
  const [apiResult, setApiResult] = useState<any>(null);
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

  const filtered = ingredients.filter(i =>
    !search || i.name.toLowerCase().includes(search.toLowerCase())
  );

 return (
  <div>
    <div className="page-header">
      <div>
        <h2>Ingredients 🧪</h2>
        <p>
          {ingredients.length} ingredient{ingredients.length !== 1 ? 's' : ''} in your pantry
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={14} /> Add Ingredient
        </button>

        <button
          className="btn btn-primary"
          onClick={async () => {
            console.log("clicked");

            if (!search) return;

            setLoadingApi(true);
            const res = await searchIngredient(search);
            setApiResult(res);
            setLoadingApi(false);
          }}
        >
          AI Lookup
        </button>
      </div>
    </div>

    <div className="page-body">
        <div style={{ position: 'relative', maxWidth: 360, marginBottom: 24 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-muted)' }} />
          <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Search ingredients…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

{apiResult && (
  <div className="card" style={{ marginBottom: 16 }}>
    <h3>{apiResult.ingredient_name}</h3>

    <p>{apiResult.description}</p>

    <p>
      <b>Benefits:</b> {apiResult.benefits?.join(", ")}
    </p>

    <p>
      <b>Best for:</b> {apiResult.best_for?.join(", ")}
    </p>

    <p>
      <b>Usage:</b> {apiResult.usage_rate}</p>
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