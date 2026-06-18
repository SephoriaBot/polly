export const config = {
  runtime: 'nodejs'
}

export default async function handler(req, res) {
  const q = (req.query.q || '').toLowerCase()

  try {
    // STEP 1: get search result page (this contains item IDs in real flow)
    const searchRes = await fetch(
      `https://www.instacart.com/store/s?k=${encodeURIComponent(q)}`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      }
    ).then(r => r.text())

    // STEP 2: extract item IDs (not names)
    const itemIds = extractItemIds(searchRes)

    if (!itemIds.length) {
      return res.status(200).json([])
    }

    // STEP 3: call Items API (REAL product resolver)
    const items = await fetchItems(itemIds)

    // STEP 4: rank + return
    const ranked = rank(items, q)

    res.status(200).json(ranked.slice(0, 10))
  } catch (e) {
    console.log(e)
    res.status(500).json({ error: 'failed' })
  }
}
