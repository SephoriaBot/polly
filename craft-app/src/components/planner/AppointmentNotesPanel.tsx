import { useState } from 'react';
import { Plus, Sprout } from 'lucide-react';
import CreateAppointmentNote from './CreateAppointmentNote';
import AppointmentNotes from './AppointmentNotes';
import type { AppointmentNoteType } from '../../types/appointmentNotes';
import styles from './AppointmentNotesPanel.module.css';

export default function AppointmentNotesPanel() {
  const [creating, setCreating] = useState(false);
  const [selectedApptId, setSelectedApptId] = useState<string | null>(null);
  const [selectedNoteType, setSelectedNoteType] = useState<AppointmentNoteType | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string>('');

  const handleCreate = (appointmentId: string, noteType: AppointmentNoteType) => {
    setSelectedApptId(appointmentId);
    setSelectedNoteType(noteType);
    setSelectedLabel('');
    setCreating(false);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <Sprout size={20} className={styles.headerIcon} />
        <span className={styles.headerLabel}>Appointment Notes</span>
      </div>

      {!creating && (
        <button type="button" className={styles.newButton} onClick={() => setCreating(true)}>
          <Plus size={14} /> New note
        </button>
      )}

      {creating && (
        <CreateAppointmentNote onCreate={handleCreate} onCancel={() => setCreating(false)} />
      )}

      {!creating && selectedApptId && selectedNoteType && (
        <AppointmentNotes
          appointmentId={selectedApptId}
          appointmentLabel={selectedLabel}
          noteType={selectedNoteType}
        />
      )}
    </div>
  );
}
