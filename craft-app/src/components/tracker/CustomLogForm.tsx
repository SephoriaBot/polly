import { useState, useEffect } from 'react';
import { upsertTrackerLog, getTrackerLog } from '../../lib/trackerApi';
import type { CustomValue } from '../../types/tracker';

interface Props {
  type: string; // "custom:<slug>"
  label: string;
  unit: string;
  date: string;
  onSaved?: () => void;
}

export default function CustomLogForm({ type, label, unit, date, onSaved }: Props) {
  const [input, setInput] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getTrackerLog(type, date).then((log) => {
      if (!active || !log) return;
      const v = (log.value as CustomValue).value;
      setInput(v != null ? String(v) : '');
    });
    return () => {
      active = false;
    };
  }, [type, date]);

  async function handleSave() {
    setSaving(true);
    try {
      const value = input === '' ? 0 : Number(input);
      await upsertTrackerLog(type, date, { value });
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h3>{label} — {date}</h3>
      <label className="form-label">{unit ? `${label} (${unit})` : label}</label>
      <input
        className="form-input"
        type="number"
        step={0.1}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onBlur={() => {
          if (input === '') return;
          const n = Number(input);
          if (Number.isNaN(n)) setInput('0');
        }}
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
