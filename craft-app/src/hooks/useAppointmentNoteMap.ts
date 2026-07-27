import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { AppointmentNoteType } from '../types/appointmentNotes';

interface UseAppointmentNoteMapResult {
  map: Record<string, AppointmentNoteType>;
  refresh: () => Promise<void>;
}

/**
 * Given a list of appointment ids, returns a map of which ones already
 * have notes started, and what note_type each is using. Used to show a
 * "view note" indicator on scheduled appointments in the planner.
 *
 * This only re-fetches on its own when the appointment id list changes —
 * it has no way of knowing when a note gets added or linked elsewhere on
 * the page (e.g. in AppointmentNotesPanel below it). Callers that create
 * or link notes should call `refresh()` afterwards so the indicator
 * actually shows up without a full page reload.
 */
export function useAppointmentNoteMap(appointmentIds: string[]): UseAppointmentNoteMapResult {
  const [map, setMap] = useState<Record<string, AppointmentNoteType>>({});
  const idsKey = appointmentIds.join(',');

  const refresh = useCallback(async () => {
    if (appointmentIds.length === 0) {
      setMap({});
      return;
    }

    const { data } = await supabase
      .from('appointment_note_items')
      .select('appointment_id, note_type')
      .in('appointment_id', appointmentIds);

    if (!data) return;

    const next: Record<string, AppointmentNoteType> = {};
    for (const row of data) {
      if (row.appointment_id && !next[row.appointment_id]) {
        next[row.appointment_id] = row.note_type;
      }
    }
    setMap(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { map, refresh };
}
