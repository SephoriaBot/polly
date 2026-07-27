import { useEffect, useRef, useState } from 'react';
import { Plus, Sprout, Archive } from 'lucide-react';
import CreateAppointmentNote from './CreateAppointmentNote';
import AppointmentNotes from './AppointmentNotes';
import UnlinkedNotes from './UnlinkedNotes';
import { useUnlinkedAppointmentNotes } from '../../hooks/useUnlinkedAppointmentNotes';
import type { AppointmentNoteType } from '../../types/appointmentNotes';
import styles from './AppointmentNotesPanel.module.css';

export interface AppointmentNoteSelection {
  appointmentId: string;
  noteType: AppointmentNoteType;
  label: string;
}

interface AppointmentNotesPanelProps {
  externalSelection?: AppointmentNoteSelection | null;
  onExternalSelectionConsumed?: () => void;
}

export default function AppointmentNotesPanel({
  externalSelection,
  onExternalSelectionConsumed,
}: AppointmentNotesPanelProps) {
  const [creating, setCreating] = useState(false);
  const [viewingUnlinked, setViewingUnlinked] = useState(false);
  const [selectedApptId, setSelectedApptId] = useState<string | null>(null);
  const [selectedNoteType, setSelectedNoteType] = useState<AppointmentNoteType | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string>('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Also drives the "Unlinked notes" badge count below, so the button and
  // the view it opens always agree with each other.
  const unlinked = useUnlinkedAppointmentNotes();

  const handleCreate = (appointmentId: string, noteType: AppointmentNoteType, label: string) => {
    setViewingUnlinked(false);
    setSelectedApptId(appointmentId);
    setSelectedNoteType(noteType);
    setSelectedLabel(label);
    setCreating(false);
  };

  // Respond to "view this appointment's note" requests coming from the
  // Upcoming appointments list.
  useEffect(() => {
    if (!externalSelection) return;

    setCreating(false);
    setViewingUnlinked(false);
    setSelectedApptId(externalSelection.appointmentId);
    setSelectedNoteType(externalSelection.noteType);
    setSelectedLabel(externalSelection.label);

    wrapperRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    onExternalSelectionConsumed?.();
  }, [externalSelection, onExternalSelectionConsumed]);

  const openUnlinked = () => {
    setCreating(false);
    setSelectedApptId(null);
    setSelectedNoteType(null);
    setViewingUnlinked(true);
  };

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <div className={styles.header}>
        <Sprout size={20} className={styles.headerIcon} />
        <span className={styles.headerLabel}>Appointment Notes</span>
      </div>

      <div className={styles.actionRow}>
        {!creating && !viewingUnlinked && (
          <button type="button" className={styles.newButton} onClick={() => setCreating(true)}>
            <Plus size={14} /> New note
          </button>
        )}

        {!creating && !unlinked.loading && unlinked.items.length > 0 && (
          <button type="button" className={styles.unlinkedButton} onClick={openUnlinked}>
            <Archive size={14} /> Unlinked notes ({unlinked.items.length})
          </button>
        )}
      </div>

      {creating && (
        <CreateAppointmentNote onCreate={handleCreate} onCancel={() => setCreating(false)} />
      )}

      {viewingUnlinked && (
        <UnlinkedNotes
          items={unlinked.items}
          loading={unlinked.loading}
          error={unlinked.error}
          toggleBringUpCovered={unlinked.toggleBringUpCovered}
          toggleHomeworkDone={unlinked.toggleHomeworkDone}
          saveResolution={unlinked.saveResolution}
          removeItem={unlinked.removeItem}
          linkToAppointment={unlinked.linkToAppointment}
          onWriteNewInstead={() => {
            setViewingUnlinked(false);
            setCreating(true);
          }}
        />
      )}

      {!creating && !viewingUnlinked && selectedApptId && selectedNoteType && (
        <AppointmentNotes
          appointmentId={selectedApptId}
          appointmentLabel={selectedLabel}
          noteType={selectedNoteType}
        />
      )}
    </div>
  );
}