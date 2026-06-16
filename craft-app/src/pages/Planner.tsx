import { useState, useEffect } from 'react'
import type { WeekPlan, Meal } from '../types'
import { supabase } from '../lib/supabase'
import styles from './Planner.module.css'

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const MEAL_TYPES = ['breakfast','lunch','dinner'] as const

const EMPTY_PLAN: WeekPlan = Object.fromEntries(
  DAYS.map(d => [d, { breakfast: null, lunch: null, dinner: null }])
)

interface PlannerProps {
  onNavigate: (page: string) => void
}

// words/phrases that signal the end of the ingredient name
const TRAILING_STOPWORDS = [
  'to taste','or more','as needed','such as','about','approx','approximately',
  'optional','if desired','for serving','for garnish','for topping',
]

export default function Planner({ onNavigate }: PlannerProps) {
  const [plan, setPlan] = useState<WeekPlan>(EMPTY_PLAN)
  const [meals, setMeals] = useState<Meal[]>([])
  const [selecting, setSelecting] = useState<{day:string; type:typeof MEAL_TYPES[number]} | null>(null)
  const [loading, setLoading] = useState(true)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [addedId, setAddedId] = useState<string | null>(null)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const [mealsRes, planRes] = await Promise.all([
      supabase.from('meals').select('*').order('name'),
      supabase.from('week_plans').select('*')
    ])
    if (mealsRes.data) setMeals(mealsRes.data)
    if (planRes.data?.length) {
      const rebuilt: WeekPlan = { ...EMPTY_PLAN }
      planRes.data.forEach((row: any) => {
        if (!rebuilt[row.day]) rebuilt[row.day] = { breakfast: null, lunch: null, dinner: null }
        rebuilt[row.day][row.meal_type as typeof MEAL_TYPES[number]] = row.meal_name
      })
      setPlan(rebuilt)
    }
    setLoading(false)
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
    await supabase.from('week_plans')
      .delete()
      .eq('day', day)
      .eq('meal_type', type)
    setPlan(p => ({ ...p, [day]: { ...p[day], [type]: null } }))
  }

  async function deleteMeal(id: string) {
    await supabase.from('meals').delete().eq('id', id)
    setMeals(prev => prev.filter(m => m.id !== id))
  }

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

    // 1. strip parenthetical content
    let cleaned = raw.replace(/\(.*?\)/g, '').trim()

    // 2. strip trailing clauses like "to taste", "or more as needed", "such as X"
    for (const phrase of TRAILING_STOPWORDS) {
      const idx = cleaned.toLowerCase().indexOf(phrase)
      if (idx !== -1) cleaned = cleaned.slice(0, idx).trim()
    }

    // 2b. strip everything after the first comma (almost always prep instructions
    // like ", finely chopped" or ", crushed" rather than part of the ingredient name)
    const commaIdx = cleaned.indexOf(',')
    if (commaIdx !== -1) cleaned = cleaned.slice(0, commaIdx).trim()

    // 3. strip leading numbers, fractions, units, and skip words
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

    // 4. strip trailing punctuation
    const result = (start === -1 ? cleaned : words.slice(start).join(' '))
      .replace(/[,;:]+$/, '')
      .trim()

    return result || raw
  }

  function normalizeForDedup(name: string): string {
    let n = name.toLowerCase().trim()
    // naive singular/plural normalization: drop trailing "es" or "s" (but not for short words)
    if (n.endsWith('es') && n.length > 4) n = n.slice(0, -2)
    else if (n.endsWith('s') && !n.endsWith('ss') && n.length > 3) n = n.slice(0, -1)
    return n
  }

  async function sendToGroceryList(meal: Meal) {
    const ingredients = meal.ingredients ?? []
    if (!ingredients.length) return
    setAddingId(meal.id)

    const cleanedNames = ingredients.map(cleanIngredient)
    const seen = new Map<string, string>() // normalized -> first-seen display name

    for (const name of cleanedNames) {
      const key = normalizeForDedup(name)
      if (!seen.has(key)) seen.set(key, name)
    }

    // check what's already on the grocery list so we don't duplicate it
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
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>this week</h1>
        <button className="btn-primary" onClick={() => onNavigate('suggest')}>
          <i className="ti ti-sparkles" aria-hidden="true" /> get meal ideas
        </button>
      </div>

      {loading ? <p style={{color:'var(--ink-muted)',fontSize:13}}>loading...</p> : (
        <>
          <div className={styles.grid}>
            {DAYS.map(day => (
              <div key={day} className="card" style={{overflow:'hidden'}}>
                <div className={styles.dayLabel}>{day}</div>
                <div className={styles.dayMeals}>
                  {MEAL_TYPES.map(type => {
                    const meal = plan[day]?.[type]
                    return (
                      <div key={type}
                        className={`${styles.slot} ${meal ? styles.filled : ''}`}
                        onClick={() => meal ? clearSlot(day, type) : setSelecting({day, type})}
                        title={meal ? 'click to clear' : `add ${type}`}
                      >
                        <span className={styles.slotType}>{type[0]}</span>
                        {meal
                          ? <span className={styles.slotMeal}>{meal}</span>
                          : <i className="ti ti-plus" style={{fontSize:9,opacity:0.4}} aria-hidden="true" />
                        }
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {selecting && (
            <div className={styles.overlay} onClick={() => setSelecting(null)}>
              <div className={styles.picker} onClick={e => e.stopPropagation()}>
                <div className={styles.pickerHeader}>
                  <span>pick a meal for {selecting.day} {selecting.type}</span>
                  <button className="btn-ghost" style={{padding:'4px 8px'}} onClick={() => setSelecting(null)}>
                    <i className="ti ti-x" aria-hidden="true" />
                  </button>
                </div>
                <div className={styles.pickerMeals}>
                  {meals.length === 0 && (
                    <p style={{fontSize:12,color:'var(--ink-muted)',padding:'1rem',textAlign:'center'}}>
                      no saved meals yet — visit suggest meals to add some
                    </p>
                  )}
                  {meals.map(m => (
                    <div key={m.id} className={styles.pickerMeal} onClick={() => assignMeal(m.name)}>
                      <span className={styles.pickerName}>{m.name}</span>
                      <span className={styles.pickerTime}>{m.time}</span>
                      <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:3}}>
                        {m.tags.map(t => <span key={t} className={`tag ${t}`}>{t}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className={styles.savedSection}>
            <h2 className={styles.sectionTitle}><i className="ti ti-heart" aria-hidden="true" /> saved meals</h2>
            {meals.length === 0 ? (
              <div className="empty-state">
                <i className="ti ti-salad" aria-hidden="true" />
                no saved meals yet — go to suggest meals to find some
              </div>
            ) : (
              <div className={styles.mealsGrid}>
                {meals.map(m => {
                  const hasIngredients = (m.ingredients ?? []).length > 0
                  return (
                    <div key={m.id} className={`card ${styles.mealCard}`}>
                      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:6}}>
                        <div className={styles.mealName}>{m.name}</div>
                        <button
                          className="btn-danger btn-sm"
                          style={{flexShrink:0,padding:'2px 6px'}}
                          onClick={() => deleteMeal(m.id)}
                          title="delete meal"
                        >
                          <i className="ti ti-trash" aria-hidden="true" />
                        </button>
                      </div>
                      <div className={styles.mealMeta}>
                        <span style={{color:'var(--ink-muted)',fontSize:11}}>{m.time}</span>
                        {m.tags.map(t => <span key={t} className={`tag ${t}`}>{t}</span>)}
                      </div>
                      <div style={{display:'flex',gap:6,marginTop:6}}>
                        <button
                          className="btn-ghost"
                          style={{fontSize:11,padding:'4px 8px',flex:1,justifyContent:'center'}}
                          onClick={() => onNavigate('cook')}
                        >
                          <i className="ti ti-chef-hat" aria-hidden="true" /> cook this
                        </button>
                        <button
                          className="btn-primary"
                          style={{fontSize:11,padding:'4px 8px',flex:1,justifyContent:'center'}}
                          onClick={() => sendToGroceryList(m)}
                          disabled={!hasIngredients || addingId === m.id}
                          title={!hasIngredients ? 'no ingredients saved for this meal' : ''}
                        >
                          {addedId === m.id
                            ? <><i className="ti ti-check" aria-hidden="true" /> added!</>
                            : addingId === m.id
                              ? <><i className="ti ti-loader-2" style={{animation:'spin .7s linear infinite'}} aria-hidden="true" /> adding...</>
                              : <><i className="ti ti-shopping-cart" aria-hidden="true" /> add to list</>}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
