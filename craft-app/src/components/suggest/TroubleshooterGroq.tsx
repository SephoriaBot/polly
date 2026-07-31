import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import Icon from '../Icon'
import {
  Wrench,
  X,
  RotateCcw,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react'
import hourglassImg from '../../assets/illustrations/hourglass.png'

interface QuizOption { value: string; label: string }

const CATEGORIES: QuizOption[] = [
  { value: 'car', label: '🚗 Car' },
  { value: 'appliance', label: '🏠 Appliance' },
  { value: 'pet', label: '🐶 Pet' },
  { value: 'plant', label: '🌱 Plant' },
  { value: 'computer', label: '💻 Computer' },
  { value: 'phone', label: '📱 Phone / Tablet' },
]

const CAR_SYMPTOMS = [
  'Won’t start',
  'Warning light',
  'Grinding noise',
  'Vibration',
  'Fluid leak',
  'Smoke',
]

const PLANT_SYMPTOMS = [
  'Yellow leaves',
  'Brown tips',
  'Drooping',
  'Black spots',
  'Mold',
  'Pests',
]

const PET_SYMPTOMS = [
  'Vomiting',
  'Not eating',
  'Overeating',
  'Limping',
  'Scratching',
  'Lethargic',
  'Diarrhea',
]

const APPLIANCE_SYMPTOMS = [
  'Won’t turn on',
  'Leaking',
  'Loud noise',
  'Not heating',
  'Burning smell',
  'Error code',
]

const COMPUTER_SYMPTOMS = [
  'Slow',
  'Won’t boot',
  'Blue screen',
  'Overheating',
  'Internet issues',
  'Freezing',
  'Won’t charge',
]

const PHONE_SYMPTOMS = [
  'Battery draining',
  'Won’t charge',
  'Overheating',
  'App crashing',
  'No signal',
  'Broken camera',
]

interface TroubleshootingResult {
  summary: string

  possibleCauses: {
    cause: string
    likelihood: string
    explanation: string
  }[]

  thingsToCheck: string[]

  suggestedSteps: string[]

  professionalHelp: string[]

  preventionTips: string[]
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

export default function TroubleshooterGroq({ onClose }: { onClose: () => void }) {
  const STEP_COUNT = 4

const [wizardState, setWizardState] = useState<WizardState>('quiz')
const [step, setStep] = useState(0)

const [category, setCategory] = useState('')
const [symptoms, setSymptoms] = useState<Set<string>>(new Set())
const [urgency, setUrgency] = useState('')
const [notes, setNotes] = useState('')

const [error, setError] = useState('')

const [assessment, setAssessment] =
  useState<TroubleshootingResult | null>(null)

function toggleSymptom(value: string) {
  setSymptoms(prev => {
    const next = new Set(prev)

    if (next.has(value))
      next.delete(value)
    else
      next.add(value)

    return next
  })
}

  function canAdvance() {
  if (step === 0) return category !== ''
  if (step === 1) return symptoms.size > 0
  if (step === 2) return urgency !== ''

  return true
}
  function reset() {
  setWizardState('quiz')

  setStep(0)

  setCategory('')
  setSymptoms(new Set())

  setUrgency('')
  setNotes('')

  setAssessment(null)

  setError('')
}

async function submit() {
  setError('')
  setWizardState('loading')

  const categoryLabel =
    CATEGORIES.find(c => c.value === category)?.label ?? category

  const prompt = `
You are a helpful troubleshooting assistant.

You help diagnose everyday problems with cars, appliances, pets, plants, computers, and phones.

You are NOT a professional mechanic, veterinarian, technician, or doctor.
Give general troubleshooting guidance only.
Do not pretend to know the exact cause.
Clearly mention when professional help is needed.

Category:
${categoryLabel}

Symptoms:
${[...symptoms].join(', ')}

Urgency:
${urgency}

User description:
"${notes.trim() || 'No additional details provided'}"

Respond ONLY with valid JSON. No markdown. No backticks.

Use exactly this structure:

{
  "summary": "A short friendly overview of what might be happening.",
  "possibleCauses": [
    {
      "cause": "Possible cause",
      "likelihood": "Common/Possible/Less likely",
      "explanation": "Why this could explain the issue"
    }
  ],
  "thingsToCheck": [
    "Thing to inspect or test"
  ],
  "suggestedSteps": [
    "Step-by-step action"
  ],
  "professionalHelp": [
    "When to call a professional"
  ],
  "preventionTips": [
    "How to avoid this in the future"
  ]
}

Keep suggestions practical, safe, and beginner-friendly.
`

  try {
    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 1200,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      }
    )

    const data = await response.json()

    const raw =
      data.choices?.[0]?.message?.content ?? ''

    const clean = raw.replace(/```json|```/g, '').trim()

    const parsed: TroubleshootingResult = JSON.parse(clean)

    setAssessment(parsed)

    setWizardState('result')

  } catch {
    setError('Something went wrong getting your troubleshooting help. Please try again.')
    setWizardState('quiz')
    setStep(STEP_COUNT - 1)
  }
}


  const symptomOptions =
  category === 'car'
    ? CAR_SYMPTOMS
    : category === 'plant'
    ? PLANT_SYMPTOMS
    : category === 'pet'
    ? PET_SYMPTOMS
    : category === 'appliance'
    ? APPLIANCE_SYMPTOMS
    : category === 'computer'
    ? COMPUTER_SYMPTOMS
    : PHONE_SYMPTOMS

const progressPct = ((step + 1) / STEP_COUNT) * 100


  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ background: 'var(--blush)', color: 'var(--pink-dark)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.95rem' }}>
            <Wrench size={17} /> Troubleshooter Groq
          </span>
          <button className="close-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>

          {/* Disclaimer */}
          <div style={{
            marginBottom: 16, padding: '10px 14px', borderRadius: 'var(--radius-sm)',
            background: 'var(--blush)', border: '1.5px solid var(--border)',
            fontSize: '0.76rem', color: 'var(--ink-muted)', lineHeight: 1.5,
          }}>
            <Icon name="wrench" size={16} /> General troubleshooting guidance only. For safety-critical issues or professional repairs, contact a qualified professional.
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
    <h3 style={{ margin: '0 0 14px', fontSize: '1.05rem' }}>
      What do you need help troubleshooting?
    </h3>

    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {CATEGORIES.map(c => (
        <button
          key={c.value}
          style={chipStyle(category === c.value)}
          onClick={() => setCategory(c.value)}
        >
          {c.label}
        </button>
      ))}
    </div>
  </div>
)}

              {step === 1 && (
  <div>
    <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem' }}>
      Which symptoms match?
    </h3>

    <p
      style={{
        fontSize: '0.78rem',
        color: 'var(--ink-muted)',
        marginBottom: 14,
      }}
    >
      Select everything that applies.
    </p>

    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {symptomOptions.map(symptom => (
        <button
          key={symptom}
          style={chipStyle(symptoms.has(symptom))}
          onClick={() => toggleSymptom(symptom)}
        >
          {symptom}
        </button>
      ))}
    </div>
  </div>
)}

              {step === 2 && (
  <div>
    <h3 style={{ margin: '0 0 14px', fontSize: '1.05rem' }}>
      How urgent is this?
    </h3>

    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {[
        'Just curious',
        'Happening occasionally',
        'Getting worse',
      ].map(level => (
        <button
          key={level}
          style={{
            ...chipStyle(urgency === level),
            textAlign: 'left',
            borderRadius: 'var(--radius-sm)',
          }}
          onClick={() => setUrgency(level)}
        >
          {level}
        </button>
      ))}
    </div>
  </div>
)}

              {step === 3 && (
  <div>
    <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem' }}>
      Describe what's happening
    </h3>

    <p
      style={{
        fontSize: '0.78rem',
        color: 'var(--ink-muted)',
        marginBottom: 14,
      }}
    >
      Include when it started, anything you've tried, and anything unusual you noticed.
    </p>

    <textarea
      className="form-textarea"
      value={notes}
      onChange={e => setNotes(e.target.value)}
      placeholder="Describe the issue in as much detail as you can..."
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
                    <Sparkles size={14} /> Troubleshoot
                  </button>
                )}
              </div>
            </div>
          )}

          {wizardState === 'loading' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 20px', gap: 12 }}>
              <img
                src={hourglassImg}
                alt=""
                style={{ width: 140, animation: 'troubleshootPulse 1.4s ease-in-out infinite' }}
              />
              <p style={{ fontSize: '0.88rem', color: 'var(--ink-muted)', fontStyle: 'italic' }}>Analyzing your issue…</p>
            </div>
          )}

{wizardState === 'result' && assessment && (
<div>

<div style={{
  padding:'14px 18px',
  borderRadius:'var(--radius-md)',
  marginBottom:18,
  background:'var(--blush)',
  border:'1.5px solid var(--pink-light)',
}}>
<p style={{
  fontSize:'0.88rem',
  lineHeight:1.6,
  margin:0
}}>
{assessment.summary}
</p>
</div>


<div className="section-label">
Possible Causes
</div>

<div style={{
display:'flex',
flexDirection:'column',
gap:8,
marginBottom:18
}}>
{assessment.possibleCauses.map((cause,i)=>(
<div key={i} className="card" style={{padding:'12px'}}>
<strong>{cause.cause}</strong>

<div style={{
fontSize:'0.75rem',
color:'var(--pink-dark)',
margin:'4px 0'
}}>
{cause.likelihood}
</div>

<p style={{
margin:0,
fontSize:'0.82rem',
color:'var(--ink-soft)'
}}>
{cause.explanation}
</p>

</div>
))}
</div>



<div className="section-label">
Things To Check
</div>

<div style={{
display:'flex',
flexDirection:'column',
gap:6,
marginBottom:18
}}>
{assessment.thingsToCheck.map((item,i)=>(
<div key={i}>
✅ {item}
</div>
))}
</div>



<div className="section-label">
Suggested Steps
</div>

<div style={{
display:'flex',
flexDirection:'column',
gap:6,
marginBottom:18
}}>
{assessment.suggestedSteps.map((item,i)=>(
<div key={i}>
{i+1}. {item}
</div>
))}
</div>



<div className="section-label">
When To Get Help
</div>

<div style={{
display:'flex',
flexDirection:'column',
gap:6,
marginBottom:18
}}>
{assessment.professionalHelp.map((item,i)=>(
<div key={i}>
⚠️ {item}
</div>
))}
</div>



<div className="section-label">
Prevention Tips
</div>

<div style={{
display:'flex',
flexDirection:'column',
gap:6,
marginBottom:18
}}>
{assessment.preventionTips.map((item,i)=>(
<div key={i}>
🌱 {item}
</div>
))}
</div>


<button 
className="btn btn-ghost"
style={{width:'100%',justifyContent:'center'}}
onClick={reset}
>
<RotateCcw size={13}/>
Start Over
</button>


</div>
)}

        </div>
      </div>

      <style>{`
        @keyframes troubleshootPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.8; }
        }
      `}</style>
    </div>
  )
}