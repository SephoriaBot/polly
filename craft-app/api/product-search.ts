/// <reference types="node" />
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Canonical store names. Any result whose `source` field contains one of these
// (case-insensitive) gets normalized to the key on the left. Anything that
// doesn't match is a marketplace reseller or one-off listing, not a real
// store — those get dropped entirely so they can't pollute coverage counts.
const KNOWN_STORES: Record<string, string> = {
  'walmart': 'Walmart',
  'target': 'Target',
  'kroger': 'Kroger',
  'costco': 'Costco',
  'sam\'s club': 'Sam\'s Club',
  'whole foods': 'Whole Foods',
  'safeway': 'Safeway',
  'publix': 'Publix',
  'aldi': 'Aldi',
  'meijer': 'Meijer',
  'h-e-b': 'H-E-B',
  'heb': 'H-E-B',
  'trader joe': 'Trader Joe\'s',
  'food lion': 'Food Lion',
  'giant': 'Giant',
  'wegmans': 'Wegmans',
  'sprouts': 'Sprouts',
  'cvs': 'CVS',
  'walgreens': 'Walgreens',
}

function normalizeStore(source: string): string | null {
  const s = source.toLowerCase()
  for (const key in KNOWN_STORES) {
    if (s.includes(key)) return KNOWN_STORES[key]
  }
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const q = (req.query.q || "").toString().trim()
  const location = (req.query.zip || "").toString().trim()

  if (!q) return res.status(400).json([])

  try {
    let url = `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(q)}&api_key=${process.env.SERPAPI_KEY}&gl=us&hl=en`

    if (location) url += `&location=${encodeURIComponent(location)}`

    const r = await fetch(url)
    const data = await r.json()

    const results = (data.shopping_results || [])
      .map((item: any) => {
        const canonical = normalizeStore(item.source || '')
        return canonical ? {
          name: item.title,
          price: item.extracted_price ?? null,
          store: canonical,
          image: item.thumbnail ?? null,
        } : null
      })
      .filter(Boolean)

    results.sort((a: any, b: any) => Number(a.price || 9999) - Number(b.price || 9999))
    return res.status(200).json(results.slice(0, 5))
  } catch (e) {
    console.error('handler error:', e)
    return res.status(200).json([])
  }
}
