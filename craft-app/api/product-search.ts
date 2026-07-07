/// <reference types="node" />
import type { VercelRequest, VercelResponse } from '@vercel/node';


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
  .filter((item) => {
    const source = (item.source || '').toLowerCase()
    if (source === 'instacart') return false
    // Filter out websites masquerading as stores
    if (source.includes('.com') || source.includes('.net') || source.includes('.org') || source.includes('.co')) return false
    return true
  })
  .map((item) => ({
    name: item.title,
    price: item.extracted_price ?? null,
    store: item.source ?? 'unknown',
    image: item.thumbnail ?? null
  }))


    results.sort((a, b) => Number(a.price || 9999) - Number(b.price || 9999))
    return res.status(200).json(results.slice(0, 5))
  } catch (e) {
    console.error('handler error:', e)
    return res.status(200).json([])
  }
}
