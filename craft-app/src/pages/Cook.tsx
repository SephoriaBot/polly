import { useState, useEffect } from 'react'
import styles from './Cook.module.css'
import { supabase } from '../lib/supabase'

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

interface Ingredient { name: string; measure: string }
interface MealData {
  id: string
  title: string
  thumb: string
  ingredients: Ingredient[]
  steps: string[]
  category: string
}

export default function Cook() {
  const initialMeal = null
const [savedMeals, setSavedMeals] = useState<{ spoonacular_id: number; name: string }[]>([])
  const [meal, setMeal] = useState<MealData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(0)
  const [unit, setUnit] = useState<'us' | 'metric'>('us')

  useEffect(() => {
  loadSavedMeals()

  if (initialMeal) {
    fetchMeal(initialMeal)
  }
}, [])

async function loadSavedMeals() {
  const { data } = await supabase
    .from('meals')
    .select('spoonacular_id, name')
    .order('name')

  setSavedMeals(data ?? [])
}

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

  const progressPct = meal
    ? meal.steps.length > 1 ? Math.round((step / (meal.steps.length - 1)) * 100) : 100
    : 0

  return (
    <div className={styles.page}>

<div className={styles.mealPicker}>
  <div className={styles.pickerLabel}>choose one of your saved meals</div>

  <div className={styles.chips}>
    {savedMeals.map(m => (
      <button
        key={m.name}
        className={`${styles.chip} ${meal?.title === m.name ? styles.active : ''}`}
        onClick={() => fetchMeal(m.spoonacular_id)}
      >
        {m.name}
      </button>
    ))}
  </div>

  {savedMeals.length === 0 && (
    <div className="empty-state">
      Save some meals from the Suggestions page first.
    </div>
  )}
</div>

      <div className={`card ${styles.cookCard}`}>
        {!meal && !loading && !error && (
          <div className="empty-state">
            <i className="ti ti-chef-hat" aria-hidden="true" />
            search for a recipe above to get started
          </div>
        )}

        {loading && (
          <div className="empty-state">
            <div className={styles.spinner} />
            <span style={{fontSize:12,color:'var(--text-soft)'}}>loading recipe...</span>
          </div>
        )}

        {error && (
          <div className="empty-state">
            <i className="ti ti-alert-circle" aria-hidden="true" />
            {error}
          </div>
        )}

        {meal && !loading && (
          <>
            <div className={styles.recipeHeader}>
              {meal.thumb && <img src={meal.thumb} alt={meal.title} className={styles.recipeThumb} />}
              <div className={styles.recipeHeaderText}>
                <h2 className={styles.recipeTitle}>{meal.title}</h2>
                <div className={styles.recipeMeta}>
                  <span className={styles.pill}>{meal.category}</span>
                  <span className={styles.pill}>{meal.steps.length} steps</span>
                  <span className={styles.pill}>{meal.ingredients.length} ingredients</span>
                </div>
              </div>
            </div>

            <div className={styles.body}>
              {/* INGREDIENTS */}
              <div className={styles.ingCol}>
                <div className={styles.ingTitle}>
                  ingredients
                  <div className={styles.unitToggle}>
                    <button className={`${styles.unitBtn} ${unit === 'us' ? styles.unitActive : ''}`} onClick={() => setUnit('us')}>US</button>
                    <button className={`${styles.unitBtn} ${unit === 'metric' ? styles.unitActive : ''}`} onClick={() => setUnit('metric')}>metric</button>
                  </div>
                </div>

                <div className={styles.ingList}>
                  {meal.ingredients.map((ing, i) => {
                    const isActive = meal.steps[step]?.toLowerCase().includes(ing.name.toLowerCase())
                    return (
                      <div key={i} className={`${styles.ingRow} ${isActive ? styles.ingHighlight : ''}`}>
                        <span className={styles.ingName}>{ing.name}</span>
                        <span className={styles.ingAmt}>{ing.measure}</span>
                      </div>
                    )
                  })}
                </div>

                <div className={styles.convBox}>
                  <div className={styles.convTitle}>quick conversions</div>
                  {CONVERSIONS[unit].map((c, i) => (
                    <div key={i} className={styles.convRow}>
                      <span>{c.from}</span><span>{c.to}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* STEPS */}
              <div className={styles.stepsCol}>
                <div className={styles.stepsTitle}>steps</div>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
                </div>
                <div className={styles.stepsList}>
                  {meal.steps.map((s, i) => {
                    const state = i < step ? 'done' : i === step ? 'active' : 'pending'
                    return (
                      <div key={i} className={`${styles.stepCard} ${styles[state]}`} onClick={() => setStep(i)}>
                        <div className={styles.stepNum}>
                          {i < step
                            ? <i className="ti ti-check" style={{fontSize:10}} aria-hidden="true" />
                            : i + 1}
                        </div>
                        <div className={styles.stepText}>{s}</div>
                      </div>
                    )
                  })}
                </div>

                <div className={styles.navRow}>
                  <button className="btn-ghost" style={{flex:1,justifyContent:'center'}} disabled={step === 0} onClick={() => setStep(s => s - 1)}>
                    <i className="ti ti-arrow-left" aria-hidden="true" /> prev
                  </button>
                  <button className="btn-primary" style={{flex:1,justifyContent:'center'}} onClick={() => step < meal.steps.length - 1 ? setStep(s => s + 1) : undefined}>
                    {step === meal.steps.length - 1
                      ? <><i className="ti ti-check" aria-hidden="true" /> done!</>
                      : <>next <i className="ti ti-arrow-right" aria-hidden="true" /></>}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
