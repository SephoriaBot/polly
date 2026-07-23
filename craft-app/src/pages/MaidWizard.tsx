import { useState } from 'react'
import { Clock, Package, ChevronRight, RotateCcw, CheckCircle2, Circle, Sparkles } from 'lucide-react'
import Icon, { type IconName } from '../components/Icon'

const ROOMS: { value: string; label: string; icon: IconName }[] = [
  { value: 'kitchen', label: 'Kitchen', icon: 'cooking-pot' },
  { value: 'bathroom', label: 'Bathroom', icon: 'cleaning-spray' },
  { value: 'bedroom', label: 'Bedroom', icon: 'moon-cloud' },
  { value: 'living_room', label: 'Living Room', icon: 'house' },
  { value: 'laundry_room', label: 'Laundry Room', icon: 'washing-machine' },
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
          <h2>Maid Wizard <Icon name="cleaning-spray" size={22} /></h2>
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
                background: 'var(--white)', border: '1.5px solid #E6A8C8',
                fontSize: '0.85rem', color: '#DAD0F7'
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ROOMS.map(r => (
                <button
                  key={r.value}
                  onClick={() => generatePlan(r.value)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 18px', borderRadius: 16, cursor: 'pointer',
                    inset: '6px',
                    border: '2px dashed rgba(232,160,172,0.35)',
                    background: 'var(--surface)',
                    transition: 'all 0.15s ease',
                    textAlign: 'left',
                    color: 'var(--ink-soft)',
                    boxShadow: '0 1px 4px rgba(232,160,172,0.08)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#e8a0ac'
                    e.currentTarget.style.boxShadow = '0 2px 10px rgba(232,160,172,0.2)'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.boxShadow = '0 1px 4px rgba(232,160,172,0.08)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span style={{ fontSize: '1.4rem' }}><Icon name={r.icon} size={22} /></span>
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
            <div className="shape-teddy" style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'linear-gradient(135deg, #fbe1e5, #ffe0d1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'gentlePulse 1.4s ease-in-out infinite',
            }}>
              <Sparkles size={24} style={{ color: '#b56575' }} />
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
              background: 'linear-gradient(135deg, #fbe1e5, #ffe0d1)',
              border: '1.5px solid #f6cfd6',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.5rem' }}>{room && <Icon name={room.icon} size={24} />}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--ink)' }}>
                    {room?.label} Deep Clean
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#b56575' }}>
                    {allDone ? <><Icon name="flower" size={14} /> All done! Amazing work~</> : `${doneCount} of ${totalSteps} steps done`}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#b56575', fontWeight: 600, fontSize: '0.88rem' }}>
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
                    ? 'linear-gradient(90deg, #f7b89c, #e8a0ac)'
                    : 'linear-gradient(90deg, #e8a0ac, #f6cfd6)',
                  borderRadius: 99,
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>

            <div className="grid-2" style={{ alignItems: 'start', gap: 16 }}>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  <Icon name="clipboard-list" size={14} /> Steps
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
                        background: done ? 'linear-gradient(135deg, #fff7f0, #fbe1e5)' : 'var(--cream)',
                        border: `1.5px solid ${done ? '#e8a0ac' : 'var(--border)'}`,
                        transition: 'all 0.2s ease',
                        boxShadow: done ? '0 1px 6px rgba(232,160,172,0.15)' : 'none',
                      }}
                    >
                      <div style={{ flexShrink: 0, marginTop: 1 }}>
                        {done
                          ? <CheckCircle2 size={17} style={{ color: '#b56575' }} />
                          : <Circle size={17} style={{ color: 'var(--border)' }} />
                        }
                      </div>
                      <div>
                        <div style={{
                          fontWeight: 600, fontSize: '0.86rem',
                          color: done ? '#b56575' : 'var(--ink)',
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
                  <Icon name="cleaning-spray" size={14} /> Supplies
                </div>
                <div className="card" style={{ borderRadius: 16, border: '1.5px solid #f6cfd6' }}>
                  <div className="card-body">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {plan.supplies.map((supply, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 10px', borderRadius: 10,
                          background: 'linear-gradient(135deg, var(--cream), var(--pink-dark))',
                          border: '1px solid #f6cfd6',
                          fontSize: '0.84rem', color: 'var(--ink)',
                        }}>
                          <Package size={13} style={{ color: '#b56575', flexShrink: 0 }} />
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
                background: 'linear-gradient(135deg, var(--cream), var(--pink-dark))',
                border: '1.5px solid #e8a0ac',
              }}>
                <div style={{ fontSize: '1.5rem', marginBottom: 6 }}><Icon name="sparkles-cluster" size={28} /></div>
                <div style={{ fontWeight: 700, color: '#b56575', marginBottom: 4 }}>Spotless! You did it!</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>Your {room?.label.toLowerCase()} is sparkling clean.</div>
                <button
                  onClick={reset}
                  style={{
                    marginTop: 12, padding: '8px 20px', borderRadius: 12, cursor: 'pointer',
                    background: 'linear-gradient(135deg, #e8a0ac, #f7b89c)',
                    border: 'none', color: 'var(--white)', fontWeight: 600, fontSize: '0.85rem',
                  }}
                >
                  Clean another room <Icon name="sparkle-single" size={14} />
                </button>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  )
}
