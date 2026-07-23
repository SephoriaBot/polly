import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import Icon from '../Icon'
import {
  Salad, X, RotateCcw, Sparkles, ChevronLeft, ChevronRight,
  CheckCircle2, ShoppingCart, Check,
} from 'lucide-react'

interface QuizOption { value: string; label: string }

const GOALS: QuizOption[] = [
  { value: 'eat_healthier', label: 'Eat healthier overall' },
  { value: 'lose_weight', label: 'Lose weight' },
  { value: 'gain_muscle', label: 'Build muscle / gain weight' },
  { value: 'more_energy', label: 'Have more energy' },
  { value: 'manage_condition', label: 'Manage a health condition' },
  { value: 'more_variety', label: 'Just want more variety' },
]

const PATTERNS: QuizOption[] = [
  { value: 'omnivore', label: 'No restrictions' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'low_carb', label: 'Low-carb' },
  { value: 'gluten_free', label: 'Gluten-free' },
]

const AVOID_OPTIONS = ['dairy', 'egg', 'gluten', 'peanut', 'tree nut', 'soy', 'shellfish', 'red meat']

const CHALLENGES: QuizOption[] = [
  { value: 'sensory_texture', label: 'Texture / sensory sensitivities' },
  { value: 'adhd_autism', label: 'ADHD / autism-related eating patterns' },
  { value: 'picky_safe_foods', label: 'Picky eating / small list of "safe" foods' },
  { value: 'food_anxiety', label: 'Anxiety or stress around food' },
  { value: 'low_appetite', label: 'Low appetite / forget to eat' },
  { value: 'binge_overeating', label: 'Tendency to binge or overeat' },
  { value: 'routine_dependent', label: 'Need a lot of routine / sameness' },
]

const ACTIVITY: QuizOption[] = [
  { value: 'sedentary', label: 'Sedentary — little exercise' },
  { value: 'light', label: 'Lightly active' },
  { value: 'moderate', label: 'Moderately active' },
  { value: 'very_active', label: 'Very active' },
]

const COOKING: QuizOption[] = [
  { value: 'quick', label: 'Quick & simple meals' },
  { value: 'love_cooking', label: 'Love to cook, have time' },
  { value: 'meal_prep', label: 'Meal prep on weekends' },
  { value: 'grab_and_go', label: 'Mostly eat out / grab and go' },
]

interface FocusArea { title: string; tips: string[] }
interface DietAssessment {
  summary: string
  notesAcknowledgment: string
  focusAreas: FocusArea[]
  foodsToEmphasize: string[]
  foodsToLimit: string[]
  groceryPicks: string[]
}

type WizardState = 'quiz' | 'loading' | 'result'

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: '8px 14px', borderRadius: 999, cursor: 'pointer',
    border: active ? '1.5px solid var(--pink-dark)' : '1.5px solid var(--border)',
    background: active ? 'var(--blush)' : 'var(--white)',
    color: active ? 'var(--pink-dark)' : 'var(--ink-soft)',
    fontSize: '0.85rem', fontWeight: active ? 700 : 500,
    transition: 'all 0.15s ease',
  }
}

export default function DrDietGroq({ onClose }: { onClose: () => void }) {
  const STEP_COUNT = 7
  const [wizardState, setWizardState] = useState<WizardState>('quiz')
  const [step, setStep] = useState(0)

  const [goal, setGoal] = useState<string>('')
  const [pattern, setPattern] = useState<string>('')
  const [avoid, setAvoid] = useState<Set<string>>(new Set())
  const [challenges, setChallenges] = useState<Set<string>>(new Set())
  const [activity, setActivity] = useState<string>('')
  const [cooking, setCooking] = useState<string>('')
  const [notes, setNotes] = useState('')

  const [error, setError] = useState('')
  const [assessment, setAssessment] = useState<DietAssessment | null>(null)
  const [expandedArea, setExpandedArea] = useState<number | null>(null)
  const [selectedPicks, setSelectedPicks] = useState<Set<string>>(new Set())
  const [addingToCart, setAddingToCart] = useState(false)
  const [addedToCart, setAddedToCart] = useState(false)

  function toggleAvoid(v: string) {
    setAvoid(prev => {
      const next = new Set(prev)
      next.has(v) ? next.delete(v) : next.add(v)
      return next
    })
  }

  function toggleChallenge(v: string) {
    setChallenges(prev => {
      const next = new Set(prev)
      next.has(v) ? next.delete(v) : next.add(v)
      return next
    })
  }

  function canAdvance() {
    if (step === 0) return Boolean(goal)
    if (step === 1) return Boolean(pattern)
    if (step === 4) return Boolean(activity)
    if (step === 5) return Boolean(cooking)
    return true
  }

  function reset() {
    setWizardState('quiz')
    setStep(0)
    setGoal('')
    setPattern('')
    setAvoid(new Set())
    setChallenges(new Set())
    setActivity('')
    setCooking('')
    setNotes('')
    setError('')
    setAssessment(null)
    setExpandedArea(null)
    setSelectedPicks(new Set())
    setAddedToCart(false)
  }

  async function submit() {
    setError('')
    setWizardState('loading')

    const goalLabel = GOALS.find(g => g.value === goal)?.label
    const patternLabel = PATTERNS.find(p => p.value === pattern)?.label
    const activityLabel = ACTIVITY.find(a => a.value === activity)?.label
    const cookingLabel = COOKING.find(c => c.value === cooking)?.label
    const challengeLabels = [...challenges].map(c => CHALLENGES.find(ch => ch.value === c)?.label).filter(Boolean) as string[]

    const CHALLENGE_GUIDANCE: Record<string, string> = {
      sensory_texture: 'They have texture/sensory sensitivities. Call out the texture of anything you suggest, stick to textures similar to foods they already tolerate, and avoid mixed/mushy/slimy textures unless the notes say those are fine.',
      adhd_autism: 'Their eating patterns are shaped by ADHD and/or autism. Favor low-effort, low-decision meals, eating the same safe foods often without judgment, and structure/reminders over willpower-based tips. Do not suggest plans that require lots of new foods or complex prep at once.',
      picky_safe_foods: 'They are a picky eater with a short list of "safe" foods. Build foodsToEmphasize mostly around safe foods and close variations of them, suggest small "food chaining" steps (a new food similar to a safe one) instead of big variety jumps, and never frame their eating as a problem to fix.',
      food_anxiety: 'They experience anxiety or stress around food. Keep every suggestion low-pressure and optional, never urgent or guilt-based.',
      low_appetite: 'They have low appetite or forget to eat. Favor easy, low-barrier, gently calorie-dense foods and snack-sized ideas over full meals, plus simple reminders/routines to eat regularly.',
      binge_overeating: 'They have a tendency to binge or overeat. Avoid restrictive or scarcity-based language; emphasize consistent, satisfying regular eating rather than limiting foods.',
      routine_dependent: 'They rely heavily on routine and sameness. Favor a small rotation of consistent go-to meals over variety for its own sake.',
    }
    const challengeGuidanceText = [...challenges].map(c => CHALLENGE_GUIDANCE[c]).filter(Boolean).join('\n')

    const prompt = `You are a warm, supportive dietitian-style assistant helping someone get general, everyday nutrition direction. You are NOT a doctor or licensed dietitian and must never give medical advice, calorie targets, macro numbers, or restrictive plans — only gentle, sustainable, food-based guidance.

Main goal: ${goalLabel}.
Current way of eating: ${patternLabel}.
Foods to avoid: ${avoid.size > 0 ? [...avoid].join(', ') : 'none specified'}.
Eating challenges they identified: ${challengeLabels.length > 0 ? challengeLabels.join(', ') : 'none specified'}.
Activity level: ${activityLabel}.
Cooking style: ${cookingLabel}.

${challengeGuidanceText ? `How to handle their eating challenges — follow this closely:\n${challengeGuidanceText}\n` : ''}
Notes in their own words — THIS IS THE MOST IMPORTANT INPUT. Read it carefully and make sure every specific thing mentioned here (foods, struggles, a diagnosis, a texture, a routine, a fear, anything) is directly and visibly reflected somewhere in your response, not just generically acknowledged:
"${notes.trim() || 'nothing else provided'}"

Respond ONLY with a valid JSON object, no markdown, no backticks, no explanation. Use this exact shape:
{
  "summary": "2-3 sentence warm, plain-language overview of a sensible direction for this person",
  "notesAcknowledgment": "If notes were provided, 1-2 sentences that explicitly name what they wrote and how it specifically shaped the guidance below (e.g. 'Since you mentioned dairy upsets your stomach and you tend to stick to a few safe foods, I focused on...'). If no notes were provided, use an empty string.",
  "focusAreas": [
    { "title": "short focus area name, e.g. Building balanced plates", "tips": ["specific, practical tip 1", "tip 2", "tip 3"] },
    { "title": "focus area 2", "tips": ["tip 1", "tip 2"] },
    { "title": "focus area 3", "tips": ["tip 1", "tip 2"] }
  ],
  "foodsToEmphasize": ["8 to 12 specific whole foods or food groups to eat more of, respecting their diet pattern, avoid list, and eating challenges"],
  "foodsToLimit": ["4 to 6 food or food categories to eat less often, phrased gently, never 'never eat' or absolute language"],
  "groceryPicks": ["10 to 15 concrete, plain grocery item names (no quantities) pulled from foodsToEmphasize, ready to drop onto a shopping list"]
}
Never mention calories, macros, or specific weight numbers. If the goal involves managing a health condition, keep foodsToEmphasize/foodsToLimit general and gently note in the summary that a doctor or registered dietitian should guide anything condition-specific. Keep the tone encouraging, never restrictive or shame-based.`

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 900,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      const data = await response.json()
      const raw = data.choices?.[0]?.message?.content ?? ''
      const clean = raw.replace(/```json|```/g, '').trim()
      const parsed: DietAssessment = JSON.parse(clean)
      setAssessment(parsed)
      setSelectedPicks(new Set(parsed.groceryPicks))
      setWizardState('result')
    } catch {
      setError('Something went wrong getting your check-in. Please try again.')
      setWizardState('quiz')
      setStep(STEP_COUNT - 1)
    }
  }

  function togglePick(item: string) {
    setSelectedPicks(prev => {
      const next = new Set(prev)
      next.has(item) ? next.delete(item) : next.add(item)
      return next
    })
  }

  async function addSelectedToGroceryList() {
    if (!assessment || selectedPicks.size === 0) return
    setAddingToCart(true)

    const { data: existing } = await supabase.from('grocery_items').select('name')
    const existingKeys = new Set((existing ?? []).map(e => e.name.toLowerCase().trim()))

    const rows = [...selectedPicks]
      .filter(item => !existingKeys.has(item.toLowerCase().trim()))
      .map(item => ({ name: item, qty: '', checked: false }))

    if (rows.length > 0) {
      await supabase.from('grocery_items').insert(rows)
    }

    setAddingToCart(false)
    setAddedToCart(true)
    setTimeout(() => setAddedToCart(false), 2500)
  }

  const progressPct = ((step + 1) / STEP_COUNT) * 100

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ background: 'var(--blush)', color: 'var(--pink-dark)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.95rem' }}>
            <Salad size={17} /> Ask Dr. Groq — Diet Check-In
          </span>
          <button className="close-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>

          {/* Disclaimer */}
          <div style={{
            marginBottom: 16, padding: '10px 14px', borderRadius: 'var(--radius-sm)',
            background: '#fdf7ff', border: '1.5px solid #ecdcfb',
            fontSize: '0.76rem', color: 'var(--ink-muted)', lineHeight: 1.5,
          }}>
            <Icon name="apple-carrot" size={16} /> General guidance only — not medical or clinical advice. For a health condition, pregnancy, or anything more specific, please check with a doctor or registered dietitian.
          </div>

          {wizardState === 'quiz' && (
            <div>
              <div style={{ height: 6, background: 'var(--border)', borderRadius: 999, marginBottom: 18, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 999, width: `${progressPct}%`,
                  background: 'linear-gradient(90deg, var(--secondary), var(--pink-dark))',
                  transition: 'width 0.3s',
                }} />
              </div>

              {error && (
                <div style={{
                  marginBottom: 16, padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--danger-bg)', border: '1.5px solid var(--danger)',
                  fontSize: '0.82rem', color: 'var(--danger)',
                }}>
                  {error}
                </div>
              )}

              {step === 0 && (
                <div>
                  <h3 style={{ margin: '0 0 14px', fontSize: '1.05rem' }}>What's your main goal right now?</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {GOALS.map(g => (
                      <button key={g.value} style={chipStyle(goal === g.value)} onClick={() => setGoal(g.value)}>{g.label}</button>
                    ))}
                  </div>
                </div>
              )}

              {step === 1 && (
                <div>
                  <h3 style={{ margin: '0 0 14px', fontSize: '1.05rem' }}>Do you follow a specific way of eating?</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {PATTERNS.map(p => (
                      <button key={p.value} style={chipStyle(pattern === p.value)} onClick={() => setPattern(p.value)}>{p.label}</button>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem' }}>Anything you need to avoid?</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginBottom: 14 }}>Optional — select any that apply</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {AVOID_OPTIONS.map(a => (
                      <button key={a} style={chipStyle(avoid.has(a))} onClick={() => toggleAvoid(a)}>{a}</button>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div>
                  <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem' }}>Any eating challenges we should know about?</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginBottom: 14 }}>Optional — select any that apply, this shapes how the suggestions are framed</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {CHALLENGES.map(c => (
                      <button key={c.value} style={chipStyle(challenges.has(c.value))} onClick={() => toggleChallenge(c.value)}>{c.label}</button>
                    ))}
                  </div>
                </div>
              )}

              {step === 4 && (
                <div>
                  <h3 style={{ margin: '0 0 14px', fontSize: '1.05rem' }}>How active are you day-to-day?</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {ACTIVITY.map(a => (
                      <button key={a.value} style={{ ...chipStyle(activity === a.value), textAlign: 'left', borderRadius: 'var(--radius-sm)' }} onClick={() => setActivity(a.value)}>{a.label}</button>
                    ))}
                  </div>
                </div>
              )}

              {step === 5 && (
                <div>
                  <h3 style={{ margin: '0 0 14px', fontSize: '1.05rem' }}>What's realistic for your cooking time?</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {COOKING.map(c => (
                      <button key={c.value} style={{ ...chipStyle(cooking === c.value), textAlign: 'left', borderRadius: 'var(--radius-sm)' }} onClick={() => setCooking(c.value)}>{c.label}</button>
                    ))}
                  </div>
                </div>
              )}

              {step === 6 && (
                <div>
                  <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem' }}>Anything else worth knowing?</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginBottom: 14 }}>Optional — but this box is read closely and will directly shape your check-in. Specific foods, a diagnosis, a texture issue, past struggles, whatever's relevant.</p>
                  <textarea
                    className="form-textarea"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="e.g. I'm dairy intolerant and it took me forever to figure that out, I have ADHD so I forget to eat until I'm starving, I only really trust like 6 foods..."
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 22, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <button
                  className="btn btn-ghost"
                  style={{ flex: 1, justifyContent: 'center' }}
                  disabled={step === 0}
                  onClick={() => setStep(s => s - 1)}
                >
                  <ChevronLeft size={14} /> Back
                </button>
                {step < STEP_COUNT - 1 ? (
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, justifyContent: 'center' }}
                    disabled={!canAdvance()}
                    onClick={() => setStep(s => s + 1)}
                  >
                    Next <ChevronRight size={14} />
                  </button>
                ) : (
                  <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={submit}>
                    <Sparkles size={14} /> Get My Check-In
                  </button>
                )}
              </div>
            </div>
          )}

          {wizardState === 'loading' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '50px 20px', gap: 16 }}>
              <div className="shape-heart" style={{
                width: 52, height: 52, borderRadius: '50%',
                background: 'var(--blush)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'dietPulse 1.4s ease-in-out infinite',
              }}>
                <Sparkles size={22} style={{ color: 'var(--pink-dark)' }} />
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--ink-muted)', fontStyle: 'italic' }}>Putting together your check-in…</p>
            </div>
          )}

          {wizardState === 'result' && assessment && (
            <div>
              <div style={{
                padding: '14px 18px', borderRadius: 'var(--radius-md)', marginBottom: 18,
                background: 'var(--blush)', border: '1.5px solid var(--pink-light)',
              }}>
                <p style={{ fontSize: '0.88rem', color: 'var(--ink)', lineHeight: 1.6, margin: 0 }}>{assessment.summary}</p>
              </div>

              {assessment.notesAcknowledgment && (
                <div style={{
                  padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: 18,
                  background: '#fdf7ff', border: '1.5px solid #ecdcfb',
                }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', lineHeight: 1.55, margin: 0, fontStyle: 'italic' }}>{assessment.notesAcknowledgment}</p>
                </div>
              )}

              <div className="section-label" style={{ marginBottom: 10 }}>Focus Areas</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                {assessment.focusAreas.map((area, i) => {
                  const isOpen = expandedArea === i
                  return (
                    <div
                      key={i}
                      className="card"
                      onClick={() => setExpandedArea(isOpen ? null : i)}
                      style={{ padding: '10px 14px', cursor: 'pointer', border: isOpen ? '1.5px solid var(--pink-dark)' : undefined }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--ink)', fontWeight: isOpen ? 700 : 600 }}>{area.title}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--pink-dark)', flexShrink: 0 }}>{isOpen ? '▲' : '▼ tips'}</span>
                      </div>
                      {isOpen && area.tips?.length > 0 && (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {area.tips.map((tip, ti) => (
                            <div key={ti} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: '0.8rem', color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                              <CheckCircle2 size={13} style={{ color: 'var(--pink-dark)', flexShrink: 0, marginTop: 2 }} />
                              {tip}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div className="section-label" style={{ marginBottom: 8 }}>Eat More Of</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {assessment.foodsToEmphasize.map(f => (
                      <span key={f} style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--sage-dark)', background: 'var(--sage-light)', padding: '3px 10px', borderRadius: 999 }}>{f}</span>
                    ))}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div className="section-label" style={{ marginBottom: 8 }}>Ease Up On</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {assessment.foodsToLimit.map(f => (
                      <span key={f} style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--gold-dark)', background: 'var(--gold-light)', padding: '3px 10px', borderRadius: 999 }}>{f}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="section-label" style={{ marginBottom: 4 }}>Grocery Picks</div>
              <p style={{ fontSize: '0.76rem', color: 'var(--ink-muted)', marginBottom: 10 }}>Uncheck anything you don't want, then add the rest to your list.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                {assessment.groceryPicks.map(item => {
                  const checked = selectedPicks.has(item)
                  return (
                    <label
                      key={item}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                        background: checked ? 'var(--blush)' : 'var(--white)',
                        border: `1.5px solid ${checked ? 'var(--pink-light)' : 'var(--border)'}`,
                      }}
                    >
                      <input type="checkbox" checked={checked} onChange={() => togglePick(item)} style={{ accentColor: 'var(--pink)' }} />
                      <span style={{ fontSize: '0.85rem', color: 'var(--ink)' }}>{item}</span>
                    </label>
                  )
                })}
              </div>

              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={addSelectedToGroceryList}
                disabled={selectedPicks.size === 0 || addingToCart || addedToCart}
              >
                {addedToCart
                  ? <><Check size={14} /> Added to Grocery List!</>
                  : addingToCart
                    ? 'Adding…'
                    : <><ShoppingCart size={14} /> Add {selectedPicks.size} Item{selectedPicks.size === 1 ? '' : 's'} to Grocery List</>}
              </button>

              <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={reset}>
                <RotateCcw size={13} /> Start Over
              </button>
            </div>
          )}

        </div>
      </div>

      <style>{`
        @keyframes dietPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.8; }
        }
      `}</style>
    </div>
  )
}
