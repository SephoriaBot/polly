// LifeEvents.tsx
// Tier 2, item 3. "I'm moving next month" creates a temporary workspace
// instead of the person building a checklist from scratch. Kept
// deliberately simple for v1: a flat checklist per event, no attempt to
// schedule individual items against the event date — that's real future
// work (spreading items across daily_tasks by days-before-event) once this
// basic shape is validated.
//
// The checklist is tailored by Groq: the template's items are the baseline
// "what people usually need", and the AI trims/adds/reorders them using the
// event date and anything the person says about their situation. If the AI
// call fails, the plain template is used so starting an event never breaks.

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/useToast';
import Icon from '../Icon';
import { useTheme } from '../../context/ThemeContext';
import { LIFE_EVENT_TEMPLATES, type LifeEventTemplate } from '../../lib/lifeEventTemplates';
import { requestChecklist } from '../../lib/aiChecklist';
import { useCreatureGrowth } from '../../creatures/CreatureGrowthContext';
import CheckMark from '../CheckMark';

interface LifeEventRow {
  id: string;
  template_key: string;
  title: string;
  event_date: string | null;
  archived: boolean;
  created_at: string;
}

interface LifeEventItemRow {
  id: string;
  life_event_id: string;
  label: string;
  done: boolean;
  item_order: number;
}

const LIFE_EVENT_SYSTEM_PROMPT = `You are a practical planning coach inside a personal life-management app. You build checklists for big life events that a real person can follow without having to think about what comes next.

How good checklist items look:
- Each item is ONE concrete action that starts with a verb and names the specific thing. "Book movers for the 14th" beats "Arrange moving". No vague items like "Get organized" or "Prepare".
- Order by lead time and dependency: things that need booking, ordering, waiting, or approval come first; things that can only happen right before the event come last. If one item can't happen until another is done, it must come after it.
- Tailor to the situation described. Keep baseline items that apply, drop ones that clearly don't, and add items the baseline missed that this situation needs. Never pad.
- Respect the time left. If the event is very soon, include only what truly matters and can still be done. If it is far off, include early-lead-time items and let later steps wait.
- Don't invent personal details (names, amounts, brands, places) that weren't given.
- Labels are short checklist text, about 4 to 10 words, no numbering, no trailing punctuation.

Respond ONLY with a valid JSON object, no markdown, no backticks, no commentary.`;

function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  return diff < 0 ? null : diff;
}

function describeTimeLeft(days: number | null): string {
  if (days === null) return 'No date was given, so pace the list for a sensible general lead time.';
  if (days === 0) return 'The event is today. Only include what can still be done today.';
  if (days <= 3) return `The event is in ${days} day${days === 1 ? '' : 's'}. Essentials only, and nothing that needs a long wait.`;
  if (days <= 14) return `The event is in ${days} days. Prioritize anything with a lead time right away.`;
  if (days <= 60) return `The event is in ${days} days. There is room to spread things out and start lead-time items early.`;
  return `The event is ${days} days away. There is plenty of time, so focus on early-lead-time items and leave a few last-minute ones for the end.`;
}

function buildLifeEventPrompt(template: LifeEventTemplate, eventDate: string, details: string): string {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const when = eventDate
    ? new Date(eventDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : 'not set';
  const situation = details.trim() ? details.trim() : 'No extra details were given. Assume a typical situation.';

  return `Life event: ${template.label}
Today's date: ${today}
Event date: ${when}
${describeTimeLeft(daysUntil(eventDate))}

About their situation (written by the person): "${situation}"

Baseline items people usually need for this kind of event:
${template.items.map(i => `- ${i}`).join('\n')}

Build their tailored checklist. Usually 6 to 14 items, never more than 16.

Use this exact shape:
{
  "items": ["first item", "second item"]
}`;
}

async function generateLifeEventItems(template: LifeEventTemplate, eventDate: string, details: string): Promise<string[]> {
  return requestChecklist({
    system: LIFE_EVENT_SYSTEM_PROMPT,
    prompt: buildLifeEventPrompt(template, eventDate, details),
    key: 'items',
    cap: 16,
  });
}

export default function LifeEvents() {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const { notifyGrowth } = useCreatureGrowth();
  const [events, setEvents] = useState<LifeEventRow[]>([]);
  const [itemsByEvent, setItemsByEvent] = useState<Record<string, LifeEventItemRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: eventsData } = await supabase.from('life_events').select('*').eq('archived', false).order('created_at');
    const rows = (eventsData as LifeEventRow[]) ?? [];
    setEvents(rows);
    if (rows.length > 0) {
      const { data: itemsData } = await supabase.from('life_event_items').select('*').in('life_event_id', rows.map(r => r.id)).order('item_order');
      const grouped: Record<string, LifeEventItemRow[]> = {};
      for (const item of (itemsData as LifeEventItemRow[]) ?? []) {
        (grouped[item.life_event_id] ??= []).push(item);
      }
      setItemsByEvent(grouped);
      if (rows.length > 0 && !expanded) setExpanded(rows[0].id);
    }
    setLoading(false);
  }

  async function startEvent(template: LifeEventTemplate, eventDate: string, details: string) {
    let labels: string[];
    try {
      labels = await generateLifeEventItems(template, eventDate, details);
      if (labels.length === 0) throw new Error('empty');
    } catch {
      // Never block starting an event on the AI — fall back to the plain template.
      labels = template.items;
      showToast("Couldn't tailor it, so I used the standard checklist", 'error');
    }

    const { data: event, error } = await supabase
      .from('life_events')
      .insert({ template_key: template.key, title: template.label, event_date: eventDate || null, archived: false })
      .select()
      .single();
    if (error || !event) { showToast("Couldn't start that — try again?", 'error'); return; }

    const { data: items } = await supabase
      .from('life_event_items')
      .insert(labels.map((label, idx) => ({ life_event_id: event.id, label, done: false, item_order: idx })))
      .select()
      .order('item_order');

    setEvents(prev => [...prev, event as LifeEventRow]);
    setItemsByEvent(prev => ({ ...prev, [event.id]: (items as LifeEventItemRow[]) ?? [] }));
    setExpanded(event.id);
    setPicking(false);
    showToast(`${template.label} workspace started 🌱`);
  }

  async function toggleItem(item: LifeEventItemRow) {
    const newDone = !item.done;
    setItemsByEvent(prev => ({
      ...prev,
      [item.life_event_id]: prev[item.life_event_id].map(i => i.id === item.id ? { ...i, done: newDone } : i),
    }));
    await supabase.from('life_event_items').update({ done: newDone }).eq('id', item.id);
    if (newDone) notifyGrowth();
  }

  async function archiveEvent(id: string) {
    setEvents(prev => prev.filter(e => e.id !== id));
    if (expanded === id) setExpanded(null);
    await supabase.from('life_events').update({ archived: true }).eq('id', id);
  }

  return (
    <div className="card">
      <div className="card-body">
        <div className="section-label">Life Events</div>
        <p className="hint-text">
          Big life stuff gets its own temporary checklist instead of you building one from scratch.
        </p>

        {loading ? (
          <p className="muted-text">Loading…</p>
        ) : (
          <div className="row-list subsection-end">
            {events.map(event => {
              const items = itemsByEvent[event.id] ?? [];
              const doneCount = items.filter(i => i.done).length;
              const isOpen = expanded === event.id;
              const template = LIFE_EVENT_TEMPLATES.find(t => t.key === event.template_key);
              return (
                <div key={event.id} className="accordion">
                  <button
                    className="accordion-head"
                    onClick={() => setExpanded(isOpen ? null : event.id)}
                  >
                    {template && (
                      <span className="panel-icon">
                        <Icon name={template.icon as Parameters<typeof Icon>[0]['name']} size={18} />
                      </span>
                    )}
                    <div className="row-text">
                      <div className="row-title">{event.title}</div>
                      <div className="row-meta">
                        {doneCount}/{items.length} done{event.event_date ? ` · ${new Date(event.event_date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}
                      </div>
                    </div>
                    <Icon name={isOpen ? 'icon-chevronup' : 'icon-chevrondown'} size={16} />
                  </button>

                  {isOpen && (
                    <div className="accordion-body">
                      {items.map(item => (
                        <div
                          key={item.id}
                          className={`row-item is-clickable is-compact${item.done ? ' is-done' : ''}`}
                          onClick={() => toggleItem(item)}
                        >
                          <CheckMark completed={item.done} size={20} />
                          <div className="row-text">
                            <div className="row-title">{item.label}</div>
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={() => archiveEvent(event.id)}
                        className="btn btn-ghost btn-sm btn-block"
                      >
                        All wrapped up — archive this
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!picking ? (
          <button className="btn btn-primary btn-block" onClick={() => setPicking(true)}>
            <Icon name="icon-plus" size={20} /> Start a life event
          </button>
        ) : (
          <TemplatePicker onPick={startEvent} onCancel={() => setPicking(false)} />
        )}
      </div>
    </div>
  );
}

function TemplatePicker({ onPick, onCancel }: { onPick: (t: LifeEventTemplate, date: string, details: string) => Promise<void>; onCancel: () => void }) {
  const [selected, setSelected] = useState<LifeEventTemplate | null>(null);
  const [date, setDate] = useState('');
  const [details, setDetails] = useState('');
  const [generating, setGenerating] = useState(false);

  async function handleCreate() {
    if (!selected || generating) return;
    setGenerating(true);
    try {
      await onPick(selected, date, details);
    } finally {
      setGenerating(false);
    }
  }

  if (selected) {
    return (
      <div className="form-panel">
        <div className="row-title">{selected.label}</div>
        <label className="form-label">Event date (optional)</label>
        <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} disabled={generating} />
        <label className="form-label">Anything specific? (optional)</label>
        <textarea
          className="form-input"
          rows={3}
          maxLength={500}
          placeholder="Tell me about your situation, like who's involved, your budget, or what you're worried about"
          value={details}
          onChange={e => setDetails(e.target.value)}
          disabled={generating}
        />
        <div className="form-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)} disabled={generating}>Back</button>
          <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={generating}>
            {generating ? 'Tailoring your checklist…' : 'Create workspace'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="pick-grid">
        {LIFE_EVENT_TEMPLATES.map(t => (
          <button key={t.key} className="pick-tile" onClick={() => setSelected(t)}>
            <Icon name={t.icon as Parameters<typeof Icon>[0]['name']} size={24} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>
      <button className="btn btn-ghost btn-sm btn-block" onClick={onCancel}>Cancel</button>
    </div>
  );
}