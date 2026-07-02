import { supabase } from '../lib/supabase';
import { TrackerLog, TrackerType, TrackerValue } from '../types';

export async function upsertTrackerLog(
  type: TrackerType,
  logDate: string,
  value: TrackerValue,
  note: string | null = null
): Promise<TrackerLog> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('tracker_logs')
    .upsert(
      { user_id: userId, type, log_date: logDate, value, note },
      { onConflict: 'user_id,type,log_date' }
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
