import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { supabase } from '../lib/supabase'; // adjust path to your existing client
import './DecisionTree.css';

type NodeType = 'root' | 'choice' | 'outcome';

interface TreeNode {
  id: string;
  label: string;
  type: NodeType;
  probability?: number; // 0-100, only meaningful on 'outcome' nodes
  payoffValue?: number; // numeric payoff, only meaningful on 'outcome' nodes
  note?: string; // optional free-text annotation
  children: TreeNode[];
}

interface DecisionTreeRow {
  id: string;
  title: string;
  root: unknown;
  created_at: string;
  updated_at: string;
}

function newNode(type: NodeType): TreeNode {
  return {
    id: crypto.randomUUID(),
    label: '',
    type,
    children: [],
  };
}

// Repairs any saved data that's missing fields (e.g. older saves without children arrays)
// so old/incomplete data can never crash the renderer.
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
    children: (node.children ?? [])
      .filter((c) => c.id !== targetId)
      .map((c) => removeNodeFromTree(c, targetId)),
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

function siblingProbabilitySum(node: TreeNode): number | null {
  const children = node.children ?? [];
  const outcomeSiblings = children.filter((c) => c.type === 'outcome');
  if (outcomeSiblings.length === 0) return null;
  return outcomeSiblings.reduce((sum, c) => sum + (c.probability ?? 0), 0);
}

// --- Recursive node renderer ---

const TreeNodeView: FC<{
  node: TreeNode;
  depth: number;
  onChange: (id: string, fn: (n: TreeNode) => TreeNode) => void;
  onRemove: (id: string) => void;
}> = ({ node, depth, onChange, onRemove }) => {
  const [collapsed, setCollapsed] = useState(false);

  const children = node.children ?? [];
  const childType: NodeType = node.type === 'root' || node.type === 'choice' ? 'choice' : 'outcome';
  const canAddOutcome = node.type === 'choice';
  const ev = node.type !== 'outcome' ? expectedValue(node) : null;
  const probSum = siblingProbabilitySum(node);
  const probWarning = probSum != null && probSum !== 100;

  return (
    <div className={`dt-node dt-${node.type}`} style={{ marginLeft: depth === 0 ? 0 : 20 }}>
      <div className="dt-node-row">
        {children.length > 0 && (
          <button className="dt-collapse-btn" onClick={() => setCollapsed((c) => !c)} aria-label="Toggle branch">
            {collapsed ? '▸' : '▾'}
          </button>
        )}
        <input
          className="dt-label-input"
          placeholder={
            node.type === 'root' ? 'What are you deciding?' : node.type === 'choice' ? 'A choice...' : 'An outcome...'
          }
          value={node.label ?? ''}
          onChange={(e) => onChange(node.id, (n) => ({ ...n, label: e.target.value }))}
        />
        {node.type === 'outcome' && (
          <>
            <input
              className="dt-prob-input"
              type="number"
              min={0}
              max={100}
              placeholder="%"
              value={node.probability ?? ''}
              onChange={(e) =>
                onChange(node.id, (n) => ({
                  ...n,
                  probability: e.target.value === '' ? undefined : Number(e.target.value),
                }))
              }
            />
            <input
              className="dt-payoff-input"
              type="number"
              placeholder="payoff"
              value={node.payoffValue ?? ''}
              onChange={(e) =>
                onChange(node.id, (n) => ({
                  ...n,
                  payoffValue: e.target.value === '' ? undefined : Number(e.target.value),
                }))
              }
            />
          </>
        )}
        {ev != null && <span className="dt-ev-badge">EV: {ev.toFixed(1)}</span>}
        {node.type !== 'root' && (
          <button className="dt-remove-btn" onClick={() => onRemove(node.id)} aria-label="Remove branch">
            ✕
          </button>
        )}
      </div>

      {probWarning && (
        <div className="dt-prob-warning">Outcome probabilities add up to {probSum}%, not 100%</div>
      )}

      {node.type === 'outcome' && (
        <input
          className="dt-note-input"
          placeholder="Note (optional)..."
          value={node.note ?? ''}
          onChange={(e) => onChange(node.id, (n) => ({ ...n, note: e.target.value }))}
        />
      )}

      {!collapsed && (
        <div className="dt-children">
          {children.map((child) => (
            <TreeNodeView key={child.id} node={child} depth={depth + 1} onChange={onChange} onRemove={onRemove} />
          ))}
          <div className="dt-add-row">
            <button
              className="dt-add-btn"
              onClick={() =>
                onChange(node.id, (n) => ({ ...n, children: [...(n.children ?? []), newNode(childType)] }))
              }
            >
              + branch
            </button>
            {canAddOutcome && (
              <button
                className="dt-add-btn dt-add-outcome"
                onClick={() =>
                  onChange(node.id, (n) => ({ ...n, children: [...(n.children ?? []), newNode('outcome')] }))
                }
              >
                + outcome
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// --- Page component ---

const DecisionTree: FC<{ treeId?: string }> = ({ treeId }) => {
  const [title, setTitle] = useState('');
  const [root, setRoot] = useState<TreeNode>(newNode('root'));
  const [rowId, setRowId] = useState<string | undefined>(treeId);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!treeId);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!treeId) return;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const { data, error } = await supabase
          .from('decision_trees')
          .select('*')
          .eq('id', treeId)
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          setLoadError('This decision could not be found.');
          return;
        }
        setTitle((data as any).title ?? '');
        setRoot(normalizeNode((data as any).root));
        setRowId((data as any).id);
      } catch (err: any) {
        console.error('Decision tree load failed:', err);
        setLoadError(err?.message ?? 'Something went wrong loading this decision.');
      } finally {
        setLoading(false);
      }
    })();
  }, [treeId]);

  const handleChange = (id: string, fn: (n: TreeNode) => TreeNode) => {
    setRoot((r) => updateNodeInTree(r, id, fn));
  };

  const handleRemove = (id: string) => {
    setRoot((r) => removeNodeFromTree(r, id));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      if (rowId) {
        const { error } = await supabase
          .from('decision_trees')
          .update({ title, root, updated_at: new Date().toISOString() })
          .eq('id', rowId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('decision_trees')
          .insert({ title, root })
          .select()
          .maybeSingle<DecisionTreeRow>();
        if (error) throw error;
        if (data) setRowId(data.id);
      }
    } catch (err: any) {
      console.error('Decision tree save failed:', err);
      setSaveError(err?.message ?? 'Something went wrong saving this decision.');
    } finally {
      setSaving(false);
    }
  };

  const overallEV = expectedValue(root);

  if (loading) {
    return (
      <div className="dt-page">
        <p className="dt-hint">Loading decision...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="dt-page">
        <p className="dt-error">Couldn't load this decision: {loadError}</p>
      </div>
    );
  }

  return (
    <div className="dt-page">
      <input
        className="dt-title-input"
        placeholder="Decision title (e.g. Swing shift vs night shift)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      {overallEV != null && (
        <div className="dt-overall-ev">Overall expected value: {overallEV.toFixed(1)}</div>
      )}
      <div className="dt-tree-container">
        <TreeNodeView node={root} depth={0} onChange={handleChange} onRemove={handleRemove} />
      </div>
      <p className="dt-hint">
        Tip: give each branch a comparable payoff number (dollars, or a 1-10 happiness score) and a probability.
        Each choice's EV = sum of (probability × payoff) across its outcomes.
      </p>
      <button className="dt-save-btn" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save decision'}
      </button>
      {saveError && <p className="dt-error">Couldn't save: {saveError}</p>}
    </div>
  );
};

export default DecisionTree;
