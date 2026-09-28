import { useEffect, useState } from 'react';
import Icon from '../Icon';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TRACKER_CONFIG } from '../../data/trackerConfig';
import type { TrackerType } from '../../types/tracker';
import { getTrackerLogsInRange } from '../../lib/trackerApi';
import { localDateKey, localDaysAgoKey } from '../../lib/dateKey';

interface OverlapPoint {
  log_date: string;
  a: number | null;
  b: number | null;
}

function pearsonCorrelation(pairs: [number, number][]): number | null {
  const n = pairs.length;
  if (n < 3) return null;
  const xs = pairs.map((p) => p[0]);
  const ys = pairs.map((p) => p[1]);
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
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
  const den = Math.sqrt(denX * denY);
  if (den === 0) return null;
  return num / den;
}

function interpretR(r: number): string {
  const abs = Math.abs(r);
  const dir = r > 0 ? 'move together' : 'move oppositely';
  if (abs < 0.1) return 'No real relationship';
  if (abs < 0.3) return `Weak tendency to ${dir}`;
  if (abs < 0.5) return `Moderate tendency to ${dir}`;
  if (abs < 0.7) return `Strong tendency to ${dir}`;
  return `Very strong tendency to ${dir}`;
}

function todayISO() {
  return localDateKey();
}
function daysAgoISO(days: number) {
  return localDaysAgoKey(days);
}

const ALL_TYPES = Object.keys(TRACKER_CONFIG) as TrackerType[];

export default function TrackerOverlap({ refreshKey = 0 }: { refreshKey?: number }) {
  const [metricA, setMetricA] = useState<TrackerType>('sleep');
  const [metricB, setMetricB] = useState<TrackerType>('weight');
  const [rangeDays, setRangeDays] = useState(30);
  const [points, setPoints] = useState<OverlapPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const start = daysAgoISO(rangeDays);
    const end = todayISO();

    Promise.all([
      getTrackerLogsInRange(metricA, start, end),
      getTrackerLogsInRange(metricB, start, end),
    ]).then(([logsA, logsB]) => {
      const map = new Map<string, OverlapPoint>();

      for (const log of logsA) {
        const val = TRACKER_CONFIG[metricA].getChartValue(log);
        map.set(log.log_date, { log_date: log.log_date, a: val, b: null });
      }
      for (const log of logsB) {
        const val = TRACKER_CONFIG[metricB].getChartValue(log);
        const existing = map.get(log.log_date);
        if (existing) existing.b = val;
        else map.set(log.log_date, { log_date: log.log_date, a: null, b: val });
      }

      const merged = Array.from(map.values()).sort((x, y) =>
        x.log_date.localeCompare(y.log_date)
      );
      setPoints(merged);
      setLoading(false);
    });
  }, [metricA, metricB, rangeDays, refreshKey]);

  const pairs: [number, number][] = points
    .filter((p) => p.a !== null && p.b !== null)
    .map((p) => [p.a as number, p.b as number]);

  const r = pearsonCorrelation(pairs);
  const sameMetric = metricA === metricB;
  const configA = TRACKER_CONFIG[metricA];
  const configB = TRACKER_CONFIG[metricB];

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label className="form-label">Metric A</label>
          <select
            className="form-input"
            value={metricA}
            onChange={(e) => setMetricA(e.target.value as TrackerType)}
          >
            {ALL_TYPES.map((t) => (
              <option key={t} value={t}>
                {TRACKER_CONFIG[t].emoji} {TRACKER_CONFIG[t].label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label className="form-label">Metric B</label>
          <select
            className="form-input"
            value={metricB}
            onChange={(e) => setMetricB(e.target.value as TrackerType)}
          >
            {ALL_TYPES.map((t) => (
              <option key={t} value={t}>
                {TRACKER_CONFIG[t].emoji} {TRACKER_CONFIG[t].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', margin: '0 0 1rem' }}>
        {[30, 90, 180].map((d) => (
          <button
            key={d}
            className={rangeDays === d ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setRangeDays(d)}
          >
            {d}d
          </button>
        ))}
      </div>

      {sameMetric && (
        <div className="card" style={{ background: 'var(--blush)' }}>
          Pick two different metrics to compare <Icon name="flower" size={16} />
        </div>
      )}

      {!sameMetric && !loading && (
        <>
          <div className="card" style={{ background: 'var(--blush)', marginBottom: '1rem' }}>
            {r === null ? (
              <>Not enough overlapping data yet — log both on the same days to see a correlation.</>
            ) : (
              <>
                r = {r.toFixed(2)} — {interpretR(r)} between {configA.label} and {configB.label}
              </>
            )}
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={points}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="log_date" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" label={{ value: configA.yAxisLabel, angle: -90, position: 'insideLeft' }} />
              <YAxis
                yAxisId="right"
                orientation="right"
                label={{ value: configB.yAxisLabel, angle: 90, position: 'insideRight' }}
              />
              <Tooltip />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="a"
                name={`${configA.emoji} ${configA.label}`}
                stroke={configA.color}
                connectNulls
                dot={{ r: 3 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="b"
                name={`${configB.emoji} ${configB.label}`}
                stroke={configB.color}
                connectNulls
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}
