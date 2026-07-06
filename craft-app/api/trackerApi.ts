import { supabase } from '../src/lib/supabase.js'
import { TrackerType, TrackerValue, TrackerLog } from '../src/types/tracker.js'

export async function upsertTrackerLog(
  type: TrackerType,
  logDate: string,
  value: TrackerValue,
  note: string | null = null
): Promise<TrackerLog> {
  const { data, error } = await supabase
    .from('tracker_logs')
    .upsert(
      { type, log_date: logDate, value, note },
      { onConflict: 'type,log_date' }
    )
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as TrackerLog;
}

export async function getTrackerLog(
  type: TrackerType,
  logDate: string
): Promise<TrackerLog | null> {
  const { data, error } = await supabase
    .from('tracker_logs')
    .select('*')
    .eq('type', type)
    .eq('log_date', logDate)
    .maybeSingle();

  if (error) throw error;
  return data as TrackerLog | null;
}

export async function getTrackerLogsInRange(
  type: TrackerType,
  startDate: string,
  endDate: string
): Promise<TrackerLog[]> {
  const { data, error } = await supabase
    .from('tracker_logs')
    .select('*')
    .eq('type', type)
    .gte('log_date', startDate)
    .lte('log_date', endDate)
    .order('log_date', { ascending: true });

  if (error) throw error;
  return (data ?? []) as TrackerLog[];
}

export async function deleteTrackerLog(type: TrackerType, logDate: string): Promise<void> {
  const { error } = await supabase
    .from('tracker_logs')
    .delete()
    .eq('type', type)
    .eq('log_date', logDate);

  if (error) throw error;
}

