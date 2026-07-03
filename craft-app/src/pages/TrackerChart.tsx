import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { getTrackerLogsInRange, deleteTrackerLog } from '../../api/trackerApi';
import type { TrackerType, TrackerLog, PeriodValue } from '../types/tracker';

interface Props {
  type: TrackerType;
  startDate: string;
  endDate: string;
  refreshKey?: number;
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
  const [deletingDate, setDeletingDate] = useState<string | null>(null);

  const loadLogs = async () => {
    const data = await getTrackerLogsInRange(type, startDate, endDate);
    setLogs(data);
  };

  useEffect(() => {
    loadLogs();
  }, [type, startDate, endDate, refreshKey]);

  async function handleDeleteEntry(logDate: string) {
    await deleteTrackerLog(type, logDate);
    setDeletingDate(null);
    loadLogs();
  }

  function EntriesList() {
    if (logs.length === 0) return null;
    return (
      <div className="card" style={{ marginTop: '1rem' }}>
        <h4>Entries</h4>
        {logs
          .slice()
          .reverse()
          .map((log) => (
            <div
              key={log.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span>{log.log_date}</span>
              {deletingDate === log.log_date ? (
                <span style={{ display: 'inline-flex', gap: '0.4rem' }}>
                  <button className="btn-primary" onClick={() => handleDeleteEntry(log.log_date)}>
                    Confirm
                  </button>
                  <button className="btn-secondary" onClick={() => setDeletingDate(null)}>
                    Cancel
                  </button>
                </span>
              ) : (
                <button className="btn-secondary" onClick={() => setDeletingDate(log.log_date)}>
                  🗑️
                </button>
              )}
            </div>
          ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return <p className="card">No data logged for this range yet.</p>;
  }

  if (type === 'sleep') {
    const hoursData = logs.map((l) => ({
      date: l.log_date.slice(5),
      hours: parseValue(l.value).hours ?? 0,
    }));
    const qualityData = logs.map((l) => ({
      date: l.log_date.slice(5),
      quality: parseValue(l.value).quality ?? 0,
    }));

    return (
      <>
        <div className="card">
          <h3>🌙 Sleep — Hours</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={hoursData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="hours" fill="#2f6b4f" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          <h3 style={{ marginTop: '1rem' }}>🌙 Sleep — Quality</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={qualityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" fontSize={12} />
              <YAxis domain={[1, 5]} fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey="quality" stroke="#5f7a5c" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <EntriesList />
      </>
    );
  }

  if (type === 'period') {
    const moodData = logs.map((l) => {
      const v = parseValue(l.value) as PeriodValue;
      const score = v.mood === 'good' ? 3 : v.mood === 'ok' ? 2 : v.mood === 'bad' ? 1 : 0;
      return { date: l.log_date.slice(5), mood: score };
    });
    const markers = logs
      .filter((l) => {
        const v = parseValue(l.value) as PeriodValue;
        return v.bleeding_start || v.bleeding_end;
      })
      .map((l) => {
        const v = parseValue(l.value) as PeriodValue;
        return { date: l.log_date.slice(5), kind: v.bleeding_start ? 'start' : 'end' };
      });

    return (
      <>
        <div className="card">
          <h3>🌸 Cycle — Mood</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={moodData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" fontSize={12} />
              <YAxis domain={[1, 3]} ticks={[1, 2, 3]} fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey="mood" stroke="#e0789a" strokeWidth={2} dot={{ r: 4 }} />
              {markers.map((m, i) => (
                <ReferenceLine
                  key={i}
                  x={m.date}
                  stroke={m.kind === 'start' ? '#e0789a' : '#8ba888'}
                  strokeDasharray="4 4"
                  label={m.kind === 'start' ? '🩸' : '✅'}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <EntriesList />
      </>
    );
  }

  const weightData = logs.map((l) => ({
    date: l.log_date.slice(5),
    weight: parseValue(l.value).weight_lbs ?? 0,
  }));

  return (
    <>
      <div className="card">
        <h3>⚖️ Weight</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={weightData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip />
            <Line type="monotone" dataKey="weight" stroke="#3b2f2a" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <EntriesList />
    </>
  );
}
