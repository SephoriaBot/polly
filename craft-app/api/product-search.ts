/// <reference types="node" />
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Collapses formatting noise so the same real store isn't split into
// multiple "different" stores (e.g. "Walmart" vs "Walmart - Grocery").
// This does NOT drop or curate stores — every seller Google Shopping
// returns still shows up, just under one consistent name per seller.
function cleanStoreName(raw: string): string {
  let s = raw.trim()
  // strip trailing qualifiers like " - Pickup & Delivery", " - Marketplace"
  s = s.replace(/\s*-\s*(pickup( ?& ?delivery)?|delivery|marketplace|grocery|official store).*$/i, '')
  s = s.replace(/\s+/g, ' ').trim()
  return s
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
      .filter((item: any) => {
        const source = (item.source || '').toLowerCase()
        if (source === 'instacart') return false
        // Filter out websites masquerading as stores
        if (source.includes('.com') || source.includes('.net') || source.includes('.org') || source.includes('.co')) return false
        return true
      })
      .map((item: any) => ({
        name: item.title,
        price: item.extracted_price ?? null,
        store: item.source ? cleanStoreName(item.source) : 'unknown',
        image: item.thumbnail ?? null
      }))

    results.sort((a: any, b: any) => Number(a.price || 9999) - Number(b.price || 9999))
    return res.status(200).json(results.slice(0, 12))
  } catch (e) {
    console.error('handler error:', e)
    return res.status(200).json([])
  }
}
