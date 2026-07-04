export type TrackerType = 'sleep' | 'period' | 'weight';

export interface SleepValue {
  hours: number;
  quality: number; // 1-5
}

export interface PeriodValue {
  mood: 'good' | 'ok' | 'bad';
  cramping: boolean;
  bleeding_start: boolean;
  bleeding_end: boolean;
}

export interface WeightValue {
  weight_lbs: number;
}

export type TrackerValue = SleepValue | PeriodValue | WeightValue;

export interface TrackerLog {
  id: string;
  user_id: string;
  type: TrackerType;
  log_date: string; // YYYY-MM-DD
  value: TrackerValue;
  note: string | null;
  created_at: string;
}
