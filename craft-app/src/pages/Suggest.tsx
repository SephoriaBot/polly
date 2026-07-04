import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from './Suggest.module.css'

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

export default function Suggest() {
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

  function toggleSet(setFn: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) {
    setFn(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }

  async function fetchRecipes() {
    setLoading(true)
    setError('')
    setMeals([])
    const params = new URLSearchParams({
      number: '6',
      addRecipeInformation: 'true',
      fillIngredients: 'false',
      sort: 'random',
      apiKey: import.meta.env.VITE_SPOONACULAR_API_KEY,
    })
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
      if (!results.length) setError('No recipes found for those filters — try adjusting them')
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
    <div className={styles.page}>
      <div className={`card ${styles.genBox}`}>
        <h2 className={styles.genTitle}><i className="ti ti-adjustments" aria-hidden="true" /> find recipes that work for you</h2>
        <p className={styles.genSub}>filter by diet, intolerances, and cook time</p>

        <div className={styles.filterSection}>
          <div className={styles.filterLabel}>diet</div>
          <div className={styles.chips}>
            {DIETS.map(d => (
              <button key={d} className={`${styles.chip} ${selectedDiets.has(d) ? styles.active : ''}`}
                onClick={() => toggleSet(setSelectedDiets, d)}>{d}</button>
            ))}
          </div>
        </div>

        <div className={styles.filterSection}>
          <div className={styles.filterLabel}>avoid</div>
          <div className={styles.chips}>
            {INTOLERANCES.map(i => (
              <button key={i} className={`${styles.chip} ${selectedIntolerances.has(i) ? styles.active : ''}`}
                onClick={() => toggleSet(setSelectedIntolerances, i)}>{i}</button>
            ))}
          </div>
        </div>

        <div className={styles.filterSection}>
          <div className={styles.filterLabel}>cook time</div>
          <div className={styles.chips}>
            {MAX_TIMES.map(t => (
              <button key={t.value} className={`${styles.chip} ${maxTime === t.value ? styles.active : ''}`}
                onClick={() => setMaxTime(t.value)}>{t.label}</button>
            ))}
          </div>
        </div>

        <div className={styles.filterSection}>
          <div className={styles.filterLabel}>meal</div>
          <div className={styles.chips}>
            {MEAL_TYPES.map(m => (
              <button
                key={m.value}
                className={`${styles.chip} ${mealType === m.value ? styles.active : ''}`}
                onClick={() => setMealType(m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {mealType === 'drink' && (
          <div className={styles.filterSection}>
            <div className={styles.filterLabel}>type</div>
            <div className={styles.chips}>
              <button
                className={`${styles.chip} ${nonAlcoholicOnly ? styles.active : ''}`}
                onClick={() => setNonAlcoholicOnly(v => !v)}
              >
                non-alcoholic only
              </button>
            </div>
          </div>
        )}

        <button className="btn-primary" onClick={fetchRecipes} disabled={loading} style={{marginTop:'0.75rem'}}>
          {loading
            ? <><i className="ti ti-loader-2" style={{animation:'spin .7s linear infinite'}} aria-hidden="true" /> loading...</>
            : <><i className="ti ti-search" aria-hidden="true" /> find recipes</>}
        </button>
      </div>

      {loading && <div className={styles.loadingBar}><div className={styles.loadingFill} /></div>}

      {error && <div className="empty-state"><i className="ti ti-alert-circle" aria-hidden="true" />{error}</div>}

      {meals.length > 0 && (
        <>
          <div className={styles.aiBadge}><i className="ti ti-database" aria-hidden="true" /> recipes from Spoonacular</div>
          <div className={styles.resultsGrid}>
            {meals.map(m => (
              <div key={m.id} className={`card ${styles.mealCard}`}>
                {m.image && <img src={m.image} alt={m.title} className={styles.mealThumb} />}
                <div style={{padding:'10px 12px 12px'}}>
                  <h3 className={styles.mealName}>{m.title}</h3>
                  <div className={styles.mealTags}>
                    {m.vegan && <span className={styles.tag}>vegan</span>}
                    {m.vegetarian && !m.vegan && <span className={styles.tag}>vegetarian</span>}
                    {m.glutenFree && <span className={styles.tag}>gluten-free</span>}
                    {m.dairyFree && <span className={styles.tag}>dairy-free</span>}
                    <span className={styles.mealTime}>{m.readyInMinutes} min</span>
                  </div>
                  {m.summary && <p className={styles.mealDesc}>{stripHtml(m.summary)}</p>}
                  <button
                    className="btn-ghost"
                    style={{width:'100%',justifyContent:'center',fontSize:11,padding:'5px 8px',marginTop:8}}
                    onClick={() => saveMeal(m)}
                    disabled={saved.has(m.id) || savingId === m.id}
                  >
                    {saved.has(m.id)
                      ? <><i className="ti ti-check" aria-hidden="true" /> saved!</>
                      : savingId === m.id
                        ? <><i className="ti ti-loader-2" style={{animation:'spin .7s linear infinite'}} aria-hidden="true" /> saving...</>
                        : <><i className="ti ti-plus" aria-hidden="true" /> save to my meals</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && !error && meals.length === 0 && (
        <div className="empty-state">
          <i className="ti ti-salad" aria-hidden="true" />
          set your filters and hit find recipes
        </div>
      )}
    </div>
  )
}
