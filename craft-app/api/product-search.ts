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

function extractItemIds(html) {
  const matches = []

  const regex = /items_\d+-\d+/g
  let m

  while ((m = regex.exec(html))) {
    matches.push(m[0])
  }

  return [...new Set(matches)]
}

async function fetchItems(ids) {
  const res = await fetch('https://www.instacart.com/graphql', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      operationName: "Items",
      variables: {
        ids,
        shopId: "754",
        zoneId: "946",
        postalCode: "23224"
      },
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash: "0362f9eaea7f55c17c95266a64f8c37a10b55d265318f85c761c59c382d96074"
        }
      }
    })
  })

  const json = await res.json()

  return json?.data?.items || []
}

function rank(items, q) {
  const words = q.toLowerCase().split(' ').filter(Boolean)

  return items
    .map(i => ({
      name: i.name,
      price: i.price,
      image: i.image,
      score: score(i.name.toLowerCase(), q, words)
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

console.log("HTML LENGTH:", html.length)
console.log("FOUND IDS:", itemIds.slice(0, 10))
