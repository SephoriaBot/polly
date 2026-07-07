import { useState, useEffect } from 'react';
import SleepLogForm from '../components/tracker/SleepLogForm';
import PeriodLogForm from '../components/tracker/PeriodLogForm';
import WeightLogForm from '../components/tracker/WeightLogForm';
import TrackerChart from '../components/tracker/TrackerChart';
import TrackerOverlap from '../components/tracker/TrackerOverlap';
import { TRACKER_CONFIG } from '../data/trackerConfig';
import type { TrackerType, PeriodValue } from '../types/tracker';
import { getTrackerLogsInRange } from '../lib/trackerApi';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

type TabType = TrackerType | 'overlap';

export default function TrackerPage() {
  const [activeType, setActiveType] = useState<TabType>('sleep');
  const [date, setDate] = useState(todayISO());
  const [refreshKey, setRefreshKey] = useState(0);
  const [cycleDay, setCycleDay] = useState<number | null>(null);

  useEffect(() => {
    getTrackerLogsInRange('period', daysAgoISO(90), todayISO()).then((logs) => {
      const starts = logs
        .filter((l) => (l.value as PeriodValue).bleeding_start)
        .map((l) => l.log_date)
        .sort()
        .reverse();

      if (starts.length === 0) {
        setCycleDay(null);
        return;
      }
      const lastStart = new Date(starts[0]);
      const diff =
        Math.floor((Date.now() - lastStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      setCycleDay(diff);
    });
  }, [refreshKey]);

  function handleSaved() {
    setRefreshKey((k) => k + 1);
  }

  return (
    <div>
      <h1>Tracker</h1>

      {cycleDay !== null && (
        <div className="card" style={{ background: 'var(--blush)' }}>
          🌸 Day {cycleDay} of your cycle
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0', flexWrap: 'wrap' }}>
        {(Object.keys(TRACKER_CONFIG) as TrackerType[]).map((type) => (
          <button
            key={type}
            className={activeType === type ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setActiveType(type)}
          >
            {TRACKER_CONFIG[type].emoji} {TRACKER_CONFIG[type].label}
          </button>
        ))}
        <button
          className={activeType === 'overlap' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setActiveType('overlap')}
        >
          🔗 Overlap
        </button>
      </div>

      {activeType !== 'overlap' && (
        <>
          <label className="form-label">Date</label>
          <input
            className="form-input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={todayISO()}
          />

          {activeType === 'sleep' && <SleepLogForm date={date} onSaved={handleSaved} />}
          {activeType === 'period' && <PeriodLogForm date={date} onSaved={handleSaved} />}
          {activeType === 'weight' && <WeightLogForm date={date} onSaved={handleSaved} />}

          <TrackerChart
            type={activeType}
            startDate={daysAgoISO(30)}
            endDate={todayISO()}
            refreshKey={refreshKey}
          />
        </>
      )}

      {activeType === 'overlap' && <TrackerOverlap refreshKey={refreshKey} />}
    </div>
  );
}
