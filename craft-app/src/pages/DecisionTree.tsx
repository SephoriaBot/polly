import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { supabase } from '../lib/supabase'; // adjust path to your existing client
import Icon from '../components/Icon';

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

function newNode(type: NodeType): TreeNode {
  return { id: crypto.randomUUID(), label: '', type, children: [] };
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

function updateNodeInTree(node: TreeNode, targetId: string, fn: (n: TreeNode) => TreeNode): TreeNode {
  if (node.id === targetId) return fn(node);
  return { ...node, children: (node.children ?? []).map((c) => updateNodeInTree(c, targetId, fn)) };
}

function removeNodeFromTree(node: TreeNode, targetId: string): TreeNode {
  return {
    ...node,
    children: (node.children ?? []).filter((c) => c.id !== targetId).map((c) => removeNodeFromTree(c, targetId)),
  };
}

function expectedValue(node: TreeNode): number | null {
  const children = node.children ?? [];
  if (children.length === 0) return null;
  let total = 0;
  let hasData = false;
  for (const child of children) {
    if (child.type === 'outcome') {
      if (child.probability != null && child.payoffValue != null) {
        total += (child.probability / 100) * child.payoffValue;
        hasData = true;
      }
    } else {
      const childEV = expectedValue(child);
      if (childEV != null) {
        total += childEV;
        hasData = true;
      }
    }
  }
  return hasData ? total : null;
}

// --- Inline style objects (no external CSS dependency, nothing can override or hide these) ---
const styles = {
  page: { padding: 16, display: 'flex', flexDirection: 'column' as const, gap: 12, minHeight: 200 },
  titleInput: { fontSize: '1.1rem', fontWeight: 600, padding: '10px 14px', borderRadius: 12, border: '2px solid var(--pink)', background: 'var(--cream)', color: 'var(--text)' },
  container: { background: 'var(--cream)', border: '2px solid var(--pink)', borderRadius: 16, padding: 14, minHeight: 60 },
  nodeRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 },
  labelInput: { flex: 1, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '0.95rem' },
  smallInput: { width: 60, padding: '8px 6px', borderRadius: 10, border: '1px solid var(--pink)', textAlign: 'center' as const },
  addBtn: { background: 'var(--pink)', color: 'var(--ink)', border: 'none', borderRadius: 10, padding: '6px 12px', fontSize: '0.8rem' },
  saveBtn: { background: 'var(--pink-dark)', color: 'var(--white)', border: 'none', borderRadius: 12, padding: '10px 20px', fontWeight: 600, alignSelf: 'flex-start' as const },
  evBadge: { fontSize: '0.75rem', fontWeight: 700, color: 'var(--pink-dark)', background: 'var(--pink-light)', padding: '3px 8px', borderRadius: 10 },
  removeBtn: { background: 'none', border: 'none', color: 'var(--danger)', fontSize: '0.85rem' },
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
  backBtn: { background: 'none', border: 'none', color: 'var(--ink-soft)', fontSize: '0.85rem', alignSelf: 'flex-start' as const, padding: 0 },
  emptyText: { color: 'var(--ink-muted)', fontStyle: 'italic' as const },
};

const TreeNodeView: FC<{
  node: TreeNode;
  depth: number;
  onChange: (id: string, fn: (n: TreeNode) => TreeNode) => void;
  onRemove: (id: string) => void;
}> = ({ node, depth, onChange, onRemove }) => {
  const children = node.children ?? [];
  const childType: NodeType = node.type === 'root' || node.type === 'choice' ? 'choice' : 'outcome';
  const canAddOutcome = node.type === 'choice';
  const ev = node.type !== 'outcome' ? expectedValue(node) : null;

  return (
    <div style={{ marginLeft: depth === 0 ? 0 : 20, borderLeft: depth > 0 ? '2px dotted var(--pink)' : 'none', paddingLeft: depth > 0 ? 10 : 0 }}>
      <div style={styles.nodeRow}>
        <input
          style={styles.labelInput}
          placeholder={node.type === 'root' ? 'What are you deciding?' : node.type === 'choice' ? 'A choice...' : 'An outcome...'}
          value={node.label ?? ''}
          onChange={(e) => onChange(node.id, (n) => ({ ...n, label: e.target.value }))}
        />
        {node.type === 'outcome' && (
          <>
            <input
              style={styles.smallInput}
              type="number"
              placeholder="%"
              value={node.probability ?? ''}
              onChange={(e) => onChange(node.id, (n) => ({ ...n, probability: e.target.value === '' ? undefined : Number(e.target.value) }))}
            />
            <input
              style={styles.smallInput}
              type="number"
              placeholder="payoff"
              value={node.payoffValue ?? ''}
              onChange={(e) => onChange(node.id, (n) => ({ ...n, payoffValue: e.target.value === '' ? undefined : Number(e.target.value) }))}
            />
          </>
        )}
        {ev != null && <span style={styles.evBadge}>EV: {ev.toFixed(1)}</span>}
        {node.type !== 'root' && (
          <button style={styles.removeBtn} onClick={() => onRemove(node.id)}><Icon name="trash-can" size={12} /></button>
        )}
      </div>

      {node.type === 'outcome' && (
        <input
          style={{ ...styles.labelInput, marginBottom: 6, fontStyle: 'italic', fontSize: '0.85rem' }}
          placeholder="Note (optional)..."
          value={node.note ?? ''}
          onChange={(e) => onChange(node.id, (n) => ({ ...n, note: e.target.value }))}
        />
      )}

      {children.map((child) => (
        <TreeNodeView key={child.id} node={child} depth={depth + 1} onChange={onChange} onRemove={onRemove} />
      ))}

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button style={styles.addBtn} onClick={() => onChange(node.id, (n) => ({ ...n, children: [...(n.children ?? []), newNode(childType)] }))}>
          + branch
        </button>
        {canAddOutcome && (
          <button style={styles.addBtn} onClick={() => onChange(node.id, (n) => ({ ...n, children: [...(n.children ?? []), newNode('outcome')] }))}>
            + outcome
          </button>
        )}
      </div>
    </div>
  );
};

const DecisionTreeEditor: FC<{ treeId?: string; onBack: () => void; onSaved: (id: string) => void }> = ({ treeId, onBack, onSaved }) => {
  const [title, setTitle] = useState('');
  const [root, setRoot] = useState<TreeNode>(newNode('root'));
  const [rowId, setRowId] = useState<string | undefined>(treeId);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>(treeId ? 'loading' : 'ready');
  const [loadError, setLoadError] = useState<string | null>(null);

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
        setRoot(normalizeNode((data as any).root));
        setRowId((data as any).id);
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

  const handleChange = (id: string, fn: (n: TreeNode) => TreeNode) => setRoot((r) => updateNodeInTree(r, id, fn));
  const handleRemove = (id: string) => setRoot((r) => removeNodeFromTree(r, id));

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
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

  const overallEV = expectedValue(root);

  return (
    <div style={styles.page}>
      <button style={styles.backBtn} onClick={onBack}>← Back to saved decisions</button>
      {status === 'loading' && <p>Loading decision...</p>}
      {status === 'error' && <p style={styles.errorText}>Couldn't load: {loadError}</p>}
      {status === 'ready' && (
        <>
          <input
            style={styles.titleInput}
            placeholder="Decision title (e.g. Swing shift vs night shift)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          {overallEV != null && <div style={styles.evBadge}>Overall EV: {overallEV.toFixed(1)}</div>}
          <div style={styles.container}>
            <TreeNodeView node={root} depth={0} onChange={handleChange} onRemove={handleRemove} />
          </div>
          <button style={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save decision'}
          </button>
          {saveError && <p style={styles.errorText}>Couldn't save: {saveError}</p>}
        </>
      )}
    </div>
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
      <div style={styles.listHeaderRow}>
        <h2 style={styles.pageTitle}>Decisions</h2>
        <button style={styles.newBtn} onClick={onNew}>+ New decision</button>
      </div>
      {status === 'loading' && <p>Loading saved decisions...</p>}
      {status === 'error' && <p style={styles.errorText}>Couldn't load decisions: {error}</p>}
      {deleteError && <p style={styles.errorText}>Couldn't delete: {deleteError}</p>}
      {status === 'ready' && trees.length === 0 && (
        <p style={styles.emptyText}>No saved decisions yet. Start a new one above.</p>
      )}
      {status === 'ready' && trees.map((t) => (
        <DecisionTreeCard key={t.id} tree={t} onSelect={onSelect} onDelete={handleDelete} />
      ))}
    </div>
  );
};

const DecisionPage: FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'editor'>('list');
  const [refreshKey, setRefreshKey] = useState(0);

  if (mode === 'editor') {
    return (
      <DecisionTreeEditor
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

export default DecisionPage;