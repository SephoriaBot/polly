/// <reference types="node" />
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserId, throttled } from './_lib/auth.js';

type ProductResult = { name: string; price: number | null; store: string; image: string | null }

// Keep only the cheapest few results per store, then cap the total. A flat
// "cheapest 20 overall" cut let a few low-priced sellers crowd every other
// store out of the list, so stores with higher prices never made it to the
// app even when they carried the item.
const MAX_PER_STORE = 3
const MAX_TOTAL = 40

function limitPerStore(results: ProductResult[]): ProductResult[] {
  const sorted = [...results].sort((a, b) => Number(a.price) - Number(b.price))
  const counts = new Map<string, number>()
  const kept: ProductResult[] = []
  for (const r of sorted) {
    const key = r.store.toLowerCase()
    const n = counts.get(key) ?? 0
    if (n >= MAX_PER_STORE) continue
    counts.set(key, n + 1)
    kept.push(r)
  }
  return kept.slice(0, MAX_TOTAL)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  const userId = await getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Please sign in', results: [] })
  if (throttled(`product-search:${userId}`, 30, 60_000)) {
    return res.status(429).json({ error: 'Too many searches. Please wait a minute.', results: [] })
  }

  const q = (req.query.q || "").toString().trim()
  const location = (req.query.zip || "").toString().trim()
  // 'groceries' (default) or 'home' — sent by the Grocery page so home goods
  // lists can keep sellers (like Amazon) that don't make sense for groceries.
  const isHome = (req.query.kind || "").toString().trim() === 'home'

  if (!q) return res.status(400).json({ error: 'Missing search query', results: [] })
  if (q.length > 120 || location.length > 20) {
    return res.status(400).json({ error: 'Search is too long', results: [] })
  }

  if (!process.env.SERPAPI_KEY) {
    console.error('product-search: SERPAPI_KEY is not set')
    return res.status(500).json({ error: 'Price search is not configured (missing API key)', results: [] })
  }

  try {
    let url = `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(q)}&api_key=${process.env.SERPAPI_KEY}&gl=us&hl=en`

    if (location) url += `&location=${encodeURIComponent(location)}`

    // Home goods lists also run SerpAPI's dedicated Amazon search, since
    // Google Shopping rarely returns Amazon listings. It runs alongside the
    // Google Shopping request, and a failure here is non-fatal — the Google
    // Shopping results still come back on their own.
    const amazonUrl = `https://serpapi.com/search.json?engine=amazon&k=${encodeURIComponent(q)}&amazon_domain=amazon.com&api_key=${process.env.SERPAPI_KEY}`

    const start = Date.now()
    const [r, amazonData] = await Promise.all([
      fetch(url),
      isHome
        ? fetch(amazonUrl)
            .then(ar => ar.json())
            .catch((e: unknown) => {
              console.error('product-search: Amazon search failed:', e)
              return null
            })
        : Promise.resolve(null),
    ])
    const data = await r.json()
    console.log(`product-search: SerpAPI responded in ${Date.now() - start}ms`)

    // SerpAPI returns 200 with an `error` field (bad/expired key, exhausted
    // account searches, rate limited, etc.) rather than an HTTP error status,
    // so !r.ok alone won't catch most real failures — check both.
    if (!r.ok || data.error) {
      console.error('product-search: SerpAPI error:', data.error || r.statusText)
      return res.status(502).json({ error: data.error || 'Price search service returned an error', results: [] })
    }

    const googleResults: ProductResult[] = (data.shopping_results || [])
      .filter((item: any) => {
        const source = (item.source || '').toLowerCase()

        // Remove marketplace/aggregator results that aren't useful
        // for Smart Cart. Do NOT filter based on ".com" — legitimate
        // chains can be returned as Walmart.com, Target.com, etc.
        if (source === 'instacart') return false
        if (source.includes('ebay')) return false

        // Amazon is dropped for grocery lists (not a useful grocery seller
        // here) but kept for home goods, where it's a real price source.
        if (!isHome && source.includes('amazon')) return false

        return true
      })
      .map((item: any) => ({
        name: item.title,
        price: item.extracted_price ?? null,
        store: item.source ?? 'unknown',
        image: item.thumbnail ?? null
      }))
      .filter((item: any) => item.store !== 'unknown' && item.price != null)

    // Amazon's own search results, labeled as plain "Amazon" so they match
    // the Amazon entry in the home goods store list.
    let amazonResults: ProductResult[] = []
    if (isHome && amazonData) {
      if (amazonData.error) {
        console.error('product-search: Amazon search error:', amazonData.error)
      } else {
        amazonResults = (amazonData.organic_results || [])
          .map((item: any) => ({
            name: item.title,
            price: item.extracted_price ?? null,
            store: 'Amazon',
            image: item.thumbnail ?? null
          }))
          .filter((item: any) => item.name && item.price != null)
      }
    }

    // Drop any Amazon rows that came through Google Shopping on home lists
    // so Amazon's price comes from its own search, not a mix of both.
    const merged = isHome
      ? [...googleResults.filter(g => !g.store.toLowerCase().includes('amazon')), ...amazonResults]
      : googleResults

    // No `error` field here — this is a legitimate "nothing matched this
    // particular search" result, distinct from the service failing outright.
    return res.status(200).json({ results: limitPerStore(merged) })
  } catch (e) {
    console.error('product-search: handler error:', e)
    return res.status(502).json({ error: 'Could not reach the price search service', results: [] })
  }
}