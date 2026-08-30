/// <reference types="node" />

import type { VercelRequest, VercelResponse } from '@vercel/node'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

// Keep this model configurable so you can change it in Vercel
// without changing the code.
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only accept POST requests.
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
    })
  }

  // The API key must ONLY exist on the server.
  if (!process.env.GROQ_API_KEY) {
    console.error('generate-cleaning-plan: GROQ_API_KEY is not set')

    return res.status(500).json({
      error: 'AI cleaning plans are not configured',
    })
  }

  try {
    const choreName = String(req.body?.choreName || '').trim()

    if (!choreName) {
      return res.status(400).json({
        error: 'Missing choreName',
      })
    }

    // Prevent accidentally sending enormous input to Groq.
    const safeChoreName = choreName.slice(0, 200)

    const prompt = `
Create a short, practical cleaning checklist for this household chore:

"${safeChoreName}"

Return ONLY a valid JSON array of strings.

Requirements:
- 4 to 8 steps
- Each step should be a concrete action
- Steps should be ordered logically
- Keep each step short and easy to check off
- Do not include numbering
- Do not include markdown
- Do not include explanations
- Do not include anything outside the JSON array

Example:
["Gather cleaning supplies","Clear the area","Clean the surfaces","Vacuum or sweep","Put everything back"]
`.trim()

    const groqResponse = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You generate concise household cleaning checklists. Follow the requested JSON format exactly.',
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
        'generate-cleaning-plan: Groq error:',
        groqData?.error || groqResponse.statusText
      )

      return res.status(502).json({
        error: 'The AI service returned an error',
      })
    }

    const content = groqData?.choices?.[0]?.message?.content

    if (typeof content !== 'string' || !content.trim()) {
      console.error(
        'generate-cleaning-plan: Groq returned no message content'
      )

      return res.status(502).json({
        error: 'The AI service returned an empty response',
      })
    }

    /*
     * Groq should return JSON, but models occasionally wrap JSON
     * in ```json ... ``` despite being told not to.
     *
     * Clean that up before parsing so the frontend doesn't have
     * to know about model formatting quirks.
     */
    let cleaned = content.trim()

    cleaned = cleaned
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    let parsed: unknown

    try {
      parsed = JSON.parse(cleaned)
    } catch {
      /*
       * Last-resort recovery:
       * If the model included text around the array, try to
       * extract the first JSON array from the response.
       */
      const start = cleaned.indexOf('[')
      const end = cleaned.lastIndexOf(']')

      if (start === -1 || end === -1 || end <= start) {
        console.error(
          'generate-cleaning-plan: Could not parse Groq response:',
          content
        )

        return res.status(502).json({
          error: 'The AI returned an invalid cleaning plan',
        })
      }

      try {
        parsed = JSON.parse(cleaned.slice(start, end + 1))
      } catch {
        console.error(
          'generate-cleaning-plan: Invalid extracted JSON:',
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

    // Normalize the result so the frontend always receives
    // a clean string array.
    const steps = parsed
      .filter((step): step is string => typeof step === 'string')
      .map((step) => step.trim())
      .filter(Boolean)
      .slice(0, 8)

    if (steps.length < 1) {
      return res.status(502).json({
        error: 'The AI returned an empty cleaning plan',
      })
    }

    return res.status(200).json({
      steps,
    })
  } catch (error) {
    console.error(
      'generate-cleaning-plan: handler error:',
      error
    )

    return res.status(500).json({
      error: 'Could not generate cleaning plan',
    })
  }
}