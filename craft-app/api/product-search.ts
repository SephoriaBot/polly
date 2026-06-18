export default async function handler(req, res) {
  const q = (req.query.q || "").toString().trim()

  if (!q) return res.status(400).json([])

  try {
    const url =
      `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(q)}&api_key=${process.env.SERPAPI_KEY}`

    const r = await fetch(url)
    const data = await r.json()

    const results = (data.shopping_results || []).slice(0, 1).map((item: any) => ({
      name: item.title,
      price: item.extracted_price ?? null,
      store: item.source ?? "unknown",
      image: item.thumbnail ?? null
    }))

    cleaned.sort((a, b) => Number(a.price || 9999) - Number(b.price || 9999))
    return res.status(200).json(results)
  } catch (e) {
    return res.status(200).json([])
  }
}