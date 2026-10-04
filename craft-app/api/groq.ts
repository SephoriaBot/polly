/// <reference types="node" />
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserId, throttled } from './_lib/auth.js';

// Signed-in proxy to Groq. The API key lives only on the server (GROQ_API_KEY).
// The browser sends the prompt; it never chooses the model and never sees the key.

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_MESSAGES = 6;
const MAX_MESSAGE_CHARS = 12_000;
const MAX_TOTAL_CHARS = 20_000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Please sign in' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error('GROQ_API_KEY is not set');
    return res.status(500).json({ error: 'AI is not configured' });
  }

  if (throttled(`groq-min:${userId}`, 20, 60_000) || throttled(`groq-hour:${userId}`, 200, 3_600_000)) {
    return res.status(429).json({ error: 'Too many AI requests. Please wait a bit and try again.' });
  }

  const b = req.body ?? {};
  const raw = b.messages;
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_MESSAGES) {
    return res.status(400).json({ error: 'Invalid messages' });
  }
  let total = 0;
  const messages: { role: string; content: string }[] = [];
  for (const m of raw) {
    if (!m || !['user', 'assistant', 'system'].includes(m.role) || typeof m.content !== 'string' || !m.content.trim()) {
      return res.status(400).json({ error: 'Invalid messages' });
    }
    if (m.content.length > MAX_MESSAGE_CHARS) return res.status(400).json({ error: 'Message too long' });
    total += m.content.length;
    messages.push({ role: m.role, content: m.content });
  }
  if (total > MAX_TOTAL_CHARS) return res.status(400).json({ error: 'Request too long' });

  const temperature = typeof b.temperature === 'number' && Number.isFinite(b.temperature)
    ? Math.min(1.5, Math.max(0, b.temperature))
    : 0.7;
  const wanted = typeof b.max_tokens === 'number' && Number.isFinite(b.max_tokens)
    ? Math.min(2000, Math.max(1, Math.floor(b.max_tokens)))
    : 800;

  try {
    const groq = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        // Fixed on the server. Change it with the GROQ_MODEL env var.
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
        reasoning_effort: 'low',
        temperature,
        // Reasoning tokens count toward the limit, so leave room for them.
        max_completion_tokens: Math.min(2500, wanted + 600),
        messages,
      }),
    });
    const data: any = await groq.json().catch(() => ({}));
    if (!groq.ok) {
      console.error('Groq error', groq.status, data?.error?.message);
      return res.status(502).json({ error: 'The AI service returned an error' });
    }
    const content = String(data?.choices?.[0]?.message?.content ?? '');
    return res.status(200).json({ choices: [{ message: { content } }] });
  } catch (err) {
    console.error('Groq request failed:', err);
    return res.status(502).json({ error: 'Could not reach the AI service' });
  }
}
