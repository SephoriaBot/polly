import React, { useState, useEffect } from 'react';
import Icon from '../components/Icon';
import type { WeekPlan } from '../types/legacy';
import { supabase } from '../lib/supabase';
import {
  SlidersHorizontal, Sparkles, Search, AlertCircle, Database, Salad,
  Loader2, Check, Plus, X, Heart, ChefHat, Trash2, ShoppingCart, CalendarDays,
} from 'lucide-react';
import DrDietGroq from '../components/suggest/DrDietGroq';
import RecipeModal from '../components/meals/RecipeModal';
import Lantern from "../components/Lantern";

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const MEAL_TYPES_WEEK = ['breakfast','lunch','dinner'] as const
const EMPTY_PLAN: WeekPlan = Object.fromEntries(
  DAYS.map(d => [d, { breakfast: null, lunch: null, dinner: null }])
)

const DIETS = ['vegetarian','vegan','gluten free','ketogenic','paleo','whole30']
const INTOLERANCES = ['dairy','egg','gluten','peanut','soy','tree nut']
const MAX_TIMES = [
  { label: 'any time', value: '' },
  { label: 'under 15 min', value: '15' },
  { label: 'under 30 min', value: '30' },
  { label: 'under 45 min', value: '45' },
]
const MEAL_TYPES_DISCOVER = [
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

interface SavedMeal {
  id: string
  spoonacular_id: number | null
  name: string
  time: string
  tags: string[]
  ingredients?: string[]
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g,'&').replace(/&#39;/g,"'").slice(0, 120) + '...'
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? 'var(--pink)' : 'var(--cream)',
    border: `1px solid ${active ? 'var(--pink)' : 'var(--border)'}`,
    borderRadius: 999, padding: '5px 13px', fontSize: '0.72rem',
    color: active ? '#fff' : 'var(--ink-soft)', fontWeight: active ? 700 : 600,
    cursor: 'pointer', transition: 'all 0.15s', fontFamily: "'Nunito Sans', sans-serif",
  }
}

type Tab = 'week' | 'discover' | 'saved'
type DiscoverMode = 'random' | 'search'

export default function Meals() {
  const [tab, setTab] = useState<Tab>('week')
  const [openRecipeId, setOpenRecipeId] = useState<number | null>(null)

  // ── shared saved-meals state (used by Week + Saved tabs) ──
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([])
  const [savedLoading, setSavedLoading] = useState(true)
  const [plan, setPlan] = useState<WeekPlan>(EMPTY_PLAN)
  const [selecting, setSelecting] = useState<{ day: string; type: typeof MEAL_TYPES_WEEK[number] } | null>(null)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [addedId, setAddedId] = useState<string | null>(null)

  useEffect(() => { loadWeekData() }, [])

  async function loadWeekData() {
    setSavedLoading(true)
    const [mealsRes, planRes] = await Promise.all([
      supabase.from('meals').select('*').order('name'),
      supabase.from('week_plans').select('*'),
    ])
    if (mealsRes.data) setSavedMeals(mealsRes.data)
    if (planRes.data?.length) {
      const rebuilt: WeekPlan = { ...EMPTY_PLAN }
      planRes.data.forEach((row: any) => {
        if (!rebuilt[row.day]) rebuilt[row.day] = { breakfast: null, lunch: null, dinner: null }
        rebuilt[row.day][row.meal_type as typeof MEAL_TYPES_WEEK[number]] = row.meal_name
      })
      setPlan(rebuilt)
    }
    setSavedLoading(false)
  }

  async function assignMeal(mealName: string) {
    if (!selecting) return
    const { day, type } = selecting
    await supabase.from('week_plans').upsert(
      { day, meal_type: type, meal_name: mealName },
      { onConflict: 'day,meal_type' }
    )
    setPlan(p => ({ ...p, [day]: { ...p[day], [type]: mealName } }))
    setSelecting(null)
  }

  async function clearSlot(day: string, type: string) {
    await supabase.from('week_plans').delete().eq('day', day).eq('meal_type', type)
    setPlan(p => ({ ...p, [day]: { ...p[day], [type]: null } }))
  }

  async function deleteMeal(id: string) {
    await supabase.from('meals').delete().eq('id', id)
    setSavedMeals(prev => prev.filter(m => m.id !== id))
  }

  function cleanIngredient(raw: string): string {
    const TRAILING_STOPWORDS = [
      'to taste','or more','as needed','such as','about','approx','approximately',
      'optional','if desired','for serving','for garnish','for topping',
    ]
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
    const result = (start === -1 ? cleaned : words.slice(start).join(' ')).replace(/[,;:]+$/, '').trim()
    return result || raw
  }

  function normalizeForDedup(name: string): string {
    let n = name.toLowerCase().trim()
    if (n.endsWith('es') && n.length > 4) n = n.slice(0, -2)
    else if (n.endsWith('s') && !n.endsWith('ss') && n.length > 3) n = n.slice(0, -1)
    return n
  }

  async function sendToGroceryList(meal: SavedMeal) {
    const ingredients = meal.ingredients ?? []
    if (!ingredients.length) return
    setAddingId(meal.id)

    const cleanedNames = ingredients.map(cleanIngredient)
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

    setAddingId(null)
    setAddedId(meal.id)
    setTimeout(() => setAddedId(null), 2000)
  }

  return (
    <div>
      <div className="page-header">
        <div className="title-row">
          <h2>Meals <Icon name="cookbook" size={22} /></h2>
          <Lantern />
        </div>
      </div>

      <div className="page-body">

        {/* ── TAB SWITCHER ── */}
        <div className="card" style={{ padding: 8 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button style={chipStyle(tab === 'week')} onClick={() => setTab('week')}>
              <CalendarDays size={12} style={{ marginRight: 4, verticalAlign: -1 }} /> This Week
            </button>
            <button style={chipStyle(tab === 'discover')} onClick={() => setTab('discover')}>
              <Sparkles size={12} style={{ marginRight: 4, verticalAlign: -1 }} /> Discover
            </button>
            <button style={chipStyle(tab === 'saved')} onClick={() => setTab('saved')}>
              <Heart size={12} style={{ marginRight: 4, verticalAlign: -1 }} /> Saved Meals
            </button>
          </div>
        </div>

        {tab === 'week' && (
          <WeekTab
            plan={plan}
            savedMeals={savedMeals}
            loading={savedLoading}
            selecting={selecting}
            onSelectSlot={(day, type) => setSelecting({ day, type })}
            onCloseSelect={() => setSelecting(null)}
            onAssignMeal={assignMeal}
            onClearSlot={clearSlot}
            onGoDiscover={() => setTab('discover')}
          />
        )}

        {tab === 'discover' && <DiscoverTab onOpenRecipe={setOpenRecipeId} onSaved={loadWeekData} />}

        {tab === 'saved' && (
          <SavedTab
            savedMeals={savedMeals}
            loading={savedLoading}
            addingId={addingId}
            addedId={addedId}
            onCook={setOpenRecipeId}
            onAddToCart={sendToGroceryList}
            onDelete={deleteMeal}
            onGoDiscover={() => setTab('discover')}
          />
        )}

      </div>

      {openRecipeId && <RecipeModal mealId={openRecipeId} onClose={() => setOpenRecipeId(null)} />}

      <style>{`
        @keyframes mealsSpin { to { transform: rotate(360deg); } }
        @keyframes mealsSlide { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }
        @media (max-width: 700px) {
          .planner-grid { grid-template-columns: repeat(4, 1fr) !important; gap: 6px !important; }
        }
      `}</style>
    </div>
  )
}

// ───────────────────────── WEEK TAB ─────────────────────────

function WeekTab({
  plan, savedMeals, loading, selecting, onSelectSlot, onCloseSelect, onAssignMeal, onClearSlot, onGoDiscover,
}: {
  plan: WeekPlan
  savedMeals: SavedMeal[]
  loading: boolean
  selecting: { day: string; type: typeof MEAL_TYPES_WEEK[number] } | null
  onSelectSlot: (day: string, type: typeof MEAL_TYPES_WEEK[number]) => void
  onCloseSelect: () => void
  onAssignMeal: (name: string) => void
  onClearSlot: (day: string, type: string) => void
  onGoDiscover: () => void
}) {
  if (loading) return <p style={{ color: 'var(--ink-muted)', fontSize: 13 }}>Loading…</p>

  return (
    <>
      <div className="planner-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, overflowX: 'auto', minWidth: 0 }}>
        {DAYS.map(day => (
          <div key={day} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{
              background: 'var(--blush)', color: 'var(--pink-dark)', fontSize: '0.62rem', fontWeight: 700,
              textAlign: 'center', padding: '5px 4px', textTransform: 'uppercase', letterSpacing: '0.05em',
              fontFamily: "'IBM Plex Mono', monospace",
            }}>
              {day}
            </div>
            <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {MEAL_TYPES_WEEK.map(type => {
                const meal = plan[day]?.[type]
                return (
                  <div
                    key={type}
                    onClick={() => meal ? onClearSlot(day, type) : onSelectSlot(day, type)}
                    title={meal ? 'Click to clear' : `Add ${type}`}
                    style={{
                      borderRadius: 'var(--radius-sm)', padding: '5px 6px', cursor: 'pointer',
                      minHeight: 30, display: 'flex', alignItems: meal ? 'flex-start' : 'center', gap: 4,
                      flexDirection: meal ? 'column' : 'row',
                      border: meal ? '1.5px solid var(--pink-light)' : '1px dashed var(--border)',
                      background: meal ? 'var(--blush)' : 'transparent',
                      color: meal ? 'var(--ink)' : 'var(--ink-muted)',
                      fontSize: '0.6rem', transition: 'background 0.1s',
                    }}
                  >
                    <span style={{ fontSize: '0.52rem', color: 'var(--pink-dark)', fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>
                      {type[0].toUpperCase()}
                    </span>
                    {meal
                      ? <span style={{ fontSize: '0.6rem', lineHeight: 1.3 }}>{meal}</span>
                      : <Plus size={9} style={{ opacity: 0.4 }} />}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {selecting && (
        <div className="modal-overlay" onClick={onCloseSelect}>
          <div className="modal" style={{ maxWidth: 340, maxHeight: '70vh' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: 'var(--blush)', color: 'var(--pink-dark)' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Pick a meal for {selecting.day} {selecting.type}</span>
              <button className="close-btn" onClick={onCloseSelect}><X size={16} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {savedMeals.length === 0 && (
                <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', padding: '1rem', textAlign: 'center' }}>
                  No saved meals yet — visit Discover to add some
                </p>
              )}
              {savedMeals.map(m => (
                <div
                  key={m.id}
                  onClick={() => onAssignMeal(m.name)}
                  style={{
                    padding: '10px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                    border: '1.5px solid var(--border)', background: 'var(--white)', transition: 'background 0.1s',
                  }}
                >
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 2, color: 'var(--ink)' }}>{m.name}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>{m.time}</span>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
                    {m.tags.map(t => <span key={t} className={`tag ${t}`}>{t}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {savedMeals.length === 0 && (
        <div className="empty-state">
          <Salad size={20} />
          No saved meals yet
          <button className="btn btn-secondary btn-sm" style={{ marginLeft: 8 }} onClick={onGoDiscover}>Find some</button>
        </div>
      )}
    </>
  )
}

// ───────────────────────── DISCOVER TAB ─────────────────────────

function DiscoverTab({ onOpenRecipe, onSaved }: { onOpenRecipe: (id: number) => void; onSaved: () => void }) {
  const [mode, setMode] = useState<DiscoverMode>('random')
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

  function switchMode(next: DiscoverMode) {
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

    if (mode === 'search') params.set('query', query.trim())
    else params.set('sort', 'random')

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
        return name.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z\s]/g, '').trim()
      })
    } catch {
      // if this fails, we still save the meal without ingredients
    }

    const { error } = await supabase.from('meals').upsert(
      { spoonacular_id: m.id, name: m.title, time: `${m.readyInMinutes} min`, tags, ingredients },
      { onConflict: 'name' }
    )

    if (!error) {
      setSaved(s => new Set([...s, m.id]))
      onSaved()
    }
    setSavingId(null)
  }

  return (
    <>
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
            {MEAL_TYPES_DISCOVER.map(m => (
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
            ? <><Loader2 size={14} style={{ animation: 'mealsSpin 0.7s linear infinite' }} /> Loading...</>
            : mode === 'search'
              ? <><Search size={14} /> Search Recipes</>
              : <><Sparkles size={14} /> Surprise Me</>}
        </button>
      </div>

      {loading && (
        <div style={{ height: 2, background: 'var(--pink-light)', borderRadius: 1, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: '40%', background: 'var(--pink)', animation: 'mealsSlide 1s ease-in-out infinite' }} />
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
                {m.image && (
                  <img
                    src={m.image} alt={m.title}
                    onClick={() => onOpenRecipe(m.id)}
                    style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block', cursor: 'pointer' }}
                  />
                )}
                <div style={{ padding: '10px 12px 12px' }}>
                  <h3
                    onClick={() => onOpenRecipe(m.id)}
                    style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 5, color: 'var(--ink)', cursor: 'pointer' }}
                  >
                    {m.title}
                  </h3>
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
                        ? <><Loader2 size={12} style={{ animation: 'mealsSpin 0.7s linear infinite' }} /> Saving...</>
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

      {showDietModal && <DrDietGroq onClose={() => setShowDietModal(false)} />}
    </>
  )
}

// ───────────────────────── SAVED TAB ─────────────────────────

function SavedTab({
  savedMeals, loading, addingId, addedId, onCook, onAddToCart, onDelete, onGoDiscover,
}: {
  savedMeals: SavedMeal[]
  loading: boolean
  addingId: string | null
  addedId: string | null
  onCook: (spoonacularId: number) => void
  onAddToCart: (meal: SavedMeal) => void
  onDelete: (id: string) => void
  onGoDiscover: () => void
}) {
  if (loading) return <p style={{ color: 'var(--ink-muted)', fontSize: 13 }}>Loading…</p>

  if (savedMeals.length === 0) {
    return (
      <div className="empty-state">
        <Salad size={20} />
        No saved meals yet
        <button className="btn btn-secondary btn-sm" style={{ marginLeft: 8 }} onClick={onGoDiscover}>Find some</button>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
      {savedMeals.map(m => {
        const hasIngredients = (m.ingredients ?? []).length > 0
        return (
          <div key={m.id} className="card">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: 5, color: 'var(--ink)' }}>{m.name}</div>
              <button
                className="btn btn-danger btn-sm"
                style={{ flexShrink: 0, padding: '2px 6px' }}
                onClick={() => onDelete(m.id)}
                title="Delete meal"
              >
                <Trash2 size={12} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--ink-muted)', fontSize: '0.68rem' }}>{m.time}</span>
              {m.tags.map(t => <span key={t} className={`tag ${t}`}>{t}</span>)}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button
                className="btn btn-ghost"
                style={{ fontSize: '0.68rem', padding: '4px 8px', flex: 1, justifyContent: 'center' }}
                onClick={() => m.spoonacular_id && onCook(m.spoonacular_id)}
                disabled={!m.spoonacular_id}
                title={!m.spoonacular_id ? 'No recipe details saved for this meal' : ''}
              >
                <ChefHat size={12} /> Cook This
              </button>
              <button
                className="btn btn-primary"
                style={{ fontSize: '0.68rem', padding: '4px 8px', flex: 1, justifyContent: 'center' }}
                onClick={() => onAddToCart(m)}
                disabled={!hasIngredients || addingId === m.id}
                title={!hasIngredients ? 'No ingredients saved for this meal' : ''}
              >
                {addedId === m.id
                  ? <><Check size={12} /> Added!</>
                  : addingId === m.id
                    ? <><Loader2 size={12} style={{ animation: 'mealsSpin 0.7s linear infinite' }} /> Adding...</>
                    : <><ShoppingCart size={12} /> Add to List</>}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}