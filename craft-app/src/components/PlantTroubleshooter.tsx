import { useState } from 'react'
import { SYMPTOMS, FOLLOW_UP_QUESTIONS } from '../data/plantQuestions'
import type { GardenPlant } from '../types/legacy'

interface Props {
  plant: GardenPlant
}

type Answers = Record<string, string>

interface Diagnosis {
  diagnosis: string
  description: string
  fix: string[]
  prevention: string[]
  severity: string
}

export default function PlantTroubleshooter({ plant }: Props) {
  const [step, setStep] = useState(0)
  const [symptom, setSymptom] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Answers>({})
  const [result, setResult] = useState<Diagnosis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function reset() {
    setStep(0)
    setSymptom(null)
    setAnswers({})
    setResult(null)
    setError('')
  }

  function selectSymptom(value: string) {
    setSymptom(value)
    setStep(1)
  }

  function answerQuestion(id: string, value: string) {
    const newAnswers = { ...answers, [id]: value }
    setAnswers(newAnswers)
    const nextStep = step + 1

    if (nextStep > FOLLOW_UP_QUESTIONS.length) {
      fetchDiagnosis(newAnswers)
    }
    setStep(nextStep)
  }

  async function fetchDiagnosis(finalAnswers: Answers) {
    setLoading(true)
    setError('')

    const symptomLabel = SYMPTOMS.find(s => s.value === symptom)?.label ?? symptom
    const answerSummary = FOLLOW_UP_QUESTIONS.map(q => {
      const ans = finalAnswers[q.id]
      const label = q.options.find(o => o.value === ans)?.label ?? ans
      return `${q.question}: ${label}`
    }).join('\n')

    const prompt = `You are a plant care expert. Diagnose the following plant problem and respond ONLY with a valid JSON object, no markdown, no backticks.

Plant: ${plant.name}
Symptom: ${symptomLabel}
Additional context:
${answerSummary}

Respond with this exact shape:
{
  "diagnosis": "Short diagnosis name",
  "description": "2-3 sentence explanation specific to ${plant.name}.",
  "fix": ["Step 1", "Step 2", "Step 3"],
  "prevention": ["Tip 1", "Tip 2"],
  "severity": "low | medium | high"
}`

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 600,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      const data = await response.json()
      const raw = data.choices?.[0]?.message?.content ?? ''
      const clean = raw.replace(/```json|```/g, '').trim()
      const parsed: Diagnosis = JSON.parse(clean)
      setResult(parsed)
    } catch {
      setError('Couldn\'t generate a diagnosis. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const currentQuestion = FOLLOW_UP_QUESTIONS[step - 1]

  return (
    <div style={{ fontSize: '0.9rem' }}>
      <h3 style={{ marginBottom: 6 }}>Troubleshoot: {plant.name}</h3>
      <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginBottom: 16 }}>
        Select a symptom and answer a few questions.
      </p>

      {/* STEP 0: Symptoms */}
      {step === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SYMPTOMS.map(s => (
            <button
              key={s.value}
              onClick={() => selectSymptom(s.value)}
              style={{
                padding: 10,
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'white',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* FOLLOW-UP QUESTIONS */}
      {step > 0 && step <= FOLLOW_UP_QUESTIONS.length && currentQuestion && (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>
            {currentQuestion.question}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {currentQuestion.options.map(opt => (
              <button
                key={opt.value}
                onClick={() => answerQuestion(currentQuestion.id, opt.value)}
                style={{
                  padding: 10,
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  background: 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '40px 20px', gap: 12, color: 'var(--ink-muted)', fontSize: '0.85rem', fontStyle: 'italic'
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'linear-gradient(135deg, #d4f5e2, #e8d5ff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'gentlePulse 1.4s ease-in-out infinite',
            fontSize: '1.2rem'
          }}>🌿</div>
          Diagnosing your {plant.name}…
          <style>{`
            @keyframes gentlePulse {
              0%, 100% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.1); opacity: 0.7; }
            }
          `}</style>
        </div>
      )}

      {/* ERROR */}
      {error && !loading && (
        <div style={{
          padding: '10px 14px', borderRadius: 10,
          background: '#fff0f0', border: '1.5px solid #fecaca',
          fontSize: '0.85rem', color: '#b91c1c', marginBottom: 12
        }}>
          {error}
          <button onClick={reset} style={{ marginLeft: 10, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', fontSize: '0.85rem' }}>
            Try again
          </button>
        </div>
      )}

      {/* RESULT */}
      {result && !loading && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 6 }}>
            {result.diagnosis}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginBottom: 10 }}>
            {result.description}
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Fix</div>
            <ul>
              {result.fix.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Prevention</div>
            <ul>
              {result.prevention.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
            Severity: {result.severity}
          </div>

          <button
            onClick={reset}
            style={{
              marginTop: 12, padding: 10,
              border: '1px solid var(--border)',
              borderRadius: 8, background: 'white',
              cursor: 'pointer', width: '100%',
            }}
          >
            Start Over
          </button>
        </div>
      )}
    </div>
  )
}
