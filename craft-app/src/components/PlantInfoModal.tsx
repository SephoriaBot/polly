import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchPlantProfile, type PlantProfile } from '../lib/plantAi'
import type { GardenPlant } from '../types/legacy'

interface Props {
  plant: GardenPlant
}

export default function PlantInfoModal({ plant }: Props) {
  const [details, setDetails] = useState<PlantProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (plant.perenual_details) {
        setDetails(plant.perenual_details as unknown as PlantProfile)
        setLoading(false)
        return
      }

      const profile = await fetchPlantProfile(plant.name)
      if (cancelled) return

      if (!profile) {
        setError('Could not generate plant info. Please try again.')
        setLoading(false)
        return
      }

      setDetails(profile)
      setLoading(false)

      await supabase
        .from('garden_plants')
        .update({
          perenual_details: profile,
          medicinal_note: profile.medicinal_note,
        })
        .eq('id', plant.id)
    }

    load()
    return () => { cancelled = true }
  }, [plant.id, plant.name, plant.perenual_details])

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

          <div style={{
            padding: '10px 14px', borderRadius: 10,
            background: details.poisonous_to_pets ? '#fff0f0' : '#f0fdf4',
            border: `1.5px solid ${details.poisonous_to_pets ? '#fecaca' : '#bbf7d0'}`,
          }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: details.poisonous_to_pets ? '#b91c1c' : '#15803d', marginBottom: details.poisonous_to_pets_note ? 4 : 0 }}>
              {details.poisonous_to_pets ? '⚠️ Toxic to pets' : '✓ Generally considered safe for pets'}
            </div>
            {details.poisonous_to_pets_note && (
              <div style={{ fontSize: '0.78rem', color: 'var(--ink-soft)' }}>{details.poisonous_to_pets_note}</div>
            )}
            <div style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', marginTop: 6, fontStyle: 'italic' }}>
              AI-generated — for anything you're unsure about, double check against the ASPCA toxic/non-toxic plant list.
            </div>
          </div>

          {details.medicinal && details.medicinal_note && (
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>🌿 Traditional uses</div>
              <p style={{ fontSize: '0.82rem', color: 'var(--ink-soft)', lineHeight: 1.5 }}>{details.medicinal_note}</p>
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
