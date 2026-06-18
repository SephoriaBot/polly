export default async function handler(req, res) {
  const q = req.query.q

  if (!q) {
    return res.status(400).json({ error: 'missing query' })
  }

  const url = `https://www.instacart.com/store/s?k=${encodeURIComponent(q)}`

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    })

    const html = await response.text()

    // very simple extraction (no API needed)
    const products = extractProducts(html)

    const ranked = rankProducts(products, q)

    return res.status(200).json(ranked.slice(0, 5))
  } catch (e) {
    return res.status(500).json({ error: 'search failed' })
  }
}

function extractProducts(html) {
  const results = []

  const regex = /"name":"(.*?)".*?"price":(\d+\.?\d*)/g
  let match

  while ((match = regex.exec(html)) !== null) {
    results.push({
      name: decode(match[1]),
      price: parseFloat(match[2] || '0'),
      retailer: 'Instacart'
    })
  }

  return results
}

function rankProducts(products, query) {
  const q = query.toLowerCase()
  const qWords = q.split(' ').filter(Boolean)

  return products
    .map(p => ({
      ...p,
      score: scoreProduct(p, q, qWords)
    }))
    .sort((a, b) => b.score - a.score)
}

function scoreProduct(p, query, qWords) {
  const name = (p.name || '').toLowerCase()
  let score = 0

  // 1. Exact match boost (huge)
  if (name === query) score += 200

  // 2. Contains full query
  if (name.includes(query)) score += 100

  // 3. Word overlap scoring
  for (const w of qWords) {
    if (name.includes(w)) score += 15
  }

  // 4. Penalize bad matches
  const badWords = ['unscented wipes', 'diaper', 'pet', 'formula']
  if (badWords.some(b => name.includes(b) && !query.includes(b))) {
    score -= 50
  }

  // 5. Size preference boost
  score += sizeScore(name, query)

  // 6. Brand quality boost (simple heuristic)
  score += brandScore(name)

  // 7. Price sanity filter
  if (p.price <= 0) score -= 100
  if (p.price > 50 && query.includes('milk')) score -= 10

  return score
}

function sizeScore(name, query) {
  const sizes = ['oz', 'lb', 'gallon', 'ct', 'pack']

  let score = 0

  for (const s of sizes) {
    if (name.includes(s)) score += 5
  }

  // prefer gallon milk if milk is requested
  if (query.includes('milk') && name.includes('gallon')) {
    score += 30
  }

  return score
}

function brandScore(name) {
  const preferred = [
    'fairlife',
    'organic valley',
    'land o lakes',
    'kirkland',
    'great value',
    'heinz'
  ]

  for (const b of preferred) {
    if (name.includes(b)) return 10
  }

  return 0
}

function scoreMatch(name, query) {
  const n = name.toLowerCase()

  let score = 0

  if (n === query) score += 100
  if (n.includes(query)) score += 50

  const words = query.split(' ')
  for (const w of words) {
    if (n.includes(w)) score += 10
  }

  return score
}

function decode(str) {
  return str.replace(/\\u0026/g, '&')
}
