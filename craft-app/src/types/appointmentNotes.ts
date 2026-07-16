// Free text rather than a fixed union so new types (dentist, vet, etc.)
// can be added later without a code change. DEFAULT_NOTE_TYPES below is
// just what the UI offers as quick-pick chips.
export type AppointmentNoteType = string;

export const DEFAULT_NOTE_TYPES: AppointmentNoteType[] = ['therapy', 'doctor', 'cosmetic'];

export type AppointmentNoteKind = 'bring_up' | 'homework';

export type AppointmentNoteStatus = 'open' | 'covered' | 'done';

export interface AppointmentNoteItem {
  id: string;
  appointment_id: string | null;
  note_type: AppointmentNoteType;
  kind: AppointmentNoteKind;
  content: string;
  status: AppointmentNoteStatus;
  resolution: string | null;
  carried_from_id: string | null;
  created_at: string;
  updated_at: string;
}

// Minimal shape Polly's planner needs to expose for appointment selection.
// Adjust field names to match your actual appointments/events table.
export interface AppointmentOption {
  id: string;
  title: string;
  date: string; // ISO date
  note_type: AppointmentNoteType;
}
