import { useState, Suspense, lazy } from 'react';
import BottomNav from './components/BottomNav';
import ThemeToggle from './components/ThemeToggle';
import { ThemeProvider } from './context/ThemeContext';
import ShapeDefs from './components/ShapeDefs';
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Meals = lazy(() => import('./pages/Meals'));
const Grocery = lazy(() => import('./pages/Grocery'));
const DailyPlanner = lazy(() => import('./pages/DailyPlanner'));
const MaidWizard = lazy(() => import('./pages/MaidWizard'));
const Wallet = lazy(() => import('./pages/Wallet'));
const TrackerPage = lazy(() => import('./pages/TrackerPage'));
const DecisionTree = lazy(() => import('./pages/DecisionTree'));
const Habitat = lazy(() => import('./pages/Habitat'));

import { ToastProvider } from './hooks/useToast';

type Page = 'dashboard' | 'meals' | 'grocery' | 'dailyplanner' | 'maidwizard' | 'wallet' | 'trackers' | 'decisions' | 'habitat';

  export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  function navigate(p: string) {
    setPage(p as Page);
    window.scrollTo(0, 0);
  }
  return (
    <ThemeProvider>
      <ShapeDefs />
      <ToastProvider>
        <div className="app-shell">
          <header className="topbar">
            <span className="topbar-mark">Polly</span>
            <div className="topbar-actions">
              <ThemeToggle />
            </div>
          </header>
          <main className="main">
            <Suspense fallback={<div className="page-loading">Loading…</div>}>
              {page === 'dashboard'    && <Dashboard />}
              {page === 'meals'        && <Meals />}
              {page === 'grocery'      && <Grocery />}
              {page === 'dailyplanner' && <DailyPlanner />}
              {page === 'maidwizard'   && <MaidWizard />}
              {page === 'wallet'       && <Wallet />}
              {page === 'trackers'     && <TrackerPage />}
              {page === 'decisions'    && <DecisionTree />}
              {page === 'habitat'      && <Habitat />}
            </Suspense>
          </main>
          <BottomNav currentPage={page} onNavigate={navigate} />
        </div>
      </ToastProvider>
    </ThemeProvider>
  );
}