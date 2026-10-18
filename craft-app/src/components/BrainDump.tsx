// BrainDump.tsx
// Tier 1, item 2: "Get it out of my head." A global, always-available dump
// box. Free text goes to Groq, comes back sorted into the four buckets Polly
// actually has structured storage for — Tasks, Grocery, Bills, and Appointments —
// then the user reviews/edits before anything is saved.
//
// Bills are saved to the bills table. Since free-form brain dumps may not
// contain an amount or due date, those fields are left null for the user
// to fill in later from Wallet.
//
// Appointments are saved to the appointments table. A date and time are
// required, so the review step makes the user fill in any the AI didn't find.

import { groqFetch } from '../lib/apiClient';
import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';
import Icon from './Icon';

interface DraftItem {
  id: string;
  text: string;
  category: 'task' | 'grocery' | 'bills' | 'appointments';
  include: boolean;
  amount?: number | null;
  dueDay?: number | null;
  recurring?: boolean | null;
  apptDate?: string | null; // YYYY-MM-DD
  apptTime?: string | null; // HH:mm (24-hour)
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildPrompt(dump: string): string {
  const now = new Date();
  const todayStr = `${todayISO()} (${now.toLocaleDateString('en-US', { weekday: 'long' })})`;

  return `Sort this free-form brain dump into four buckets: "task" (chores, errands, calls, things to plan, anything action-shaped), "grocery" (specific items to buy at a store), "bills" (money owed, bills to pay, invoices, subscriptions, rent, utilities, credit card payments, debt payments, or other financial obligations), and "appointments" (scheduled visits or meetings the user has to show up to, like a dentist visit, vet check-up, or therapy session). Calling to book or schedule something is a "task", not an appointment.

For bills, extract the amount, due day of the month, and whether it is recurring ONLY when the user explicitly provides that information. Never guess missing values. Use null for information that was not provided.

For appointments, extract the date (YYYY-MM-DD) and the time (24-hour HH:mm) ONLY when the user explicitly provides them. Today is ${todayStr}; use that to resolve words like "tomorrow" or "next Tuesday". Never guess a missing date or time. Use null for information that was not provided.

Split run-on sentences into separate short items. Keep each item's wording short and plain — a to-do label, not a sentence.

Brain dump:
"${dump.trim()}"

Respond ONLY with a valid JSON object, no markdown, no backticks, no explanation. Use this exact shape:
{
  "items": [
    { "text": "short item label", "category": "task" },
    { "text": "short item label", "category": "grocery" },
    { "text": "short bill label", "category": "bills", "amount": null, "dueDay": null, "recurring": null },
    { "text": "short appointment title", "category": "appointments", "apptDate": null, "apptTime": null }
  ]
}`;
}

async function categorize(dump: string): Promise<{
  text: string;
  category: 'task' | 'grocery' | 'bills' | 'appointments';
  amount: number | null;
  dueDay: number | null;
  recurring: boolean | null;
  apptDate: string | null;
  apptTime: string | null;
}[]> {
  const response = await groqFetch({
      max_tokens: 600,
      messages: [{ role: 'user', content: buildPrompt(dump) }],
    });

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content ?? '';
  const clean = raw.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);

  if (!Array.isArray(parsed.items)) throw new Error('bad shape');

  return parsed.items
    .filter((i: any) => typeof i.text === 'string' && i.text.trim())
    .map((i: any) => ({
  text: i.text.trim(),
  category:
    i.category === 'grocery'
      ? 'grocery'
      : i.category === 'bills'
        ? 'bills'
        : i.category === 'appointments'
          ? 'appointments'
          : 'task',
  amount: typeof i.amount === 'number' ? i.amount : null,
  dueDay: typeof i.dueDay === 'number' ? i.dueDay : null,
  recurring: typeof i.recurring === 'boolean' ? i.recurring : null,
  apptDate: typeof i.apptDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(i.apptDate) ? i.apptDate : null,
  apptTime: typeof i.apptTime === 'string' && /^\d{2}:\d{2}$/.test(i.apptTime) ? i.apptTime : null,
}));
}

// Web Speech API isn't in TS's default DOM lib and support is Chrome/Edge-first
// (Safari and Firefox are spotty), so this stays feature-detected and typed
// loosely rather than pulling in a whole speech-recognition type package.
const SpeechRecognitionCtor: any =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

export default function BrainDump({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { showToast } = useToast();
  const [dump, setDump] = useState('');
  const [drafts, setDrafts] = useState<DraftItem[] | null>(null);
  const [sorting, setSorting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef('');
  const shouldListenRef = useRef(false);

  useEffect(() => {
    // Stop listening if the sheet closes out from under an active session.
    if (!open) {
      shouldListenRef.current = false;
      recognitionRef.current?.stop();
    }
  }, [open]);

  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      recognitionRef.current?.stop();
    };
  }, []);

  if (!open) return null;

  function launchRecognition() {
    const recognition = new SpeechRecognitionCtor();
    // Chrome has a known bug where a single long-running continuous +
    // interimResults session eventually locks up the tab. Running short,
    // single-utterance sessions and auto-restarting on each pause gives the
    // same "keep talking" feel without tripping that bug.
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let finalChunk = '';
      let interimChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalChunk += transcript + ' ';
        else interimChunk += transcript;
      }
      if (finalChunk) baseTextRef.current += finalChunk;
      setDump(baseTextRef.current + interimChunk);
    };

    recognition.onerror = (event: any) => {
      // "no-speech" just means a pause with nothing said — onend follows
      // right after and restarts things, so it's not a real failure.
      if (event.error !== 'no-speech') {
        shouldListenRef.current = false;
        setListening(false);
      }
    };

    recognition.onend = () => {
      if (shouldListenRef.current) {
        launchRecognition();
      } else {
        setListening(false);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function startListening() {
    if (!SpeechRecognitionCtor || listening) return;
    setError('');
    baseTextRef.current = dump.trim() ? dump.trim() + ' ' : '';
    shouldListenRef.current = true;
    launchRecognition();
    setListening(true);
  }

  function stopListening() {
    shouldListenRef.current = false;
    recognitionRef.current?.stop();
    setListening(false);
  }

  function reset() {
    stopListening();
    setDump('');
    setDrafts(null);
    setError('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSort() {
    if (!dump.trim()) return;
    setSorting(true);
    setError('');

    try {
      const items = await categorize(dump);

      if (items.length === 0) {
        setError("Couldn't find anything in there — try adding a bit more detail.");
        setSorting(false);
        return;
      }

      setDrafts(items.map((i, idx) => ({
  id: `${idx}-${i.text}`,
  text: i.text,
  category: i.category,
  include: true,
  amount: i.amount ?? null,
  dueDay: i.dueDay ?? null,
  recurring: i.recurring ?? null,
  apptDate: i.apptDate ?? null,
  apptTime: i.apptTime ?? null,
})));
    } catch {
      setError('Something went wrong sorting that. Please try again.');
    } finally {
      setSorting(false);
    }
  }

  function updateDraft(id: string, patch: Partial<DraftItem>) {
  setDrafts(prev =>
    prev
      ? prev.map(d => d.id === id ? { ...d, ...patch } : d)
      : prev
  );
}

  function removeDraft(id: string) {
    setDrafts(prev => prev ? prev.filter(d => d.id !== id) : prev);
  }

  async function handleSave() {
    if (!drafts) return;

    const toSave = drafts.filter(d => d.include && d.text.trim());

    if (toSave.length === 0) {
      handleClose();
      return;
    }

    const incompleteAppt = toSave.some(
      d => d.category === 'appointments' && (!d.apptDate || !d.apptTime)
    );
    if (incompleteAppt) {
      setError('Add a date and time for each appointment before saving.');
      return;
    }
    setError('');

    setSaving(true);

    try {
      const tasks = toSave.filter(d => d.category === 'task');
      const groceries = toSave.filter(d => d.category === 'grocery');
      const bills = toSave.filter(d => d.category === 'bills');
      const appts = toSave.filter(d => d.category === 'appointments');
      const today = todayISO();

      const currentDate = new Date();
      const billMonth = currentDate.getMonth() + 1;
      const billYear = currentDate.getFullYear();

      const [
        { error: tasksError },
        { error: groceriesError },
        { error: billsError },
        { error: apptsError },
      ] = await Promise.all([
        tasks.length > 0
          ? supabase.from('daily_tasks').insert(tasks.map(t => ({
              label: t.text,
              done: false,
              task_date: today,
              template_id: null,
            })))
          : Promise.resolve({ error: null }),

        groceries.length > 0
          ? supabase.from('grocery_items').insert(groceries.map(g => ({
              name: g.text,
              qty: '',
              checked: false,
              list_name: 'Default',
            })))
          : Promise.resolve({ error: null }),

        bills.length > 0
  ? supabase.from('bills').insert(bills.map(b => ({
      name: b.text,
      amount: b.amount ?? null,
      due_day: b.dueDay ?? null,
      recurring: b.recurring ?? null,
      bill_month: billMonth,
      bill_year: billYear,
    })))
  : Promise.resolve({ error: null }),

        appts.length > 0
          ? supabase.from('appointments').insert(
              appts.map(a => ({
                title: a.text.trim(),
                date_time: new Date(`${a.apptDate}T${a.apptTime}`).toISOString(),
              }))
            )
          : Promise.resolve({ error: null }),
      ]);

      if (tasksError || groceriesError || billsError || apptsError) {
        throw new Error('One or more items failed to save.');
      }

      showToast(`Sorted ${toSave.length} thing${toSave.length === 1 ? '' : 's'} out of your head 🌱`);
      handleClose();
    } catch {
      setError('Saving hit a snag — please try again.');
    } finally {
      setSaving(false);
    }
  }

  const taskCount = drafts?.filter(d => d.category === 'task').length ?? 0;
  const groceryCount = drafts?.filter(d => d.category === 'grocery').length ?? 0;
  const billsCount = drafts?.filter(d => d.category === 'bills').length ?? 0;
  const apptsCount = drafts?.filter(d => d.category === 'appointments').length ?? 0;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={handleClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)', borderRadius: '24px 24px 0 0',
          border: '1.5px solid var(--border)', borderBottom: 'none',
          padding: 20, width: '100%', maxWidth: 520, maxHeight: '85vh',
          overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="section-label" style={{ marginBottom: 0 }}>
            <Icon name="notebook-pen" size={16} /> Get it out of your head
          </div>
          <button
            onClick={handleClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-muted)', fontSize: '1.1rem', padding: 4 }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {!drafts ? (
          <>
            <div style={{ position: 'relative' }}>
              <textarea
                className="form-input"
                value={dump}
                onChange={e => setDump(e.target.value)}
                placeholder="Need to call the dentist, buy detergent, pay the electric bill, clean the bathroom..."
                rows={5}
                style={{ fontSize: '1rem', resize: 'vertical', fontFamily: 'inherit', paddingRight: SpeechRecognitionCtor ? 46 : undefined }}
                autoFocus
              />
              {SpeechRecognitionCtor && (
                <button
                  type="button"
                  onClick={listening ? stopListening : startListening}
                  aria-label={listening ? 'Stop voice capture' : 'Start voice capture'}
                  title={listening ? 'Stop listening' : 'Speak your dump'}
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    width: 30, height: 30, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: 'none', cursor: 'pointer',
                    background: listening ? 'var(--pink-dark)' : 'var(--cream)',
                    color: listening ? 'var(--white)' : 'var(--ink-muted)',
                    boxShadow: listening ? '0 0 0 4px rgba(203, 138, 99, 0.25)' : 'none',
                    transition: 'box-shadow 0.2s ease',
                  }}
                >
                  {listening ? <Square size={13} fill="currentColor" /> : <Mic size={15} />}
                </button>
              )}
            </div>
            {listening && (
              <div style={{ fontSize: '0.72rem', color: 'var(--pink-dark)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--pink-dark)', display: 'inline-block' }} />
                Listening… tap the square to stop
              </div>
            )}
            {error && <div style={{ fontSize: '0.75rem', color: 'var(--pink-dark)', fontWeight: 600 }}>{error}</div>}
            <button
              className="btn btn-primary"
              onClick={handleSort}
              disabled={sorting || !dump.trim()}
              style={{ opacity: sorting || !dump.trim() ? 0.6 : 1 }}
            >
              {sorting ? 'Sorting…' : 'Sort it out'}
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
              {taskCount} task{taskCount === 1 ? '' : 's'} · {groceryCount} grocery item{groceryCount === 1 ? '' : 's'} · {billsCount} bill{billsCount === 1 ? '' : 's'} · {apptsCount} appointment{apptsCount === 1 ? '' : 's'}. Uncheck or edit anything before saving.
            </div>

            {(['task', 'grocery', 'bills', 'appointments'] as const).map(cat => {
              const items = drafts.filter(d => d.category === cat);
              if (items.length === 0) return null;

              return (
                <div key={cat}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-muted)', marginBottom: 6 }}>
                    {cat === 'task' ? 'Tasks' : cat === 'grocery' ? 'Grocery' : cat === 'bills' ? 'Bills' : 'Appointments'}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {items.map(d => (
                      <div
                        key={d.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                          background: 'var(--white)', border: '1.5px solid var(--border)',
                          borderRadius: 14, padding: '8px 10px',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={d.include}
                          onChange={e => updateDraft(d.id, { include: e.target.checked })}
                          style={{ flexShrink: 0 }}
                        />

                        <input
                          value={d.text}
                          onChange={e => updateDraft(d.id, { text: e.target.value })}
                          style={{
                            flex: 1, border: 'none', background: 'transparent', outline: 'none',
                            fontSize: '1rem', fontFamily: 'inherit',
                            color: d.include ? 'var(--ink)' : 'var(--ink-muted)',
                            textDecoration: d.include ? 'none' : 'line-through',
                          }}
                        />

                       <select
  value={d.category}
  onChange={e => updateDraft(d.id, {
    category: e.target.value as 'task' | 'grocery' | 'bills' | 'appointments'
  })}
  style={{
    fontSize: '1rem',
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'var(--cream)',
    color: 'var(--ink-muted)'
  }}
>
  <option value="task">Task</option>
  <option value="grocery">Grocery</option>
  <option value="bills">Bill</option>
  <option value="appointments">Appointment</option>
</select>

{d.category === 'bills' && (
  <div style={{
    display: 'flex',
    gap: 5,
    alignItems: 'center',
    flexShrink: 0,
  }}>
    <input
      type="number"
      min="0"
      step="0.01"
      placeholder="Amount"
      value={d.amount ?? ''}
      onChange={e => updateDraft(d.id, {
        amount: e.target.value === '' ? null : Number(e.target.value),
      })}
      style={{
        width: 75,
        fontSize: '1rem',
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--cream)',
        color: 'var(--ink)',
        padding: '5px 6px',
      }}
    />

    <input
      type="number"
      min="1"
      max="31"
      placeholder="Due"
      value={d.dueDay ?? ''}
      onChange={e => updateDraft(d.id, {
        dueDay: e.target.value === '' ? null : Number(e.target.value),
      })}
      style={{
        width: 50,
        fontSize: '1rem',
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--cream)',
        color: 'var(--ink)',
        padding: '5px 6px',
      }}
    />

    <select
      value={d.recurring === null || d.recurring === undefined ? '' : String(d.recurring)}
      onChange={e => updateDraft(d.id, {
        recurring: e.target.value === '' ? null : e.target.value === 'true',
      })}
      style={{
        fontSize: '1rem',
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--cream)',
        color: 'var(--ink-muted)',
      }}
    >
      <option value="">Repeat?</option>
      <option value="true">Yes</option>
      <option value="false">No</option>
    </select>
</div>
  )}

                        {d.category === 'appointments' && (
                          <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
                            <input
                              type="date"
                              value={d.apptDate ?? ''}
                              onChange={e => updateDraft(d.id, { apptDate: e.target.value || null })}
                              style={{
                                fontSize: '1rem',
                                border: '1px solid var(--border)',
                                borderRadius: 8,
                                background: 'var(--cream)',
                                color: 'var(--ink)',
                                padding: '5px 6px',
                              }}
                            />
                            <input
                              type="time"
                              value={d.apptTime ?? ''}
                              onChange={e => updateDraft(d.id, { apptTime: e.target.value || null })}
                              style={{
                                fontSize: '1rem',
                                border: '1px solid var(--border)',
                                borderRadius: 8,
                                background: 'var(--cream)',
                                color: 'var(--ink)',
                                padding: '5px 6px',
                              }}
                            />
                          </div>
                        )}

                        <button
                          onClick={() => removeDraft(d.id)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--ink-muted)', fontSize: '0.9rem', flexShrink: 0
                          }}
                          aria-label="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {error && <div style={{ fontSize: '0.75rem', color: 'var(--pink-dark)', fontWeight: 600 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={reset}>Start over</button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
                style={{ flex: 1, opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Saving…' : 'Add it all'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}