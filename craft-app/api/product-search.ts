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
  .map(n => n.trim())
  .filter(n => {
    const s = n.toLowerCase()

    const looksLikeProduct =
      s.length >= 3 &&
      s.length <= 35 &&
      !s.includes('how ') &&
      !s.includes('does ') &&
      !s.includes('same-day') &&
      !s.includes('pickup') &&
      !s.includes('products') &&
      !s.includes('delivery') &&
      !s.includes('instacart')

    const hasLetters = /[a-z]/.test(s)
    const notSentence = s.split(' ').length <= 4

    return looksLikeProduct && hasLetters && notSentence
  })
  .map(n => ({ name: n }))
  .slice(0, 10)

function normalizeQuery(name: string) {
  return name
    .toLowerCase()
    .replace(/can i|get|have|buy|deliver(ed)?|add to cart|products|y|how does|same-day|how long|how much|work|pickup|search|instacart/g, '')
    .replace(/\?/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}