// aiChecklist.ts
// Shared helper for "ask Groq for a checklist" features. Sends a system +
// user prompt through the signed-in /api/groq proxy and turns the reply into
// a clean string[] — tolerant of fences, stray text, numbering, and repeats.

import { groqFetch } from './apiClient';

function extractList(raw: string, key: string): unknown[] {
  const clean = raw.replace(/```json|```/gi, '').trim();

  const objStart = clean.indexOf('{');
  const objEnd = clean.lastIndexOf('}');
  if (objStart !== -1 && objEnd > objStart) {
    const parsed = JSON.parse(clean.slice(objStart, objEnd + 1));
    if (Array.isArray(parsed[key])) return parsed[key];
  }

  const arrStart = clean.indexOf('[');
  const arrEnd = clean.lastIndexOf(']');
  if (arrStart !== -1 && arrEnd > arrStart) {
    const parsed = JSON.parse(clean.slice(arrStart, arrEnd + 1));
    if (Array.isArray(parsed)) return parsed;
  }

  throw new Error('bad shape');
}

export async function requestChecklist(opts: {
  system: string;
  prompt: string;
  key: string; // the JSON field the list lives under, e.g. "items"
  cap: number; // safety cap against a runaway reply, not a target
  temperature?: number;
  maxTokens?: number;
}): Promise<string[]> {
  const response = await groqFetch({
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.maxTokens ?? 900,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.prompt },
    ],
  });

  if (!response.ok) throw new Error('groq request failed');
  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content ?? '';

  const seen = new Set<string>();
  return extractList(raw, opts.key)
    .filter((s): s is string => typeof s === 'string')
    .map(s => s.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').replace(/[.]+$/, '').trim().slice(0, 140))
    .filter(s => {
      const k = s.toLowerCase();
      if (!s || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, opts.cap);
}
