import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import styles from './Pets.module.css'
import DrGroq from '../components/pets/DrGroq'
import { Cat, Dog, Bird, Rabbit, Fish, PawPrint, type LucideIcon } from 'lucide-react'

interface Pet {
  id: string
  name: string
  species: string
  icon_color: string | null
  breed: string
  age: number
  weight: number
  notes: string
  vet_name: string | null
  vet_phone: string | null
  insurance_provider: string | null
  insurance_policy: string | null
  feeding_routine: string | null
  personality: string | null
  hiding_spots: string | null
  created_at: string
}

interface Vaccination {
  id: string
  pet_id: string
  name: string
  date_given: string
  next_due: string
  notes: string
}

interface WeightEntry {
  id: string
  pet_id: string
  weight: number
  unit: string
  recorded_at: string
}

interface FeedingEntry {
  id: string
  pet_id: string
  food_type: string
  amount: string
  ate_well: boolean
  notes: string
  fed_at: string
}

// One consistent line-icon per species, instead of emoji.
const SPECIES_ICONS: Record<string, LucideIcon> = {
  cat: Cat, dog: Dog, bird: Bird, rabbit: Rabbit, fish: Fish, other: PawPrint
}

function SpeciesIcon({ species, size = 24, style }: { species: string; size?: number; style?: React.CSSProperties }) {
  const Icon = SPECIES_ICONS[species] ?? PawPrint
  return <Icon size={size} style={style} strokeWidth={1.75} />
}

const COLOR_OPTIONS = [
  { name: 'natural', filter: 'none' },
  { name: 'black',   filter: 'brightness(0.35) saturate(1.2)' },
  { name: 'white',   filter: 'brightness(1.6) saturate(0.3)' },
  { name: 'grey',    filter: 'grayscale(1) brightness(1.1)' }
]

const EMPTY_PET_FORM = {
  name: '', species: 'cat', icon_color: 'natural', breed: '', age: '', weight: '', notes: '',
  vet_name: '', vet_phone: '', insurance_provider: '', insurance_policy: '',
  feeding_routine: '', personality: '', hiding_spots: ''
}

export default function Pets() {
  const [pets, setPets] = useState<Pet[]>([])
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null)
  const [tab, setTab] = useState<'feeding' | 'vaccinations' | 'weight' | 'sitter' | 'troubleshoot'>('feeding')
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([])
  const [weights, setWeights] = useState<WeightEntry[]>([])
  const [feedings, setFeedings] = useState<FeedingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showPetModal, setShowPetModal] = useState(false)
  const [editingPetId, setEditingPetId] = useState<string | null>(null)
  const [petForm, setPetForm] = useState(EMPTY_PET_FORM)

  const [vacForm, setVacForm] = useState({ name: '', date_given: '', next_due: '', notes: '' })
  const [weightForm, setWeightForm] = useState({ weight: '', unit: 'lbs', recorded_at: new Date().toISOString().split('T')[0] })
  const [feedingForm, setFeedingForm] = useState({
    food_type: 'wet', amount: '', ate_well: true, notes: '',
    fed_at: new Date().toISOString().slice(0, 16)
  })

  useEffect(() => { fetchPets() }, [])

  useEffect(() => {
    if (selectedPet) {
      fetchVaccinations(selectedPet.id)
      fetchWeights(selectedPet.id)
      fetchFeedings(selectedPet.id)
    }
  }, [selectedPet])

  async function fetchPets() {
    setLoading(true)
    const { data } = await supabase.from('pets').select('*').order('name')
    setPets(data ?? [])
    setLoading(false)
  }

  async function fetchVaccinations(petId: string) {
    const { data } = await supabase.from('pet_vaccinations').select('*').eq('pet_id', petId).order('date_given', { ascending: false })
    setVaccinations(data ?? [])
  }

  async function fetchWeights(petId: string) {
    const { data } = await supabase.from('pet_weights').select('*').eq('pet_id', petId).order('recorded_at', { ascending: false })
    setWeights(data ?? [])
  }

  async function fetchFeedings(petId: string) {
    const { data } = await supabase.from('pet_feedings').select('*').eq('pet_id', petId).order('fed_at', { ascending: false }).limit(30)
    setFeedings(data ?? [])
  }

  function openAddPet() {
    setEditingPetId(null)
    setPetForm(EMPTY_PET_FORM)
    setShowPetModal(true)
  }

  function openEditPet(pet: Pet) {
    setEditingPetId(pet.id)
    setPetForm({
      name: pet.name,
      species: pet.species ?? 'cat',
      breed: pet.breed ?? '',
      icon_color: pet.icon_color ?? 'natural',
      age: pet.age != null ? String(pet.age) : '',
      weight: pet.weight != null ? String(pet.weight) : '',
      notes: pet.notes ?? '',
      vet_name: pet.vet_name ?? '',
      vet_phone: pet.vet_phone ?? '',
      insurance_provider: pet.insurance_provider ?? '',
      insurance_policy: pet.insurance_policy ?? '',
      feeding_routine: pet.feeding_routine ?? '',
      personality: pet.personality ?? '',
      hiding_spots: pet.hiding_spots ?? '',
    })
    setShowPetModal(true)
  }

  async function savePet() {
    if (!petForm.name.trim()) return
    const payload = {
      name: petForm.name.trim(),
      species: petForm.species,
      breed: petForm.breed.trim(),
      icon_color: petForm.icon_color || 'natural',
      age: petForm.age ? parseFloat(petForm.age) : null,
      weight: petForm.weight ? parseFloat(petForm.weight) : null,
      notes: petForm.notes.trim(),
      vet_name: petForm.vet_name.trim() || null,
      vet_phone: petForm.vet_phone.trim() || null,
      insurance_provider: petForm.insurance_provider.trim() || null,
      insurance_policy: petForm.insurance_policy.trim() || null,
      feeding_routine: petForm.feeding_routine.trim() || null,
      personality: petForm.personality.trim() || null,
      hiding_spots: petForm.hiding_spots.trim() || null,
    }

    if (editingPetId) {
      const { data } = await supabase.from('pets').update(payload).eq('id', editingPetId).select().single()
      if (data) {
        setPets(prev => prev.map(p => p.id === editingPetId ? data : p).sort((a, b) => a.name.localeCompare(b.name)))
        if (selectedPet?.id === editingPetId) setSelectedPet(data)
      }
    } else {
      const { data } = await supabase.from('pets').insert(payload).select().single()
      if (data) {
        setPets(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
        setSelectedPet(data)
      }
    }

    setPetForm(EMPTY_PET_FORM)
    setEditingPetId(null)
    setShowPetModal(false)
  }

  async function deletePet(id: string) {
    if (!confirm('Delete this pet and all their records?')) return
    await supabase.from('pets').delete().eq('id', id)
    setPets(prev => prev.filter(p => p.id !== id))
    if (selectedPet?.id === id) setSelectedPet(null)
  }

  async function addVaccination() {
    if (!vacForm.name.trim() || !selectedPet) return
    const { data } = await supabase.from('pet_vaccinations').insert({
      pet_id: selectedPet.id,
      name: vacForm.name.trim(),
      date_given: vacForm.date_given || null,
      next_due: vacForm.next_due || null,
      notes: vacForm.notes.trim(),
    }).select().single()
    if (data) setVaccinations(prev => [data, ...prev])
    setVacForm({ name: '', date_given: '', next_due: '', notes: '' })
  }

  async function deleteVaccination(id: string) {
    await supabase.from('pet_vaccinations').delete().eq('id', id)
    setVaccinations(prev => prev.filter(v => v.id !== id))
  }

  async function addWeight() {
    if (!weightForm.weight || !selectedPet) return
    const { data } = await supabase.from('pet_weights').insert({
      pet_id: selectedPet.id,
      weight: parseFloat(weightForm.weight),
      unit: weightForm.unit,
      recorded_at: weightForm.recorded_at,
    }).select().single()
    if (data) setWeights(prev => [data, ...prev])
    setWeightForm({ weight: '', unit: 'lbs', recorded_at: new Date().toISOString().split('T')[0] })
  }

  async function deleteWeight(id: string) {
    await supabase.from('pet_weights').delete().eq('id', id)
    setWeights(prev => prev.filter(w => w.id !== id))
  }

  async function addFeeding() {
    if (!selectedPet) return
    const { data } = await supabase.from('pet_feedings').insert({
      pet_id: selectedPet.id,
      food_type: feedingForm.food_type,
      amount: feedingForm.amount.trim() || null,
      ate_well: feedingForm.ate_well,
      notes: feedingForm.notes.trim() || null,
      fed_at: new Date(feedingForm.fed_at).toISOString(),
    }).select().single()
    if (data) setFeedings(prev => [data, ...prev])
    setFeedingForm({ food_type: 'wet', amount: '', ate_well: true, notes: '', fed_at: new Date().toISOString().slice(0, 16) })
  }

  async function deleteFeeding(id: string) {
    await supabase.from('pet_feedings').delete().eq('id', id)
    setFeedings(prev => prev.filter(f => f.id !== id))
  }

  function isDueSoon(dateStr: string) {
    if (!dateStr) return false
    const due = new Date(dateStr)
    const diff = (due.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return diff <= 30 && diff >= 0
  }

  function isOverdue(dateStr: string) {
    if (!dateStr) return false
    return new Date(dateStr) < new Date()
  }

  function getFilter(colorName: string | null) {
    return COLOR_OPTIONS.find(c => c.name === colorName)?.filter ?? 'none'
  }

  function formatDateTime(isoStr: string) {
    return new Date(isoStr).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Garden & Home</p>
          <h1 className={styles.title}>My Pets</h1>
        </div>
        <button className="btn-primary" onClick={openAddPet}>+ Add Pet</button>
      </div>

      {/* Add/Edit pet modal */}
      {showPetModal && (
        <div className="modal-overlay" onClick={() => setShowPetModal(false)}>
          <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingPetId ? 'Edit Pet' : 'Add a Pet'}</h3>
              <button className="close-btn" onClick={() => setShowPetModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Basic Info</div>
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input className="form-input" value={petForm.name} onChange={e => setPetForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Luna" />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Species</label>
                  <select className="form-select" value={petForm.species} onChange={e => setPetForm(f => ({ ...f, species: e.target.value }))}>
                    <option value="cat">Cat</option>
                    <option value="dog">Dog</option>
                    <option value="bird">Bird</option>
                    <option value="rabbit">Rabbit</option>
                    <option value="fish">Fish</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Breed</label>
                  <input className="form-input" value={petForm.breed} onChange={e => setPetForm(f => ({ ...f, breed: e.target.value }))} placeholder="e.g. Domestic Shorthair" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Icon Color</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {COLOR_OPTIONS.map(c => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setPetForm(f => ({ ...f, icon_color: c.name }))}
                      title={c.name}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 8,
                        border: petForm.icon_color === c.name ? '2px solid var(--pink)' : '1.5px dashed var(--border)',
                        background: petForm.icon_color === c.name ? 'var(--blush)' : '#fff',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <SpeciesIcon species={petForm.species} size={22} style={{ filter: c.filter, color: 'var(--ink)' }} />
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Age (years)</label>
                  <input className="form-input" type="number" value={petForm.age} onChange={e => setPetForm(f => ({ ...f, age: e.target.value }))} placeholder="3" />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Weight (lbs)</label>
                  <input className="form-input" type="number" value={petForm.weight} onChange={e => setPetForm(f => ({ ...f, weight: e.target.value }))} placeholder="10" />
                </div>
              </div>

              <div style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '16px 0 12px' }}>Vet & Insurance</div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Vet Name</label>
                  <input className="form-input" value={petForm.vet_name} onChange={e => setPetForm(f => ({ ...f, vet_name: e.target.value }))} placeholder="Dr. Smith" />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Vet Phone</label>
                  <input className="form-input" value={petForm.vet_phone} onChange={e => setPetForm(f => ({ ...f, vet_phone: e.target.value }))} placeholder="(804) 555-0100" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Insurance Provider</label>
                  <input className="form-input" value={petForm.insurance_provider} onChange={e => setPetForm(f => ({ ...f, insurance_provider: e.target.value }))} placeholder="Trupanion" />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Policy Number</label>
                  <input className="form-input" value={petForm.insurance_policy} onChange={e => setPetForm(f => ({ ...f, insurance_policy: e.target.value }))} placeholder="POL-12345" />
                </div>
              </div>

              <div style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '16px 0 12px' }}>Catsitter Info</div>
              <div className="form-group">
                <label className="form-label">Feeding Routine</label>
                <textarea className="form-textarea" value={petForm.feeding_routine} onChange={e => setPetForm(f => ({ ...f, feeding_routine: e.target.value }))} placeholder="e.g. 1/4 cup dry in the morning, half a can wet at night" />
              </div>
              <div className="form-group">
                <label className="form-label">Personality</label>
                <textarea className="form-textarea" value={petForm.personality} onChange={e => setPetForm(f => ({ ...f, personality: e.target.value }))} placeholder="e.g. Shy at first, warms up quickly, loves chin scratches" />
              </div>
              <div className="form-group">
                <label className="form-label">Hiding Spots / Favorite Places</label>
                <textarea className="form-textarea" value={petForm.hiding_spots} onChange={e => setPetForm(f => ({ ...f, hiding_spots: e.target.value }))} placeholder="e.g. Under the bed, on top of the fridge" />
              </div>
              <div className="form-group">
                <label className="form-label">Other Notes</label>
                <textarea className="form-textarea" value={petForm.notes} onChange={e => setPetForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any other important info..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setShowPetModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={savePet}>{editingPetId ? 'Save Changes' : 'Add Pet'}</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--ink-muted)', fontSize: 13 }}>loading...</p>
      ) : pets.length === 0 ? (
        <div className="empty-state">
          <PawPrint size={40} style={{ marginBottom: 12, color: 'var(--ink-muted)' }} />
          <p>No pets yet — add your first one above!</p>
        </div>
      ) : (
        <div className={styles.layout}>

          {/* Pet list */}
          <div className={styles.petList}>
            {pets.map(pet => (
              <div
                key={pet.id}
                className={`${styles.petCard} ${selectedPet?.id === pet.id ? styles.petCardActive : ''}`}
                onClick={() => setSelectedPet(pet)}
              >
                <span className={styles.petEmoji}>
                  <SpeciesIcon species={pet.species} size={28} style={{ filter: getFilter(pet.icon_color), color: 'var(--ink)' }} />
                </span>
                <div className={styles.petInfo}>
                  <div className={styles.petName}>{pet.name}</div>
                  <div className={styles.petMeta}>{pet.breed || pet.species}</div>
                </div>
                <button className={styles.deleteBtn} onClick={e => { e.stopPropagation(); openEditPet(pet) }} title="edit">✎</button>
                <button className={styles.deleteBtn} onClick={e => { e.stopPropagation(); deletePet(pet.id) }} title="delete">✕</button>
              </div>
            ))}
          </div>

          {/* Pet detail */}
          {selectedPet && (
            <div className={styles.detail}>

              {/* Pet summary */}
              <div className={`card ${styles.petSummary}`}>
                <div className={styles.summaryLeft}>
                  <span className={styles.summaryEmoji}>
                    <SpeciesIcon species={selectedPet.species} size={40} style={{ filter: getFilter(selectedPet.icon_color), color: 'var(--ink)' }} />
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <h2 className={styles.summaryName}>{selectedPet.name}</h2>
                      <button className="btn-ghost btn-sm" onClick={() => openEditPet(selectedPet)}>✎ Edit</button>
                    </div>
                    <p className={styles.summaryMeta}>
                      {[selectedPet.breed, selectedPet.age ? `${selectedPet.age} yrs` : null, selectedPet.weight ? `${selectedPet.weight} lbs` : null].filter(Boolean).join(' · ')}
                    </p>
                    {selectedPet.vet_name && (
                      <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: 4 }}>
                        🏥 {selectedPet.vet_name}{selectedPet.vet_phone ? ` · ${selectedPet.vet_phone}` : ''}
                      </p>
                    )}
                    {selectedPet.insurance_provider && (
                      <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: 2 }}>
                        🛡 {selectedPet.insurance_provider}{selectedPet.insurance_policy ? ` · ${selectedPet.insurance_policy}` : ''}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className={styles.tabs}>
                {(['feeding', 'vaccinations', 'weight', 'sitter', 'troubleshoot'] as const).map(t => (
                  <button key={t} className={`${styles.tabBtn} ${tab === t ? styles.tabActive : ''}`} onClick={() => setTab(t)}>
                    {t === 'sitter' ? '🏠 catsitter' : t === 'feeding' ? '🍽 feeding' : t === 'vaccinations' ? '💉 vaccines' : t === 'weight' ? '⚖️ weight' : '🩺 ask dr. groq'}
                  </button>
                ))}
              </div>

              {/* Feeding log */}
              {tab === 'feeding' && (
                <div className={styles.section}>
                  <div className={styles.addRow}>
                    <select className="form-select" value={feedingForm.food_type} onChange={e => setFeedingForm(f => ({ ...f, food_type: e.target.value }))} style={{ flex: 1 }}>
                      <option value="wet">Wet</option>
                      <option value="dry">Dry</option>
                      <option value="both">Both</option>
                      <option value="treat">Treat</option>
                      <option value="other">Other</option>
                    </select>
                    <input className="form-input" placeholder="Amount (optional)" value={feedingForm.amount} onChange={e => setFeedingForm(f => ({ ...f, amount: e.target.value }))} style={{ flex: 1 }} />
                    <select className="form-select" value={feedingForm.ate_well ? 'yes' : 'no'} onChange={e => setFeedingForm(f => ({ ...f, ate_well: e.target.value === 'yes' }))} style={{ flex: 1 }}>
                      <option value="yes">Ate well ✓</option>
                      <option value="no">Didn't finish</option>
                    </select>
                    <input className="form-input" type="datetime-local" value={feedingForm.fed_at} onChange={e => setFeedingForm(f => ({ ...f, fed_at: e.target.value }))} style={{ flex: 1 }} />
                    <button className="btn-primary" onClick={addFeeding}>Log</button>
                  </div>
                  <div className="form-group" style={{ marginTop: 8 }}>
                    <input className="form-input" placeholder="Notes (optional)" value={feedingForm.notes} onChange={e => setFeedingForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>
                  {feedings.length === 0 ? (
                    <p className={styles.empty}>No feedings logged yet</p>
                  ) : feedings.map(f => (
                    <div key={f.id} className={`card ${styles.recordRow}`}>
                      <div className={styles.recordMain}>
                        <span className={styles.recordName}>{f.food_type}{f.amount ? ` — ${f.amount}` : ''}</span>
                        <span className={styles.recordMeta}>{formatDateTime(f.fed_at)}</span>
                        <span className={styles.recordMeta} style={{ color: f.ate_well ? 'var(--green-dark)' : '#b91c1c' }}>
                          {f.ate_well ? '✓ Ate well' : '⚠ Didn\'t finish'}
                        </span>
                        {f.notes && <span className={styles.recordNotes}>{f.notes}</span>}
                      </div>
                      <button className={styles.deleteBtn} onClick={() => deleteFeeding(f.id)}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Vaccinations */}
              {tab === 'vaccinations' && (
                <div className={styles.section}>
                  <div className={styles.addRow}>
                    <input className="form-input" placeholder="Vaccine name..." value={vacForm.name} onChange={e => setVacForm(f => ({ ...f, name: e.target.value }))} style={{ flex: 2 }} />
                    <input className="form-input" type="date" value={vacForm.date_given} onChange={e => setVacForm(f => ({ ...f, date_given: e.target.value }))} style={{ flex: 1 }} />
                    <input className="form-input" type="date" value={vacForm.next_due} onChange={e => setVacForm(f => ({ ...f, next_due: e.target.value }))} style={{ flex: 1 }} />
                    <button className="btn-primary" onClick={addVaccination}>Add</button>
                  </div>
                  <div className={styles.addRowLabels}>
                    <span style={{ flex: 2 }}>Name</span>
                    <span style={{ flex: 1 }}>Date given</span>
                    <span style={{ flex: 1 }}>Next due</span>
                  </div>
                  {vaccinations.length === 0 ? (
                    <p className={styles.empty}>No vaccinations recorded yet</p>
                  ) : vaccinations.map(v => (
                    <div key={v.id} className={`card ${styles.recordRow}`}>
                      <div className={styles.recordMain}>
                        <span className={styles.recordName}>{v.name}</span>
                        {v.date_given && <span className={styles.recordMeta}>Given: {v.date_given}</span>}
                        {v.next_due && (
                          <span className={`${styles.recordMeta} ${isOverdue(v.next_due) ? styles.overdue : isDueSoon(v.next_due) ? styles.dueSoon : ''}`}>
                            Due: {v.next_due} {isOverdue(v.next_due) ? '⚠️ overdue' : isDueSoon(v.next_due) ? '⏰ soon' : ''}
                          </span>
                        )}
                        {v.notes && <span className={styles.recordNotes}>{v.notes}</span>}
                      </div>
                      <button className={styles.deleteBtn} onClick={() => deleteVaccination(v.id)}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Weight */}
              {tab === 'weight' && (
                <div className={styles.section}>
                  <div className={styles.addRow}>
                    <input className="form-input" type="number" placeholder="Weight..." value={weightForm.weight} onChange={e => setWeightForm(f => ({ ...f, weight: e.target.value }))} style={{ flex: 1 }} />
                    <select className="form-select" value={weightForm.unit} onChange={e => setWeightForm(f => ({ ...f, unit: e.target.value }))} style={{ flex: 1 }}>
                      <option value="lbs">lbs</option>
                      <option value="kg">kg</option>
                    </select>
                    <input className="form-input" type="date" value={weightForm.recorded_at} onChange={e => setWeightForm(f => ({ ...f, recorded_at: e.target.value }))} style={{ flex: 1 }} />
                    <button className="btn-primary" onClick={addWeight}>Add</button>
                  </div>
                  {weights.length === 0 ? (
                    <p className={styles.empty}>No weight entries yet</p>
                  ) : weights.map(w => (
                    <div key={w.id} className={`card ${styles.recordRow}`}>
                      <div className={styles.recordMain}>
                        <span className={styles.recordName}>{w.weight} {w.unit}</span>
                        <span className={styles.recordMeta}>{w.recorded_at}</span>
                      </div>
                      <button className={styles.deleteBtn} onClick={() => deleteWeight(w.id)}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Catsitter card */}
              {tab === 'sitter' && (
                <div className={styles.section}>
                  <div className="card" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <SpeciesIcon species={selectedPet.species} size={20} style={{ color: 'var(--ink)' }} />
                      {selectedPet.name}'s Care Card
                    </div>

                    {selectedPet.feeding_routine ? (
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>🍽 Feeding Routine</div>
                        <p style={{ fontSize: '0.9rem', color: 'var(--ink)', lineHeight: 1.6 }}>{selectedPet.feeding_routine}</p>
                      </div>
                    ) : null}

                    {selectedPet.personality ? (
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>😸 Personality</div>
                        <p style={{ fontSize: '0.9rem', color: 'var(--ink)', lineHeight: 1.6 }}>{selectedPet.personality}</p>
                      </div>
                    ) : null}

                    {selectedPet.hiding_spots ? (
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>📍 Hiding Spots</div>
                        <p style={{ fontSize: '0.9rem', color: 'var(--ink)', lineHeight: 1.6 }}>{selectedPet.hiding_spots}</p>
                      </div>
                    ) : null}

                    {selectedPet.vet_name || selectedPet.vet_phone ? (
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>🏥 Vet</div>
                        <p style={{ fontSize: '0.9rem', color: 'var(--ink)' }}>{selectedPet.vet_name}{selectedPet.vet_phone ? ` · ${selectedPet.vet_phone}` : ''}</p>
                      </div>
                    ) : null}

                    {selectedPet.insurance_provider ? (
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>🛡 Insurance</div>
                        <p style={{ fontSize: '0.9rem', color: 'var(--ink)' }}>{selectedPet.insurance_provider}{selectedPet.insurance_policy ? ` · Policy: ${selectedPet.insurance_policy}` : ''}</p>
                      </div>
                    ) : null}

                    {selectedPet.notes ? (
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>📝 Other Notes</div>
                        <p style={{ fontSize: '0.9rem', color: 'var(--ink)', lineHeight: 1.6 }}>{selectedPet.notes}</p>
                      </div>
                    ) : null}

                    {!selectedPet.feeding_routine && !selectedPet.personality && !selectedPet.hiding_spots && !selectedPet.vet_name && !selectedPet.insurance_provider && !selectedPet.notes && (
                      <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)' }}>No catsitter info yet — edit this pet to add feeding routine, personality, and hiding spots.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Ask Dr. Groq */}
              {tab === 'troubleshoot' && (
                <div className={styles.section}>
                  <DrGroq pet={selectedPet} />
                </div>
              )}

            </div>
          )}
        </div>
      )}
    </div>
  )
}
