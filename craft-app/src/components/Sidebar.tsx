import { Leaf, FlaskConical, Sparkles, BookOpen, Home, Wand2, UtensilsCrossed, ShoppingCart, Archive, CalendarDays, Lightbulb } from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar" style={{ position: 'static' }}>
      <div className="sidebar-logo">
        <h1>Housekeepers Club</h1>
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
          <button className={`nav-item ${currentPage === 'add-recipe' ? 'active' : ''}`} onClick={() => onNavigate('add-recipe')}>
            <Sparkles size={16} /> Add Recipe
          </button>
        </nav>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Kitchen</div>
        <nav className="sidebar-nav">
          <button className={`nav-item ${currentPage === 'cook' ? 'active' : ''}`} onClick={() => onNavigate('cook')}>
            <UtensilsCrossed size={16} /> Cook
          </button>
          <button className={`nav-item ${currentPage === 'suggest' ? 'active' : ''}`} onClick={() => onNavigate('suggest')}>
            <Lightbulb size={16} /> Suggestions
          </button>
          <button className={`nav-item ${currentPage === 'planner' ? 'active' : ''}`} onClick={() => onNavigate('planner')}>
            <CalendarDays size={16} /> Meal Planner
          </button>
          <button className={`nav-item ${currentPage === 'grocery' ? 'active' : ''}`} onClick={() => onNavigate('grocery')}>
            <ShoppingCart size={16} /> Grocery List
          </button>
          <button className={`nav-item ${currentPage === 'pantry' ? 'active' : ''}`} onClick={() => onNavigate('pantry')}>
            <Archive size={16} /> Pantry
          </button>
        </nav>
      </div>

    </aside>
  );
}
