/// <reference types="node" />
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Runs daily via Vercel Cron (see vercel.json). For every row in
// price_watches, re-searches that item at that specific store and updates
// current_price/lowest_price, flagging `dropped` when the price has fallen
// below the watch's baseline. This does NOT send a notification — the
// Grocery page just reads `dropped` rows and surfaces them in a "Price
// Drops" card next time it's opened.

const MAX_WATCHES_PER_RUN = 40

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically
  // when CRON_SECRET is set as an env var — this just makes sure nobody
  // else can hit the endpoint and burn through the SerpAPI quota.
  if (process.env.CRON_SECRET) {
    const auth = req.headers['authorization']
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  if (!process.env.SERPAPI_KEY) {
    console.error('check-price-drops: SERPAPI_KEY is not set')
    return res.status(500).json({ error: 'Price search is not configured (missing API key)' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL as string
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY as string
  if (!supabaseUrl || !supabaseKey) {
    console.error('check-price-drops: Supabase env vars are not set')
    return res.status(500).json({ error: 'Database is not configured' })
  }
  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data: watches, error: fetchError } = await supabase
    .from('price_watches')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(MAX_WATCHES_PER_RUN)

  if (fetchError) {
    console.error('check-price-drops: failed to load watches:', fetchError)
    return res.status(500).json({ error: 'Could not load watched items' })
  }
  if (!watches || watches.length === 0) {
    return res.status(200).json({ checked: 0, dropped: 0 })
  }

  let checked = 0
  let dropped = 0

  for (const watch of watches) {
    try {
      const q = `${watch.item_name} ${watch.store}`
      const url = `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(q)}&api_key=${process.env.SERPAPI_KEY}&gl=us&hl=en`
      const r = await fetch(url)
      const data = await r.json()

      if (!r.ok || data.error) {
        console.error(`check-price-drops: SerpAPI error for "${q}":`, data.error || r.statusText)
        continue
      }

      // Only keep results that actually look like they're from the watched
      // store — a "{item} {store}" query can still surface other sellers.
      const storeLower = String(watch.store).toLowerCase()
      const matches = (data.shopping_results || [])
        .filter((item: any) => {
          const source = (item.source || '').toLowerCase()
          return source.includes(storeLower) || storeLower.includes(source)
        })
        .map((item: any) => item.extracted_price)
        .filter((p: any) => typeof p === 'number')

      if (matches.length === 0) {
        // Nothing matched this run — leave the existing price data alone
        // rather than overwriting it with nothing.
        checked++
        continue
      }

      const currentPrice = Math.min(...matches)
      const lowestPrice = Math.min(currentPrice, Number(watch.lowest_price ?? currentPrice))
      const isDropped = currentPrice < Number(watch.baseline_price) - 0.01

      await supabase
        .from('price_watches')
        .update({
          current_price: currentPrice,
          lowest_price: lowestPrice,
          dropped: isDropped,
          last_checked_at: new Date().toISOString(),
        })
        .eq('id', watch.id)

      checked++
      if (isDropped) dropped++
    } catch (e) {
      console.error(`check-price-drops: failed to check watch ${watch.id}:`, e)
      // One bad lookup shouldn't stop the rest of the batch.
    }
  }

  return res.status(200).json({ checked, dropped })
}
