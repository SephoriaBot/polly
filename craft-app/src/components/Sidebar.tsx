import { useState } from 'react';
import {
  Leaf, FlaskConical, Sparkles, BookOpen, Home, Wand2,
  UtensilsCrossed, ShoppingCart, Archive, CalendarDays, Lightbulb,
  PawPrint, ChefHat, PiggyBank, CalendarCheck, ChevronDown, ChevronRight,
  LineChart
} from 'lucide-react';


interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const SECTIONS = [
  {
    id: 'open-kitchen',
    label: 'Open Kitchen',
    icon: ChefHat,
    items: [
      { id: 'cook', label: 'Cook', icon: UtensilsCrossed },
      { id: 'suggest', label: 'Suggestions', icon: Lightbulb },
      { id: 'planner', label: 'Meal Planner', icon: CalendarDays },
      { id: 'grocery', label: 'Grocery List', icon: ShoppingCart },
    ],
  },
    {
    id: 'home',
    label: 'Home',
    icon: Home,
    items: [
      { id: 'maidwizard', label: 'Maid Wizard', icon: Sparkles },
      { id: 'plants', label: 'My Plants', icon: Leaf },
      { id: 'pets', label: 'My Pets', icon: PawPrint },
    ],
  },
  {
    id: 'planning',
    label: 'Planning',
    icon: CalendarCheck,
    items: [
      { id: 'dailyplanner', label: 'Daily Planner', icon: CalendarCheck },
      { id: 'wallet', label: 'Wallet', icon: PiggyBank },
      { id: 'trackers', label: 'Trackers', icon: LineChart },
    ],
  },

  {
    id: 'craft-table',
    label: 'Craft Table',
    icon: Sparkles,
    items: [
      { id: 'recipes', label: 'Recipe Library', icon: BookOpen },
      { id: 'wizard', label: 'Recipe Wizard', icon: Wand2 },
      { id: 'add-recipe', label: 'Add Recipe', icon: Sparkles },
    ],
  },
];

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const initialOpen = SECTIONS.find(s => s.items.some(i => i.id === currentPage))?.id ?? null;
  const [openSection, setOpenSection] = useState<string | null>(initialOpen);

  function toggleSection(id: string) {
    setOpenSection(prev => (prev === id ? null : id));
  }

 return (
  <div className="sidebar">
    <div className="sidebar-logo">
      <h1>Polly</h1>
      <p>your pocket assistant</p>
    </div>

    <div className="sidebar-section">
      <nav className="sidebar-nav">
        <button
          className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
          onClick={() => onNavigate('dashboard')}
        >
          <Home size={16} /> Dashboard
        </button>
      </nav>
    </div>

    {SECTIONS.map(section => {
      const Icon = section.icon;
      const isOpen = openSection === section.id;
      const isSectionActive = section.items.some(i => i.id === currentPage);

      return (
        <div className="sidebar-section" key={section.id}>
          <nav className="sidebar-nav">
            <button
              className={`nav-item ${isSectionActive ? 'active' : ''}`}
              onClick={() => toggleSection(section.id)}
            >
              <Icon size={16} />
              <span style={{ flex: 1 }}>{section.label}</span>
              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {isOpen && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  gap: 6,
                  paddingLeft: 4,
                  marginTop: 4,
                  overflowX: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'none',
                }}
              >
                {section.items.map(item => {
                  const ItemIcon = item.icon;

                  return (
                    <button
                      key={item.id}
                      className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
                      style={{
                        fontSize: '0.8rem',
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                        padding: '8px 12px',
                      }}
                      onClick={() => onNavigate(item.id)}
                    >
                      <ItemIcon size={16} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </nav>
        </div>
      );
    })}
  </div>
);
}
