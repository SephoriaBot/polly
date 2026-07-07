import { useState, useEffect } from 'react';
import { upsertTrackerLog, getTrackerLog } from '../../lib/trackerApi';
import type { WeightValue } from '../../types/tracker';


interface Props {
  date: string;
  onSaved?: () => void;
}

export default function WeightLogForm({ date, onSaved }: Props) {
  const [weight, setWeight] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getTrackerLog('weight', date).then((log) => {
      if (!active || !log) return;
      setWeight((log.value as WeightValue).weight_lbs);
    });
    return () => {
      active = false;
    };
  }, [date]);

  async function handleSave() {
    setSaving(true);
    try {
      await upsertTrackerLog('weight', date, { weight_lbs: weight });
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h3>Weight — {date}</h3>
      <label className="form-label">Weight (lbs)</label>
      <input
        className="form-input"
        type="number"
        step={0.1}
        value={weight}
        onChange={(e) => setWeight(Number(e.target.value))}
      />
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
