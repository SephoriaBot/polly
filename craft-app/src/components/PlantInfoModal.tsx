import { useEffect, useState } from 'react'
import type { GardenPlant } from '../types/legacy'
import { supabase } from '../lib/supabase'


interface Props {
  plant: GardenPlant
}

interface PlantDetails {
  medicinal: boolean
  poisonous_to_pets: boolean
  poisonous_to_humans: boolean
  watering: string | null
  sunlight: string[]
  cycle: string | null
  care_level: string | null
  edible_fruit: boolean
  edible_leaf: boolean
  description: string | null
}

export default function PlantInfoModal({ plant }: Props) {
  const [details, setDetails] = useState<PlantDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

    useEffect(() => {
    if (!plant.perenual_id) {
      setError('No plant database record for this entry.')
      setLoading(false)
      return
    }

    // Use cached details if we have them
    if (plant.perenual_details) {
      setDetails(plant.perenual_details as unknown as PlantDetails)
      setLoading(false)
      return
    }

    fetch(`/api/plant-details?id=${plant.perenual_id}`)
      .then(async res => {
        const text = await res.text()
        let data
        try {
          data = JSON.parse(text)
        } catch {
          throw new Error(`Bad response (status ${res.status}): ${text.slice(0, 150)}`)
        }
        if (!res.ok || data.error) {
          throw new Error(data.error ?? 'unknown error')
        }
        const parsed: PlantDetails = {
          medicinal: data.medicinal === true,
          poisonous_to_pets: data.poisonous_to_pets === true,
          poisonous_to_humans: data.poisonous_to_humans === true,
          watering: data.watering ?? null,
          sunlight: Array.isArray(data.sunlight) ? data.sunlight : [],
          cycle: data.cycle ?? null,
          care_level: data.care_level ?? null,
          edible_fruit: data.edible_fruit === true,
          edible_leaf: data.edible_leaf === true,
          description: data.description ?? null,
        }
        setDetails(parsed)

        // Cache it so we don't burn API quota next time
        await supabase
          .from('garden_plants')
          .update({ perenual_details: parsed, perenual_details_fetched_at: new Date().toISOString() })
          .eq('id', plant.id)
      })
      .catch(err => setError(err.message || 'Could not load plant info.'))
      .finally(() => setLoading(false))
  }, [plant.perenual_id, plant.perenual_details, plant.id])

  return (
    <div style={{ fontSize: '0.9rem' }}>
      <h3 style={{ marginBottom: 4 }}>{plant.name}</h3>
      {plant.scientific_name && (
        <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', fontStyle: 'italic', marginBottom: 16 }}>
          {plant.scientific_name}
        </p>
      )}

      {loading && <p style={{ color: 'var(--ink-muted)', fontSize: '0.85rem' }}>Loading plant info…</p>}
      {error && <p style={{ color: '#b91c1c', fontSize: '0.85rem' }}>{error}</p>}

      {details && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Cat safety — front and center */}
          <div style={{
            padding: '10px 14px', borderRadius: 10,
            background: details.poisonous_to_pets ? '#fff0f0' : '#f0fdf4',
            border: `1.5px solid ${details.poisonous_to_pets ? '#fecaca' : '#bbf7d0'}`,
          }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: details.poisonous_to_pets ? '#b91c1c' : '#15803d' }}>
              {details.poisonous_to_pets ? '⚠️ Toxic to pets' : '✓ Safe for pets'}
            </div>
          </div>

          {details.medicinal && plant.medicinal_note && (
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>🌿 Traditional uses</div>
              <p style={{ fontSize: '0.82rem', color: 'var(--ink-soft)', lineHeight: 1.5 }}>{plant.medicinal_note}</p>
            </div>
          )}

          {details.description && (
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>About</div>
              <p style={{ fontSize: '0.82rem', color: 'var(--ink-soft)', lineHeight: 1.5 }}>{details.description}</p>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {details.watering && (
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Watering</div>
                <div style={{ fontSize: '0.85rem' }}>{details.watering}</div>
              </div>
            )}
            {details.sunlight.length > 0 && (
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Sunlight</div>
                <div style={{ fontSize: '0.85rem' }}>{details.sunlight.join(', ')}</div>
              </div>
            )}
            {details.cycle && (
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Cycle</div>
                <div style={{ fontSize: '0.85rem' }}>{details.cycle}</div>
              </div>
            )}
            {details.care_level && (
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Care level</div>
                <div style={{ fontSize: '0.85rem' }}>{details.care_level}</div>
              </div>
            )}
          </div>

          {(details.edible_fruit || details.edible_leaf) && (
            <div style={{ fontSize: '0.8rem', color: 'var(--ink-soft)' }}>
              🍽️ Edible {[details.edible_fruit && 'fruit', details.edible_leaf && 'leaf'].filter(Boolean).join(' & ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
