import { supabase } from './supabase'
import type { TrackerType, TrackerValue, TrackerLog, CustomTrackerDef } from '../types/tracker';

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

// ── Custom trackers (user-defined, beyond the sleep/period/weight built-ins) ──

function slugify(label: string): string {
  const base = label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return `custom:${base || 'tracker'}-${Date.now().toString(36)}`;
}

export async function listCustomTrackers(): Promise<CustomTrackerDef[]> {
  const { data, error } = await supabase
    .from('custom_trackers')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row: any) => ({ id: row.id, label: row.label, unit: row.unit }));
}

export async function addCustomTracker(label: string, unit: string): Promise<CustomTrackerDef> {
  const id = slugify(label);
  const { data, error } = await supabase
    .from('custom_trackers')
    .insert({ id, label, unit })
    .select()
    .single();

  if (error) throw error;
  return { id: data.id, label: data.label, unit: data.unit };
}

export async function removeCustomTracker(id: string): Promise<void> {
  await supabase.from('tracker_logs').delete().eq('type', id);
  const { error } = await supabase.from('custom_trackers').delete().eq('id', id);
  if (error) throw error;
}
