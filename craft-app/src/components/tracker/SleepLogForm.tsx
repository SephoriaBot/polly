import { useState, useEffect } from 'react';
import { upsertTrackerLog, getTrackerLog, deleteTrackerLog } from '../../lib/trackerApi';
import type { SleepValue } from '../../types/tracker';

interface Props {
  date: string; // YYYY-MM-DD
  onSaved?: () => void;
}

export default function SleepLogForm({ date, onSaved }: Props) {
  const [hours, setHours] = useState<number>(7);
  const [quality, setQuality] = useState<number>(3);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getTrackerLog('sleep', date).then((log) => {
      if (!active || !log) return;
      const v = log.value as SleepValue;
      setHours(v.hours);
      setQuality(v.quality);
    });
    return () => {
      active = false;
    };
  }, [date]);

  async function handleSave() {
    setSaving(true);
    try {
      await upsertTrackerLog('sleep', date, { hours, quality });
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

async function handleDelete() {
  if (!confirm('Delete this sleep entry?')) return;
  setSaving(true);
  try {
    await deleteTrackerLog('sleep', date);
    setHours(7);
    setQuality(3);
    onSaved?.();
  } finally {
    setSaving(false);
  }
}


  return (
    <div className="card">
      <h3>Sleep — {date}</h3>

      <label className="form-label">Hours slept</label>
      <input
        className="form-input"
        type="number"
        step={0.5}
        min={0}
        max={24}
        value={hours}
        onChange={(e) => setHours(Number(e.target.value))}
      />

      <label className="form-label">Quality</label>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {[1, 2, 3, 4, 5].map((q) => (
          <button
            key={q}
            type="button"
            className={quality === q ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setQuality(q)}
          >
            {q}
          </button>
        ))}
      </div>

      <button
        className="btn-primary"
        onClick={handleSave}
        disabled={saving}
        style={{ marginTop: '0.75rem' }}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>

<button
  className="btn-secondary"
  onClick={handleDelete}
  disabled={saving}
  style={{ marginTop: '0.75rem', marginLeft: '0.5rem' }}
>
  🗑️ Delete
</button>

    </div>
  );
}
