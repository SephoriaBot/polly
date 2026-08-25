import React, { useState, useEffect } from 'react';
import { Salad } from 'lucide-react';
import Icon from '../Icon';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/useToast';
import DrDietGroq from '../suggest/DrDietGroq';
import RecipeModal from './RecipeModal';
import emptyWallet from '../../assets/icons/empty-wallet.png';
import errorDizzyImg from '../../assets/illustrations/error_dizzy.png';
import EmptyState from '../EmptyState';

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

type Tab = 'discover' | 'saved'
type DiscoverMode = 'random' | 'search'

interface NewGroceryItem { name: string; qty: string; checked: boolean; list_name: string; list_id: string | null }

interface RecipeBoxProps {
  /** name of the grocery list ingredients should be added to */
  currentList: string
  /** id of that same list — the real join key, list_name is kept only for display/back-compat */
  currentListId: string | null
  /** names already on that list, used to skip duplicates */
  existingItemNames: string[]
  /** called with the rows actually inserted, so the parent can update its own item state */
  onItemsAdded: (rows: NewGroceryItem[]) => void
}

export default function RecipeBox({ currentList, currentListId, existingItemNames, onItemsAdded }: RecipeBoxProps) {
  const { showToast } = useToast()
  const [tab, setTab] = useState<Tab>('discover')
  const [openRecipeId, setOpenRecipeId] = useState<number | null>(null)

  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([])
  const [savedLoading, setSavedLoading] = useState(true)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [addedId, setAddedId] = useState<string | null>(null)
  const [planningId, setPlanningId] = useState<string | null>(null)

  useEffect(() => { loadSavedMeals() }, [])

  async function loadSavedMeals() {
    setSavedLoading(true)
    const { data } = await supabase.from('meals').select('*').order('name')
    if (data) setSavedMeals(data)
    setSavedLoading(false)
  }

  async function deleteMeal(id: string) {
    await supabase.from('meals').delete().eq('id', id)
    setSavedMeals(prev => prev.filter(m => m.id !== id))
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

    const existingKeys = new Set(existingItemNames.map(normalizeForDedup))
    const rows: NewGroceryItem[] = Array.from(seen.entries())
      .filter(([key]) => !existingKeys.has(key))
      .map(([, name]) => ({ name, qty: '', checked: false, list_name: currentList, list_id: currentListId }))

    if (rows.length) {
      const { data } = await supabase.from('grocery_items').insert(rows).select()
      if (data) onItemsAdded(data as unknown as NewGroceryItem[])
    }

    setAddingId(null)
    setAddedId(meal.id)
    setTimeout(() => setAddedId(null), 2000)
  }

  // The interconnection piece: scheduling a meal writes a real Planner
  // appointment (so it shows up on Today's "coming up" strip via the
  // existing appointments pull), and — since it's already right there —
  // optionally chains straight into the grocery list too.
  async function planMealNight(meal: SavedMeal, dateStr: string, includeGroceries: boolean) {
    if (!dateStr) return
    const isoDateTime = new Date(`${dateStr}T18:00:00`).toISOString()
    const { error } = await supabase.from('appointments').insert({ title: `🍽️ ${meal.name}`, date_time: isoDateTime })
    if (error) {
      showToast("Couldn't add that to your planner — try again?", 'error')
      return
    }
    if (includeGroceries) await sendToGroceryList(meal)
    setPlanningId(null)
    showToast(`${meal.name} is on the calendar 🗓️`)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Icon name="cookbook" size={20} style={{ color: 'var(--pink-dark)' }} />
        <h2 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--ink)' }}>Recipe Box</h2>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        <button style={chipStyle(tab === 'discover')} onClick={() => setTab('discover')}>
          <Icon name="_extra-unnamed-heart" size={12} style={{ marginRight: 4, verticalAlign: -1 }} /> Find Meals
        </button>
        <button style={chipStyle(tab === 'saved')} onClick={() => setTab('saved')}>
          <Icon name="icon-heart" size={12} style={{ marginRight: 4, verticalAlign: -1 }} /> Saved ({savedMeals.length})
        </button>
      </div>

      {tab === 'discover' && <DiscoverTab onOpenRecipe={setOpenRecipeId} onSaved={loadSavedMeals} />}

      {tab === 'saved' && (
        <SavedTab
          savedMeals={savedMeals}
          loading={savedLoading}
          addingId={addingId}
          addedId={addedId}
          planningId={planningId}
          onCook={setOpenRecipeId}
          onAddToCart={sendToGroceryList}
          onDelete={deleteMeal}
          onGoDiscover={() => setTab('discover')}
          onStartPlan={setPlanningId}
          onCancelPlan={() => setPlanningId(null)}
          onConfirmPlan={planMealNight}
        />
      )}

      {openRecipeId && <RecipeModal mealId={openRecipeId} onClose={() => setOpenRecipeId(null)} />}

      <style>{`
        @keyframes recipeBoxSpin { to { transform: rotate(360deg); } }
        @keyframes recipeBoxSlide { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }
      `}</style>
    </div>
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
          <Icon name="_extra-unnamed-heart" size={14} /> Ask Dr. Groq
        </button>
      </div>

      <div className="card">
        <h2 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Icon name="icon-slidershorizontal" size={16} style={{ color: 'var(--pink)' }} /> Find Recipes That Work for You
        </h2>
        <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginBottom: 12 }}>Search by name, or get a surprise pick</p>

        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button style={chipStyle(mode === 'random')} onClick={() => switchMode('random')}>
              <Icon name="_extra-unnamed-heart" size={12} style={{ marginRight: 4, verticalAlign: -1 }} /> Surprise Me
            </button>
            <button style={chipStyle(mode === 'search')} onClick={() => switchMode('search')}>
              <Icon name="icon-search" size={12} style={{ marginRight: 4, verticalAlign: -1 }} /> Search
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
            ? <><Icon name="icon-loader2" size={14} style={{ animation: 'recipeBoxSpin 0.7s linear infinite' }} /> Loading...</>
            : mode === 'search'
              ? <><Icon name="icon-search" size={14} /> Search Recipes</>
              : <><Icon name="_extra-unnamed-heart" size={14} /> Surprise Me</>}
        </button>
      </div>

      {loading && (
        <div style={{ height: 2, background: 'var(--pink-light)', borderRadius: 1, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: '40%', background: 'var(--pink)', animation: 'recipeBoxSlide 1s ease-in-out infinite' }} />
        </div>
      )}

      {error && (
        <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8, padding: '20px 12px' }}>
          <img src={errorDizzyImg} alt="" style={{ width: 100 }} />
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
            <Icon name="icon-database" size={11} /> Recipes from Spoonacular
          </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(200px, 100%), 1fr))', gap: 10 }}>
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
                      ? <><Icon name="flowerfull" size={12} /> Saved!</>
                      : savingId === m.id
                        ? <><Icon name="icon-loader2" size={12} style={{ animation: 'recipeBoxSpin 0.7s linear infinite' }} /> Saving...</>
                        : <><Icon name="icon-plus" size={12} /> Save to Recipe Box</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && !error && meals.length === 0 && (
        <div className="empty-state">
          <Icon name="cooking-pot" size={20} />
          {mode === 'search' ? 'Search for a recipe by name' : 'Hit Surprise Me for a random pick'}
        </div>
      )}

      {showDietModal && <DrDietGroq onClose={() => setShowDietModal(false)} />}
    </>
  )
}

// ───────────────────────── SAVED TAB ─────────────────────────

function SavedTab({
  savedMeals, loading, addingId, addedId, planningId, onCook, onAddToCart, onDelete, onGoDiscover,
  onStartPlan, onCancelPlan, onConfirmPlan,
}: {
  savedMeals: SavedMeal[]
  loading: boolean
  addingId: string | null
  addedId: string | null
  planningId: string | null
  onCook: (spoonacularId: number) => void
  onAddToCart: (meal: SavedMeal) => void
  onDelete: (id: string) => void
  onGoDiscover: () => void
  onStartPlan: (id: string) => void
  onCancelPlan: () => void
  onConfirmPlan: (meal: SavedMeal, dateStr: string, includeGroceries: boolean) => void
}) {
  if (loading) return <p style={{ color: 'var(--ink-muted)', fontSize: 13 }}>Loading…</p>

  if (savedMeals.length === 0) {
    return (
      <div className="empty-state" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <EmptyState image={emptyWallet} message="No saved meals yet." />
        <button className="btn btn-secondary btn-sm" onClick={onGoDiscover}>Find some</button>
      </div>
    )
  }

  return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(160px, 100%), 1fr))', gap: 10 }}>
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
                <Icon name="icon-trash2" size={12} />
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
                <Icon name="icon-chefhat" size={12} /> Cook This
              </button>
              <button
                className="btn btn-primary"
                style={{ fontSize: '0.68rem', padding: '4px 8px', flex: 1, justifyContent: 'center' }}
                onClick={() => onAddToCart(m)}
                disabled={!hasIngredients || addingId === m.id}
                title={!hasIngredients ? 'No ingredients saved for this meal' : ''}
              >
                {addedId === m.id
                  ? <><Icon name="flowerfull" size={12} /> Added!</>
                  : addingId === m.id
                    ? <><Icon name="icon-loader2" size={12} style={{ animation: 'recipeBoxSpin 0.7s linear infinite' }} /> Adding...</>
                    : <><Icon name="icon-plus" size={12} /> Add to List</>}
              </button>
            </div>
            <button
              className="btn btn-ghost"
              style={{ fontSize: '0.68rem', padding: '4px 8px', width: '100%', justifyContent: 'center', marginTop: 6 }}
              onClick={() => onStartPlan(planningId === m.id ? '' : m.id)}
            >
              <Icon name="calendar" size={12} /> Plan a Night
            </button>
            {planningId === m.id && (
              <PlanNightForm
                meal={m}
                hasIngredients={hasIngredients}
                onCancel={onCancelPlan}
                onConfirm={onConfirmPlan}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function PlanNightForm({
  meal, hasIngredients, onCancel, onConfirm,
}: {
  meal: SavedMeal
  hasIngredients: boolean
  onCancel: () => void
  onConfirm: (meal: SavedMeal, dateStr: string, includeGroceries: boolean) => void
}) {
  const todayStr = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(todayStr)
  const [includeGroceries, setIncludeGroceries] = useState(hasIngredients)
  const [saving, setSaving] = useState(false)
  const [estimate, setEstimate] = useState<{ total: number; priced: number; of: number } | null>(null)
  const [estimateLoading, setEstimateLoading] = useState(false)

  // Completes the doc's "meal → grocery → budget" chain: once ingredients
  // are going to the grocery list, look up whatever Smart Cart has already
  // cached for those item names and total up the cheapest known price per
  // ingredient. Partial coverage is expected and shown honestly — this is
  // a ballpark from cached prices, not a live quote.
  useEffect(() => {
    if (!includeGroceries || !hasIngredients) { setEstimate(null); return }
    let cancelled = false
    setEstimateLoading(true)
    ;(async () => {
      const cleanedNames = Array.from(new Set((meal.ingredients ?? []).map(cleanIngredient).map(normalizeForDedup)))
      const { data } = await supabase.from('grocery_prices').select('item_name,price')
      if (cancelled) return
      const cheapestByName = new Map<string, number>()
      for (const row of data ?? []) {
        const key = normalizeForDedup(row.item_name)
        const current = cheapestByName.get(key)
        if (current === undefined || row.price < current) cheapestByName.set(key, row.price)
      }
      let total = 0
      let priced = 0
      for (const name of cleanedNames) {
        const price = cheapestByName.get(name)
        if (price !== undefined) { total += price; priced += 1 }
      }
      setEstimate({ total, priced, of: cleanedNames.length })
      setEstimateLoading(false)
    })()
    return () => { cancelled = true }
  }, [includeGroceries, hasIngredients, meal.ingredients])

  async function confirm() {
    setSaving(true)
    await onConfirm(meal, date, includeGroceries)
    setSaving(false)
  }

  return (
    <div style={{ marginTop: 8, padding: 8, borderRadius: 12, background: 'var(--cream)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input
        type="date"
        className="form-input"
        value={date}
        min={todayStr}
        onChange={e => setDate(e.target.value)}
        style={{ fontSize: '0.75rem', padding: '4px 6px' }}
      />
      {hasIngredients && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.68rem', color: 'var(--ink-muted)' }}>
          <input type="checkbox" checked={includeGroceries} onChange={e => setIncludeGroceries(e.target.checked)} />
          Also add ingredients to grocery list
        </label>
      )}
      {includeGroceries && hasIngredients && (
        <div style={{ fontSize: '0.68rem', color: 'var(--pink-dark)', fontWeight: 600, paddingLeft: 2 }}>
          {estimateLoading ? (
            'Estimating cost…'
          ) : estimate && estimate.priced > 0 ? (
            `🛒 ~$${estimate.total.toFixed(2)} (${estimate.priced} of ${estimate.of} ingredients priced)`
          ) : (
            'No price history yet for these ingredients'
          )}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-ghost btn-sm" style={{ flex: 1, fontSize: '0.68rem', justifyContent: 'center' }} onClick={onCancel}>Cancel</button>
        <button
          className="btn btn-primary btn-sm"
          style={{ flex: 1, fontSize: '0.68rem', justifyContent: 'center', opacity: saving ? 0.6 : 1 }}
          onClick={confirm}
          disabled={saving || !date}
        >
          {saving ? 'Adding…' : 'Confirm'}
        </button>
      </div>
    </div>
  )
}