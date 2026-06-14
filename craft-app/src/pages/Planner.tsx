import { useState, useEffect } from 'react'
import type { WeekPlan, Meal } from '../types'
import { supabase } from '../lib/supabase'
import styles from './Planner.module.css'

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const MEAL_TYPES = ['breakfast','lunch','dinner'] as const

const EMPTY_PLAN: WeekPlan = Object.fromEntries(
  DAYS.map(d => [d, { breakfast: null, lunch: null, dinner: null }])
)

export default function Planner({ onNavigate }: PlannerProps) {
  const [plan, setPlan] = useState<WeekPlan>(EMPTY_PLAN)
  const [meals, setMeals] = useState<Meal[]>([])
  const [selecting, setSelecting] = useState<{day:string; type:typeof MEAL_TYPES[number]} | null>(null)
  const [loading, setLoading] = useState(true)
  interface PlannerProps {
  onNavigate: (page: string) => void
}

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

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>this week</h1>
        <button className="btn-primary" onClick={() => onNavigate('suggest')}>
          <i className="ti ti-sparkles" aria-hidden="true" /> get meal ideas
        </button>
      </div>

      {loading ? <p style={{color:'var(--text-soft)',fontSize:13}}>loading...</p> : (
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
                    <p style={{fontSize:12,color:'var(--text-soft)',padding:'1rem',textAlign:'center'}}>
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
                {meals.map(m => (
                  <div key={m.id} className={`card ${styles.mealCard}`}>
                    <div className={styles.mealName}>{m.name}</div>
                    <div className={styles.mealMeta}>
                      <span style={{color:'var(--text-soft)',fontSize:11}}>{m.time}</span>
                      {m.tags.map(t => <span key={t} className={`tag ${t}`}>{t}</span>)}
                    </div>
                    <button
                      className="btn-ghost"
                      style={{fontSize:11,padding:'4px 8px',marginTop:6,width:'100%',justifyContent:'center'}}
                      onClick={() => onNavigate('cook')}
                    >
                      <i className="ti ti-chef-hat" aria-hidden="true" /> cook this
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
