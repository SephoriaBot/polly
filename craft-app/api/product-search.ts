const productDB = [
  { name: 'milk whole gallon', brand: 'generic', score: 0 },
  { name: 'fairlife milk 52oz', brand: 'fairlife', score: 0 },
  { name: 'organic valley milk', brand: 'organic valley', score: 0 },
  { name: 'eggs large dozen', brand: 'generic', score: 0 },
  { name: 'kirkland eggs 18ct', brand: 'kirkland', score: 0 },
  { name: 'wonder bread white', brand: 'wonder', score: 0 },
  { name: 'kirkland bread whole wheat', brand: 'kirkland', score: 0 },
]

export default function handler(req, res) {
  const q = (req.query.q || '').toLowerCase().trim()

  if (!q) return res.status(400).json({ error: 'missing query' })

  const words = q.split(' ').filter(Boolean)

  const ranked = productDB
    .map(p => ({
      ...p,
      score: scoreProduct(p.name, q, words)
    }))
    .sort((a, b) => b.score - a.score)

  return res.status(200).json(ranked.slice(0, 5))
}

function scoreProduct(name, query, words) {
  let score = 0
  const n = name.toLowerCase()

  if (n === query) score += 200
  if (n.includes(query)) score += 120

  for (const w of words) {
    if (n.includes(w)) score += 25
  }

  // milk logic
  if (query.includes('milk') && n.includes('milk')) score += 30

  // eggs logic
  if (query.includes('egg') && n.includes('egg')) score += 30

  // penalty for weak matches
  if (n.length < 3) score -= 100

  return score
}
