import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import PlantsPage from './pages/PlantsPage';
import RecipesPage from './pages/RecipesPage';
import WizardPage from './pages/WizardPage';
import AddRecipePage from './pages/AddRecipePage';
import Cook from './pages/Cook';
import Grocery from './pages/Grocery';
import Planner from './pages/Planner';
import Suggest from './pages/Suggest';
import Pets from './pages/Pets';
import DailyPlanner from './pages/DailyPlanner';
import MaidWizard from './pages/MaidWizard';
import Wallet from './pages/Wallet';
import TrackerPage from './pages/TrackerPage';

import { ToastProvider } from './hooks/useToast';

type Page = 'dashboard' | 'plants' | 'recipes' | 'wizard' | 'add-recipe' | 'cook' | 'grocery' | 'planner' | 'suggest' | 'pets' | 'dailyplanner' | 'maidwizard' | 'wallet' | 'trackers';



export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  function navigate(p: string) {
    setPage(p as Page);
    window.scrollTo(0, 0);
  }
  return (
    <ToastProvider>
      <div className="app-shell">
        <Sidebar currentPage={page} onNavigate={navigate} />
        <main className="main">
          {page === 'dashboard'    && <Dashboard onNavigate={navigate} />}
          {page === 'plants'       && <PlantsPage />}
          {page === 'recipes'      && <RecipesPage onNavigate={navigate} />}
          {page === 'wizard'       && <WizardPage />}
          {page === 'add-recipe'   && <AddRecipePage onNavigate={navigate} />}
          {page === 'cook'         && <Cook />}
          {page === 'grocery'      && <Grocery />}
          {page === 'planner' && <Planner onNavigate={navigate} />}
          {page === 'suggest'      && <Suggest />}
          {page === 'pets'         && <Pets />}
          {page === 'dailyplanner' && <DailyPlanner />}
          {page === 'maidwizard' && <MaidWizard />}
          {page === 'wallet' && <Wallet />}
          {page === 'trackers' && <TrackerPage />}

    
        </main>
      </div>
    </ToastProvider>
  );
}
