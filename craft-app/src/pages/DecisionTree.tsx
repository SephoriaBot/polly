import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { supabase } from '../lib/supabase'; // adjust path to your existing client

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
  titleInput: { fontSize: '1.1rem', fontWeight: 600, padding: '10px 14px', borderRadius: 12, border: '2px solid #f3c9d4', background: '#fdf6ee', color: '#4a3b3b' },
  container: { background: '#fdf6ee', border: '2px solid #f3c9d4', borderRadius: 16, padding: 14, minHeight: 60 },
  nodeRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 },
  labelInput: { flex: 1, padding: '8px 12px', borderRadius: 10, border: '1px solid #f3c9d4', background: '#fff', fontSize: '0.95rem' },
  smallInput: { width: 60, padding: '8px 6px', borderRadius: 10, border: '1px solid #f3c9d4', textAlign: 'center' as const },
  addBtn: { background: '#f3c9d4', color: '#6b3f4b', border: 'none', borderRadius: 10, padding: '6px 12px', fontSize: '0.8rem' },
  saveBtn: { background: '#f4a988', color: '#5a3521', border: 'none', borderRadius: 12, padding: '10px 20px', fontWeight: 600, alignSelf: 'flex-start' as const },
  evBadge: { fontSize: '0.75rem', fontWeight: 700, color: '#6b3f2b', background: '#f4a988', padding: '3px 8px', borderRadius: 10 },
  removeBtn: { background: 'none', border: 'none', color: '#c98b8b', fontSize: '0.85rem' },
  errorText: { color: '#b85c5c', fontWeight: 600 },
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
    <div style={{ marginLeft: depth === 0 ? 0 : 20, borderLeft: depth > 0 ? '2px dotted #f3c9d4' : 'none', paddingLeft: depth > 0 ? 10 : 0 }}>
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
          <button style={styles.removeBtn} onClick={() => onRemove(node.id)}>✕</button>
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

const DecisionTree: FC<{ treeId?: string }> = ({ treeId }) => {
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
    supabase
      .from('decision_trees')
      .select('*')
      .eq('id', treeId)
      .maybeSingle()
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
      } else {
        const { data, error } = await supabase.from('decision_trees').insert({ title, root }).select().maybeSingle();
        if (error) throw error;
        if (data) setRowId((data as any).id);
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

export default DecisionTree;
