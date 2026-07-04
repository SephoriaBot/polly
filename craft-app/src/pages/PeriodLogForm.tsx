import { useState, useEffect } from 'react';
import { upsertTrackerLog, getTrackerLog } from '../../api/trackerApi';
import type { PeriodValue } from '../types/tracker';

interface Props {
  date: string;
  onSaved?: () => void;
}

const MOODS: { value: PeriodValue['mood']; label: string }[] = [
  { value: 'good', label: '🙂 Good' },
  { value: 'ok', label: '😐 Ok' },
  { value: 'bad', label: '🙁 Bad' },
];

export default function PeriodLogForm({ date, onSaved }: Props) {
  const [mood, setMood] = useState<PeriodValue['mood']>('ok');
  const [cramping, setCramping] = useState(false);
  const [bleedingStart, setBleedingStart] = useState(false);
  const [bleedingEnd, setBleedingEnd] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getTrackerLog('period', date).then((log) => {
      if (!active || !log) return;
      const v = log.value as PeriodValue;
      setMood(v.mood);
      setCramping(v.cramping);
      setBleedingStart(v.bleeding_start);
      setBleedingEnd(v.bleeding_end);
    });
    return () => {
      active = false;
    };
  }, [date]);

  async function handleSave() {
    setSaving(true);
    try {
      await upsertTrackerLog('period', date, {
        mood,
        cramping,
        bleeding_start: bleedingStart,
        bleeding_end: bleedingEnd,
      });
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h3>Cycle — {date}</h3>

      <h1>Mood</h1>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {MOODS.map((m) => (
          <button
            key={m.value}
            type="button"
            className={mood === m.value ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setMood(m.value)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <label
        className="card-body"
        style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
      >
        <input
          type="checkbox"
          checked={cramping}
          onChange={(e) => setCramping(e.target.checked)}
        />
        Cramping today
      </label>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={bleedingStart ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setBleedingStart((v) => !v)}
        >
          🩸 Period started today
        </button>
        <button
          type="button"
          className={bleedingEnd ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setBleedingEnd((v) => !v)}
        >
          ✅ Period ended today
        </button>
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
