import { useEffect, useState } from 'react';
import { useAppointments } from '../../hooks/useAppointments';
import { supabase } from '../../lib/supabase';
import { DEFAULT_NOTE_TYPES } from '../../types/appointmentNotes';
import type { AppointmentNoteType } from '../../types/appointmentNotes';
import styles from './CreateAppointmentNote.module.css';
import Icon, { type IconName } from '../Icon';

interface CreateAppointmentNoteProps {
  onCreate: (appointmentId: string, noteType: AppointmentNoteType, appointmentLabel: string) => void;
  onCancel: () => void;
}

export default function CreateAppointmentNote({ onCreate, onCancel }: CreateAppointmentNoteProps) {
  const { appointments, loading, error } = useAppointments();

  const [appointmentId, setAppointmentId] = useState('');
  const [existingType, setExistingType] = useState<AppointmentNoteType | null>(null);
  const [checkingType, setCheckingType] = useState(false);

  const [noteType, setNoteType] = useState<AppointmentNoteType | null>(null);
  const [customType, setCustomType] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const selectedAppt = appointments.find((a) => a.id === appointmentId);

  // Whenever a different appointment is picked, check whether it already
  // has notes started — if so, reuse that note_type automatically instead
  // of asking again. This is what was causing "other" types to get lost:
  // the type was never remembered per appointment before.
  useEffect(() => {
    if (!appointmentId) {
      setExistingType(null);
      setNoteType(null);
      return;
    }

    let cancelled = false;
    setCheckingType(true);

    supabase
      .from('appointment_note_items')
      .select('note_type')
      .eq('appointment_id', appointmentId)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const found = data?.note_type ?? null;
        setExistingType(found);
        setNoteType(found);
        setShowCustomInput(false);
        setCustomType('');
        setCheckingType(false);
      });

    return () => {
      cancelled = true;
    };
  }, [appointmentId]);

  const chooseType = (type: AppointmentNoteType) => {
    setNoteType(type);
    setShowCustomInput(false);
  };

  const confirmCustomType = () => {
    if (!customType.trim()) return;
    setNoteType(customType.trim().toLowerCase());
    setShowCustomInput(false);
  };

  const handleCreate = () => {
    if (!noteType || !appointmentId) return;
    onCreate(appointmentId, noteType, selectedAppt?.title ?? '');
  };

  return (
    <div className={styles.panel}>
      <div className={styles.sectionLabel}>Which appointment?</div>

      {loading && <p className={styles.helperText}>Loading your appointments…</p>}
      {error && <p className={styles.errorText}>{error}</p>}

      {!loading && !error && (
        <div className={styles.selectWrap}>
          <select
            className={styles.select}
            value={appointmentId}
            onChange={(e) => setAppointmentId(e.target.value)}
          >
            <option value="">Select from your planner…</option>
            {appointments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title} — {new Date(a.date_time).toLocaleDateString()}
              </option>
            ))}
          </select>
          <Icon name="icon-chevrondown" size={16} className={styles.selectChevron} />
        </div>
      )}

      {!loading && !error && appointments.length === 0 && (
        <p className={styles.helperText}>
          No appointments found yet — add one to your planner first.
        </p>
      )}

      {appointmentId && checkingType && (
        <p className={styles.helperText}>Checking for existing notes…</p>
      )}

      {appointmentId && !checkingType && existingType && (
        <p className={styles.helperText}>
          <Icon name="_extra-unnamed-heart" size={12} style={{ verticalAlign: '-1px', marginRight: 4 }} />
          This appointment already has "{existingType}" notes — picking up where you left off.
        </p>
      )}

      {appointmentId && !checkingType && !existingType && (
        <>
          <div className={styles.sectionLabel}>What type of appointment?</div>

          <div className={styles.typeRow}>
            {DEFAULT_NOTE_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className={`${styles.typeChip} ${noteType === type ? styles.typeChipActive : ''}`}
                onClick={() => chooseType(type)}
              >
                {type}
              </button>
            ))}

            {noteType && !DEFAULT_NOTE_TYPES.includes(noteType) && (
              <button type="button" className={`${styles.typeChip} ${styles.typeChipActive}`}>
                {noteType}
              </button>
            )}

            <button
              type="button"
              className={styles.typeChipAdd}
              onClick={() => setShowCustomInput((s) => !s)}
            >
              <Icon name="icon-plus" size={13} /> other
            </button>
          </div>

          {showCustomInput && (
            <div className={styles.customTypeRow}>
              <input
                className={styles.customTypeInput}
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && confirmCustomType()}
                placeholder="e.g. dentist, vet…"
              />
              <button type="button" className={styles.smallConfirmButton} onClick={confirmCustomType}>
                Use
              </button>
            </div>
          )}
        </>
      )}

      <div className={styles.actionRow}>
        <button type="button" className={styles.cancelButton} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={styles.confirmButton}
          disabled={!noteType || !appointmentId}
          onClick={handleCreate}
        >
          Start notes
        </button>
      </div>
    </div>
  );
}
