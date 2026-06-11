import { useEffect, useState } from 'react';
import { Plus, X, Droplets, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Plant, PlantLog, PlantType, LogAction } from '../types';
import { useToast } from '../hooks/useToast';

const PLANT_EMOJIS: Record<PlantType, string> = {
  herb: '🌿', flower: '🌸', succulent: '🪴', vegetable: '🥬', tropical: '🌴', other: '🌱',
};

const WATER_STATUS = (plant: Plant): { label: string; className: string } => {
  if (!plant.last_watered || !plant.watering_frequency_days) return { label: 'No schedule', className: '' };
  const diff = (Date.now() - new Date(plant.last_watered).getTime()) / 86400000;
  if (diff >= plant.watering_frequency_days) return { label: 'Needs water!', className: 'water-overdue' };
  if (diff >= plant.watering_frequency_days * 0.75) return { label: 'Water soon', className: 'water-soon' };
  return { label: 'Watered ✓', className: 'water-ok' };
};

export default function PlantsPage() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);
  const [logs, setLogs] = useState<PlantLog[]>([]);
  const { showToast } = useToast();

  const [form, setForm] = useState({ name: '', type: 'herb' as PlantType, notes: '', watering_frequency_days: '', location: '', emoji: '', acquired_date: '' });

  useEffect(() => { loadPlants(); }, []);

  async function loadPlants() {
    setLoading(true);
    const { data } = await supabase.from('plants').select('*').order('created_at', { ascending: false });
    setPlants(data || []);
    setLoading(false);
  }

  async function loadLogs(plantId: string) {
    const { data } = await supabase.from('plant_logs').select('*').eq('plant_id', plantId).order('logged_at', { ascending: false }).limit(20);
    setLogs(data || []);
  }

  async function addPlant() {
    if (!form.name.trim()) return;
    const { error } = await supabase.from('plants').insert({
      name: form.name.trim(),
      type: form.type,
      notes: form.notes || null,
      watering_frequency_days: form.watering_frequency_days ? parseInt(form.watering_frequency_days) : null,
      location: form.location || null,
      emoji: form.emoji || PLANT_EMOJIS[form.type],
      acquired_date: form.acquired_date || null,
    });
    if (error) { showToast('Error adding plant', 'error'); return; }
    showToast('Plant added!');
    setShowAdd(false);
    setForm({ name: '', type: 'herb', notes: '', watering_frequency_days: '', location: '', emoji: '', acquired_date: '' });
    loadPlants();
  }

  async function logAction(plantId: string, action: LogAction, note?: string) {
    await supabase.from('plant_logs').insert({ plant_id: plantId, action, note: note || null, logged_at: new Date().toISOString() });
    if (action === 'watered') {
      await supabase.from('plants').update({ last_watered: new Date().toISOString() }).eq('id', plantId);
    }
    showToast(`${action.charAt(0).toUpperCase() + action.slice(1)} logged!`);
    loadPlants();
    loadLogs(plantId);
  }

  async function deletePlant(id: string) {
    await supabase.from('plants').delete().eq('id', id);
    setSelectedPlant(null);
    showToast('Plant removed');
    loadPlants();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>My Garden 🌿</h2>
          <p>{plants.length} plant{plants.length !== 1 ? 's' : ''} growing</p>
        </div>
        <button className="btn btn-green" onClick={() => setShowAdd(true)}>
          <Plus size={15} /> Add Plant
        </button>
      </div>

      <div className="page-body">
        {loading ? (
          <div className="loading-spinner">Loading your garden…</div>
        ) : plants.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🌱</div>
            <h3>Your garden is empty</h3>
            <p>Add your first plant to start tracking waterings and care notes.</p>
            <button className="btn btn-green" onClick={() => setShowAdd(true)}><Plus size={14} /> Add Plant</button>
          </div>
        ) : (
          <div className="grid-3">
            {plants.map(plant => {
              const status = WATER_STATUS(plant);
              return (
                <div key={plant.id} className="card" style={{ cursor: 'pointer' }} onClick={() => { setSelectedPlant(plant); loadLogs(plant.id); }}>
                  <div className="card-body">
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                      <div className="plant-emoji">{plant.emoji || PLANT_EMOJIS[plant.type]}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 2 }}>{plant.name}</div>
                        <span className="badge badge-green">{plant.type}</span>
                      </div>
                    </div>
                    {plant.location && <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginBottom: 6 }}>📍 {plant.location}</div>}
                    <div className={`water-indicator ${status.className}`}>
                      <Droplets size={13} /> {status.label}
                      {plant.last_watered && <span style={{ color: 'var(--ink-muted)', marginLeft: 4, fontSize: '0.75rem' }}>
                        · {new Date(plant.last_watered).toLocaleDateString()}
                      </span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Plant Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add a Plant</h3>
              <button className="close-btn" onClick={() => setShowAdd(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Plant Name *</label>
                <input className="form-input" placeholder="e.g. Cilantro, Nasturtium" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select className="form-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as PlantType }))}>
                    <option value="herb">Herb</option>
                    <option value="flower">Flower</option>
                    <option value="succulent">Succulent</option>
                    <option value="vegetable">Vegetable</option>
                    <option value="tropical">Tropical</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Emoji (optional)</label>
                  <input className="form-input" placeholder="🌿" value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <input className="form-input" placeholder="e.g. Kitchen windowsill" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Water every (days)</label>
                  <input className="form-input" type="number" min="1" placeholder="e.g. 3" value={form.watering_frequency_days} onChange={e => setForm(f => ({ ...f, watering_frequency_days: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Date Acquired</label>
                <input className="form-input" type="date" value={form.acquired_date} onChange={e => setForm(f => ({ ...f, acquired_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" placeholder="Care tips, personality traits…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-green" onClick={addPlant}><Plus size={14} /> Add Plant</button>
            </div>
          </div>
        </div>
      )}

      {/* Plant Detail Modal */}
      {selectedPlant && (
        <div className="modal-overlay" onClick={() => setSelectedPlant(null)}>
          <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '1.8rem' }}>{selectedPlant.emoji || PLANT_EMOJIS[selectedPlant.type]}</span>
                <div>
                  <h3>{selectedPlant.name}</h3>
                  <span className="badge badge-green">{selectedPlant.type}</span>
                </div>
              </div>
              <button className="close-btn" onClick={() => setSelectedPlant(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
                {(['watered', 'fertilized', 'repotted', 'pruned'] as LogAction[]).map(action => (
                  <button key={action} className={`btn btn-sm ${action === 'watered' ? 'btn-green' : 'btn-secondary'}`}
                    onClick={() => logAction(selectedPlant.id, action)}>
                    {action === 'watered' && <Droplets size={13} />}
                    {action === 'fertilized' && '🌱'}
                    {action === 'repotted' && '🪴'}
                    {action === 'pruned' && '✂️'}
                    {action}
                  </button>
                ))}
              </div>

              {selectedPlant.notes && (
                <div style={{ background: 'var(--cream)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.875rem', color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                  {selectedPlant.notes}
                </div>
              )}

              <div style={{ display: 'flex', gap: 20, fontSize: '0.82rem', color: 'var(--ink-muted)', marginBottom: 16 }}>
                {selectedPlant.location && <span>📍 {selectedPlant.location}</span>}
                {selectedPlant.watering_frequency_days && <span><Droplets size={12} /> Every {selectedPlant.watering_frequency_days} day{selectedPlant.watering_frequency_days !== 1 ? 's' : ''}</span>}
                {selectedPlant.last_watered && <span><Check size={12} /> Last watered {new Date(selectedPlant.last_watered).toLocaleDateString()}</span>}
              </div>

              {logs.length > 0 && (
                <>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 10, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Care Log</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {logs.map(log => (
                      <div key={log.id} style={{ display: 'flex', gap: 10, fontSize: '0.85rem', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ color: 'var(--ink-muted)', minWidth: 90 }}>{new Date(log.logged_at).toLocaleDateString()}</span>
                        <span className="badge badge-green">{log.action}</span>
                        {log.note && <span style={{ color: 'var(--ink-soft)' }}>{log.note}</span>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <button className="btn btn-danger btn-sm" onClick={() => deletePlant(selectedPlant.id)}>Remove Plant</button>
              <button className="btn btn-ghost" onClick={() => setSelectedPlant(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
