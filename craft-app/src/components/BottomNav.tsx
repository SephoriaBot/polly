import { useState } from 'react';

interface BottomNavProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const PRIMARY_TABS = [
  {
    id: 'dashboard',
    label: 'Home',
    icon: (
      <svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></svg>
    ),
  },
  {
    id: 'wallet',
    label: 'Wallet',
    icon: (
      <svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><circle cx="16" cy="14" r="1.4" /></svg>
    ),
  },
  {
    id: 'dailyplanner',
    label: 'Planner',
    icon: (
      <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
    ),
  },
  {
    id: 'trackers',
    label: 'Trackers',
    icon: (
      <svg viewBox="0 0 24 24"><path d="M3 17l5-5 4 4 9-9" /><path d="M14 7h6v6" /></svg>
    ),
  },
  {
    id: 'habitat',
    label: 'Habitat',
    icon: (
      <svg viewBox="0 0 24 24">
        <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
        <circle cx="5" cy="9.5" r="1.6" /><circle cx="19" cy="9.5" r="1.6" />
        <path d="M6 15c0-3.3 2.7-6 6-6s6 2.7 6 6-2.7 5-6 5-6-1.7-6-5z" />
      </svg>
    ),
  },
];

// Items that live in the expandable row. No sections/labels here anymore —
// just a flat row of icon tabs that slides open above the primary bar.
const MORE_ITEMS = [
  {
    id: 'meals',
    label: 'Meals',
    icon: (
      <svg viewBox="0 0 24 24"><path d="M8 3v7a2 2 0 002 2v9" /><path d="M8 3v4M11 3v4" /><path d="M16 3c-1.4 0-2.5 1.8-2.5 4s1.1 4 2.5 4v10" /></svg>
    ),
  },
  {
    id: 'grocery',
    label: 'Grocery',
    icon: (
      <svg viewBox="0 0 24 24"><path d="M6 8h12l-1.2 12H7.2L6 8z" /><path d="M9 8V6a3 3 0 016 0v2" /></svg>
    ),
  },
  {
    id: 'decisions',
    label: 'Decisions',
    icon: (
      <svg viewBox="0 0 24 24"><path d="M12 3v6" /><path d="M12 9L6 21" /><path d="M12 9l6 12" /><circle cx="12" cy="3" r="1.4" /></svg>
    ),
  },
  {
    id: 'maidwizard',
    label: 'Maid Wizard',
    icon: (
      <svg viewBox="0 0 24 24"><path d="M5 20L18 7" /><path d="M15 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" /></svg>
    ),
  },
];

const MORE_ITEM_IDS = MORE_ITEMS.map((i) => i.id);

export default function BottomNav({ currentPage, onNavigate }: BottomNavProps) {
  const [expanded, setExpanded] = useState(false);
  const isMoreActive = MORE_ITEM_IDS.includes(currentPage);

  function go(page: string) {
    onNavigate(page);
    setExpanded(false);
  }

  return (
    <div className="bottombar-wrap">
      {expanded && (
        <div className="bottombar-expand">
          {MORE_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`bottombar-tab ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => go(item.id)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}

      <nav className="bottombar">
        {PRIMARY_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`bottombar-tab ${currentPage === tab.id ? 'active' : ''}`}
            onClick={() => go(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
        <button
          className={`bottombar-tab ${isMoreActive ? 'active' : ''}`}
          onClick={() => setExpanded((e) => !e)}
        >
          <svg
            viewBox="0 0 24 24"
            style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
          More
        </button>
      </nav>
    </div>
  );
}