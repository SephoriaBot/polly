import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { getTrackerLogsInRange } from '../../api/trackerApi';
import { TRACKER_CONFIG } from '../data/trackerConfig';
import type { TrackerType, TrackerLog, SleepValue, PeriodValue } from '../types/tracker';

interface Props {
  type: TrackerType;
  startDate: string;
  endDate: string;
  refreshKey?: number;
}

interface ChartPoint {
  date: string;
  primary: number | null;
  secondary?: number | null;
}

function parseValue(raw: unknown): any {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw ?? {};
}

export default function TrackerChart({ type, startDate, endDate, refreshKey }: Props) {
  const [logs, setLogs] = useState<TrackerLog[]>([]);
  const config = TRACKER_CONFIG[type];

  const loadLogs = async () => {
    const data = await getTrackerLogsInRange(type, startDate, endDate);
    setLogs(data);
  };

  useEffect(() => {
    loadLogs();
  }, [type, startDate, endDate, refreshKey]);

  if (logs.length === 0) {
    return (
      <p className="card">
        No {config.label.toLowerCase()} data logged for this range yet.
      </p>
    );
  }

  const chartData: ChartPoint[] = logs.map((log) => {
    const date = log.log_date.slice(5);
    const v = parseValue(log.value);
    if (type === 'sleep') {
      return {
        date,
        primary: typeof v.hours === 'number' ? v.hours : null,
        secondary: typeof v.quality === 'number' ? v.quality : null,
      };
    }
    if (type === 'period') {
      const moodScore =
        v.mood === 'good' ? 3 : v.mood === 'ok' ? 2 : v.mood === 'bad' ? 1 : null;
      return { date, primary: moodScore };
    }
    return { date, primary: typeof v.weight_lbs === 'number' ? v.weight_lbs : null };
  });

  const periodMarkers =
    type === 'period'
      ? logs
          .filter((l) => {
            const v = parseValue(l.value);
            return v.bleeding_start || v.bleeding_end;
          })
          .map((l) => {
            const v = parseValue(l.value);
            return { date: l.log_date.slice(5), kind: v.bleeding_start ? 'start' : 'end' };
          })
      : [];

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>
          {config.emoji} {config.label}
        </h3>
        <button className="btn-secondary" onClick={loadLogs}>
          🔄 Refresh
        </button>
      </div>

      {/* TEMPORARY DEBUG — remove once chart is confirmed working */}
      <pre style={{ fontSize: '10px', background: '#f4f4f4', padding: '6px', overflowX: 'auto' }}>
        {JSON.stringify(chartData, null, 2)}
      </pre>

      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" stroke="var(--ink)" fontSize={12} />
          <YAxis
            yAxisId="left"
            stroke="var(--ink)"
            fontSize={12}
            allowDecimals
            domain={[0, 'auto']}
            label={{ value: config.yAxisLabel, angle: -90, position: 'insideLeft' }}
          />
          {type === 'sleep' && (
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="var(--sage-dark)"
              fontSize={12}
              domain={[1, 5]}
              label={{ value: 'Quality', angle: 90, position: 'insideRight' }}
            />
          )}
          <Tooltip />
          <Legend />

          {type === 'sleep' && (
            <>
              <Bar yAxisId="left" dataKey="primary" name="Hours" fill={config.color} radius={[4, 4, 0, 0]} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="secondary"
                name="Quality"
                stroke="var(--sage-dark)"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            </>
          )}

          {type !== 'sleep' && (
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="primary"
              name={config.label}
              stroke={config.color}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          )}

          {periodMarkers.map((m, i) => (
            <ReferenceLine
              key={i}
              yAxisId="left"
              x={m.date}
              stroke={m.kind === 'start' ? 'var(--primary)' : 'var(--sage)'}
              strokeDasharray="4 4"
              label={{ value: m.kind === 'start' ? '🩸' : '✅', position: 'top' }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
