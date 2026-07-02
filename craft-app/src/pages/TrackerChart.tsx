import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { getTrackerLogsInRange } from '../../api/trackerApi';
import { TRACKER_CONFIG } from '../data/trackerConfig';
import { TrackerType } from '../types';

interface Props {
  type: TrackerType;
  startDate: string;
  endDate: string;
  refreshKey?: number;
}

interface ChartPoint {
  date: string;
  value: number | null;
}

export default function TrackerChart({ type, startDate, endDate, refreshKey }: Props) {
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const config = TRACKER_CONFIG[type];

  useEffect(() => {
    let active = true;
    getTrackerLogsInRange(type, startDate, endDate).then((logs) => {
      if (!active) return;
      setChartData(
        logs.map((log) => ({
          date: log.log_date.slice(5), // MM-DD
          value: config.getChartValue(log),
        }))
      );
    });
    return () => {
      active = false;
    };
  }, [type, startDate, endDate, refreshKey]);

  if (chartData.length === 0) {
    return (
      <p className="card">
        No {config.label.toLowerCase()} data logged for this range yet.
      </p>
    );
  }

  return (
    <div className="card">
      <h3>
        {config.emoji} {config.label}
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        {config.chartType === 'bar' ? (
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--blush)" />
            <XAxis dataKey="date" stroke="var(--ink)" fontSize={12} />
            <YAxis
              stroke="var(--ink)"
              fontSize={12}
              label={{ value: config.yAxisLabel, angle: -90, position: 'insideLeft' }}
            />
            <Tooltip />
            <Bar dataKey="value" fill={config.color} radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--blush)" />
            <XAxis dataKey="date" stroke="var(--ink)" fontSize={12} />
            <YAxis
              stroke="var(--ink)"
              fontSize={12}
              label={{ value: config.yAxisLabel, angle: -90, position: 'insideLeft' }}
            />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="value"
              stroke={config.color}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
