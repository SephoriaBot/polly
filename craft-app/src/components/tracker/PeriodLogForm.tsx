import { useState, useEffect } from 'react';
import { upsertTrackerLog, getTrackerLog } from '../../lib/trackerApi';
import { getMoonPhase } from '../../lib/almanac';
import Icon, { type IconName } from '../Icon';
import type { PeriodValue } from '../../types/tracker';
interface Props {
  date: string;
  onSaved?: () => void;
}

const MOODS: { value: PeriodValue['mood']; label: string; icon: IconName }[] = [
  { value: 'good', label: 'Good', icon: 'mood-happy' },
  { value: 'ok', label: 'Ok', icon: 'mood-neutral' },
  { value: 'bad', label: 'Bad', icon: 'mood-sad' },
];

export default function PeriodLogForm({ date, onSaved }: Props) {
  const [mood, setMood] = useState<PeriodValue['mood']>('ok');
  const [cramping, setCramping] = useState(false);
  const [bleedingStart, setBleedingStart] = useState(false);
  const [bleedingEnd, setBleedingEnd] = useState(false);
  const [saving, setSaving] = useState(false);

  const moon = getMoonPhase(new Date(`${date}T12:00:00Z`));

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
            <Icon name={m.icon} size={16} /> {m.label}
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
          <Icon name="heart-medical" size={16} /> Period started today
        </button>
        <button
          type="button"
          className={bleedingEnd ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setBleedingEnd((v) => !v)}
        >
          <Icon name="clipboard-check" size={16} /> Period ended today
        </button>
      </div>

      {(bleedingStart || bleedingEnd) && (
        <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: '0.4rem' }}>
          🌙 {moon.phaseName} · {moon.illuminationPct}% illuminated
        </div>
      )}

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
