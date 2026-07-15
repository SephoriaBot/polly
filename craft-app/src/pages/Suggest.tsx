import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { SlidersHorizontal, Sparkles, Search, AlertCircle, Database, Salad, Loader2, Check, Plus } from 'lucide-react'
import DrDietGroq from '../components/suggest/DrDietGroq'

const DIETS = ['vegetarian','vegan','gluten free','ketogenic','paleo','whole30']
const INTOLERANCES = ['dairy','egg','gluten','peanut','soy','tree nut']
const MAX_TIMES = [
  { label: 'any time', value: '' },
  { label: 'under 15 min', value: '15' },
  { label: 'under 30 min', value: '30' },
  { label: 'under 45 min', value: '45' },
]

const MEAL_TYPES = [
  { label: 'any meal', value: '' },
  { label: 'breakfast', value: 'breakfast' },
  { label: 'lunch', value: 'lunch' },
  { label: 'dinner', value: 'main course' },
  { label: 'drink', value: 'drink' },
]

const ALCOHOL_KEYWORDS = [
  'vodka','rum','gin','tequila','whiskey','whisky','bourbon','wine','beer',
  'champagne','prosecco','liqueur','brandy','cocktail','sangria','mojito',
  'margarita','martini','daiquiri','spritz','cider','mead','sake','schnapps',
]

function isAlcoholic(m: { title: string; summary?: string }) {
  const text = `${m.title} ${m.summary ?? ''}`.toLowerCase()
  return ALCOHOL_KEYWORDS.some(kw => text.includes(kw))
}

interface SpoonRecipe {
  id: number
  title: string
  image: string
  readyInMinutes: number
  servings: number
  vegetarian: boolean
  vegan: boolean
  glutenFree: boolean
  dairyFree: boolean
  summary: string
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g,'&').replace(/&#39;/g,"'").slice(0, 120) + '...'
}

type Mode = 'random' | 'search'

function chipStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? 'var(--pink)' : 'var(--cream)',
    border: `1px solid ${active ? 'var(--pink)' : 'var(--border)'}`,
    borderRadius: 999, padding: '5px 13px', fontSize: '0.72rem',
    color: active ? '#fff' : 'var(--ink-soft)', fontWeight: active ? 700 : 600,
    cursor: 'pointer', transition: 'all 0.15s', fontFamily: "'Nunito Sans', sans-serif",
  }
}

export default function Suggest() {
  const [mode, setMode] = useState<Mode>('random')
  const [query, setQuery] = useState('')
  const [selectedDiets, setSelectedDiets] = useState<Set<string>>(new Set(['vegetarian']))
  const [selectedIntolerances, setSelectedIntolerances] = useState<Set<string>>(new Set())
  const [maxTime, setMaxTime] = useState('')
  const [mealType, setMealType] = useState('')
  const [nonAlcoholicOnly, setNonAlcoholicOnly] = useState(false)
  const [loading, setLoading] = useState(false)
  const [meals, setMeals] = useState<SpoonRecipe[]>([])
  const [saved, setSaved] = useState<Set<number>>(new Set())
  const [savingId, setSavingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [showDietModal, setShowDietModal] = useState(false)

  function toggleSet(setFn: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) {
    setFn(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError('')
  }

  async function fetchRecipes() {
    if (mode === 'search' && !query.trim()) {
      setError('Type something to search for')
      return
    }

    setLoading(true)
    setError('')
    setMeals([])
    const params = new URLSearchParams({
      number: '6',
      addRecipeInformation: 'true',
      fillIngredients: 'false',
      apiKey: import.meta.env.VITE_SPOONACULAR_API_KEY,
    })

    if (mode === 'search') {
      params.set('query', query.trim())
    } else {
      params.set('sort', 'random')
    }

    if (selectedDiets.size) params.set('diet', [...selectedDiets].join(','))
    if (selectedIntolerances.size) params.set('intolerances', [...selectedIntolerances].join(','))
    if (maxTime) params.set('maxReadyTime', maxTime)
    if (mealType) params.set('type', mealType)

    try {
      const res = await fetch(`https://api.spoonacular.com/recipes/complexSearch?${params}`)
      const data = await res.json()
      if (data.code === 402) { setError('Spoonacular daily limit reached — try again tomorrow'); setLoading(false); return }

      let results: SpoonRecipe[] = data.results || []
      if (mealType === 'drink' && nonAlcoholicOnly) {
        results = results.filter(m => !isAlcoholic(m))
      }

      setMeals(results)
      if (!results.length) {
        setError(mode === 'search'
          ? `No recipes found for "${query.trim()}" — try different words or fewer filters`
          : 'No recipes found for those filters — try adjusting them')
      }
    } catch {
      setError('Could not load recipes — check your connection')
    }
    setLoading(false)
  }

  async function saveMeal(m: SpoonRecipe) {
    setSavingId(m.id)
    const tags = [
      m.vegetarian && 'vegetarian',
      m.vegan && 'vegan',
      m.glutenFree && 'gluten-free',
      m.dairyFree && 'dairy-free',
    ].filter(Boolean) as string[]

    let ingredients: string[] = []
    try {
      const params = new URLSearchParams({ apiKey: import.meta.env.VITE_SPOONACULAR_API_KEY })
      const res = await fetch(`https://api.spoonacular.com/recipes/${m.id}/information?${params}`)
      const data = await res.json()
      ingredients = (data.extendedIngredients || []).map((ing: any) => {
        const name = ing.name || ing.originalName || ing.original || ''
        return name
          .toLowerCase()
          .replace(/\(.*?\)/g, '')
          .replace(/[^a-z\s]/g, '')
          .trim()
      })
    } catch {
      // if this fails, we still save the meal without ingredients
    }

    const { error } = await supabase.from('meals').upsert(
      {
        spoonacular_id: m.id,
        name: m.title,
        time: `${m.readyInMinutes} min`,
        tags,
        ingredients,
      },
      { onConflict: 'name' }
    )

    if (!error) setSaved(s => new Set([...s, m.id]))
    setSavingId(null)
  }

  return (
    <div>
      <div className="page-body">

        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Salad size={20} style={{ color: 'var(--pink-dark)', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--ink)' }}>Not sure what to eat?</div>
              <div style={{ fontSize: '0.76rem', color: 'var(--ink-muted)' }}>Take a quick diet check-in with Dr. Groq</div>
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowDietModal(true)}>
            <Sparkles size={14} /> Ask Dr. Groq
          </button>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <SlidersHorizontal size={16} style={{ color: 'var(--pink)' }} /> Find Recipes That Work for You
          </h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginBottom: 12 }}>Search by name, or get a surprise pick</p>

          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <button style={chipStyle(mode === 'random')} onClick={() => switchMode('random')}>
                <Sparkles size={12} style={{ marginRight: 4, verticalAlign: -1 }} /> Surprise Me
              </button>
              <button style={chipStyle(mode === 'search')} onClick={() => switchMode('search')}>
                <Search size={12} style={{ marginRight: 4, verticalAlign: -1 }} /> Search
              </button>
            </div>
          </div>

          {mode === 'search' && (
            <div style={{ marginBottom: 10 }}>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. lemon pasta, chicken tacos..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') fetchRecipes() }}
                style={{ width: '100%' }}
              />
            </div>
          )}

          <div style={{ marginBottom: 10 }}>
            <div className="section-label" style={{ marginBottom: 5 }}>Diet</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {DIETS.map(d => (
                <button key={d} style={chipStyle(selectedDiets.has(d))} onClick={() => toggleSet(setSelectedDiets, d)}>{d}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div className="section-label" style={{ marginBottom: 5 }}>Avoid</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {INTOLERANCES.map(i => (
                <button key={i} style={chipStyle(selectedIntolerances.has(i))} onClick={() => toggleSet(setSelectedIntolerances, i)}>{i}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div className="section-label" style={{ marginBottom: 5 }}>Cook Time</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {MAX_TIMES.map(t => (
                <button key={t.value} style={chipStyle(maxTime === t.value)} onClick={() => setMaxTime(t.value)}>{t.label}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div className="section-label" style={{ marginBottom: 5 }}>Meal</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {MEAL_TYPES.map(m => (
                <button key={m.value} style={chipStyle(mealType === m.value)} onClick={() => setMealType(m.value)}>{m.label}</button>
              ))}
            </div>
          </div>

          {mealType === 'drink' && (
            <div style={{ marginBottom: 10 }}>
              <div className="section-label" style={{ marginBottom: 5 }}>Type</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <button style={chipStyle(nonAlcoholicOnly)} onClick={() => setNonAlcoholicOnly(v => !v)}>
                  non-alcoholic only
                </button>
              </div>
            </div>
          )}

          <button className="btn btn-primary" onClick={fetchRecipes} disabled={loading} style={{ marginTop: '0.5rem' }}>
            {loading
              ? <><Loader2 size={14} style={{ animation: 'suggestSpin 0.7s linear infinite' }} /> Loading...</>
              : mode === 'search'
                ? <><Search size={14} /> Search Recipes</>
                : <><Sparkles size={14} /> Surprise Me</>}
          </button>
        </div>

        {loading && (
          <div style={{ height: 2, background: 'var(--pink-light)', borderRadius: 1, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '40%', background: 'var(--pink)', animation: 'suggestSlide 1s ease-in-out infinite' }} />
          </div>
        )}

        {error && (
          <div className="empty-state">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {meals.length > 0 && (
          <>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: 'var(--pink-light)', color: 'var(--pink-dark)',
              fontSize: '0.68rem', fontWeight: 700, padding: '3px 10px', borderRadius: 999,
            }}>
              <Database size={11} /> Recipes from Spoonacular
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
              {meals.map(m => (
                <div key={m.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {m.image && <img src={m.image} alt={m.title} style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }} />}
                  <div style={{ padding: '10px 12px 12px' }}>
                    <h3 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 5, color: 'var(--ink)' }}>{m.title}</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', marginBottom: 6 }}>
                      {m.vegan && <span className="tag vegan">vegan</span>}
                      {m.vegetarian && !m.vegan && <span className="tag vegetarian">vegetarian</span>}
                      {m.glutenFree && <span className="tag gluten-free">gluten-free</span>}
                      {m.dairyFree && <span className="tag dairy-free">dairy-free</span>}
                      <span style={{ fontSize: '0.64rem', color: 'var(--ink-muted)', marginLeft: 'auto' }}>{m.readyInMinutes} min</span>
                    </div>
                    {m.summary && <p style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', lineHeight: 1.4, marginBottom: 2 }}>{stripHtml(m.summary)}</p>}
                    <button
                      className="btn btn-ghost"
                      style={{ width: '100%', justifyContent: 'center', fontSize: '0.68rem', padding: '5px 8px', marginTop: 8 }}
                      onClick={() => saveMeal(m)}
                      disabled={saved.has(m.id) || savingId === m.id}
                    >
                      {saved.has(m.id)
                        ? <><Check size={12} /> Saved!</>
                        : savingId === m.id
                          ? <><Loader2 size={12} style={{ animation: 'suggestSpin 0.7s linear infinite' }} /> Saving...</>
                          : <><Plus size={12} /> Save to My Meals</>}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && !error && meals.length === 0 && (
          <div className="empty-state">
            <Salad size={20} />
            {mode === 'search' ? 'Search for a recipe by name' : 'Hit Surprise Me for a random pick'}
          </div>
        )}

      </div>

      {showDietModal && <DrDietGroq onClose={() => setShowDietModal(false)} />}

      <style>{`
        @keyframes suggestSpin { to { transform: rotate(360deg); } }
        @keyframes suggestSlide { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }
      `}</style>
    </div>
  )
}
