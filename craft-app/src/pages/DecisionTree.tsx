import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { supabase } from '../lib/supabase';
import Icon from '../components/Icon';
import EmptyState from '../components/EmptyState';
import emptyDecision from '../assets/icons/empty-decisions.png';
import QuickDecide from '../components/decisions/QuickDecide';



type NodeType = 'root' | 'choice' | 'outcome';

interface TreeNode {
  id: string;
  label: string;
  type: NodeType;
  probability?: number;
  payoffValue?: number;
  note?: string;
  children: TreeNode[];
}

interface SavedTreeSummary {
  id: string;
  title: string | null;
  updated_at: string | null;
}

// --- Wizard-shaped data: a flat "option -> outcomes" model. This is what
// the person actually builds, step by step. It still saves down to the
// same TreeNode/root JSON shape the DB already uses, so older saved
// decisions (and QuickDecide, if it's ever wired to this data) keep
// working — see choicesFromRoot / rootFromChoices below.

interface WizardOutcome {
  id: string;
  label: string;
  probability?: number;
  payoffValue?: number;
  note?: string;
}

interface WizardChoice {
  id: string;
  label: string;
  outcomes: WizardOutcome[];
}

function normalizeNode(raw: any): TreeNode {
  const type: NodeType = raw?.type === 'root' || raw?.type === 'choice' || raw?.type === 'outcome' ? raw.type : 'choice';
  const rawChildren = Array.isArray(raw?.children) ? raw.children : [];
  return {
    id: typeof raw?.id === 'string' ? raw.id : crypto.randomUUID(),
    label: typeof raw?.label === 'string' ? raw.label : '',
    type,
    probability: typeof raw?.probability === 'number' ? raw.probability : undefined,
    payoffValue: typeof raw?.payoffValue === 'number' ? raw.payoffValue : undefined,
    note: typeof raw?.note === 'string' ? raw.note : undefined,
    children: rawChildren.map(normalizeNode),
  };
}

// Collects every outcome-type descendant of a node, at any depth, into one
// flat list. Older decisions built with the previous free-form editor could
// have outcomes nested a few levels deep under sub-choices; this flattens
// them so the wizard has one simple outcome list per top-level option.
function outcomesFromNode(node: TreeNode): WizardOutcome[] {
  const result: WizardOutcome[] = [];
  function walk(n: TreeNode) {
    for (const child of n.children ?? []) {
      if (child.type === 'outcome') {
        result.push({
          id: child.id,
          label: child.label,
          probability: child.probability,
          payoffValue: child.payoffValue,
          note: child.note,
        });
      } else {
        walk(child);
      }
    }
  }
  walk(node);
  return result;
}

function choicesFromRoot(root: TreeNode): WizardChoice[] {
  return (root.children ?? []).map((c) => ({
    id: c.id,
    label: c.label,
    outcomes: outcomesFromNode(c),
  }));
}

function rootFromChoices(title: string, choices: WizardChoice[]): TreeNode {
  return {
    id: crypto.randomUUID(),
    label: title,
    type: 'root',
    children: choices.map((c) => ({
      id: c.id || crypto.randomUUID(),
      label: c.label,
      type: 'choice',
      children: c.outcomes.map((o) => ({
        id: o.id || crypto.randomUUID(),
        label: o.label,
        type: 'outcome',
        probability: o.probability,
        payoffValue: o.payoffValue,
        note: o.note,
        children: [],
      })),
    })),
  };
}

function evForChoice(choice: WizardChoice): number | null {
  let total = 0;
  let hasData = false;
  for (const o of choice.outcomes) {
    if (o.probability != null && o.payoffValue != null) {
      total += (o.probability / 100) * o.payoffValue;
      hasData = true;
    }
  }
  return hasData ? total : null;
}

function newChoice(): WizardChoice {
  return { id: crypto.randomUUID(), label: '', outcomes: [] };
}

function newOutcomeDraft(): Omit<WizardOutcome, 'id'> {
  return { label: '', probability: undefined, payoffValue: undefined, note: '' };
}

// --- Inline style objects (no external CSS dependency, nothing can override or hide these) ---
const styles = {
  page: { padding: 16, display: 'flex', flexDirection: 'column' as const, gap: 12, minHeight: 200 },
  titleInput: { fontSize: '1.1rem', fontWeight: 600, padding: '10px 14px', borderRadius: 12, border: '2px solid var(--pink)', background: 'var(--cream)', color: 'var(--text)' },
  container: { background: 'var(--cream)', border: '2px solid var(--pink)', borderRadius: 16, padding: 14, minHeight: 60 },
  labelInput: { flex: 1, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '0.95rem' },
  smallInput: { width: 70, padding: '8px 6px', borderRadius: 10, border: '1px solid var(--pink)', textAlign: 'center' as const },
  addBtn: { background: 'var(--pink)', color: 'var(--ink)', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' },
  saveBtn: { background: 'var(--pink-dark)', color: 'var(--white)', border: 'none', borderRadius: 12, padding: '10px 20px', fontWeight: 600, alignSelf: 'flex-start' as const },
  evBadge: { fontSize: '0.75rem', fontWeight: 700, color: 'var(--pink-dark)', background: 'var(--pink-light)', padding: '3px 8px', borderRadius: 10 },
  removeBtn: { background: 'none', border: 'none', color: 'var(--danger)', fontSize: '0.85rem', cursor: 'pointer', padding: 4 },
  errorText: { color: 'var(--danger)', fontWeight: 600 },
  // list view styles
  listHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  pageTitle: { fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', margin: 0 },
  newBtn: { background: 'var(--pink-dark)', color: 'var(--white)', border: 'none', borderRadius: 12, padding: '10px 16px', fontWeight: 600 },
  treeCard: { background: 'var(--cream)', border: '2px solid var(--pink)', borderRadius: 16, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 },
  treeCardMain: { flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 4, textAlign: 'left' as const, background: 'none', border: 'none', cursor: 'pointer', padding: 0 },
  treeCardTitle: { fontWeight: 600, color: 'var(--text)', fontSize: '1rem' },
  treeCardMeta: { fontSize: '0.75rem', color: 'var(--ink-muted)' },
  deleteBtn: { background: 'none', border: 'none', color: 'var(--danger)', fontSize: '0.85rem', padding: '6px 8px', flexShrink: 0 },
  deleteConfirmBtn: { background: 'var(--danger)', color: 'var(--white)', border: 'none', borderRadius: 10, padding: '6px 10px', fontSize: '0.75rem', flexShrink: 0 },
  deleteCancelBtn: { background: 'none', border: 'none', color: 'var(--ink-muted)', fontSize: '0.75rem', padding: '6px 8px', flexShrink: 0 },
  backBtn: { background: 'none', border: 'none', color: 'var(--ink-soft)', fontSize: '0.85rem', alignSelf: 'flex-start' as const, padding: 0, cursor: 'pointer' },
  emptyText: { color: 'var(--ink-muted)', fontStyle: 'italic' as const },
  // wizard-specific
  stepBadge: { fontSize: '0.68rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' },
  stepPrompt: { fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: '2px 0 4px' },
  helperText: { fontSize: '0.75rem', color: 'var(--ink-muted)', margin: '0 0 10px', lineHeight: 1.4 },
  chip: { display: 'flex', alignItems: 'center', gap: 6, background: 'var(--white)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '8px 10px', marginBottom: 6 },
  chipLabel: { flex: 1, fontSize: '0.88rem', fontWeight: 600, color: 'var(--ink)' },
  fieldLabel: { fontSize: '0.72rem', color: 'var(--ink-muted)', fontWeight: 600, display: 'block', marginBottom: 4 },
  navRow: { display: 'flex', gap: 8, marginTop: 14 },
  outcomeRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 },
  probabilityWarn: { fontSize: '0.68rem', color: 'var(--pink-dark)', marginTop: 2 },
};

function BackLink({ onClick, label = '← Back' }: { onClick: () => void; label?: string }) {
  return <button style={styles.backBtn} onClick={onClick}>{label}</button>;
}

// --- Step 1: title ---
const TitleStep: FC<{ title: string; onChange: (v: string) => void; onNext: () => void; onBack: () => void }> = ({ title, onChange, onNext, onBack }) => (
  <div style={styles.page}>
    <BackLink onClick={onBack} label="← Back to saved decisions" />
    <span style={styles.stepBadge}>Step 1</span>
    <p style={styles.stepPrompt}>What are you deciding?</p>
    <p style={styles.helperText}>Give it a short name so you can find it again later — e.g. "Swing shift vs night shift."</p>
    <input
      style={styles.titleInput}
      placeholder="e.g. Swing shift vs night shift"
      value={title}
      onChange={(e) => onChange(e.target.value)}
      autoFocus
    />
    <div style={styles.navRow}>
      <button className="btn btn-primary" onClick={onNext} disabled={!title.trim()}>Next</button>
    </div>
  </div>
);

// --- Step 2: options/choices ---
const ChoicesStep: FC<{
  choices: WizardChoice[];
  onChange: (choices: WizardChoice[]) => void;
  onNext: () => void;
  onBack: () => void;
}> = ({ choices, onChange, onNext, onBack }) => {
  const [draft, setDraft] = useState('');

  function addChoice() {
    const label = draft.trim();
    if (!label) return;
    onChange([...choices, { ...newChoice(), label }]);
    setDraft('');
  }

  function removeChoice(id: string) {
    onChange(choices.filter((c) => c.id !== id));
  }

  return (
    <div style={styles.page}>
      <BackLink onClick={onBack} />
      <span style={styles.stepBadge}>Step 2</span>
      <p style={styles.stepPrompt}>What are your options?</p>
      <p style={styles.helperText}>List every real option you're weighing. You'll add likely outcomes for each one next.</p>

      {choices.map((c) => (
        <div key={c.id} style={styles.chip}>
          <span style={styles.chipLabel}>{c.label}</span>
          <button style={styles.removeBtn} onClick={() => removeChoice(c.id)}><Icon name="icon-trash2" size={14} /></button>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 6 }}>
        <input
          style={styles.labelInput}
          placeholder="e.g. Take the swing shift"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addChoice(); }}
        />
        <button style={styles.addBtn} onClick={addChoice}>+ Add option</button>
      </div>

      {choices.length < 2 && (
        <p style={styles.probabilityWarn}>Add at least 2 options so there's something to compare.</p>
      )}

      <div style={styles.navRow}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>Back</button>
        <button className="btn btn-primary" onClick={onNext} disabled={choices.length < 2}>Next</button>
      </div>
    </div>
  );
};

// --- Step 3: outcomes, one option at a time ---
const OutcomesStep: FC<{
  choice: WizardChoice;
  index: number;
  total: number;
  onChange: (outcomes: WizardOutcome[]) => void;
  onNext: () => void;
  onBack: () => void;
}> = ({ choice, index, total, onChange, onNext, onBack }) => {
  const [draft, setDraft] = useState(newOutcomeDraft());

  function addOutcome() {
    if (!draft.label.trim()) return;
    onChange([...choice.outcomes, { id: crypto.randomUUID(), ...draft, label: draft.label.trim() }]);
    setDraft(newOutcomeDraft());
  }

  function removeOutcome(id: string) {
    onChange(choice.outcomes.filter((o) => o.id !== id));
  }

  const probabilitySum = choice.outcomes.reduce((sum, o) => sum + (o.probability ?? 0), 0);
  const ev = evForChoice(choice);
  const isLast = index === total - 1;

  return (
    <div style={styles.page}>
      <BackLink onClick={onBack} />
      <span style={styles.stepBadge}>Step 3 · Option {index + 1} of {total}</span>
      <p style={styles.stepPrompt}>What could happen if you choose "{choice.label}"?</p>
      <p style={styles.helperText}>
        Add each realistic outcome. <strong>Probability</strong> is how likely it is, as a % (outcomes for
        one option should add up to roughly 100%). <strong>Payoff</strong> is how good or bad that outcome
        would be — pick any scale you like (e.g. -10 to 10), just stay consistent across outcomes.
      </p>

      {choice.outcomes.map((o) => (
        <div key={o.id} style={styles.outcomeRow}>
          <span style={{ ...styles.chipLabel, flex: 'unset', minWidth: 0 }}>
            {o.label}
            {o.probability != null && <span style={{ color: 'var(--ink-muted)', fontWeight: 400 }}> — {o.probability}%</span>}
            {o.payoffValue != null && <span style={{ color: 'var(--ink-muted)', fontWeight: 400 }}> · payoff {o.payoffValue}</span>}
          </span>
          <button style={styles.removeBtn} onClick={() => removeOutcome(o.id)}><Icon name="icon-trash2" size={14} /></button>
        </div>
      ))}

      {choice.outcomes.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          {ev != null && <span style={styles.evBadge}>EV so far: {ev.toFixed(1)}</span>}
          {probabilitySum !== 0 && (
            <span style={{ fontSize: '0.68rem', color: Math.abs(probabilitySum - 100) > 1 ? 'var(--pink-dark)' : 'var(--ink-muted)' }}>
              Total probability: {probabilitySum}%
            </span>
          )}
        </div>
      )}

      <div style={styles.container}>
        <label style={styles.fieldLabel}>Outcome</label>
        <input
          style={{ ...styles.labelInput, width: '100%', marginBottom: 8 }}
          placeholder="e.g. It works out great"
          value={draft.label}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })}
        />
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={styles.fieldLabel}>Probability (%)</label>
            <input
              style={{ ...styles.smallInput, width: '100%' }}
              type="number"
              placeholder="e.g. 60"
              value={draft.probability ?? ''}
              onChange={(e) => setDraft({ ...draft, probability: e.target.value === '' ? undefined : Number(e.target.value) })}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={styles.fieldLabel}>Payoff</label>
            <input
              style={{ ...styles.smallInput, width: '100%' }}
              type="number"
              placeholder="e.g. 8"
              value={draft.payoffValue ?? ''}
              onChange={(e) => setDraft({ ...draft, payoffValue: e.target.value === '' ? undefined : Number(e.target.value) })}
            />
          </div>
        </div>
        <label style={styles.fieldLabel}>Note (optional)</label>
        <input
          style={{ ...styles.labelInput, width: '100%', marginBottom: 10, fontStyle: 'italic', fontSize: '0.85rem' }}
          placeholder="Any extra context..."
          value={draft.note ?? ''}
          onChange={(e) => setDraft({ ...draft, note: e.target.value })}
        />
        <button style={styles.addBtn} onClick={addOutcome} disabled={!draft.label.trim()}>+ Add outcome</button>
      </div>

      {choice.outcomes.length === 0 && (
        <p style={styles.probabilityWarn}>Add at least 1 outcome before moving on.</p>
      )}

      <div style={styles.navRow}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>Back</button>
        <button className="btn btn-primary" onClick={onNext} disabled={choice.outcomes.length === 0}>
          {isLast ? 'Review' : 'Next option'}
        </button>
      </div>
    </div>
  );
};

// --- Step 4: review + save ---
const ReviewStep: FC<{
  title: string;
  choices: WizardChoice[];
  onEditChoices: () => void;
  onEditOutcomes: (index: number) => void;
  onSave: () => void;
  onBack: () => void;
  saving: boolean;
  saveError: string | null;
}> = ({ title, choices, onEditChoices, onEditOutcomes, onSave, onBack, saving, saveError }) => {
  const scored = choices.map((c) => ({ choice: c, ev: evForChoice(c) }));
  const bestEv = scored.reduce<number | null>((best, s) => (s.ev != null && (best == null || s.ev > best) ? s.ev : best), null);

  return (
    <div style={styles.page}>
      <BackLink onClick={onBack} />
      <span style={styles.stepBadge}>Review</span>
      <p style={styles.stepPrompt}>{title}</p>
      {bestEv != null && (
        <p style={styles.helperText}>The highlighted option has the best expected value based on what you entered — but you know your situation better than the math does.</p>
      )}

      <button style={{ ...styles.backBtn, marginBottom: 4, cursor: 'pointer' }} onClick={onEditChoices}>Edit options</button>

      {scored.map(({ choice, ev }, i) => {
        const isBest = bestEv != null && ev === bestEv;
        return (
          <div
            key={choice.id}
            style={{
              ...styles.container,
              border: isBest ? '2px solid var(--pink-dark)' : styles.container.border,
              background: isBest ? 'var(--blush)' : styles.container.background,
              marginBottom: 4,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                {isBest && '⭐ '}{choice.label}
              </span>
              {ev != null && <span style={styles.evBadge}>EV: {ev.toFixed(1)}</span>}
            </div>
            {choice.outcomes.map((o) => (
              <div key={o.id} style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginBottom: 2 }}>
                {o.label}
                {o.probability != null && ` — ${o.probability}%`}
                {o.payoffValue != null && ` · payoff ${o.payoffValue}`}
                {o.note && ` (${o.note})`}
              </div>
            ))}
            <button
              style={{ ...styles.backBtn, marginTop: 6, fontSize: '0.72rem', cursor: 'pointer' }}
              onClick={() => onEditOutcomes(i)}
            >
              Edit outcomes
            </button>
          </div>
        );
      })}

      <button style={styles.saveBtn} onClick={onSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save decision'}
      </button>
      {saveError && <p style={styles.errorText}>Couldn't save: {saveError}</p>}
    </div>
  );
};

type WizardStep = 'title' | 'choices' | 'outcomes' | 'review';

const DecisionWizard: FC<{ treeId?: string; onBack: () => void; onSaved: (id: string) => void }> = ({ treeId, onBack, onSaved }) => {
  const [title, setTitle] = useState('');
  const [choices, setChoices] = useState<WizardChoice[]>([]);
  const [rowId, setRowId] = useState<string | undefined>(treeId);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>(treeId ? 'loading' : 'ready');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<WizardStep>(treeId ? 'review' : 'title');
  const [outcomeIndex, setOutcomeIndex] = useState(0);

  useEffect(() => {
    if (!treeId) {
      setStatus('ready');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    Promise.resolve(
      supabase
        .from('decision_trees')
        .select('*')
        .eq('id', treeId)
        .maybeSingle()
    )
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setLoadError(error.message);
          setStatus('error');
          return;
        }
        if (!data) {
          setLoadError('This decision could not be found.');
          setStatus('error');
          return;
        }
        setTitle((data as any).title ?? '');
        setChoices(choicesFromRoot(normalizeNode((data as any).root)));
        setRowId((data as any).id);
        setStep('review');
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err?.message ?? 'Something went wrong loading this decision.');
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [treeId]);

  function updateOutcomesFor(index: number, outcomes: WizardOutcome[]) {
    setChoices((prev) => prev.map((c, i) => (i === index ? { ...c, outcomes } : c)));
  }

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    const root = rootFromChoices(title, choices);
    try {
      if (rowId) {
        const { error } = await supabase.from('decision_trees').update({ title, root, updated_at: new Date().toISOString() }).eq('id', rowId);
        if (error) throw error;
        onSaved(rowId);
      } else {
        const { data, error } = await supabase.from('decision_trees').insert({ title, root }).select().maybeSingle();
        if (error) throw error;
        if (data) {
          setRowId((data as any).id);
          onSaved((data as any).id);
        }
      }
    } catch (err: any) {
      setSaveError(err?.message ?? 'Something went wrong saving this decision.');
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading') return <div style={styles.page}><p>Loading decision...</p></div>;
  if (status === 'error') return <div style={styles.page}><p style={styles.errorText}>Couldn't load: {loadError}</p></div>;

  if (step === 'title') {
    return <TitleStep title={title} onChange={setTitle} onNext={() => setStep('choices')} onBack={onBack} />;
  }

  if (step === 'choices') {
    return (
      <ChoicesStep
        choices={choices}
        onChange={setChoices}
        onBack={() => setStep(rowId ? 'review' : 'title')}
        onNext={() => {
          setOutcomeIndex(0);
          setStep(choices.length > 0 ? 'outcomes' : 'choices');
        }}
      />
    );
  }

  if (step === 'outcomes' && choices[outcomeIndex]) {
    return (
      <OutcomesStep
        choice={choices[outcomeIndex]}
        index={outcomeIndex}
        total={choices.length}
        onChange={(outcomes) => updateOutcomesFor(outcomeIndex, outcomes)}
        onBack={() => (outcomeIndex === 0 ? setStep('choices') : setOutcomeIndex((i) => i - 1))}
        onNext={() => (outcomeIndex === choices.length - 1 ? setStep('review') : setOutcomeIndex((i) => i + 1))}
      />
    );
  }

  return (
    <ReviewStep
      title={title}
      choices={choices}
      onEditChoices={() => setStep('choices')}
      onEditOutcomes={(i) => { setOutcomeIndex(i); setStep('outcomes'); }}
      onSave={handleSave}
      onBack={onBack}
      saving={saving}
      saveError={saveError}
    />
  );
};

const DecisionTreeCard: FC<{
  tree: SavedTreeSummary;
  onSelect: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
}> = ({ tree, onSelect, onDelete }) => {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <div style={styles.treeCard}>
      <button style={styles.treeCardMain} onClick={() => onSelect(tree.id)}>
        <span style={styles.treeCardTitle}>{tree.title?.trim() ? tree.title : 'Untitled decision'}</span>
        {tree.updated_at && (
          <span style={styles.treeCardMeta}>Updated {new Date(tree.updated_at).toLocaleDateString()}</span>
        )}
      </button>
      {!confirming ? (
        <button style={styles.deleteBtn} onClick={() => setConfirming(true)}>Delete</button>
      ) : (
        <>
          <button
            style={styles.deleteConfirmBtn}
            disabled={deleting}
            onClick={async () => {
              setDeleting(true);
              await onDelete(tree.id);
              setDeleting(false);
            }}
          >
            {deleting ? '...' : 'Confirm'}
          </button>
          <button style={styles.deleteCancelBtn} onClick={() => setConfirming(false)}>Cancel</button>
        </>
      )}
    </div>
  );
};

const DecisionTreeList: FC<{ onSelect: (id: string) => void; onNew: () => void; refreshKey: number }> = ({ onSelect, onNew, refreshKey }) => {
  const [trees, setTrees] = useState<SavedTreeSummary[]>([]);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    Promise.resolve(
      supabase
        .from('decision_trees')
        .select('id, title, updated_at')
        .order('updated_at', { ascending: false })
    )
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setError(error.message);
          setStatus('error');
          return;
        }
        setTrees((data as SavedTreeSummary[]) ?? []);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message ?? 'Something went wrong loading your decisions.');
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const handleDelete = async (id: string) => {
    setDeleteError(null);
    const { error } = await supabase.from('decision_trees').delete().eq('id', id);
    if (error) {
      setDeleteError(error.message);
      return;
    }
    setTrees((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div style={styles.page}>
      <div style={{ ...styles.listHeaderRow, justifyContent: 'flex-end' }}>
        <button style={styles.newBtn} onClick={onNew}>+ New decision</button>
      </div>
      {status === 'loading' && <p>Loading saved decisions...</p>}
      {status === 'error' && <p style={styles.errorText}>Couldn't load decisions: {error}</p>}
      {deleteError && <p style={styles.errorText}>Couldn't delete: {deleteError}</p>}
      {status === 'ready' && trees.length === 0 && (
        <EmptyState
        image={emptyDecision}
        message="Nothing decided yet"
    subMessage="Add your first decision below"
  />
      )}
      {status === 'ready' && trees.map((t) => (
        <DecisionTreeCard key={t.id} tree={t} onSelect={onSelect} onDelete={handleDelete} />
      ))}
    </div>
  );
};

const DeepDiveDecisions: FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'editor'>('list');
  const [refreshKey, setRefreshKey] = useState(0);

  if (mode === 'editor') {
    return (
      <DecisionWizard
        treeId={selectedId ?? undefined}
        onBack={() => {
          setRefreshKey((k) => k + 1);
          setMode('list');
        }}
        onSaved={(id) => setSelectedId(id)}
      />
    );
  }

  return (
    <DecisionTreeList
      refreshKey={refreshKey}
      onSelect={(id) => {
        setSelectedId(id);
        setMode('editor');
      }}
      onNew={() => {
        setSelectedId(null);
        setMode('editor');
      }}
    />
  );
};

type TopTab = 'quick' | 'deep';

const DecisionPage: FC = () => {
  const [tab, setTab] = useState<TopTab>('quick');

  return (
    <div style={styles.page}>
      <div className="title-row" style={{ marginBottom: 12 }}>
        <h2 style={styles.pageTitle}><Icon name="title-decisions" size={22} />Decisions</h2>
        
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {(['quick', 'deep'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '6px 12px', borderRadius: 12,
              background: tab === t ? 'var(--blush)' : 'transparent',
              border: `1.5px solid ${tab === t ? 'var(--pink-dark)' : 'var(--border)'}`,
              color: tab === t ? 'var(--pink-dark)' : 'var(--ink-muted)',
              fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
            }}
          >
            {t === 'quick' ? 'Help me decide' : 'Deep dive'}
          </button>
        ))}
      </div>

      {tab === 'quick' ? <QuickDecide /> : <DeepDiveDecisions />}
    </div>
  );
};

export default DecisionPage;
