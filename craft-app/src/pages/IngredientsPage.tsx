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

interface IngredientInfo {
  ingredient_name: string;
  description: string;
  benefits: string[];
  best_for: string[];
  usage_rate: string;
  category: string;
  ph_notes: string | null;
  cautions: string | null;
}

const INGREDIENT_DB: Record<string, IngredientInfo> = {
  'shea butter': {
    ingredient_name: 'Shea Butter',
    description: 'A fat extracted from the nut of the African shea tree. Rich in fatty acids and vitamins, it is solid at room temperature and melts on contact with skin.',
    benefits: ['Deep moisturizing', 'Anti-inflammatory', 'Promotes skin elasticity', 'Soothes dry and irritated skin'],
    best_for: ['Dry skin', 'Sensitive skin', 'Eczema-prone skin'],
    usage_rate: '2–30% in lotions, up to 100% as a straight butter',
    category: 'Occlusive / Emollient',
    ph_notes: null,
    cautions: 'May feel heavy in high concentrations for oily skin types.',
  },
  'jojoba oil': {
    ingredient_name: 'Jojoba Oil',
    description: 'A liquid wax extracted from the seed of the jojoba plant. Technically a wax ester, it closely mimics the skin\'s natural sebum and is very stable.',
    benefits: ['Balances oil production', 'Non-comedogenic', 'Long shelf life', 'Lightweight moisturizer'],
    best_for: ['All skin types', 'Acne-prone skin', 'Oily skin'],
    usage_rate: '1–100%',
    category: 'Emollient',
    ph_notes: null,
    cautions: null,
  },
  'niacinamide': {
    ingredient_name: 'Niacinamide (Vitamin B3)',
    description: 'A water-soluble form of vitamin B3. One of the most well-researched skincare actives with a wide range of benefits and excellent tolerability.',
    benefits: ['Reduces pore appearance', 'Controls sebum', 'Brightens skin tone', 'Strengthens skin barrier', 'Reduces redness'],
    best_for: ['Oily skin', 'Acne-prone skin', 'Hyperpigmentation', 'Aging skin'],
    usage_rate: '2–10%',
    category: 'Active',
    ph_notes: 'Stable between pH 5–7. Avoid combining with high-concentration vitamin C as it can cause flushing.',
    cautions: 'At concentrations above 10% may cause flushing in sensitive individuals.',
  },
  'glycerin': {
    ingredient_name: 'Glycerin (Glycerol)',
    description: 'A simple polyol compound that occurs naturally in all living things. One of the most effective and widely used humectants in cosmetics.',
    benefits: ['Draws moisture into skin', 'Improves skin barrier', 'Enhances product spreadability', 'Non-irritating'],
    best_for: ['All skin types', 'Dehydrated skin', 'Sensitive skin'],
    usage_rate: '1–10% in leave-on products',
    category: 'Humectant',
    ph_notes: null,
    cautions: 'At very high concentrations (above 30%) can draw moisture out of skin in low-humidity environments.',
  },
  'hyaluronic acid': {
    ingredient_name: 'Hyaluronic Acid (Sodium Hyaluronate)',
    description: 'A naturally occurring polysaccharide found in connective tissue. Capable of holding up to 1000x its weight in water, making it an exceptional humectant.',
    benefits: ['Intense hydration', 'Plumps fine lines', 'Lightweight feel', 'Compatible with most ingredients'],
    best_for: ['All skin types', 'Dehydrated skin', 'Aging skin'],
    usage_rate: '0.1–2%',
    category: 'Humectant',
    ph_notes: 'Most effective between pH 5–8.',
    cautions: 'Apply to damp skin and seal with an occlusive to prevent moisture loss in dry climates.',
  },
  'btms-50': {
    ingredient_name: 'BTMS-50 (Behentrimonium Methosulfate)',
    description: 'A conditioning emulsifying wax derived from rapeseed oil. Creates rich, creamy emulsions and is a popular choice for hair and skin conditioning products.',
    benefits: ['Effective emulsifier', 'Adds conditioning', 'Creates stable emulsions', 'Imparts silky skin feel'],
    best_for: ['Lotions', 'Creams', 'Hair conditioners'],
    usage_rate: '4–8% as primary emulsifier',
    category: 'Emulsifier',
    ph_notes: null,
    cautions: null,
  },
  'cetyl alcohol': {
    ingredient_name: 'Cetyl Alcohol',
    description: 'A fatty alcohol derived from palm or coconut oil. Despite the name, it is not a drying alcohol — it is a waxy solid that thickens and conditions.',
    benefits: ['Thickens formulas', 'Adds emolliency', 'Improves texture', 'Stabilizes emulsions'],
    best_for: ['Creams', 'Lotions', 'Conditioners'],
    usage_rate: '1–6%',
    category: 'Emollient / Thickener',
    ph_notes: null,
    cautions: null,
  },
  'vitamin e': {
    ingredient_name: 'Vitamin E (Tocopherol)',
    description: 'A fat-soluble antioxidant naturally found in many plant oils. Used in formulations primarily to extend shelf life and provide skin benefits.',
    benefits: ['Antioxidant protection', 'Extends product shelf life', 'Moisturizing', 'Supports skin healing'],
    best_for: ['Dry skin', 'Aging skin', 'Oil-based formulas'],
    usage_rate: '0.5–1%',
    category: 'Antioxidant',
    ph_notes: null,
    cautions: 'Can cause allergic reactions in some individuals at higher concentrations.',
  },
  'aloe vera': {
    ingredient_name: 'Aloe Vera Gel',
    description: 'A gel extracted from the leaves of the aloe plant. Contains polysaccharides, vitamins, and minerals with well-documented soothing properties.',
    benefits: ['Soothes irritated skin', 'Lightweight hydration', 'Anti-inflammatory', 'Cooling effect'],
    best_for: ['Sensitive skin', 'Sunburned skin', 'Oily skin'],
    usage_rate: '2–98%',
    category: 'Humectant / Soothing Agent',
    ph_notes: 'pH around 4.5–5.5.',
    cautions: 'Some people have aloe allergies — patch test recommended.',
  },
  'sodium percarbonate': {
    ingredient_name: 'Sodium Percarbonate',
    description: 'An oxidizing agent that releases hydrogen peroxide when dissolved in water. Used as an oxygen bleach in laundry and cleaning formulations.',
    benefits: ['Effective stain removal', 'Brightens whites', 'Kills bacteria and mold', 'Breaks down to water and soda ash'],
    best_for: ['Laundry powder', 'Cleaning products', 'Whitening formulas'],
    usage_rate: '10–30% in laundry powder',
    category: 'Oxidizing Agent / Bleach',
    ph_notes: 'Creates alkaline solution when dissolved.',
    cautions: 'Keep dry — moisture activates it. Not for use on wool or silk. Irritating to eyes.',
  },
  'washing soda': {
    ingredient_name: 'Washing Soda (Sodium Carbonate)',
    description: 'A highly alkaline salt used as a water softener and cleaning booster. Also known as soda ash, it is a key ingredient in DIY laundry formulas.',
    benefits: ['Softens hard water', 'Boosts cleaning power', 'Removes grease and stains', 'Inexpensive'],
    best_for: ['Laundry powder', 'Cleaning products'],
    usage_rate: '30–50% in laundry powder',
    category: 'Alkaline Builder',
    ph_notes: 'Highly alkaline — pH around 11.',
    cautions: 'Irritating to skin and eyes. Not for delicate fabrics. Do not confuse with baking soda.',
  },
  'slsa': {
    ingredient_name: 'SLSA (Sodium Lauryl Sulfoacetate)',
    description: 'A mild, plant-derived surfactant that creates a fluffy lather. Often confused with SLS but much gentler and derived from coconut and palm oils.',
    benefits: ['Gentle cleansing', 'Rich fluffy lather', 'Less irritating than SLS', 'Safe for sensitive skin'],
    best_for: ['Bath bombs', 'Bubble bath', 'Gentle cleansers', 'Laundry powder'],
    usage_rate: '5–25%',
    category: 'Surfactant',
    ph_notes: null,
    cautions: 'Fine powder — use a mask when handling to avoid inhaling.',
  },
  'coconut oil': {
    ingredient_name: 'Coconut Oil',
    description: 'A saturated fat extracted from fresh coconut meat. High in lauric acid, it is solid at room temperature and has antimicrobial properties.',
    benefits: ['Moisturizing', 'Antimicrobial', 'Creates hard bar soap', 'Good lather in soap making'],
    best_for: ['Soap making', 'Hair care', 'Body products'],
    usage_rate: '15–30% in soap, 1–10% in skin products',
    category: 'Occlusive / Emollient',
    ph_notes: null,
    cautions: 'Comedogenic rating of 4 — can clog pores for acne-prone skin in leave-on products. Fractionated coconut oil is lighter and non-comedogenic.',
  },
  'castile soap': {
    ingredient_name: 'Castile Soap',
    description: 'A vegetable-based soap traditionally made with olive oil, now referring broadly to any plant-oil-based liquid or bar soap without synthetic detergents.',
    benefits: ['Gentle cleansing', 'Biodegradable', 'Versatile', 'Free of synthetic detergents'],
    best_for: ['Sensitive skin', 'Natural cleaning', 'DIY household products'],
    usage_rate: 'As needed — used as a base',
    category: 'Surfactant / Cleanser',
    ph_notes: 'Highly alkaline — pH 9–11. Do not mix with acidic ingredients like vinegar.',
    cautions: 'Mixing with acids (vinegar, citric acid) will unsaponify the soap and cause curdling.',
  },
  'sunflower oil': {
    ingredient_name: 'Sunflower Seed Oil',
    description: 'A light, non-greasy oil high in linoleic acid extracted from sunflower seeds. One of the best oils for sensitive and acne-prone skin.',
    benefits: ['High linoleic acid content', 'Lightweight', 'Supports skin barrier', 'Non-comedogenic'],
    best_for: ['Sensitive skin', 'Acne-prone skin', 'Dry skin'],
    usage_rate: '1–100%',
    category: 'Emollient',
    ph_notes: null,
    cautions: 'Shorter shelf life than some oils — add vitamin E to extend.',
  },
  'beeswax': {
    ingredient_name: 'Beeswax',
    description: 'A natural wax produced by honeybees. Used in cosmetics to thicken, provide structure, and create a protective barrier on the skin.',
    benefits: ['Thickens and hardens formulas', 'Creates protective barrier', 'Locks in moisture', 'Natural preservative properties'],
    best_for: ['Lip balm', 'Body butter', 'Salves', 'Lotion bars'],
    usage_rate: '5–30% depending on desired hardness',
    category: 'Wax / Thickener',
    ph_notes: null,
    cautions: 'Not vegan. Can feel heavy on skin at high concentrations.',
  },
  'colloidal oatmeal': {
    ingredient_name: 'Colloidal Oatmeal',
    description: 'Finely milled oats processed to disperse in water. FDA-approved as a skin protectant with well-documented anti-itch and soothing properties.',
    benefits: ['Soothes itch and irritation', 'Anti-inflammatory', 'Gentle exfoliation', 'Strengthens skin barrier'],
    best_for: ['Eczema', 'Sensitive skin', 'Dry itchy skin'],
    usage_rate: '0.5–5%',
    category: 'Soothing Agent / Skin Protectant',
    ph_notes: null,
    cautions: 'Must be finely milled to disperse properly. Avoid in formulas if oat allergy is a concern.',
  },
  'panthenol': {
    ingredient_name: 'Panthenol (Pro-Vitamin B5)',
    description: 'The alcohol form of pantothenic acid (vitamin B5). Converts to vitamin B5 in the skin and is prized for its moisturizing and healing properties.',
    benefits: ['Deep moisturizing', 'Promotes wound healing', 'Reduces inflammation', 'Improves skin elasticity'],
    best_for: ['Dry skin', 'Damaged skin', 'Hair care'],
    usage_rate: '0.5–5%',
    category: 'Humectant / Skin Conditioning Agent',
    ph_notes: 'Stable between pH 4–7.',
    cautions: null,
  },
  'allantoin': {
    ingredient_name: 'Allantoin',
    description: 'A naturally occurring compound found in comfrey root. Known for its ability to soothe skin and accelerate cell regeneration.',
    benefits: ['Soothes and calms skin', 'Promotes cell turnover', 'Anti-irritant', 'Softens keratin'],
    best_for: ['Sensitive skin', 'Acne-prone skin', 'After-sun care'],
    usage_rate: '0.1–2%',
    category: 'Soothing Agent',
    ph_notes: 'Dissolves better in warm water. Add to water phase when heated.',
    cautions: null,
  },
  'citric acid': {
    ingredient_name: 'Citric Acid',
    description: 'A weak organic acid found naturally in citrus fruits. Used in cosmetics primarily to adjust pH and as a preservative booster.',
    benefits: ['pH adjustment', 'Preservative booster', 'Mild AHA exfoliant at higher concentrations', 'Chelating agent'],
    best_for: ['pH adjustment in all formulas', 'Bath bombs (reacts with baking soda)', 'Toners'],
    usage_rate: 'As needed for pH adjustment, 1–10% as active',
    category: 'pH Adjuster / AHA',
    ph_notes: 'Very acidic — use in small amounts to lower pH. Key ingredient in bath bomb fizz reaction.',
    cautions: 'Do not mix directly with castile soap or other alkaline ingredients without diluting first.',
  },
};

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
