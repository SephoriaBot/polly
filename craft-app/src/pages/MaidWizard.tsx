import { useState } from 'react'
import { Clock, Package, ChevronRight, RotateCcw, CheckCircle2, Circle, Sparkles } from 'lucide-react'

const ROOMS = [
  { value: 'kitchen', label: 'Kitchen', emoji: '🍳' },
  { value: 'bathroom', label: 'Bathroom', emoji: '🛁' },
  { value: 'bedroom', label: 'Bedroom', emoji: '🛏️' },
  { value: 'living_room', label: 'Living Room', emoji: '🛋️' },
  { value: 'laundry_room', label: 'Laundry Room', emoji: '🧺' },
]

interface CleaningPlan {
  supplies: string[]
  estimatedMinutes: number
  steps: { title: string; detail: string }[]
}

type WizardState = 'select' | 'loading' | 'plan'

export default function MaidWizard() {
  const [wizardState, setWizardState] = useState<WizardState>('select')
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const [plan, setPlan] = useState<CleaningPlan | null>(null)
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')

  async function generatePlan(roomValue: string) {
    const room = ROOMS.find(r => r.value === roomValue)
    if (!room) return

    setSelectedRoom(roomValue)
    setWizardState('loading')
    setCheckedSteps(new Set())
    setError('')

    const prompt = `You are a deep cleaning expert. Generate a deep cleaning plan for: ${room.label}

Respond ONLY with a valid JSON object, no markdown, no backticks, no explanation. Use this exact shape:
{
  "supplies": ["item1", "item2"],
  "estimatedMinutes": 45,
  "steps": [
    { "title": "Short action title", "detail": "One to two sentences of specific guidance." }
  ]
}
Include 4–8 supplies, a realistic time estimate, and 6–10 steps in logical cleaning order (top to bottom, least dirty to most dirty). Be specific and practical.`

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      const data = await response.json()
      const raw = data.choices?.[0]?.message?.content ?? ''
      const clean = raw.replace(/```json|```/g, '').trim()
      const parsed: CleaningPlan = JSON.parse(clean)
      setPlan(parsed)
      setWizardState('plan')
    } catch {
      setError('Something went wrong generating your plan. Please try again.')
      setWizardState('select')
    }
  }

  function toggleStep(index: number) {
    setCheckedSteps(prev => {
      const next = new Set(prev)
      next.has(index) ? next.delete(index) : next.add(index)
      return next
    })
  }

  function reset() {
    setWizardState('select')
    setSelectedRoom(null)
    setPlan(null)
    setCheckedSteps(new Set())
    setError('')
  }

  const room = ROOMS.find(r => r.value === selectedRoom)
  const doneCount = checkedSteps.size
  const totalSteps = plan?.steps.length ?? 0
  const allDone = totalSteps > 0 && doneCount === totalSteps

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Maid Wizard 🧹</h2>
          <p>Pick a room and get a deep clean plan</p>
        </div>
        {wizardState === 'plan' && (
          <button className="btn btn-ghost" onClick={reset}>
            <RotateCcw size={14} /> New Room
          </button>
        )}
      </div>

      <div className="page-body">

        {/* Room selection */}
        {wizardState === 'select' && (
          <div style={{ maxWidth: 500 }}>
            {error && (
              <div style={{
                marginBottom: 16, padding: '10px 14px', borderRadius: 12,
                background: 'var(--white)', border: '1.5px solid #fecaca',
                fontSize: '0.85rem', color: '#b91c1c'
              }}>
                {error}
              </div>
            )}

            <p style={{ fontSize: '0.88rem', color: 'var(--ink-muted)', marginBottom: 20, lineHeight: 1.6 }}>
              Which room are we tackling today? ✨
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ROOMS.map(r => (
                <button
                  key={r.value}
                  onClick={() => generatePlan(r.value)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 18px', borderRadius: 16, cursor: 'pointer',
                    inset: '6px',
                    border: '2px dashed rgba(200,150,200,0.35)',
                    background: '#FFFFFF',
                    transition: 'all 0.15s ease',
                    textAlign: 'left',
                    color: 'var(--ink-soft)',
                    boxShadow: '0 1px 4px rgba(201,166,240,0.08)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#C9A6F0'
                    e.currentTarget.style.boxShadow = '0 2px 10px rgba(201,166,240,0.2)'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.boxShadow = '0 1px 4px rgba(201,166,240,0.08)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span style={{ fontSize: '1.4rem' }}>{r.emoji}</span>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--ink)' }}>{r.label}</span>
                  </div>
                  <ChevronRight size={16} style={{ color: 'var(--ink-muted)' }} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {wizardState === 'loading' && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '60px 20px', gap: 16
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'linear-gradient(135deg, #fde8f5, #e8d5ff)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'gentlePulse 1.4s ease-in-out infinite',
            }}>
              <Sparkles size={24} style={{ color: '#9B72CF' }} />
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--ink-muted)', fontStyle: 'italic' }}>
              Building your {room?.label.toLowerCase()} cleaning plan…
            </p>
            <style>{`
              @keyframes gentlePulse {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.08); opacity: 0.8; }
              }
            `}</style>
          </div>
        )}

        {/* Plan */}
        {wizardState === 'plan' && plan && (
          <div style={{ maxWidth: 640 }}>

            <div style={{
              padding: '16px 20px', borderRadius: 16, marginBottom: 20,
              background: 'linear-gradient(135deg, #fde8f5, #e8d5ff)',
              border: '1.5px solid #f0d9ff',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.5rem' }}>{room?.emoji}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--ink)' }}>
                    {room?.label} Deep Clean
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#9B72CF' }}>
                    {allDone ? '🌸 All done! Amazing work~' : `${doneCount} of ${totalSteps} steps done`}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9B72CF', fontWeight: 600, fontSize: '0.88rem' }}>
                <Clock size={15} />
                ~{plan.estimatedMinutes} min
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ height: 8, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${totalSteps > 0 ? (doneCount / totalSteps) * 100 : 0}%`,
                  background: allDone
                    ? 'linear-gradient(90deg, #8FE0B8, #C9A6F0)'
                    : 'linear-gradient(90deg, #C9A6F0, #FF8FC4)',
                  borderRadius: 99,
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>

            <div className="grid-2" style={{ alignItems: 'start', gap: 16 }}>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  🧽 Steps
                </div>
                {plan.steps.map((step, i) => {
                  const done = checkedSteps.has(i)
                  return (
                    <div
                      key={i}
                      onClick={() => toggleStep(i)}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        padding: '12px 14px', borderRadius: 14, cursor: 'pointer',
                        background: done ? 'linear-gradient(135deg, #f0faf5, #faf0ff)' : 'var(--cream)',
                        border: `1.5px solid ${done ? '#C9A6F0' : 'var(--border)'}`,
                        transition: 'all 0.2s ease',
                        boxShadow: done ? '0 1px 6px rgba(201,166,240,0.15)' : 'none',
                      }}
                    >
                      <div style={{ flexShrink: 0, marginTop: 1 }}>
                        {done
                          ? <CheckCircle2 size={17} style={{ color: '#9B72CF' }} />
                          : <Circle size={17} style={{ color: 'var(--border)' }} />
                        }
                      </div>
                      <div>
                        <div style={{
                          fontWeight: 600, fontSize: '0.86rem',
                          color: done ? '#9B72CF' : 'var(--ink)',
                          textDecoration: done ? 'line-through' : 'none',
                          transition: 'all 0.2s ease',
                        }}>
                          {step.title}
                        </div>
                        {!done && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: 3, lineHeight: 1.5 }}>
                            {step.detail}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div>
                <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                  🧴 Supplies
                </div>
                <div className="card" style={{ borderRadius: 16, border: '1.5px solid #f0d9ff' }}>
                  <div className="card-body">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {plan.supplies.map((supply, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 10px', borderRadius: 10,
                          background: 'linear-gradient(135deg, #fff8f0, #fef6ff)',
                          border: '1px solid #f0d9ff',
                          fontSize: '0.84rem', color: 'var(--ink)',
                        }}>
                          <Package size={13} style={{ color: '#9B72CF', flexShrink: 0 }} />
                          {supply}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {allDone && (
              <div style={{
                marginTop: 24, padding: '16px 20px', borderRadius: 16, textAlign: 'center',
                background: 'linear-gradient(135deg, #f0faf5, #faf0ff)',
                border: '1.5px solid #C9A6F0',
              }}>
                <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>🌸✨</div>
                <div style={{ fontWeight: 700, color: '#9B72CF', marginBottom: 4 }}>Spotless! You did it!</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>Your {room?.label.toLowerCase()} is sparkling clean.</div>
                <button
                  onClick={reset}
                  style={{
                    marginTop: 12, padding: '8px 20px', borderRadius: 12, cursor: 'pointer',
                    background: 'linear-gradient(135deg, #C9A6F0, #FF8FC4)',
                    border: 'none', color: 'white', fontWeight: 600, fontSize: '0.85rem',
                  }}
                >
                  Clean another room ✨
                </button>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  )
}
