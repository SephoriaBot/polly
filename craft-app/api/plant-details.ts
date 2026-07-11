/// <reference types="node" />
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = (req.query.id || "").toString().trim()
  if (!id) return res.status(400).json({ error: 'missing id' })

  try {
    const detailRes = await fetch(
      `https://perenual.com/api/species/details/${id}?key=${process.env.PERENUAL_KEY}`
    )
    const d = await detailRes.json()

    return res.status(200).json({
      medicinal: d.medicinal === true,
      poisonous_to_pets: d.poisonous_to_pets === true,
      poisonous_to_humans: d.poisonous_to_humans === true,
      watering: d.watering ?? null,
      sunlight: d.sunlight ?? [],
      cycle: d.cycle ?? null,
      care_level: d.care_level ?? null,
      edible_fruit: d.edible_fruit === true,
      edible_leaf: d.edible_leaf === true,
      description: d.description ?? null,
    })
  } catch (e) {
    console.error('plant-details error:', e)
    return res.status(500).json({ error: 'fetch failed' })
  }
}
