import { useEffect, useRef, useState } from 'react';
import CreateAppointmentNote from './CreateAppointmentNote';
import AppointmentNotes from './AppointmentNotes';
import UnlinkedNotes from './UnlinkedNotes';
import { useUnlinkedAppointmentNotes } from '../../hooks/useUnlinkedAppointmentNotes';
import type { AppointmentNoteType } from '../../types/appointmentNotes';
import styles from './AppointmentNotesPanel.module.css';
import Icon, { type IconName } from '../Icon';

export interface AppointmentNoteSelection {
  appointmentId: string;
  noteType: AppointmentNoteType;
  label: string;
}

interface AppointmentNotesPanelProps {
  externalSelection?: AppointmentNoteSelection | null;
  onExternalSelectionConsumed?: () => void;
  // Called whenever a note is added, carried over, or linked back to an
  // appointment — lets the caller (e.g. DailyPlanner's note-icon map)
  // refresh, since it has no other way of knowing this panel changed data.
  onNotesChanged?: () => void;
}

export default function AppointmentNotesPanel({
  externalSelection,
  onExternalSelectionConsumed,
  onNotesChanged,
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

  // Steps back out of "New note" or "Unlinked notes" to the menu where you
  // can pick between them. Whatever appointment note you had open (if any)
  // before switching modes is left alone, so it's still there underneath.
  const goBack = () => {
    setCreating(false);
    setViewingUnlinked(false);
  };

  const inSubView = creating || viewingUnlinked;

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <div className={styles.header}>
        <Icon name="icon-flower" size={20} className={styles.headerIcon} />
        <span className={styles.headerLabel}>Appointment Notes</span>
      </div>

      <div className={styles.actionRow}>
        {inSubView ? (
          <button type="button" className={styles.backTopButton} onClick={goBack}>
            <Icon name="icon-arrowleft" size={14} /> Back
          </button>
        ) : (
          <>
            <button type="button" className={styles.newButton} onClick={() => setCreating(true)}>
              <Icon name="icon-plus" size={14} /> New note
            </button>

            {!unlinked.loading && unlinked.items.length > 0 && (
              <button type="button" className={styles.unlinkedButton} onClick={openUnlinked}>
                <Icon name="icon-archive" size={14} /> Unlinked notes ({unlinked.items.length})
              </button>
            )}
          </>
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
          onLinked={onNotesChanged}
        />
      )}

      {!creating && !viewingUnlinked && selectedApptId && selectedNoteType && (
        <AppointmentNotes
          appointmentId={selectedApptId}
          appointmentLabel={selectedLabel}
          noteType={selectedNoteType}
          onNoteChanged={onNotesChanged}
        />
      )}
    </div>
  );
}
