import NavIcon from './NavIcon';

interface BottomNavProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const TABS = [
  {
    id: 'dashboard',
    label: 'Home',
    icon: <NavIcon name="dashboard" size={35} />,
  },
  {
    id: 'wallet',
    label: 'Wallet',
    icon: <NavIcon name="wallet" size={35} />,
  },
  {
    id: 'dailyplanner',
    label: 'Planning',
    icon: <NavIcon name="planner" size={35} />,
  },
  {
    id: 'habitat',
    label: 'Habitat',
    icon: <NavIcon name="habitat" size={35} />,
  },
];

export default function BottomNav({ currentPage, onNavigate }: BottomNavProps) {
  return (
    <div className="bottombar-wrap">
      <nav className="bottombar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`bottombar-tab ${currentPage === tab.id ? 'active' : ''}`}
            onClick={() => onNavigate(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
