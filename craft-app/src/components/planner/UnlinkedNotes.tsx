import { useState } from 'react';
import { useAppointments } from '../../hooks/useAppointments';
import type { AppointmentNoteItem } from '../../types/appointmentNotes';
import notesStyles from './AppointmentNotes.module.css';
import styles from './UnlinkedNotes.module.css';
import Icon, { type IconName } from '../Icon';
import EmptyState from '../EmptyState';

interface UnlinkedNotesProps {
  items: AppointmentNoteItem[];
  loading: boolean;
  error: string | null;
  toggleBringUpCovered: (item: AppointmentNoteItem) => Promise<void>;
  toggleHomeworkDone: (item: AppointmentNoteItem) => Promise<void>;
  saveResolution: (itemId: string, resolution: string) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  linkToAppointment: (itemIds: string[], appointmentId: string) => Promise<void>;
  onLinked?: () => void;
}

export default function UnlinkedNotes({
  items,
  loading,
  error,
  toggleBringUpCovered,
  toggleHomeworkDone,
  saveResolution,
  removeItem,
  linkToAppointment,
  onLinked,
}: UnlinkedNotesProps) {
  const [resolutionDrafts, setResolutionDrafts] = useState<Record<string, string>>({});
  const [linkingGroup, setLinkingGroup] = useState<string | null>(null);
  const [linkTarget, setLinkTarget] = useState('');
  const { appointments, loading: appointmentsLoading, error: appointmentsError } = useAppointments();

  const openLinkPicker = (noteType: string) => {
    setLinkingGroup(noteType);
    setLinkTarget('');
  };

  const closeLinkPicker = () => {
    setLinkingGroup(null);
    setLinkTarget('');
  };

  const confirmLink = async (groupItems: AppointmentNoteItem[]) => {
    if (!linkTarget) return;
    await linkToAppointment(
      groupItems.map((i) => i.id),
      linkTarget
    );
    closeLinkPicker();
    onLinked?.();
  };

  if (loading) {
    return <p className={notesStyles.loadingText}>Loading unlinked notes…</p>;
  }

  if (error) {
    return <p className={notesStyles.errorText}>{error}</p>;
  }

  if (items.length === 0) {
    return (
      
        <EmptyState image="empty10" message="No unlinked notes yet." />
      
    );
  }

  // Grouped by note_type since these no longer belong to any specific
  // appointment — the appointment that created them was deleted. Linking
  // happens at the group level: everything under a note_type came from the
  // same orphaned thread, so it all gets re-homed to one appointment at once.
  const groups = items.reduce<Record<string, AppointmentNoteItem[]>>((acc, item) => {
    (acc[item.note_type] ??= []).push(item);
    return acc;
  }, {});

  const handleSaveResolution = async (item: AppointmentNoteItem) => {
    const text = resolutionDrafts[item.id] ?? item.resolution ?? '';
    await saveResolution(item.id, text);
  };

  const renderGroupLinkPicker = (noteType: string, groupItems: AppointmentNoteItem[]) => {
    if (linkingGroup !== noteType) return null;

    return (
      <div className={styles.linkPicker}>
        {appointmentsError && <p className={notesStyles.errorText}>{appointmentsError}</p>}
        <select
          className={styles.linkSelect}
          value={linkTarget}
          onChange={(e) => setLinkTarget(e.target.value)}
          disabled={appointmentsLoading}
        >
          <option value="">
            {appointmentsLoading ? 'Loading appointments…' : 'Select an appointment…'}
          </option>
          {appointments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title} — {new Date(a.date_time).toLocaleDateString()}
            </option>
          ))}
        </select>
        <div className={styles.linkPickerActions}>
          <button type="button" className={styles.cancelLinkButton} onClick={closeLinkPicker}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.linkConfirmButton}
            disabled={!linkTarget}
            onClick={() => confirmLink(groupItems)}
          >
            Link all {groupItems.length}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={notesStyles.wrapper}>
      <p className={styles.intro}>
        Notes left behind by deleted appointments. Wrap these up, link the whole group back to
        an appointment, or clear them out.
      </p>

      {Object.entries(groups).map(([noteType, groupItems]) => {
        const bringUpOpen = groupItems.filter((i) => i.kind === 'bring_up' && i.status === 'open');
        const bringUpCovered = groupItems.filter((i) => i.kind === 'bring_up' && i.status === 'covered');
        const homework = groupItems.filter((i) => i.kind === 'homework');

        return (
          <div key={noteType} className={styles.group}>
            <div className={styles.groupHeader}>
              <span>{noteType}</span>
              <button
                type="button"
                className={styles.groupLinkButton}
                onClick={() => openLinkPicker(noteType)}
              >
                <Icon name="icon-link2" size={13} /> Link to appointment
              </button>
            </div>

            {renderGroupLinkPicker(noteType, groupItems)}

            {bringUpOpen.length > 0 && (
              <section className={notesStyles.section}>
                <div className={notesStyles.sectionHeader}>
                  <span>Want to bring up</span>
                </div>
                {bringUpOpen.map((item) => (
                  <div key={item.id} className={notesStyles.row}>
                    <button
                      className={notesStyles.checkButton}
                      onClick={() => toggleBringUpCovered(item)}
                      aria-label="Mark covered"
                      type="button"
                    >
                      <Icon name="icon-circle" size={18} />
                    </button>
                    <span className={notesStyles.itemText}>{item.content}</span>
                    <button
                      className={notesStyles.deleteButton}
                      onClick={() => removeItem(item.id)}
                      aria-label="Delete"
                      type="button"
                    >
                      <Icon name="icon-clear" size={15} />
                    </button>
                  </div>
                ))}
              </section>
            )}

            {bringUpCovered.length > 0 && (
              <section className={notesStyles.section}>
                <div className={notesStyles.sectionHeader}>
                  <span>Covered</span>
                </div>
                {bringUpCovered.map((item) => (
                  <div key={item.id} className={notesStyles.coveredBlock}>
                    <div className={notesStyles.row}>
                      <button
                        className={notesStyles.checkButton}
                        onClick={() => toggleBringUpCovered(item)}
                        aria-label="Mark not covered"
                        type="button"
                      >
                        <Icon name="groq_7" size={18} className={notesStyles.coveredIcon} />
                      </button>
                      <span className={`${notesStyles.itemText} ${notesStyles.strikethrough}`}>
                        {item.content}
                      </span>
                      <button
                        className={notesStyles.deleteButton}
                        onClick={() => removeItem(item.id)}
                        aria-label="Delete"
                        type="button"
                      >
                        <Icon name="icon-clear" size={15} />
                      </button>
                    </div>
                    <div className={notesStyles.resolutionRow}>
                      <input
                        className={notesStyles.resolutionInput}
                        value={resolutionDrafts[item.id] ?? item.resolution ?? ''}
                        onChange={(e) =>
                          setResolutionDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveResolution(item)}
                        placeholder="What was the resolution?"
                      />
                      <button
                        className={notesStyles.saveButton}
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

            {homework.length > 0 && (
              <section className={`${notesStyles.section} ${notesStyles.homeworkSection}`}>
                <div className={notesStyles.sectionHeader}>
                  <span>Homework</span>
                </div>
                {homework.map((item) => (
                  <div key={item.id} className={notesStyles.row}>
                    <button
                      className={notesStyles.checkButton}
                      onClick={() => toggleHomeworkDone(item)}
                      aria-label="Toggle done"
                      type="button"
                    >
                      {item.status === 'done' ? (
                        <Icon name="groq_7" size={18} className={notesStyles.coveredIcon} />
                      ) : (
                        <Icon name="icon-circle" size={18} />
                      )}
                    </button>
                    <span
                      className={`${notesStyles.itemText} ${item.status === 'done' ? notesStyles.strikethrough : ''}`}
                    >
                      {item.content}
                    </span>
                    <button
                      className={notesStyles.deleteButton}
                      onClick={() => removeItem(item.id)}
                      aria-label="Delete"
                      type="button"
                    >
                      <Icon name="icon-clear" size={15} />
                    </button>
                  </div>
                ))}
              </section>
            )}
          </div>
        );
      })}
    </div>
  );
}
