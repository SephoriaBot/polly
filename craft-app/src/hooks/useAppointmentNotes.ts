import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase'; // NOTE: adjust path to your actual client
import type {
  AppointmentNoteItem,
  AppointmentNoteType,
  AppointmentNoteKind,
} from '../types/appointmentNotes';

interface UseAppointmentNotesResult {
  items: AppointmentNoteItem[];
  carryOverItems: AppointmentNoteItem[];
  carryOverApptId: string | null;
  loading: boolean;
  error: string | null;
  addItem: (kind: AppointmentNoteKind, content: string) => Promise<void>;
  toggleBringUpCovered: (item: AppointmentNoteItem) => Promise<void>;
  toggleHomeworkDone: (item: AppointmentNoteItem) => Promise<void>;
  saveResolution: (itemId: string, resolution: string) => Promise<void>;
  carryOverItem: (item: AppointmentNoteItem) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Loads and manages appointment note items for a single appointment, plus
 * finds carry-over candidates from the most recent *other* appointment of
 * the same note_type that still has open "bring_up" items.
 */
export function useAppointmentNotes(
  appointmentId: string,
  noteType: AppointmentNoteType,
  onChange?: () => void
): UseAppointmentNotesResult {
  const [items, setItems] = useState<AppointmentNoteItem[]>([]);
  const [carryOverItems, setCarryOverItems] = useState<AppointmentNoteItem[]>([]);
  const [carryOverApptId, setCarryOverApptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('appointment_note_items')
      .select('*')
      .eq('appointment_id', appointmentId)
      .order('created_at', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setItems(data ?? []);
    setLoading(false);
  }, [appointmentId]);

  const loadCarryOver = useCallback(async () => {
    // Find open bring_up items belonging to a *different* appointment of
    // the same note_type, most recently updated first. This is a v1
    // simplification: it orders by when the item was last touched rather
    // than the appointment's actual date, since we're not joining to the
    // appointments table here. Once appointment dates are wired in, swap
    // this for an ordered join on appointment date instead.
        const { data, error: fetchError } = await supabase
      .from('appointment_note_items')
      .select('*')
      .eq('note_type', noteType)
      .eq('kind', 'bring_up')
      .eq('status', 'open')
      .or(`appointment_id.neq.${appointmentId},appointment_id.is.null`)
      .order('updated_at', { ascending: false })
      .limit(20);


    if (fetchError) {
      setError(fetchError.message);
      return;
    }

    const rows = data ?? [];
    const sourceApptId = rows[0]?.appointment_id ?? null;
    setCarryOverApptId(sourceApptId);
    setCarryOverItems(sourceApptId ? rows.filter((r) => r.appointment_id === sourceApptId) : []);
  }, [appointmentId, noteType]);

  const refresh = useCallback(async () => {
    await Promise.all([loadItems(), loadCarryOver()]);
  }, [loadItems, loadCarryOver]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addItem = useCallback(
    async (kind: AppointmentNoteKind, content: string) => {
      if (!content.trim()) return;

      const { data, error: insertError } = await supabase
        .from('appointment_note_items')
        .insert({
          appointment_id: appointmentId,
          note_type: noteType,
          kind,
          content: content.trim(),
          status: 'open',
        })
        .select()
        .single();

      if (insertError) {
        setError(insertError.message);
        return;
      }

      setItems((prev) => [...prev, data]);
      onChange?.();
    },
    [appointmentId, noteType, onChange]
  );

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

  const carryOverItem = useCallback(
    async (item: AppointmentNoteItem) => {
      // Insert a fresh item on the current appointment, linked back to the
      // original for lineage.
      const { data: inserted, error: insertError } = await supabase
        .from('appointment_note_items')
        .insert({
          appointment_id: appointmentId,
          note_type: noteType,
          kind: 'bring_up',
          content: item.content,
          status: 'open',
          carried_from_id: item.id,
        })
        .select()
        .single();

      if (insertError) {
        setError(insertError.message);
        return;
      }

      setItems((prev) => [...prev, inserted]);
      onChange?.();

      // Mark the original as covered so it stops showing up as a carry-over
      // candidate next time, while keeping a record of why it closed.
      const { error: updateError } = await supabase
        .from('appointment_note_items')
        .update({ status: 'covered', resolution: `Carried forward to this appointment (${appointmentId})` })
        .eq('id', item.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setCarryOverItems((prev) => prev.filter((i) => i.id !== item.id));
    },
    [appointmentId, noteType, onChange]
  );

  const removeItem = useCallback(async (itemId: string) => {
    const { error: deleteError } = await supabase.from('appointment_note_items').delete().eq('id', itemId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setItems((prev) => prev.filter((i) => i.id !== itemId));
  }, []);

  return {
    items,
    carryOverItems,
    carryOverApptId,
    loading,
    error,
    addItem,
    toggleBringUpCovered,
    toggleHomeworkDone,
    saveResolution,
    carryOverItem,
    removeItem,
    refresh,
  };
}
