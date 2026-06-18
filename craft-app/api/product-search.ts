export const config = {
  runtime: 'nodejs'
}

export default async function handler(req, res) {
  const q = (req.query.q || '').toLowerCase()

  const url = `https://www.instacart.com/store/s?k=${encodeURIComponent(q)}`

  const html = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  }).then(r => r.text())

  const raw = extractCandidates(html)

  const cleaned = raw
    .filter(isRealProduct)
    .map(name => ({ name }))
    .slice(0, 10)

  const ranked = rank(cleaned, q)

  res.status(200).json(ranked.slice(0, 8))
}

function extractCandidates(html) {
  const matches = []

  const regex = /"name":"(.*?)"/g
  let m

  while ((m = regex.exec(html))) {
    const text = decode(m[1])

    matches.push(text)
  }

  return matches
}

function isRealProduct(name) {
  const n = name.toLowerCase()

  return (
    n.length > 3 &&
    n.length < 60 &&
    !n.includes('can i get') &&
    !n.includes('delivered') &&
    !n.includes('add to cart') &&
    !n.includes('delivery') &&
    !n.includes('sponsored') &&
    !n.includes('instacart') &&
    /^[a-z0-9\s\-\&\(\)]+$/.test(n)
  )
}

function rank(products, q) {
  const words = q.split(' ').filter(Boolean)

  return products
    .map(p => ({
      ...p,
      score: score(p.name.toLowerCase(), q, words)
    }))
    .sort((a, b) => b.score - a.score)
}

function score(name, q, words) {
  let s = 0

  if (name === q) s += 200
  if (name.includes(q)) s += 100

  for (const w of words) {
    if (name.includes(w)) s += 20
  }

  return s
}
