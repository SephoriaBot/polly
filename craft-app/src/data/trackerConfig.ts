import type { TrackerLog, TrackerType } from '../types/tracker';


export interface TrackerTypeConfig {
  type: TrackerType;
  label: string;
  emoji: string;
  color: string; // CSS var, matches Homebody's cottagecore palette
  chartType: 'line' | 'bar';
  yAxisLabel: string;
  getChartValue: (log: TrackerLog) => number | null;
}

export const TRACKER_CONFIG: Record<TrackerType, TrackerTypeConfig> = {
  sleep: {
    type: 'sleep',
    label: 'Sleep',
    emoji: '🌙',
    color: 'var(--green-dark)',
    chartType: 'bar',
    yAxisLabel: 'Hours',
    getChartValue: (log) => (log.value as any).hours ?? null,
  },
  period: {
    type: 'period',
    label: 'Cycle',
    emoji: '🌸',
    color: 'var(--pink)',
    chartType: 'line',
    yAxisLabel: 'Mood',
    getChartValue: (log) => {
      const mood = (log.value as any).mood;
      if (mood === 'good') return 3;
      if (mood === 'ok') return 2;
      if (mood === 'bad') return 1;
      return null;
    },
  },
  weight: {
    type: 'weight',
    label: 'Weight',
    emoji: '⚖️',
    color: 'var(--ink)',
    chartType: 'line',
    yAxisLabel: 'lbs',
    getChartValue: (log) => (log.value as any).weight_lbs ?? null,
  },
};
