import { useState } from 'react';
import Icon, { type IconName } from './Icon';

interface BottomNavProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const PRIMARY_TABS = [
  {
    id: 'dashboard',
    label: 'Home',
    icon: <Icon name="icon-home" size={25} />,
  },
  {
    id: 'wallet',
    label: 'Wallet',
    icon: <Icon name="icon-wallet" size={25} />,
  },
  {
    id: 'dailyplanner',
    label: 'Planner',
    icon: <Icon name="icon-planner" size={25} />,
  },
  {
    id: 'habitat',
    label: 'Habitat',
    icon: <Icon name="icon-habitat" size={25} />,
  },
];

// Items that live in the expandable row. No sections/labels here anymore —
// just a flat row of icon tabs that slides open above the primary bar.
const MORE_ITEMS = [
  {
    id: 'trackers',
    label: 'Trackers',
    icon: <Icon name="icon-trackers" size={25} />,
  },
  {
    id: 'meals',
    label: 'Meals',
    icon: <Icon name="icon-meals" size={25} />,
  },
  {
    id: 'grocery',
    label: 'Grocery',
    icon: <Icon name="icon-grocery" size={25} />,
  },
  {
    id: 'decisions',
    label: 'Decisions',
    icon: <Icon name="icon-decisions" size={25} />,
  },
  {
    id: 'maidwizard',
    label: 'Maid Wizard',
    icon: <Icon name="icon-maidwizard" size={25} />,
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