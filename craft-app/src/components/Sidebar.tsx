import { Leaf, FlaskConical, Sparkles, BookOpen, Home, Wand2 } from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1>Craft & Garden</h1>
        <p>Your creative sanctuary</p>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Overview</div>
        <nav className="sidebar-nav">
          <button className={`nav-item ${currentPage === 'home' ? 'active' : ''}`} onClick={() => onNavigate('home')}>
            <Home size={16} /> Dashboard
          </button>
        </nav>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Garden</div>
        <nav className="sidebar-nav">
          <button className={`nav-item ${currentPage === 'plants' ? 'active' : ''}`} onClick={() => onNavigate('plants')}>
            <Leaf size={16} /> My Plants
          </button>
        </nav>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Alchemy</div>
        <nav className="sidebar-nav">
          <button className={`nav-item ${currentPage === 'recipes' ? 'active' : ''}`} onClick={() => onNavigate('recipes')}>
            <BookOpen size={16} /> Recipe Library
          </button>
          <button className={`nav-item ${currentPage === 'wizard' ? 'active' : ''}`} onClick={() => onNavigate('wizard')}>
            <Wand2 size={16} /> Recipe Wizard
          </button>
          <button className={`nav-item ${currentPage === 'ingredients' ? 'active' : ''}`} onClick={() => onNavigate('ingredients')}>
            <FlaskConical size={16} /> Ingredients
          </button>
        </nav>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Manage</div>
        <nav className="sidebar-nav">
          <button className={`nav-item ${currentPage === 'add-recipe' ? 'active' : ''}`} onClick={() => onNavigate('add-recipe')}>
            <Sparkles size={16} /> Add Recipe
          </button>
        </nav>
      </div>
    </aside>
  );
}
