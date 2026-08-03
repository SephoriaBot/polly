import { useState, useEffect } from 'react';
import Icon from '../components/Icon';
import type { IconName } from '../components/Icon';
import SleepLogForm from '../components/tracker/SleepLogForm';
import PeriodLogForm from '../components/tracker/PeriodLogForm';
import WeightLogForm from '../components/tracker/WeightLogForm';
import CustomLogForm from '../components/tracker/CustomLogForm';
import TrackerChart from '../components/tracker/TrackerChart';
import TrackerOverlap from '../components/tracker/TrackerOverlap';
import { TRACKER_CONFIG } from '../data/trackerConfig';
import type { TrackerType, PeriodValue, CustomTrackerDef } from '../types/tracker';
import { getTrackerLogsInRange, listCustomTrackers, addCustomTracker, removeCustomTracker } from '../lib/trackerApi';
import { getMoonPhase, MOON_ICON_BY_PHASE, type MoonPhase } from '../lib/almanac';
import Lantern from "../components/Lantern";

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
  const [periodEnded, setPeriodEnded] = useState(false);
  const [cycleMoon, setCycleMoon] = useState<{ start: MoonPhase | null; end: MoonPhase | null }>({
    start: null,
    end: null,
  });
  const [customTrackers, setCustomTrackers] = useState<CustomTrackerDef[]>([]);
  const [showAddTracker, setShowAddTracker] = useState(false);
  const [newTrackerLabel, setNewTrackerLabel] = useState('');
  const [newTrackerUnit, setNewTrackerUnit] = useState('');
  const [savingTracker, setSavingTracker] = useState(false);

  useEffect(() => {
    listCustomTrackers().then(setCustomTrackers).catch((e) => console.error('failed to load custom trackers', e));
  }, []);

  async function handleAddTracker() {
    const label = newTrackerLabel.trim();
    if (!label) return;
    setSavingTracker(true);
    try {
      const def = await addCustomTracker(label, newTrackerUnit.trim());
      setCustomTrackers((prev) => [...prev, def]);
      setActiveType(def.id);
      setNewTrackerLabel('');
      setNewTrackerUnit('');
      setShowAddTracker(false);
    } catch (e) {
      console.error('failed to add custom tracker', e);
    } finally {
      setSavingTracker(false);
    }
  }

  async function handleRemoveTracker(def: CustomTrackerDef) {
    if (!window.confirm(`Remove "${def.label}" and all its logged entries? This can't be undone.`)) return;
    await removeCustomTracker(def.id);
    setCustomTrackers((prev) => prev.filter((t) => t.id !== def.id));
    if (activeType === def.id) setActiveType('sleep');
  }

  useEffect(() => {
    getTrackerLogsInRange('period', daysAgoISO(90), todayISO()).then((logs) => {
      const starts = logs
        .filter((l) => (l.value as PeriodValue).bleeding_start)
        .map((l) => l.log_date)
        .sort()
        .reverse();

      if (starts.length === 0) {
        setCycleDay(null);
        setPeriodEnded(false);
        setCycleMoon({ start: null, end: null });
        return;
      }

      const lastStartDate = starts[0];
      const lastStart = new Date(lastStartDate);
      const diff =
        Math.floor((Date.now() - lastStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      setCycleDay(diff);

      const endLog = logs
        .filter((l) => (l.value as PeriodValue).bleeding_end && l.log_date >= lastStartDate)
        .map((l) => l.log_date)
        .sort()[0];

      setPeriodEnded(!!endLog);
      setCycleMoon({
        start: getMoonPhase(new Date(`${lastStartDate}T12:00:00Z`)),
        end: endLog ? getMoonPhase(new Date(`${endLog}T12:00:00Z`)) : null,
      });
    });
  }, [refreshKey]);

  function handleSaved() {
    setRefreshKey((k) => k + 1);
  }

  const activeCustomTracker = customTrackers.find((t) => t.id === activeType);

  return (
    <div>
      <div className="page-header">
        <div className="title-row">
          <h1>Tracker</h1>
          <Lantern />
        </div>
      </div>

      {cycleDay !== null && (
        <div className="card" style={{ background: 'var(--blush)' }}>
          <div>
            <Icon name="flower" size={16} /> Day {cycleDay} of your cycle{periodEnded ? ' · period ended' : ''}
          </div>
          {(cycleMoon.start || cycleMoon.end) && (
            <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {cycleMoon.start && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Icon name={(MOON_ICON_BY_PHASE[cycleMoon.start.phaseName] ?? 'moon-cloud') as IconName} size={14} />
                  Started under {cycleMoon.start.phaseName} ({cycleMoon.start.illuminationPct}%)
                </span>
              )}
              {cycleMoon.end && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Icon name={(MOON_ICON_BY_PHASE[cycleMoon.end.phaseName] ?? 'moon-cloud') as IconName} size={14} />
                  Ended under {cycleMoon.end.phaseName} ({cycleMoon.end.illuminationPct}%)
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0', flexWrap: 'wrap' }}>
        {(Object.keys(TRACKER_CONFIG) as TrackerType[]).map((type) => (
          <button
            key={type}
            className={activeType === type ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setActiveType(type)}
          >
            {TRACKER_CONFIG[type].icon
              ? <Icon name={TRACKER_CONFIG[type].icon!} size={16} />
              : TRACKER_CONFIG[type].emoji} {TRACKER_CONFIG[type].label}
          </button>
        ))}
        {customTrackers.map((t) => (
          <button
            key={t.id}
            className={activeType === t.id ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setActiveType(t.id)}
          >
            {t.label}
          </button>
        ))}
        <button
          className={activeType === 'overlap' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setActiveType('overlap')}
        >
          <Icon name="calculator" size={16} /> Overlap
        </button>
        <button className="btn-secondary" onClick={() => setShowAddTracker((s) => !s)}>
          <Icon name="icon-plus" size={16} /> Add Tracker
        </button>
      </div>

      {showAddTracker && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h4>New Custom Tracker</h4>
          <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginBottom: 8 }}>
            Track anything with a single daily number — water intake, pages read, mood score, whatever's useful to you.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              className="form-input" type="text" placeholder="Name (e.g. Water Intake)"
              value={newTrackerLabel} onChange={(e) => setNewTrackerLabel(e.target.value)}
              style={{ width: 200 }}
            />
            <input
              className="form-input" type="text" placeholder="Unit (e.g. cups)"
              value={newTrackerUnit} onChange={(e) => setNewTrackerUnit(e.target.value)}
              style={{ width: 140 }}
            />
            <button className="btn-primary" onClick={handleAddTracker} disabled={savingTracker || !newTrackerLabel.trim()}>
              {savingTracker ? 'Adding…' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {activeCustomTracker && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button className="btn-secondary" onClick={() => handleRemoveTracker(activeCustomTracker)}>
            <Icon name="icon-trash2" size={14} /> Remove "{activeCustomTracker.label}"
          </button>
        </div>
      )}

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
          {activeCustomTracker && (
            <CustomLogForm
              type={activeCustomTracker.id}
              label={activeCustomTracker.label}
              unit={activeCustomTracker.unit}
              date={date}
              onSaved={handleSaved}
            />
          )}

          <TrackerChart
            type={activeType}
            startDate={daysAgoISO(30)}
            endDate={todayISO()}
            refreshKey={refreshKey}
            label={activeCustomTracker?.label}
            unit={activeCustomTracker?.unit}
          />
        </>
      )}

      {activeType === 'overlap' && <TrackerOverlap refreshKey={refreshKey} />}
    </div>
  );
}