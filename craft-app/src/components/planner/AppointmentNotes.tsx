import { useState } from 'react';
import { useAppointmentNotes } from '../../hooks/useAppointmentNotes';
import type { AppointmentNoteItem, AppointmentNoteType } from '../../types/appointmentNotes';
import styles from './AppointmentNotes.module.css'; // NOTE: adjust to your CSS token setup
import Icon, { type IconName } from '../Icon';

interface AppointmentNotesProps {
  appointmentId: string;
  appointmentLabel: string;
  noteType: AppointmentNoteType;
  onNoteChanged?: () => void;
}

export default function AppointmentNotes({
  appointmentId,
  appointmentLabel,
  noteType,
  onNoteChanged,
}: AppointmentNotesProps) {
  const {
    items,
    carryOverItems,
    loading,
    error,
    addItem,
    toggleBringUpCovered,
    toggleHomeworkDone,
    saveResolution,
    carryOverItem,
    removeItem,
  } = useAppointmentNotes(appointmentId, noteType, onNoteChanged);

  const [bringUpDraft, setBringUpDraft] = useState('');
  const [homeworkDraft, setHomeworkDraft] = useState('');
  const [resolutionDrafts, setResolutionDrafts] = useState<Record<string, string>>({});

  const bringUpOpen = items.filter((i) => i.kind === 'bring_up' && i.status === 'open');
  const bringUpCovered = items.filter((i) => i.kind === 'bring_up' && i.status === 'covered');
  const homework = items.filter((i) => i.kind === 'homework');

  const handleAddBringUp = async () => {
    if (!bringUpDraft.trim()) return;
    await addItem('bring_up', bringUpDraft);
    setBringUpDraft('');
  };

  const handleAddHomework = async () => {
    if (!homeworkDraft.trim()) return;
    await addItem('homework', homeworkDraft);
    setHomeworkDraft('');
  };

  const handleSaveResolution = async (item: AppointmentNoteItem) => {
    const text = resolutionDrafts[item.id] ?? item.resolution ?? '';
    await saveResolution(item.id, text);
  };

  if (loading) {
    return <p className={styles.loadingText}>Loading notes…</p>;
  }

  return (
    <div className={styles.wrapper}>
      <p className={styles.viewingLabel}>{appointmentLabel}</p>

      {error && <p className={styles.errorText}>{error}</p>}

      {carryOverItems.length > 0 && (
        <section className={`${styles.section} ${styles.carryOverSection}`}>
          <div className={styles.sectionHeader}>
            <Icon name="icon-refreshcw" size={14} />
            <span>Still open from last time</span>
          </div>
          {carryOverItems.map((item) => (
            <div key={item.id} className={styles.carryOverRow}>
              <span className={styles.itemText}>{item.content}</span>
              <button
                className={styles.pillButton}
                onClick={() => carryOverItem(item)}
                type="button"
              >
                Bring into today
              </button>
            </div>
          ))}
        </section>
      )}

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span>Want to bring up</span>
        </div>

        {bringUpOpen.map((item) => (
          <div key={item.id} className={styles.row}>
            <button
              className={styles.checkButton}
              onClick={() => toggleBringUpCovered(item)}
              aria-label="Mark covered"
              type="button"
            >
              <Icon name="icon-circle" size={18} />
            </button>
            <span className={styles.itemText}>{item.content}</span>
            <button
              className={styles.deleteButton}
              onClick={() => removeItem(item.id)}
              aria-label="Delete"
              type="button"
            >
              <Icon name="groq_3" size={15} />
            </button>
          </div>
        ))}

        <div className={styles.addRow}>
          <input
            className={styles.textInput}
            value={bringUpDraft}
            onChange={(e) => setBringUpDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddBringUp()}
            placeholder="Add something to bring up…"
          />
          <button className={styles.addButton} onClick={handleAddBringUp} aria-label="Add" type="button">
            <Icon name="icon-plus" size={18} />
          </button>
        </div>
      </section>

      {bringUpCovered.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span>Covered</span>
          </div>

          {bringUpCovered.map((item) => (
            <div key={item.id} className={styles.coveredBlock}>
              <div className={styles.row}>
                <button
                  className={styles.checkButton}
                  onClick={() => toggleBringUpCovered(item)}
                  aria-label="Mark not covered"
                  type="button"
                >
                  <Icon name="groq_7" size={18} className={styles.coveredIcon} />
                </button>
                <span className={`${styles.itemText} ${styles.strikethrough}`}>{item.content}</span>
                <button
                  className={styles.deleteButton}
                  onClick={() => removeItem(item.id)}
                  aria-label="Delete"
                  type="button"
                >
                  <Icon name="groq_3" size={15} />
                </button>
              </div>

              <div className={styles.resolutionRow}>
                <input
                  className={styles.resolutionInput}
                  value={resolutionDrafts[item.id] ?? item.resolution ?? ''}
                  onChange={(e) =>
                    setResolutionDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveResolution(item)}
                  placeholder="What was the resolution?"
                />
                <button
                  className={styles.saveButton}
                  onClick={() => handleSaveResolution(item)}
                  type="button"
                >
                  Save
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className={`${styles.section} ${styles.homeworkSection}`}>
        <div className={styles.sectionHeader}>
          <span>Homework</span>
        </div>

        {homework.map((item) => (
          <div key={item.id} className={styles.row}>
            <button
              className={styles.checkButton}
              onClick={() => toggleHomeworkDone(item)}
              aria-label="Toggle done"
              type="button"
            >
              {item.status === 'done' ? (
                <Icon name="groq_7" size={18} className={styles.coveredIcon} />
              ) : (
                <Icon name="icon-circle" size={18} />
              )}
            </button>
            <span
              className={`${styles.itemText} ${item.status === 'done' ? styles.strikethrough : ''}`}
            >
              {item.content}
            </span>
            <button
              className={styles.deleteButton}
              onClick={() => removeItem(item.id)}
              aria-label="Delete"
              type="button"
            >
              <Icon name="groq_3" size={15} />
            </button>
          </div>
        ))}

        <div className={styles.addRow}>
          <input
            className={`${styles.textInput} ${styles.homeworkInput}`}
            value={homeworkDraft}
            onChange={(e) => setHomeworkDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddHomework()}
            placeholder="Add homework…"
          />
          <button className={styles.addButton} onClick={handleAddHomework} aria-label="Add homework" type="button">
            <Icon name="icon-plus" size={18} />
          </button>
        </div>
      </section>
    </div>
  );
}
