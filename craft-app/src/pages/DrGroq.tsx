import { useState } from 'react'
import { Stethoscope, AlertTriangle, Phone, RotateCcw, CheckCircle2, Sparkles } from 'lucide-react'

interface PetContext {
  name: string
  species: string
  breed?: string | null
  age?: number | null
  weight?: number | null
  vet_name?: string | null
  vet_phone?: string | null
}

interface Symptom {
  id: string
  label: string
  redFlag?: boolean
}

interface SymptomGroup {
  label: string
  emoji: string
  symptoms: Symptom[]
}

const SYMPTOM_GROUPS: SymptomGroup[] = [
  {
    label: 'Eating & Drinking',
    emoji: '🍽',
    symptoms: [
      { id: 'not_eating', label: 'Not eating' },
      { id: 'eating_less', label: 'Eating less than usual' },
      { id: 'overeating', label: 'Overeating / begging more' },
      { id: 'drinking_more', label: 'Drinking more than usual' },
      { id: 'drinking_less', label: 'Drinking less than usual' },
      { id: 'vomiting', label: 'Vomiting' },
    ],
  },
  {
    label: 'Digestive',
    emoji: '🌀',
    symptoms: [
      { id: 'diarrhea', label: 'Diarrhea' },
      { id: 'constipation', label: 'Constipation' },
      { id: 'blood_stool', label: 'Blood in stool', redFlag: true },
    ],
  },
  {
    label: 'Urinary',
    emoji: '💧',
    symptoms: [
      { id: 'straining_urinate', label: 'Straining to urinate / not urinating', redFlag: true },
      { id: 'blood_urine', label: 'Blood in urine', redFlag: true },
      { id: 'urinating_more', label: 'Urinating more than usual' },
    ],
  },
  {
    label: 'Weight & Body',
    emoji: '⚖️',
    symptoms: [
      { id: 'weight_gain', label: 'Noticeable weight gain' },
      { id: 'weight_loss', label: 'Noticeable weight loss' },
      { id: 'bloated', label: 'Bloated / distended belly', redFlag: true },
    ],
  },
  {
    label: 'Behavior & Energy',
    emoji: '😿',
    symptoms: [
      { id: 'lethargy', label: 'Lethargy / low energy' },
      { id: 'hiding', label: 'Hiding more than usual' },
      { id: 'vocalizing', label: 'Increased vocalization' },
      { id: 'aggression', label: 'Aggression / irritability' },
      { id: 'confusion', label: 'Confusion / disorientation' },
    ],
  },
  {
    label: 'Mobility',
    emoji: '🦴',
    symptoms: [
      { id: 'limping', label: 'Limping' },
      { id: 'stiffness', label: 'Stiffness' },
      { id: 'wont_jump', label: "Reluctant to jump / climb" },
      { id: 'cant_stand', label: "Can't stand / collapsed", redFlag: true },
    ],
  },
  {
    label: 'Grooming & Coat',
    emoji: '🪮',
    symptoms: [
      { id: 'not_grooming', label: 'Not grooming self' },
      { id: 'over_grooming', label: 'Over-grooming / excessive licking' },
      { id: 'matted_fur', label: 'Matted fur' },
      { id: 'hair_loss', label: 'Hair loss' },
      { id: 'dandruff', label: 'Dandruff / flaky skin' },
      { id: 'scratching', label: 'Excessive scratching' },
      { id: 'redness', label: 'Skin redness / irritation' },
      { id: 'parasites', label: 'Visible fleas, ticks, or parasites' },
    ],
  },
  {
    label: 'Respiratory',
    emoji: '🫁',
    symptoms: [
      { id: 'coughing', label: 'Coughing' },
      { id: 'sneezing', label: 'Sneezing' },
      { id: 'labored_breathing', label: 'Labored / rapid breathing', redFlag: true },
      { id: 'wheezing', label: 'Wheezing' },
    ],
  },
  {
    label: 'Eyes, Ears & Nose',
    emoji: '👁',
    symptoms: [
      { id: 'discharge', label: 'Discharge (eyes, ears, or nose)' },
      { id: 'eye_ear_redness', label: 'Redness' },
      { id: 'odor', label: 'Unusual odor' },
      { id: 'head_shaking', label: 'Head shaking' },
    ],
  },
  {
    label: 'Other Emergencies',
    emoji: '🚨',
    symptoms: [
      { id: 'poisoning', label: 'Suspected poisoning / ate something toxic', redFlag: true },
    ],
  },
]

const DURATIONS = [
  { value: 'today', label: 'Started today' },
  { value: 'few_days', label: 'A few days' },
  { value: 'week_plus', label: 'A week or more' },
]

const SEVERITIES = [
  { value: 'mild', label: 'Mild concern' },
  { value: 'worried', label: 'Worried' },
  { value: 'very_worried', label: 'Very worried' },
]

interface PossibleCause {
  cause: string
  tips: string[]
}

interface Assessment {
  summary: string
  possibleCauses: PossibleCause[]
  homeCareTips: string[]
  vetUrgency: 'monitor' | 'soon' | 'urgent'
}

type WizardState = 'form' | 'loading' | 'redflag' | 'result'

export default function DrGroq({ pet }: { pet: PetContext }) {
  const [wizardState, setWizardState] = useState<WizardState>('form')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [duration, setDuration] = useState('today')
  const [severity, setSeverity] = useState('worried')
  const [freeText, setFreeText] = useState('')
  const [triggeredRedFlags, setTriggeredRedFlags] = useState<string[]>([])
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [error, setError] = useState('')
  const [expandedCause, setExpandedCause] = useState<number | null>(null)

  const allSymptoms = SYMPTOM_GROUPS.flatMap(g => g.symptoms)

  function toggleSymptom(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function reset() {
    setWizardState('form')
    setSelected(new Set())
    setDuration('today')
    setSeverity('worried')
    setFreeText('')
    setTriggeredRedFlags([])
    setAssessment(null)
    setError('')
    setExpandedCause(null)
  }

  async function submit() {
    setError('')

    const redFlags = allSymptoms.filter(s => s.redFlag && selected.has(s.id)).map(s => s.label)
    if (redFlags.length > 0) {
      setTriggeredRedFlags(redFlags)
      setWizardState('redflag')
      return
    }

    if (selected.size === 0 && !freeText.trim()) {
      setError('Select at least one symptom or describe what\'s going on.')
      return
    }

    setWizardState('loading')

    const symptomLabels = allSymptoms.filter(s => selected.has(s.id)).map(s => s.label)
    const durationLabel = DURATIONS.find(d => d.value === duration)?.label
    const severityLabel = SEVERITIES.find(s => s.value === severity)?.label

    const prompt = `You are a calm, careful veterinary triage assistant helping a pet owner decide what to do before calling the vet. You are NOT a vet and must never diagnose definitively — only suggest possibilities and next steps.

Pet: ${pet.name}, a ${pet.age ? pet.age + '-year-old ' : ''}${pet.breed || pet.species} (${pet.species})${pet.weight ? `, ${pet.weight} lbs` : ''}.

Reported symptoms: ${symptomLabels.length > 0 ? symptomLabels.join(', ') : 'none selected'}.
Duration: ${durationLabel}.
Owner's concern level: ${severityLabel}.
Additional details from owner: ${freeText.trim() || 'none provided'}.

Respond ONLY with a valid JSON object, no markdown, no backticks, no explanation. Use this exact shape:
{
  "summary": "1-2 sentence plain-language summary of what's being observed",
  "possibleCauses": [
    { "cause": "short possibility name, e.g. Overeating / free-feeding", "tips": ["specific, practical tip 1 for this cause", "tip 2", "tip 3"] },
    { "cause": "possibility 2", "tips": ["tip 1", "tip 2"] },
    { "cause": "possibility 3", "tips": ["tip 1", "tip 2"] }
  ],
  "homeCareTips": ["safe, conservative general tip 1", "tip 2", "tip 3"],
  "vetUrgency": "monitor" | "soon" | "urgent"
}
Use "monitor" only for clearly minor, low-risk situations. Use "soon" when a vet visit within a few days is wise. Use "urgent" if there's any meaningful chance this needs prompt veterinary attention. Keep tips conservative and never suggest withholding care that could be needed — when uncertain, lean toward recommending the vet. Keep possibleCauses to non-alarmist, plausible options, not worst-case scenarios. Each cause's "tips" should be specific, actionable steps for managing or preventing that particular cause (2-4 tips each), not generic advice.`

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 800,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      const data = await response.json()
      const raw = data.choices?.[0]?.message?.content ?? ''
      const clean = raw.replace(/```json|```/g, '').trim()
      const parsed: Assessment = JSON.parse(clean)
      setAssessment(parsed)
      setWizardState('result')
    } catch {
      setError('Something went wrong getting an assessment. Please try again.')
      setWizardState('form')
    }
  }

  const urgencyStyle = {
    monitor: { bg: 'linear-gradient(135deg, #eafaf0, #f3fff7)', border: '#9bdcb5', text: '#2f8a55', label: '🌿 Keep an eye on it' },
    soon: { bg: 'linear-gradient(135deg, #fff7e6, #fffaf0)', border: '#f0c97a', text: '#b8860b', label: '⏰ See a vet soon' },
    urgent: { bg: 'linear-gradient(135deg, #fdeaea, #fff5f5)', border: '#f0a3a3', text: '#c0392b', label: '🚨 Vet visit recommended' },
  } as const

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><Stethoscope size={20} style={{ verticalAlign: -3, marginRight: 6 }} />Ask Dr. Groq</h2>
          <p>A quick check-in before you call the vet</p>
        </div>
        {wizardState !== 'form' && (
          <button className="btn btn-ghost" onClick={reset}>
            <RotateCcw size={14} /> Start Over
          </button>
        )}
      </div>

      <div className="page-body">

        {/* Disclaimer, always visible */}
        <div style={{
          marginBottom: 18, padding: '10px 14px', borderRadius: 12,
          background: '#fdf7ff', border: '1.5px solid #ecdcfb',
          fontSize: '0.78rem', color: 'var(--ink-muted)', lineHeight: 1.5,
        }}>
          🩺 This is general guidance only, not a diagnosis. It's meant to help you describe symptoms and decide how urgent a vet visit is — not replace one.
        </div>

        {/* Form */}
        {wizardState === 'form' && (
          <div style={{ maxWidth: 640 }}>
            {error && (
              <div style={{
                marginBottom: 16, padding: '10px 14px', borderRadius: 12,
                background: 'var(--white)', border: '1.5px solid #fecaca',
                fontSize: '0.85rem', color: '#b91c1c'
              }}>
                {error}
              </div>
            )}

            <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', marginBottom: 16 }}>
              What's going on with <strong>{pet.name}</strong>? Select anything that applies.
            </p>

            {SYMPTOM_GROUPS.map(group => (
              <div key={group.label} style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  {group.emoji} {group.label}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {group.symptoms.map(s => {
                    const active = selected.has(s.id)
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSymptom(s.id)}
                        style={{
                          padding: '8px 14px', borderRadius: 99, cursor: 'pointer',
                          border: active ? '1.5px solid #C9A6F0' : '1.5px solid var(--border)',
                          background: active ? 'linear-gradient(135deg, #f0d9ff, #fde8f5)' : '#fff',
                          color: active ? '#7a4fb0' : 'var(--ink-soft)',
                          fontSize: '0.82rem', fontWeight: active ? 600 : 500,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {active ? '✓ ' : ''}{s.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
                <label className="form-label">How long has this been going on?</label>
                <select className="form-select" value={duration} onChange={e => setDuration(e.target.value)}>
                  {DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
                <label className="form-label">How worried are you?</label>
                <select className="form-select" value={severity} onChange={e => setSeverity(e.target.value)}>
                  {SEVERITIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">Anything else to add? (optional)</label>
              <textarea
                className="form-textarea"
                value={freeText}
                onChange={e => setFreeText(e.target.value)}
                placeholder="e.g. started right after switching food, only happens at night..."
              />
            </div>

            <button className="btn-primary" onClick={submit} style={{ width: '100%' }}>
              Get Dr. Groq's Take ✨
            </button>
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
              Looking over {pet.name}'s symptoms…
            </p>
            <style>{`
              @keyframes gentlePulse {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.08); opacity: 0.8; }
              }
            `}</style>
          </div>
        )}

        {/* Red flag override — skip AI, show urgent banner */}
        {wizardState === 'redflag' && (
          <div style={{ maxWidth: 560 }}>
            <div style={{
              padding: '24px', borderRadius: 18, textAlign: 'center',
              background: 'linear-gradient(135deg, #fdeaea, #fff5f5)',
              border: '2px solid #f0a3a3',
            }}>
              <AlertTriangle size={32} style={{ color: '#c0392b', marginBottom: 10 }} />
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#c0392b', marginBottom: 8 }}>
                Please call your vet now
              </div>
              <p style={{ fontSize: '0.88rem', color: '#7a2e2e', lineHeight: 1.6, marginBottom: 14 }}>
                You selected {triggeredRedFlags.length === 1 ? 'a symptom' : 'symptoms'} that can signal a real emergency:
              </p>
              <ul style={{ textAlign: 'left', fontSize: '0.85rem', color: '#7a2e2e', marginBottom: 16, lineHeight: 1.8 }}>
                {triggeredRedFlags.map(f => <li key={f}>{f}</li>)}
              </ul>
              <p style={{ fontSize: '0.82rem', color: '#7a2e2e', marginBottom: 18 }}>
                This isn't something to wait on a home-care summary for — it's best to talk to a vet or emergency clinic directly.
              </p>
              {pet.vet_phone && (
                <a
                  href={`tel:${pet.vet_phone}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '10px 22px', borderRadius: 12,
                    background: '#c0392b', color: 'white', fontWeight: 700, fontSize: '0.88rem',
                    textDecoration: 'none',
                  }}
                >
                  <Phone size={15} /> Call {pet.vet_name || 'Vet'} · {pet.vet_phone}
                </a>
              )}
            </div>
          </div>
        )}

        {/* AI Result */}
        {wizardState === 'result' && assessment && (
          <div style={{ maxWidth: 640 }}>
            <div style={{
              padding: '16px 20px', borderRadius: 16, marginBottom: 20,
              background: urgencyStyle[assessment.vetUrgency].bg,
              border: `1.5px solid ${urgencyStyle[assessment.vetUrgency].border}`,
            }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: urgencyStyle[assessment.vetUrgency].text, marginBottom: 6 }}>
                {urgencyStyle[assessment.vetUrgency].label}
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--ink)', lineHeight: 1.6 }}>{assessment.summary}</p>
            </div>

            {assessment.vetUrgency !== 'monitor' && pet.vet_phone && (
              <a
                href={`tel:${pet.vet_phone}`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '10px 22px', borderRadius: 12, marginBottom: 20,
                  background: assessment.vetUrgency === 'urgent' ? '#c0392b' : '#b8860b',
                  color: 'white', fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none',
                }}
              >
                <Phone size={15} /> Call {pet.vet_name || 'Vet'} · {pet.vet_phone}
              </a>
            )}

            <div className="grid-2" style={{ alignItems: 'start', gap: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                  🔎 Possible Causes
                </div>
                <p style={{ fontSize: '0.76rem', color: 'var(--ink-muted)', marginBottom: 8, fontStyle: 'italic' }}>
                  Tap a cause for tips
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {assessment.possibleCauses.map((c, i) => {
                    const isOpen = expandedCause === i
                    return (
                      <div
                        key={i}
                        className="card"
                        onClick={() => setExpandedCause(isOpen ? null : i)}
                        style={{
                          padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
                          border: isOpen ? '1.5px solid #C9A6F0' : undefined,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--ink)', fontWeight: isOpen ? 600 : 500 }}>{c.cause}</span>
                          <span style={{ fontSize: '0.75rem', color: '#9B72CF', flexShrink: 0 }}>{isOpen ? '▲' : '▼ tips'}</span>
                        </div>
                        {isOpen && c.tips?.length > 0 && (
                          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {c.tips.map((tip, ti) => (
                              <div key={ti} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: '0.8rem', color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                                <CheckCircle2 size={13} style={{ color: '#9B72CF', flexShrink: 0, marginTop: 2 }} />
                                {tip}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                  💡 Home-Care Tips
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {assessment.homeCareTips.map((t, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', borderRadius: 12, background: 'var(--cream)', border: '1.5px solid var(--border)', fontSize: '0.85rem', color: 'var(--ink)' }}>
                      <CheckCircle2 size={15} style={{ color: '#9B72CF', flexShrink: 0, marginTop: 1 }} />
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <p style={{ marginTop: 20, fontSize: '0.78rem', color: 'var(--ink-muted)', fontStyle: 'italic', lineHeight: 1.5 }}>
              If anything changes or worsens, don't wait — call your vet.
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
