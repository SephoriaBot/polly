export default async function handler(req, res) {
  const q = req.query.q || ''

  res.status(200).json([
    { name: q, store: "Store A", price: 2.99 }
  ])
}
