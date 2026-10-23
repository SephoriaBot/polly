// Shared horizontally-scrollable pill tab bar, used to split up pages that
// were getting long (Planner, Habitat, Wallet, Grocery) into focused
// single-section views instead of one long stacked scroll.
import { useEffect } from 'react';
import Icon, { type IconName } from './Icon';
import { loadSavedTab, saveTab } from '../lib/navMemory';

export interface PageTab<T extends string> {
  key: T;
  label: string;
  icon: IconName;
}

interface PageTabsProps<T extends string> {
  tabs: PageTab<T>[];
  active: T;
  onChange: (key: T) => void;
}

export default function PageTabs<T extends string>({ tabs, active, onChange }: PageTabsProps<T>) {
  const tabKeys = tabs.map(t => t.key as string);
  const tabSetId = tabKeys.join('|');

  // On first mount, jump back to the tab you were last on.
  useEffect(() => {
    const saved = loadSavedTab(tabKeys);
    if (saved && saved !== active) onChange(saved as T);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Remember the tab whenever it changes.
  useEffect(() => {
    saveTab(tabKeys, active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, tabSetId]);

  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        paddingBottom: 4,
        marginBottom: 16,
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}
    >
      {tabs.map(tab => {
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
              padding: '8px 14px', borderRadius: 999,
              border: `1.5px solid ${isActive ? 'var(--primary)' : 'var(--border)'}`,
              background: isActive ? 'var(--primary)' : 'var(--surface)',
              color: isActive ? 'var(--btn-ink)' : 'var(--ink-muted)',
              fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
              transition: '0.15s ease',
            }}
          >
            <Icon name={tab.icon} size={14} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
