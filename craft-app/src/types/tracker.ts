// Built-in tracker types ship with Polly by default. Custom trackers (added
// by the user in Settings) use dynamic ids of the form `custom:<slug>`, so
// TrackerType is widened to string to allow those alongside the built-ins.
export type BuiltInTrackerType = 'sleep' | 'period' | 'weight';
export type TrackerType = BuiltInTrackerType | string;

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

// Generic single-number value used by all user-defined custom trackers
// (e.g. "Water Intake", "Mood Score", "Pages Read" — whatever someone wants
// to track that isn't one of the built-ins).
export interface CustomValue {
  value: number;
}

export type TrackerValue = SleepValue | PeriodValue | WeightValue | CustomValue;

export interface TrackerLog {
  id: string;
  user_id: string;
  type: TrackerType;
  log_date: string; // YYYY-MM-DD
  value: TrackerValue;
  note: string | null;
  created_at: string;
}

// A user-defined custom tracker's metadata (name/unit), stored separately
// from the logged values themselves.
export interface CustomTrackerDef {
  id: string; // "custom:<slug>"
  label: string;
  unit: string;
}
