export default async function handler(req, res) {
  const q = (req.query.q || "").toString().trim()
  const zip = (req.query.zip || "").toString().trim()

  if (!q) return res.status(400).json([])

  try {
    let url = `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(q)}&api_key=${process.env.SERPAPI_KEY}`
    
    if (zip) {
      url += `&location=${encodeURIComponent(zip + ", United States")}&gl=us&hl=en`
    }

    const r = await fetch(url)
    const data = await r.json()

    const results = (data.shopping_results || [])
      .filter((item) => (item.source || '').toLowerCase() !== 'instacart')
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
