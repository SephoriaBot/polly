import { useEffect, useState, useRef } from 'react';
import { Search, Plus, Minus, Droplets, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import PlantTroubleshooter from '../components/plantTroubleshooter'
import type { GardenPlant } from '../types/legacy'

interface WateringEntry {
  id: string
  watered_at: string
}

interface SearchResult {
  id: number
  name: string
  scientific_name: string | null
}

export default function PlantsPage() {
  const [plants, setPlants] = useState<GardenPlant[]>([])
  const [waterings, setWaterings] = useState<WateringEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [wateringLoading, setWateringLoading] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [selectedPlant, setSelectedPlant] = useState<GardenPlant | null>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    loadPlants()
    loadWaterings()
  }, [])

  async function loadPlants() {
    setLoading(true)
    const { data } = await supabase
      .from('garden_plants')
      .select('*')
      .order('name')
    setPlants(data ?? [])
    setLoading(false)
  }

  async function loadWaterings() {
    const { data } = await supabase
      .from('garden_waterings')
      .select('*')
      .order('watered_at', { ascending: false })
    setWaterings(data ?? [])
  }

  async function searchPlants(q: string) {
    if (!q.trim()) { setSearchResults([]); return }
    setSearching(true)
    setSearchError('')
    try {
      const res = await fetch(`/api/plant-search?q=${encodeURIComponent(q.trim())}`)
      const data = await res.json()
      setSearchResults(Array.isArray(data) ? data : [])
      if (!data?.length) setSearchError('No results found.')
    } catch {
      setSearchError('Search failed, try again.')
      setSearchResults([])
    }
    setSearching(false)
  }

  function handleQueryChange(val: string) {
    setQuery(val)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => searchPlants(val), 500)
  }

  async function addPlant(result: SearchResult) {
    const existing = plants.find(p => p.perenual_id === result.id)
    if (existing) {
      await updateQuantity(existing.id, existing.quantity + 1)
      setQuery('')
      setSearchResults([])
      return
    }

    const { data } = await supabase
      .from('garden_plants')
      .insert({
        name: result.name,
        scientific_name: result.scientific_name ?? null,
        perenual_id: result.id,
        quantity: 1,
      })
      .select()
      .single()

    if (data) setPlants(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setQuery('')
    setSearchResults([])
  }

  async function updateQuantity(id: string, newQty: number) {
    if (newQty < 1) {
      removePlant(id)
      return
    }
    await supabase.from('garden_plants').update({ quantity: newQty }).eq('id', id)
    setPlants(prev => prev.map(p => p.id === id ? { ...p, quantity: newQty } : p))
  }

  async function removePlant(id: string) {
    await supabase.from('garden_plants').delete().eq('id', id)
    setPlants(prev => prev.filter(p => p.id !== id))
  }

  async function logWatering() {
    setWateringLoading(true)
    const { data } = await supabase
      .from('garden_waterings')
      .insert({ watered_at: new Date().toISOString() })
      .select()
      .single()
    if (data) setWaterings(prev => [data, ...prev])
    setWateringLoading(false)
  }

  async function deleteWatering(id: string) {
    await supabase.from('garden_waterings').delete().eq('id', id)
    setWaterings(prev => prev.filter(w => w.id !== id))
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit'
    })
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>My Garden 🌿</h2>
          <p>{plants.length} plant{plants.length !== 1 ? 's' : ''} growing</p>
        </div>
      </div>

      <div className="page-body">

        {/* Search */}
        <div style={{ marginBottom: 28, maxWidth: 560 }}>
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-muted)' }} />
            <input
              className="form-input"
              style={{ paddingLeft: 36 }}
              placeholder="Search a plant to add to your garden…"
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
            />
            {query && (
              <button onClick={() => { setQuery(''); setSearchResults([]) }} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)' }}>
                <X size={14} />
              </button>
            )}
          </div>

          {searching && <p style={{ fontSize: 13, color: 'var(--ink-muted)', padding: '6px 0' }}>Searching…</p>}
          {searchError && <p style={{ fontSize: 13, color: '#b91c1c' }}>{searchError}</p>}

          {searchResults.length > 0 && (
            <div style={{ border: '1.5px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--white)' }}>
              {searchResults.map(r => (
                <div
                  key={r.id}
                  onClick={() => addPlant(r)}
                  style={{
                    padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--cream)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--white)')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--ink)' }}>{r.name}</div>
                      {r.scientific_name && <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', fontStyle: 'italic' }}>{r.scientific_name}</div>}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: plants.some(p => p.perenual_id === r.id) ? 'var(--green-dark)' : 'var(--citrus-blue)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {plants.some(p => p.perenual_id === r.id) ? '+ add another' : '+ add'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Garden list + watering side by side */}
        <div className="grid-2" style={{ alignItems: 'start' }}>

          {/* Plant list */}
          <div className="card">
            <div className="card-body">
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 14 }}>
                In my garden
              </div>
              {loading ? (
                <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Loading…</p>
              ) : plants.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', lineHeight: 1.6 }}>Search for a plant above to add it to your garden.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {plants.map(p => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--ink)' }}>{p.name}</div>
                        {p.scientific_name && <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', fontStyle: 'italic' }}>{p.scientific_name}</div>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => updateQuantity(p.id, p.quantity - 1)}
                          style={{ width: 26, height: 26, borderRadius: '50%', border: '1.5px solid var(--border)', background: 'var(--cream)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Minus size={11} />
                        </button>
                        <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 700, fontSize: '0.88rem' }}>{p.quantity}</span>
                        <button
                          onClick={() => updateQuantity(p.id, p.quantity + 1)}
                          style={{ width: 26, height: 26, borderRadius: '50%', border: '1.5px solid var(--border)', background: 'var(--cream)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Plus size={11} />
                        </button>
                        <button
                          onClick={() => removePlant(p.id)}
                          style={{ width: 26, height: 26, borderRadius: '50%', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 2 }}
                        >
                          <Trash2 size={13} />
                        </button>
<button
  onClick={() => setSelectedPlant(p)}
  style={{
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '4px 8px',
    fontSize: '0.75rem',
    cursor: 'pointer',
    color: 'var(--ink-soft)',
    marginLeft: 6
  }}
>
  Troubleshoot
</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
  </div>

          </div>

          {/* Watering */}
          <div className="card">
            <div className="card-body">
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 14 }}>
                Watering
              </div>

              <button
                className="btn btn-green"
                style={{ width: '100%', justifyContent: 'center', marginBottom: 20, padding: '12px', fontSize: '0.9rem' }}
                onClick={logWatering}
                disabled={wateringLoading}
              >
                <Droplets size={16} />
                {wateringLoading ? 'Logging…' : 'Everyone had water today ✓'}
              </button>

              {waterings.length > 0 && (
                <>
                  <button
                    onClick={() => setShowHistory(h => !h)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--ink-muted)', fontWeight: 600, padding: 0, marginBottom: 10 }}
                  >
                    {showHistory ? '▾ hide history' : '▸ show history'} ({waterings.length})
                  </button>

                  {showHistory && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto', paddingRight: 4 }}>
                      {waterings.map(w => (
                        <div key={w.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '0.82rem' }}>
                          <span style={{ color: 'var(--ink-soft)' }}>💧 {formatDate(w.watered_at)}</span>
                          <button
                            onClick={() => deleteWatering(w.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)', padding: 0, display: 'flex', alignItems: 'center' }}
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {waterings.length === 0 && (
                <p style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>No watering logged yet.</p>
              )}
            </div>
          </div>
              </div>

      {selectedPlant && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div style={{ background: 'white', borderRadius: 12, padding: 20, width: '90%', maxWidth: 600 }}>
            <button
              onClick={() => setSelectedPlant(null)}
              style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
            <PlantTroubleshooter key={selectedPlant.id} plant={selectedPlant} />

          </div>
        </div>
      )}
    </div>
  )
}

