import { useState, useEffect } from 'react'
import { ArrowRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Icon, { type IconName } from '../Icon';

const CONVERSIONS = {
  us: [
    { from: '1 cup',          to: '16 tbsp' },
    { from: '1 tbsp',         to: '3 tsp' },
    { from: '1 cup',          to: '8 fl oz' },
    { from: '1 lb',           to: '16 oz' },
    { from: '1 stick butter', to: '½ cup / 8 tbsp' },
  ],
  metric: [
    { from: '1 cup',  to: '240 ml' },
    { from: '1 tbsp', to: '15 ml' },
    { from: '1 tsp',  to: '5 ml' },
    { from: '1 oz',   to: '28 g' },
    { from: '1 lb',   to: '454 g' },
  ],
}

const TRAILING_STOPWORDS = [
  'to taste','or more','as needed','such as','about','approx','approximately',
  'optional','if desired','for serving','for garnish','for topping',
]

function cleanIngredient(raw: string): string {
  const units = new Set([
    'cup','cups','tbsp','tsp','tablespoon','tablespoons','teaspoon','teaspoons',
    'oz','ounce','ounces','lb','lbs','pound','pounds','g','gram','grams',
    'kg','ml','l','liter','liters','pinch','dash','can','cans','clove','cloves',
    'slice','slices','piece','pieces','large','medium','small','whole','bunch',
    'handful','package','packages','pkg','sprig','sprigs','stalk','stalks',
    'head','heads','quart','quarts','pint','pints','gallon','gallons',
  ])
  const skipWords = new Set([
    'of','fresh','dried','ground','chopped','minced','diced','sliced','to',
    'taste','or','and','finely','roughly','coarsely','about','approximately',
  ])

  let cleaned = raw.replace(/\(.*?\)/g, '').trim()

  for (const phrase of TRAILING_STOPWORDS) {
    const idx = cleaned.toLowerCase().indexOf(phrase)
    if (idx !== -1) cleaned = cleaned.slice(0, idx).trim()
  }

  const commaIdx = cleaned.indexOf(',')
  if (commaIdx !== -1) cleaned = cleaned.slice(0, commaIdx).trim()

  const words = cleaned.split(/\s+/)
  const start = words.findIndex(w => {
    const c = w.toLowerCase().replace(/[.,;:]/g, '')
    return (
      c.length > 0 &&
      isNaN(parseFloat(c)) &&
      !/^[\d/¼½¾⅓⅔⅛⅜⅝⅞-]+$/.test(c) &&
      !units.has(c) &&
      !skipWords.has(c)
    )
  })

  const result = (start === -1 ? cleaned : words.slice(start).join(' '))
    .replace(/[,;:]+$/, '')
    .trim()

  return result || raw
}

function normalizeForDedup(name: string): string {
  let n = name.toLowerCase().trim()
  if (n.endsWith('es') && n.length > 4) n = n.slice(0, -2)
  else if (n.endsWith('s') && !n.endsWith('ss') && n.length > 3) n = n.slice(0, -1)
  return n
}

interface Ingredient { name: string; measure: string }
interface MealData {
  id: string
  title: string
  thumb: string
  ingredients: Ingredient[]
  steps: string[]
  category: string
}

interface RecipeModalProps {
  mealId: number
  onClose: () => void
}

export default function RecipeModal({ mealId, onClose }: RecipeModalProps) {
  const [meal, setMeal] = useState<MealData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(0)
  const [unit, setUnit] = useState<'us' | 'metric'>('us')
  const [addingToCart, setAddingToCart] = useState(false)
  const [addedToCart, setAddedToCart] = useState(false)

  useEffect(() => {
    fetchMeal(mealId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealId])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  async function fetchMeal(id: number) {
    setLoading(true)
    setError('')
    setMeal(null)
    setStep(0)

    try {
      const res = await fetch(
        `https://api.spoonacular.com/recipes/${id}/information?apiKey=${import.meta.env.VITE_SPOONACULAR_API_KEY}`
      )
      const data = await res.json()

      setMeal({
        id: String(data.id),
        title: data.title,
        thumb: data.image,
        category: data.dishTypes?.join(', ') || '',
        ingredients: (data.extendedIngredients || []).map((i: any) => ({
          name: i.name,
          measure: i.originalMeasure || i.original || ''
        })),
        steps:
          data.analyzedInstructions?.[0]?.steps?.map((s: any) => s.step) ??
          ['No instructions available']
      })
    } catch {
      setError('Could not load recipe.')
    }

    setLoading(false)
  }

  async function addMissingToCart() {
    if (!meal || !meal.ingredients.length) return
    setAddingToCart(true)

    const cleanedNames = meal.ingredients.map(i => cleanIngredient(i.name))
    const seen = new Map<string, string>()
    for (const name of cleanedNames) {
      const key = normalizeForDedup(name)
      if (!seen.has(key)) seen.set(key, name)
    }

    const { data: existing } = await supabase.from('grocery_items').select('name')
    const existingKeys = new Set((existing ?? []).map(e => normalizeForDedup(e.name)))

    const rows = Array.from(seen.entries())
      .filter(([key]) => !existingKeys.has(key))
      .map(([, name]) => ({ name, qty: '', checked: false }))

    if (rows.length) {
      await supabase.from('grocery_items').insert(rows)
    }

    setAddingToCart(false)
    setAddedToCart(true)
    setTimeout(() => setAddedToCart(false), 2000)
  }

  const progressPct = meal
    ? meal.steps.length > 1 ? Math.round((step / (meal.steps.length - 1)) * 100) : 100
    : 0

  function pillStyle() {
    return {
      fontSize: '0.68rem', fontWeight: 700, color: 'var(--pink-dark)',
      background: 'var(--white)', border: '1px solid var(--pink-light)',
      borderRadius: 999, padding: '3px 10px',
    } as React.CSSProperties
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 760, width: '95%', maxHeight: '90vh', overflowY: 'auto', padding: 0 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ background: 'var(--blush)', color: 'var(--pink-dark)', position: 'sticky', top: 0, zIndex: 1 }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="icon-chefhat" size={16} /> {meal?.title || 'Recipe'}
          </span>
          <button className="close-btn" onClick={onClose}><Icon name="icon-clear" size={16} /></button>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <div style={{
              width: 24, height: 24, margin: '0 auto 10px',
              border: '2.5px solid var(--pink-light)', borderTopColor: 'var(--pink-dark)',
              borderRadius: '50%', animation: 'cookSpin 0.7s linear infinite',
            }} />
            <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>Loading recipe…</span>
          </div>
        )}

        {error && (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--danger)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <Icon name="icon-alertcircle" size={20} />
            <span style={{ fontSize: '0.85rem' }}>{error}</span>
          </div>
        )}

        {meal && !loading && (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              background: 'var(--blush)', padding: '16px 18px',
            }}>
              {meal.thumb && (
                <img src={meal.thumb} alt={meal.title} style={{
                  width: 80, height: 80, objectFit: 'cover',
                  borderRadius: 'var(--radius-sm)', flexShrink: 0,
                }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {meal.category && <span style={pillStyle()}>{meal.category}</span>}
                  <span style={pillStyle()}>{meal.steps.length} steps</span>
                  <span style={pillStyle()}>{meal.ingredients.length} ingredients</span>
                </div>
              </div>
              <button
                className="btn btn-primary"
                style={{ flexShrink: 0, fontSize: '0.72rem' }}
                onClick={addMissingToCart}
                disabled={addingToCart || addedToCart}
              >
                {addedToCart
                  ? <><Icon name="groq_7" size={13} /> Added!</>
                  : addingToCart
                    ? <><Icon name="icon-loader2" size={13} style={{ animation: 'cookSpin 0.7s linear infinite' }} /> Adding...</>
                    : <><Icon name="groq_10" size={13} /> Add missing to cart</>}
              </button>
            </div>

            <div className="cook-grid" style={{ display: 'grid', gridTemplateColumns: '230px 1fr', minHeight: 380 }}>

              {/* INGREDIENTS */}
              <div style={{ borderRight: '1px solid var(--border)', padding: 16, display: 'flex', flexDirection: 'column' }}>
                <div className="section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span>Ingredients</span>
                  <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                    <button
                      onClick={() => setUnit('us')}
                      style={{
                        background: unit === 'us' ? 'var(--pink-dark)' : 'none', color: unit === 'us' ? '#fff' : 'var(--ink-muted)',
                        border: 'none', padding: '3px 8px', fontSize: '0.6rem', cursor: 'pointer',
                        fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase',
                      }}
                    >US</button>
                    <button
                      onClick={() => setUnit('metric')}
                      style={{
                        background: unit === 'metric' ? 'var(--pink-dark)' : 'none', color: unit === 'metric' ? '#fff' : 'var(--ink-muted)',
                        border: 'none', padding: '3px 8px', fontSize: '0.6rem', cursor: 'pointer',
                        fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase',
                      }}
                    >Metric</button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 14 }}>
                  {meal.ingredients.map((ing, i) => {
                    const isActive = meal.steps[step]?.toLowerCase().includes(ing.name.toLowerCase())
                    return (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                        padding: '6px 8px', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem',
                        background: isActive ? 'var(--blush)' : 'transparent',
                        borderLeft: isActive ? '2px solid var(--pink-dark)' : '2px solid transparent',
                        transition: 'background 0.1s',
                      }}>
                        <span style={{ flex: 1, color: 'var(--ink)' }}>{ing.name}</span>
                        <span style={{ color: 'var(--pink-dark)', fontWeight: 600, fontSize: '0.72rem', textAlign: 'right', minWidth: 65, marginLeft: 8 }}>{ing.measure}</span>
                      </div>
                    )
                  })}
                </div>

                <div style={{ background: 'var(--cream)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginTop: 'auto' }}>
                  <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--ink-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'IBM Plex Mono', monospace" }}>
                    Quick Conversions
                  </div>
                  {CONVERSIONS[unit].map((c, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', padding: '2px 0', color: 'var(--ink-muted)' }}>
                      <span>{c.from}</span>
                      <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{c.to}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* STEPS */}
              <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column' }}>
                <div className="section-label">Steps</div>

                <div style={{ height: 6, background: 'var(--border)', borderRadius: 999, marginBottom: 14, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 999, width: `${progressPct}%`,
                    background: 'linear-gradient(90deg, var(--secondary), var(--pink-dark))',
                    transition: 'width 0.3s',
                  }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  {meal.steps.map((s, i) => {
                    const state = i < step ? 'done' : i === step ? 'active' : 'pending'
                    return (
                      <div
                        key={i}
                        onClick={() => setStep(i)}
                        style={{
                          border: `1.5px solid ${state === 'active' ? 'var(--pink-dark)' : 'var(--border)'}`,
                          background: state === 'active' ? 'var(--blush)' : 'var(--white)',
                          borderRadius: 'var(--radius-md)', padding: '10px 12px',
                          cursor: 'pointer', opacity: state === 'done' ? 0.55 : 1,
                          transition: 'all 0.15s',
                        }}
                      >
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 20, height: 20, borderRadius: '50%', marginBottom: 6,
                          background: state === 'active' ? 'var(--pink-dark)' : state === 'done' ? 'var(--pink-dark)' : 'var(--cream)',
                          border: `1px solid ${state === 'pending' ? 'var(--border)' : 'var(--pink-dark)'}`,
                          color: state === 'pending' ? 'var(--ink-muted)' : '#fff',
                          fontSize: '0.62rem', fontWeight: 700,
                        }}>
                          {i < step ? <Icon name="groq_7" size={11} /> : i + 1}
                        </div>
                        <div style={{ fontSize: '0.85rem', lineHeight: 1.55, color: state === 'done' ? 'var(--ink-muted)' : 'var(--ink)' }}>
                          {s}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                  <button
                    className="btn btn-ghost"
                    style={{ flex: 1, justifyContent: 'center' }}
                    disabled={step === 0}
                    onClick={() => setStep(s => s - 1)}
                  >
                    <Icon name="icon-arrowleft" size={14} /> Prev
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => step < meal.steps.length - 1 ? setStep(s => s + 1) : undefined}
                  >
                    {step === meal.steps.length - 1
                      ? <><Icon name="groq_7" size={14} /> Done!</>
                      : <>Next <ArrowRight size={14} /></>}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes cookSpin { to { transform: rotate(360deg); } }
        @media (max-width: 800px) {
          .cook-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
