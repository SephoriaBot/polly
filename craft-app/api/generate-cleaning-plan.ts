// craft-app/api/generate-cleaning-plan.ts
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL =
  process.env.GROQ_MODEL || 'openai/gpt-oss-120b'
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
    })
  }
  const apiKey = process.env.VITE_GROQ_API_KEY
  if (!apiKey) {
    console.error('VITE_GROQ_API_KEY is not configured')
    return res.status(500).json({
      error: 'AI cleaning plans are not configured',
    })
  }
  try {
    const choreName = String(
      req.body?.choreName || ''
    ).trim()
    if (!choreName) {
      return res.status(400).json({
        error: 'Missing choreName',
      })
    }
    const prompt = `
Create a short, practical cleaning checklist for this household chore:
"${choreName.slice(0, 200)}"
Return ONLY a valid JSON array of strings.
Requirements:
- 4 to 8 steps
- Each step is a concrete action
- Put the steps in logical order
- Keep each step short and easy to check off
- No numbering
- No markdown
- No explanations
- Nothing outside the JSON array
Example:
["Gather supplies","Clear the area","Clean the surfaces","Vacuum or sweep","Put everything back"]
`.trim()
    const groqResponse = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You create concise household cleaning checklists and always return valid JSON when requested.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.4,
        max_tokens: 500,
      }),
    })
    const groqData = await groqResponse.json()
    if (!groqResponse.ok) {
      console.error(
        'Groq error:',
        groqData?.error || groqResponse.statusText
      )
      return res.status(502).json({
        error: 'The AI service returned an error',
      })
    }
    const content =
      groqData?.choices?.[0]?.message?.content
    if (
      typeof content !== 'string' ||
      !content.trim()
    ) {
      return res.status(502).json({
        error: 'The AI returned an empty response',
      })
    }
    let cleaned = content.trim()
    // Remove markdown code fences if the model added them.
    cleaned = cleaned
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()
    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      // Try extracting an array if there was extra text.
      const start = cleaned.indexOf('[')
      const end = cleaned.lastIndexOf(']')
      if (start === -1 || end <= start) {
        console.error(
          'Could not parse Groq response:',
          content
        )
        return res.status(502).json({
          error: 'The AI returned an invalid cleaning plan',
        })
      }
      try {
        parsed = JSON.parse(
          cleaned.slice(start, end + 1)
        )
      } catch {
        console.error(
          'Invalid JSON from Groq:',
          content
        )
        return res.status(502).json({
          error: 'The AI returned an invalid cleaning plan',
        })
      }
    }
    if (!Array.isArray(parsed)) {
      return res.status(502).json({
        error: 'The AI returned an invalid cleaning plan',
      })
    }
    const steps = parsed
      .filter(
        (step): step is string =>
          typeof step === 'string'
      )
      .map((step) => step.trim())
      .filter(Boolean)
      .slice(0, 8)
    if (steps.length === 0) {
      return res.status(502).json({
        error: 'The AI returned an empty cleaning plan',
      })
    }
    return res.status(200).json({
      steps,
    })
  } catch (error) {
    console.error(
      'Cleaning plan API error:',
      error
    )
    return res.status(500).json({
      error: 'Could not generate cleaning plan',
    })
  }
}