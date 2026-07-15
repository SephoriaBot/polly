/// <reference types="node" />
import type { VercelRequest, VercelResponse } from '@vercel/node';


export default async function handler(req: VercelRequest, res: VercelResponse) {
  const q = (req.query.q || "").toString().trim()
  const location = (req.query.zip || "").toString().trim()

  if (!q) return res.status(400).json({ error: 'Missing search query', results: [] })

  if (!process.env.SERPAPI_KEY) {
    console.error('product-search: SERPAPI_KEY is not set')
    return res.status(500).json({ error: 'Price search is not configured (missing API key)', results: [] })
  }

  try {
    let url = `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(q)}&api_key=${process.env.SERPAPI_KEY}&gl=us&hl=en`

    if (location) url += `&location=${encodeURIComponent(location)}`

    const r = await fetch(url)
    const data = await r.json()

    // SerpAPI returns 200 with an `error` field (bad/expired key, exhausted
    // account searches, rate limited, etc.) rather than an HTTP error status,
    // so !r.ok alone won't catch most real failures — check both.
    if (!r.ok || data.error) {
      console.error('product-search: SerpAPI error:', data.error || r.statusText)
      return res.status(502).json({ error: data.error || 'Price search service returned an error', results: [] })
    }

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
        store: item.source ?? 'unknown',
        image: item.thumbnail ?? null
      }))

    results.sort((a: any, b: any) => Number(a.price || 9999) - Number(b.price || 9999))
    // No `error` field here — this is a legitimate "nothing matched this
    // particular search" result, distinct from the service failing outright.
    return res.status(200).json({ results: results.slice(0, 5) })
  } catch (e) {
    console.error('product-search: handler error:', e)
    return res.status(502).json({ error: 'Could not reach the price search service', results: [] })
  }
}
