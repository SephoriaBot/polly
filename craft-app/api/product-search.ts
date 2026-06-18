export const config = {
  runtime: 'nodejs'
}

export default async function handler(req, res) {
  const q = (req.query.q || '').toString().trim()

  if (!q) {
    return res.status(400).json([])
  }

  try {
    const url = `https://www.instacart.com/store/s?k=${encodeURIComponent(q)}`

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html'
      }
    })

    const html = await response.text()

    // safer extraction (not regex-only spam)
    const names = [...html.matchAll(/"name":"([^"]+)"/g)]
      .map(m => m[1])
      .filter(Boolean)
      .slice(0, 20)

    const cleaned = [...new Set(names)]
  .filter(name => {
    const n = name.toLowerCase()

    return (
      n.length >= 4 &&
      n.length <= 40 &&
      !n.includes('delivered') &&
      !n.includes('can i') &&
      !n.includes('add to cart') &&
      !n.includes('search') &&
      !n.includes('instacart') &&
      !n.includes('?')
    )
  })
  .map(name => ({ name }))
  .slice(0, 10)

    return res.status(200).json(cleaned)
  } catch (e) {
    return res.status(200).json([])
  }
}