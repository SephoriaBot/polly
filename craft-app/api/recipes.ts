/// <reference types="node" />
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserId, throttled } from './_lib/auth.js';

// Signed-in proxy to Spoonacular. The key lives only on the server (SPOONACULAR_API_KEY).
//   GET /api/recipes?kind=search&query=...&diet=...   -> complexSearch
//   GET /api/recipes?kind=info&id=12345               -> recipe information

const BASE = 'https://api.spoonacular.com/recipes';
const one = (v: unknown) => (typeof v === 'string' ? v : Array.isArray(v) && typeof v[0] === 'string' ? v[0] : '');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Please sign in' });

  const apiKey = process.env.SPOONACULAR_API_KEY;
  if (!apiKey) {
    console.error('SPOONACULAR_API_KEY is not set');
    return res.status(500).json({ error: 'Recipe search is not configured' });
  }

  if (throttled(`recipes:${userId}`, 40, 60_000)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
  }

  const kind = one(req.query.kind);
  let url: string;

  if (kind === 'info') {
    const id = one(req.query.id);
    if (!/^\d{1,12}$/.test(id)) return res.status(400).json({ error: 'Invalid recipe id' });
    url = `${BASE}/${id}/information?apiKey=${encodeURIComponent(apiKey)}`;
  } else if (kind === 'search') {
    const p = new URLSearchParams({
      number: String(Math.min(10, Math.max(1, parseInt(one(req.query.number), 10) || 6))),
      addRecipeInformation: 'true',
      fillIngredients: 'false',
      apiKey,
    });
    // Only these filters are passed along, each with a length cap.
    const allowed: [string, number][] = [
      ['query', 100], ['diet', 100], ['intolerances', 200], ['maxReadyTime', 4], ['type', 30],
    ];
    for (const [name, max] of allowed) {
      const v = one(req.query[name]).trim();
      if (!v) continue;
      if (v.length > max) return res.status(400).json({ error: `${name} is too long` });
      p.set(name, v);
    }
    if (one(req.query.sort) === 'random') p.set('sort', 'random');
    url = `${BASE}/complexSearch?${p}`;
  } else {
    return res.status(400).json({ error: 'Unknown request' });
  }

  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    const data = await r.json().catch(() => ({}));
    // Spoonacular reports an exhausted daily quota as a JSON body with code 402;
    // the app reads that, so pass the body through with its status.
    return res.status(r.ok || data?.code === 402 ? 200 : 502).json(data);
  } catch (err) {
    console.error('Spoonacular request failed:', err);
    return res.status(502).json({ error: 'Could not reach the recipe service' });
  }
}
