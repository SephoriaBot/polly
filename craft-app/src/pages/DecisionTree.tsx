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
  note?: string; // payoff / result note
  children: TreeNode[];
}

interface DecisionTreeRow {
  id: string;
  title: string;
  root: TreeNode;
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

function updateNodeInTree(node: TreeNode, targetId: string, fn: (n: TreeNode) => TreeNode): TreeNode {
  if (node.id === targetId) return fn(node);
  return { ...node, children: node.children.map((c) => updateNodeInTree(c, targetId, fn)) };
}

function removeNodeFromTree(node: TreeNode, targetId: string): TreeNode {
  return {
    ...node,
    children: node.children
      .filter((c) => c.id !== targetId)
      .map((c) => removeNodeFromTree(c, targetId)),
  };
}

// --- Recursive node renderer ---

const TreeNodeView: FC<{
  node: TreeNode;
  depth: number;
  onChange: (id: string, fn: (n: TreeNode) => TreeNode) => void;
  onRemove: (id: string) => void;
}> = ({ node, depth, onChange, onRemove }) => {
  const [collapsed, setCollapsed] = useState(false);

  const childType: NodeType = node.type === 'root' || node.type === 'choice' ? 'choice' : 'outcome';
  // root/choice nodes branch into choices; you can also add an outcome leaf under a choice
  const canAddOutcome = node.type === 'choice';

  return (
    <div className={`dt-node dt-${node.type}`} style={{ marginLeft: depth === 0 ? 0 : 20 }}>
      <div className="dt-node-row">
        {node.children.length > 0 && (
          <button className="dt-collapse-btn" onClick={() => setCollapsed((c) => !c)} aria-label="Toggle branch">
            {collapsed ? '▸' : '▾'}
          </button>
        )}
        <input
          className="dt-label-input"
          placeholder={
            node.type === 'root' ? 'What are you deciding?' : node.type === 'choice' ? 'A choice...' : 'An outcome...'
          }
          value={node.label}
          onChange={(e) => onChange(node.id, (n) => ({ ...n, label: e.target.value }))}
        />
        {node.type === 'outcome' && (
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
        )}
        {node.type !== 'root' && (
          <button className="dt-remove-btn" onClick={() => onRemove(node.id)} aria-label="Remove branch">
            ✕
          </button>
        )}
      </div>

      {node.type === 'outcome' && (
        <input
          className="dt-note-input"
          placeholder="Payoff / note..."
          value={node.note ?? ''}
          onChange={(e) => onChange(node.id, (n) => ({ ...n, note: e.target.value }))}
        />
      )}

      {!collapsed && (
        <div className="dt-children">
          {node.children.map((child) => (
            <TreeNodeView key={child.id} node={child} depth={depth + 1} onChange={onChange} onRemove={onRemove} />
          ))}
          <div className="dt-add-row">
            <button
              className="dt-add-btn"
              onClick={() =>
                onChange(node.id, (n) => ({ ...n, children: [...n.children, newNode(childType)] }))
              }
            >
              + branch
            </button>
            {canAddOutcome && (
              <button
                className="dt-add-btn dt-add-outcome"
                onClick={() =>
                  onChange(node.id, (n) => ({ ...n, children: [...n.children, newNode('outcome')] }))
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

  useEffect(() => {
    if (!treeId) return;
    (async () => {
      const { data, error } = await supabase
        .from('decision_trees')
        .select('*')
        .eq('id', treeId)
        .maybeSingle<DecisionTreeRow>();
      if (!error && data) {
        setTitle(data.title);
        setRoot(data.root);
        setRowId(data.id);
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
    if (rowId) {
      await supabase
        .from('decision_trees')
        .update({ title, root, updated_at: new Date().toISOString() })
        .eq('id', rowId);
    } else {
      const { data } = await supabase
        .from('decision_trees')
        .insert({ title, root })
        .select()
        .maybeSingle<DecisionTreeRow>();
      if (data) setRowId(data.id);
    }
    setSaving(false);
  };

  return (
    <div className="dt-page">
      <input
        className="dt-title-input"
        placeholder="Decision title (e.g. Swing shift vs night shift)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="dt-tree-container">
        <TreeNodeView node={root} depth={0} onChange={handleChange} onRemove={handleRemove} />
      </div>
      <button className="dt-save-btn" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save decision'}
      </button>
    </div>
  );
};

export default DecisionTree;
