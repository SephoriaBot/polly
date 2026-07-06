export default async function handler(req, res) {
  const q = (req.query.q || "").toString().trim()
  if (!q) return res.status(400).json([])

  try {
    const searchRes = await fetch(
      `https://perenual.com/api/species-list?key=${process.env.PERENUAL_KEY}&q=${encodeURIComponent(q)}&page=1`
    )
    const searchData = await searchRes.json()
    const results = searchData.data ?? []

    const mapped = results
      .slice(0, 5)
      .map((plant) => ({
        id: plant.id,
        name: plant.common_name,
        scientific_name: plant.scientific_name?.[0] ?? null,
      }))

    return res.status(200).json(mapped)
  } catch (e) {
    console.error('plant-search error:', e)
    return res.status(500).json([])
  }
}
