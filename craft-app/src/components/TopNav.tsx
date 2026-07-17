import { useEffect, useState } from 'react';
import ThemeToggle from './ThemeToggle';

interface TopNavProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const DASHBOARD = { id: 'dashboard', label: 'Dashboard' };

const SECTIONS = [
  {
    id: 'home',
    label: 'Home',
    items: [
      { id: 'maidwizard', label: 'Maid Wizard' },
    ],
  },
  {
    id: 'planning',
    label: 'Planning',
    items: [
      { id: 'dailyplanner', label: 'Daily Planner' },
      { id: 'wallet', label: 'Wallet' },
      { id: 'trackers', label: 'Trackers' },
      { id: 'decisions', label: 'Decisions' },
    ],
  },
  {
    id: 'open-kitchen',
    label: 'Open Kitchen',
    items: [
      { id: 'meals', label: 'Meals' },
      { id: 'grocery', label: 'Grocery List' },
    ],
  },
];

const ALL_ITEMS = [DASHBOARD, ...SECTIONS.flatMap(s => s.items)];

export default function TopNav({ currentPage, onNavigate }: TopNavProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  function go(page: string) {
    onNavigate(page);
    setOpen(false);
  }

  const currentLabel = ALL_ITEMS.find(i => i.id === currentPage)?.label ?? 'Dashboard';

  return (
    <>
      <header className="topbar">
        <span className="topbar-mark">Polly</span>
        <button className="topbar-trigger" onClick={() => setOpen(true)}>
          {currentLabel} · Menu
        </button>
      </header>

      {open && (
        <>
          <div className="nav-sheet-backdrop" onClick={() => setOpen(false)} />
          <div className="nav-sheet">
            <div className="nav-sheet-header">
              <span className="topbar-mark">Polly</span>
              <button className="nav-close" onClick={() => setOpen(false)}>Close</button>
            </div>

            <button
              className={`nav-dashboard-link ${currentPage === 'dashboard' ? 'active' : ''}`}
              onClick={() => go('dashboard')}
            >
              Dashboard
            </button>

            {SECTIONS.map(section => (
              <div className="nav-group" key={section.id}>
                <div className="nav-group-label">{section.label}</div>
                <div className="nav-group-items">
                  {section.items.map(item => (
                    <button
                      key={item.id}
                      className={`nav-link ${currentPage === item.id ? 'active' : ''}`}
                      onClick={() => go(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
