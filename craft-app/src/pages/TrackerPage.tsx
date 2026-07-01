import { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
// Adjust this import to wherever Homebody's Supabase client lives,
// e.g. '../lib/supabaseClient' or '../supabaseClient'
import { supabase } from '../lib/supabase';

import './TrackerPage.css';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

type TrackerType = 'sleep' | 'period' | 'weight';

interface TrackerEntry {
  id: string;
  tracker_type: TrackerType;
  entry_date: string; // YYYY-MM-DD
  value_numeric: number | null;
  details: Record<string, any> | null;
  note: string | null;
}

interface TrackerPreference {
  tracker_type: TrackerType;
  enabled: boolean;
  unit: string | null;
}

const TRACKER_META: Record<
  TrackerType,
  { label: string; emoji: string; color: string }
> = {
  sleep: { label: 'Sleep', emoji: '🌙', color: '#8d7aa8' },
  period: { label: 'Period Cycle', emoji: '🌸', color: '#d99a8f' },
  weight: { label: 'Weight', emoji: '⚖️', color: '#7f9463' },
};

const todayStr = () => new Date().toISOString().slice(0, 10);

// ------------------------------------------------------------------
// Root page
// ------------------------------------------------------------------

export default function TrackerPage() {
  const [prefs, setPrefs] = useState<TrackerPreference[]>([]);
  const [entries, setEntries] = useState<TrackerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [managing, setManaging] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [{ data: prefData }, { data: entryData }] = await Promise.all([
      supabase.from('tracker_preferences').select('tracker_type, enabled, unit'),
      supabase
        .from('tracker_entries')
        .select('id, tracker_type, entry_date, value_numeric, details, note')
        .order('entry_date', { ascending: true }),
    ]);
    setPrefs(prefData ?? []);
    setEntries(entryData ?? []);
    setLoading(false);
  }

  const enabledTypes = useMemo(
    () => prefs.filter((p) => p.enabled).map((p) => p.tracker_type),
    [prefs]
  );

  async function saveTrackerSelection(selected: TrackerType[]) {
    const rows = (Object.keys(TRACKER_META) as TrackerType[]).map((type) => ({
      tracker_type: type,
      enabled: selected.includes(type),
    }));
    const { error } = await supabase
      .from('tracker_preferences')
      .upsert(rows, { onConflict: 'tracker_type' });
    if (!error) {
      setManaging(false);
      loadAll();
    }
  }

  async function addEntry(
    type: TrackerType,
    payload: Partial<TrackerEntry> & { entry_date: string }
  ) {
    const { error } = await supabase.from('tracker_entries').upsert(
      {
        tracker_type: type,
        ...payload,
      },
      { onConflict: 'tracker_type,entry_date' }
    );
    if (!error) loadAll();
  }

  if (loading) {
    return <div className="tracker-page">Loading your trackers…</div>;
  }

  const showPicker = managing || enabledTypes.length === 0;

  return (
    <div className="tracker-page">
      <div className="tracker-page__header">
        <h1 className="tracker-page__title">Trackers</h1>
        {enabledTypes.length > 0 && !managing && (
          <button
            className="tracker-page__manage-btn"
            onClick={() => setManaging(true)}
          >
            Manage
          </button>
        )}
      </div>

      {showPicker ? (
        <TrackerPicker
          initiallySelected={enabledTypes}
          onSave={saveTrackerSelection}
          onCancel={enabledTypes.length > 0 ? () => setManaging(false) : undefined}
        />
      ) : (
        <>
          {enabledTypes.map((type) => (
            <TrackerCard
              key={type}
              type={type}
              entries={entries.filter((e) => e.tracker_type === type)}
              onAdd={(payload) => addEntry(type, payload)}
            />
          ))}
          {enabledTypes.length >= 2 && (
            <CorrelationSection enabledTypes={enabledTypes} entries={entries} />
          )}
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Picker
// ------------------------------------------------------------------

function TrackerPicker({
  initiallySelected,
  onSave,
  onCancel,
}: {
  initiallySelected: TrackerType[];
  onSave: (selected: TrackerType[]) => void;
  onCancel?: () => void;
}) {
  const [selected, setSelected] = useState<TrackerType[]>(initiallySelected);

  function toggle(type: TrackerType) {
    setSelected((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  return (
    <div className="tracker-picker">
      <p className="tracker-picker__prompt">What do you want to track?</p>
      <div className="tracker-picker__options">
        {(Object.keys(TRACKER_META) as TrackerType[]).map((type) => (
          <div
            key={type}
            className={
              'tracker-option' +
              (selected.includes(type) ? ' tracker-option--selected' : '')
            }
            onClick={() => toggle(type)}
          >
            <span className="tracker-option__emoji">
              {TRACKER_META[type].emoji}
            </span>
            <span className="tracker-option__label">
              {TRACKER_META[type].label}
            </span>
          </div>
        ))}
      </div>
      <button
        className="tracker-picker__save"
        disabled={selected.length === 0}
        onClick={() => onSave(selected)}
      >
        Save trackers
      </button>
      {onCancel && (
        <button
          className="tracker-page__manage-btn"
          style={{ marginLeft: 8 }}
          onClick={onCancel}
        >
          Cancel
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Card dispatcher
// ------------------------------------------------------------------

function TrackerCard({
  type,
  entries,
  onAdd,
}: {
  type: TrackerType;
  entries: TrackerEntry[];
  onAdd: (payload: Partial<TrackerEntry> & { entry_date: string }) => void;
}) {
  const meta = TRACKER_META[type];
  return (
    <div className={`tracker-card tracker-card--${type}`}>
      <div className="tracker-card__body">
        <div className="tracker-card__head">
          <h2 className="tracker-card__title">
            {meta.emoji} {meta.label}
          </h2>
          <span className="tracker-card__stat">
            {statLine(type, entries)}
          </span>
        </div>

        {type === 'sleep' && <SleepForm onAdd={onAdd} />}
        {type === 'period' && <PeriodForm onAdd={onAdd} />}
        {type === 'weight' && <WeightForm onAdd={onAdd} />}

        {entries.length === 0 ? (
          <p className="tracker-card__empty">No entries yet — log your first one above 🌱</p>
        ) : (
          <TrackerChart type={type} entries={entries} />
        )}
      </div>
    </div>
  );
}

function statLine(type: TrackerType, entries: TrackerEntry[]): string {
  if (entries.length === 0) return '';
  const last = entries[entries.length - 1];
  if (type === 'sleep') return `Last: ${last.value_numeric}h`;
  if (type === 'weight') {
    const prev = entries[entries.length - 2];
    if (!prev || last.value_numeric == null || prev.value_numeric == null) {
      return `Last: ${last.value_numeric}`;
    }
    const diff = last.value_numeric - prev.value_numeric;
    const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
    return `Last: ${last.value_numeric} (${arrow}${Math.abs(diff).toFixed(1)})`;
  }
  if (type === 'period') {
    const starts = entries.filter((e) => e.details?.event === 'start');
    if (starts.length === 0) return '';
    const lastStart = new Date(starts[starts.length - 1].entry_date);
    const cycleDay =
      Math.floor((Date.now() - lastStart.getTime()) / 86400000) + 1;
    return `Cycle day ${cycleDay}`;
  }
  return '';
}

// ------------------------------------------------------------------
// Forms
// ------------------------------------------------------------------

function SleepForm({
  onAdd,
}: {
  onAdd: (payload: Partial<TrackerEntry> & { entry_date: string }) => void;
}) {
  const [hours, setHours] = useState('');
  const [quality, setQuality] = useState(3);
  const [date, setDate] = useState(todayStr());

  function submit() {
    if (!hours) return;
    onAdd({
      entry_date: date,
      value_numeric: parseFloat(hours),
      details: { quality },
    });
    setHours('');
  }

  return (
    <div className="tracker-form">
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <input
        type="number"
        step="0.5"
        min="0"
        max="24"
        placeholder="Hours"
        value={hours}
        onChange={(e) => setHours(e.target.value)}
      />
      <div className="tracker-form__quality">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={
              'tracker-form__star' +
              (n <= quality ? ' tracker-form__star--active' : '')
            }
            onClick={() => setQuality(n)}
          >
            ★
          </span>
        ))}
      </div>
      <button
        className="tracker-form__submit"
        disabled={!hours}
        onClick={submit}
      >
        Log
      </button>
    </div>
  );
}

function PeriodForm({
  onAdd,
}: {
  onAdd: (payload: Partial<TrackerEntry> & { entry_date: string }) => void;
}) {
  const [date, setDate] = useState(todayStr());
  const [flow, setFlow] = useState('medium');

  function logStart() {
    onAdd({ entry_date: date, details: { event: 'start', flow } });
  }

  function logDay() {
    onAdd({ entry_date: date, details: { event: 'day', flow } });
  }

  return (
    <div className="tracker-form">
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <select value={flow} onChange={(e) => setFlow(e.target.value)}>
        <option value="spotting">Spotting</option>
        <option value="light">Light</option>
        <option value="medium">Medium</option>
        <option value="heavy">Heavy</option>
      </select>
      <button className="tracker-form__submit" onClick={logDay}>
        Log day
      </button>
      <button className="tracker-form__submit" onClick={logStart}>
        Period started
      </button>
    </div>
  );
}

function WeightForm({
  onAdd,
}: {
  onAdd: (payload: Partial<TrackerEntry> & { entry_date: string }) => void;
}) {
  const [value, setValue] = useState('');
  const [date, setDate] = useState(todayStr());

  function submit() {
    if (!value) return;
    onAdd({ entry_date: date, value_numeric: parseFloat(value) });
    setValue('');
  }

  return (
    <div className="tracker-form">
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <input
        type="number"
        step="0.1"
        placeholder="Weight"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button
        className="tracker-form__submit"
        disabled={!value}
        onClick={submit}
      >
        Log
      </button>
    </div>
  );
}

// ------------------------------------------------------------------
// Chart (single tracker)
// ------------------------------------------------------------------

function TrackerChart({
  type,
  entries,
}: {
  type: TrackerType;
  entries: TrackerEntry[];
}) {
  const recent = entries.slice(-30);

  const data =
    type === 'period'
      ? cycleLengthData(recent)
      : recent.map((e) => ({
          date: e.entry_date.slice(5), // MM-DD
          value: e.value_numeric,
        }));

  const yLabel = type === 'sleep' ? 'hrs' : type === 'weight' ? '' : 'days';

  return (
    <div className="tracker-card__chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4d9c8" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis tick={{ fontSize: 11 }} width={40} unit={yLabel ? ` ${yLabel}` : ''} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="value"
            stroke={TRACKER_META[type].color}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Turns raw "period start" entries into cycle-length data points
// (days between consecutive start dates), which is more useful to
// graph than raw daily logs.
function cycleLengthData(entries: TrackerEntry[]) {
  const starts = entries
    .filter((e) => e.details?.event === 'start')
    .map((e) => e.entry_date)
    .sort();

  const points: { date: string; value: number }[] = [];
  for (let i = 1; i < starts.length; i++) {
    const prev = new Date(starts[i - 1]);
    const curr = new Date(starts[i]);
    const days = Math.round((curr.getTime() - prev.getTime()) / 86400000);
    points.push({ date: starts[i].slice(5), value: days });
  }
  return points;
}

// ------------------------------------------------------------------
// Correlation section — how trackers relate to each other
// ------------------------------------------------------------------

// Builds a per-date numeric value for a tracker so different
// tracker types can be compared on a shared timeline:
//   sleep  -> hours slept that night
//   weight -> logged weight that day
//   period -> day-of-cycle (days since the most recent period start,
//             1 = start day), which is what you'd actually want to
//             correlate against sleep/weight, not raw flow logs
function dailySeries(type: TrackerType, entries: TrackerEntry[]): Map<string, number> {
  const map = new Map<string, number>();

  if (type === 'sleep' || type === 'weight') {
    entries.forEach((e) => {
      if (e.value_numeric != null) map.set(e.entry_date, e.value_numeric);
    });
    return map;
  }

  // period -> cycle day per date
  const starts = entries
    .filter((e) => e.details?.event === 'start')
    .map((e) => e.entry_date)
    .sort();
  if (starts.length === 0) return map;

  const allDates = entries.map((e) => e.entry_date).sort();
  const earliest = allDates[0];
  const latest = allDates[allDates.length - 1];

  let cursor = new Date(earliest);
  const end = new Date(latest);
  let currentStartIdx = -1;

  while (cursor <= end) {
    const dateStr = cursor.toISOString().slice(0, 10);
    while (
      currentStartIdx + 1 < starts.length &&
      starts[currentStartIdx + 1] <= dateStr
    ) {
      currentStartIdx++;
    }
    if (currentStartIdx >= 0) {
      const start = new Date(starts[currentStartIdx]);
      const day = Math.round((cursor.getTime() - start.getTime()) / 86400000) + 1;
      map.set(dateStr, day);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return map;
}

function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 4) return null;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  if (denX === 0 || denY === 0) return null;
  return num / Math.sqrt(denX * denY);
}

function interpretR(r: number): string {
  const abs = Math.abs(r);
  const strength =
    abs < 0.2 ? 'negligible' : abs < 0.4 ? 'weak' : abs < 0.6 ? 'moderate' : abs < 0.8 ? 'strong' : 'very strong';
  const direction = r > 0 ? 'positive' : r < 0 ? 'negative' : 'no';
  return `${strength} ${direction} correlation`;
}

function CorrelationSection({
  enabledTypes,
  entries,
}: {
  enabledTypes: TrackerType[];
  entries: TrackerEntry[];
}) {
  const pairs: [TrackerType, TrackerType][] = [];
  for (let i = 0; i < enabledTypes.length; i++) {
    for (let j = i + 1; j < enabledTypes.length; j++) {
      pairs.push([enabledTypes[i], enabledTypes[j]]);
    }
  }

  return (
    <div className="correlation-section">
      <h2 className="correlation-section__title">How they relate</h2>
      {pairs.map(([a, b]) => (
        <CorrelationCard key={`${a}-${b}`} a={a} b={b} entries={entries} />
      ))}
    </div>
  );
}

function CorrelationCard({
  a,
  b,
  entries,
}: {
  a: TrackerType;
  b: TrackerType;
  entries: TrackerEntry[];
}) {
  const seriesA = dailySeries(a, entries.filter((e) => e.tracker_type === a));
  const seriesB = dailySeries(b, entries.filter((e) => e.tracker_type === b));

  const sharedDates = [...seriesA.keys()]
    .filter((d) => seriesB.has(d))
    .sort();

  const chartData = sharedDates.map((d) => ({
    date: d.slice(5),
    a: seriesA.get(d)!,
    b: seriesB.get(d)!,
  }));

  const r =
    chartData.length >= 4
      ? pearson(
          chartData.map((p) => p.a),
          chartData.map((p) => p.b)
        )
      : null;

  const metaA = TRACKER_META[a];
  const metaB = TRACKER_META[b];

  return (
    <div className="correlation-card">
      <div className="correlation-card__head">
        <span className="correlation-card__pair">
          {metaA.emoji} {metaA.label} <span className="correlation-card__vs">vs</span> {metaB.emoji} {metaB.label}
        </span>
        {r != null ? (
          <span className="correlation-card__r">
            r = {r.toFixed(2)} <em>({interpretR(r)})</em>
          </span>
        ) : (
          <span className="correlation-card__r correlation-card__r--muted">
            not enough overlapping data yet
          </span>
        )}
      </div>

      {chartData.length >= 2 && (
        <div className="tracker-card__chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4d9c8" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis yAxisId="a" tick={{ fontSize: 11 }} width={34} />
              <YAxis yAxisId="b" orientation="right" tick={{ fontSize: 11 }} width={34} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                yAxisId="a"
                type="monotone"
                dataKey="a"
                name={metaA.label}
                stroke={metaA.color}
                strokeWidth={2}
                dot={{ r: 2 }}
              />
              <Line
                yAxisId="b"
                type="monotone"
                dataKey="b"
                name={metaB.label}
                stroke={metaB.color}
                strokeWidth={2}
                dot={{ r: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
