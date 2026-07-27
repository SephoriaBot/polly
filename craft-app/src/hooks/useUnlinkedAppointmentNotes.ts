import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { AppointmentNoteItem } from '../types/appointmentNotes';

interface UseUnlinkedAppointmentNotesResult {
  items: AppointmentNoteItem[];
  loading: boolean;
  error: string | null;
  toggleBringUpCovered: (item: AppointmentNoteItem) => Promise<void>;
  toggleHomeworkDone: (item: AppointmentNoteItem) => Promise<void>;
  saveResolution: (itemId: string, resolution: string) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  linkToAppointment: (itemIds: string[], appointmentId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Notes whose appointment was deleted (appointment_id set to null by the
 * ON DELETE SET NULL FK). These have no home in the regular per-appointment
 * view, so this hook powers a standalone "Unlinked notes" browser instead.
 */
export function useUnlinkedAppointmentNotes(): UseUnlinkedAppointmentNotesResult {
  const [items, setItems] = useState<AppointmentNoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('appointment_note_items')
      .select('*')
      .is('appointment_id', null)
      .order('note_type', { ascending: true })
      .order('created_at', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setItems(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateItem = useCallback(async (itemId: string, patch: Partial<AppointmentNoteItem>) => {
    const { data, error: updateError } = await supabase
      .from('appointment_note_items')
      .update(patch)
      .eq('id', itemId)
      .select()
      .single();

    if (updateError) {
      setError(updateError.message);
      return null;
    }

    setItems((prev) => prev.map((i) => (i.id === itemId ? data : i)));
    return data as AppointmentNoteItem;
  }, []);

  const toggleBringUpCovered = useCallback(
    async (item: AppointmentNoteItem) => {
      await updateItem(item.id, { status: item.status === 'covered' ? 'open' : 'covered' });
    },
    [updateItem]
  );

  const toggleHomeworkDone = useCallback(
    async (item: AppointmentNoteItem) => {
      await updateItem(item.id, { status: item.status === 'done' ? 'open' : 'done' });
    },
    [updateItem]
  );

  const saveResolution = useCallback(
    async (itemId: string, resolution: string) => {
      await updateItem(itemId, { resolution });
    },
    [updateItem]
  );

  const removeItem = useCallback(async (itemId: string) => {
    const { error: deleteError } = await supabase.from('appointment_note_items').delete().eq('id', itemId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setItems((prev) => prev.filter((i) => i.id !== itemId));
  }, []);

  // Re-homes a whole note_type group of orphaned notes onto a (usually
  // newly-created) appointment in one shot. Once linked they're no longer
  // "unlinked", so drop them from this list rather than waiting on a full
  // refresh.
  const linkToAppointment = useCallback(async (itemIds: string[], appointmentId: string) => {
    if (!appointmentId || itemIds.length === 0) return;

    const { error: updateError } = await supabase
      .from('appointment_note_items')
      .update({ appointment_id: appointmentId })
      .in('id', itemIds);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    const idSet = new Set(itemIds);
    setItems((prev) => prev.filter((i) => !idSet.has(i.id)));
  }, []);

  return {
    items,
    loading,
    error,
    toggleBringUpCovered,
    toggleHomeworkDone,
    saveResolution,
    removeItem,
    linkToAppointment,
    refresh,
  };
}
