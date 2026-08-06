import type { TrackerLog, TrackerType } from '../types/tracker';
import type { IconName } from '../components/Icon';


export interface TrackerTypeConfig {
  type: TrackerType;
  label: string;
  icon?: IconName; // preferred - illustrated icon
  emoji?: string; // fallback for types with no matching illustrated icon yet (e.g. weight/scale)
  color: string; // CSS var, matches pollys cottagecore palette
  chartType: 'line' | 'bar';
  yAxisLabel: string;
  getChartValue: (log: TrackerLog) => number | null;
}

export const TRACKER_CONFIG: Record<TrackerType, TrackerTypeConfig> = {
  sleep: {
    type: 'sleep',
    label: 'Sleep',
    icon: 'moon-cloud',
    color: 'var(--green-dark)',
    chartType: 'bar',
    yAxisLabel: 'Hours',
    getChartValue: (log) => (log.value as any).hours ?? null,
  },
  period: {
    type: 'period',
    label: 'Cycle',
    icon: 'flower',
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
    icon: 'apple-carrot',
    color: 'var(--ink)',
    chartType: 'line',
    yAxisLabel: 'lbs',
    getChartValue: (log) => (log.value as any).weight_lbs ?? null,
  },
};
