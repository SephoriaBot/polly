import { useState, useEffect } from 'react';
import { upsertTrackerLog, getTrackerLog, deleteTrackerLog } from '../../lib/trackerApi';
import type { SleepValue } from '../../types/tracker';

interface Props {
  date: string; // YYYY-MM-DD
  onSaved?: () => void;
}

export default function SleepLogForm({ date, onSaved }: Props) {
  const [hoursInput, setHoursInput] = useState<string>('7');
  const [quality, setQuality] = useState<number>(3);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getTrackerLog('sleep', date).then((log) => {
      if (!active || !log) return;
      const v = log.value as SleepValue;
      setHoursInput(v.hours != null ? String(v.hours) : '');
      setQuality(v.quality);
    });
    return () => {
      active = false;
    };
  }, [date]);

  async function handleSave() {
    setSaving(true);
    try {
      const hours = hoursInput === '' ? 0 : Number(hoursInput);
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
    setHoursInput('7');
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
        value={hoursInput}
        onChange={(e) => setHoursInput(e.target.value)}
        onBlur={() => {
          if (hoursInput === '') return;
          const n = Number(hoursInput);
          if (Number.isNaN(n)) setHoursInput('0');
          else if (n < 0) setHoursInput('0');
          else if (n > 24) setHoursInput('24');
        }}
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


    </div>
  );
}
