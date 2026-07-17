import { useState, Suspense, lazy } from 'react';
import TopNav from './components/TopNav';
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

import { ToastProvider } from './hooks/useToast';

type Page = 'dashboard' | 'meals' | 'grocery' | 'dailyplanner' | 'maidwizard' | 'wallet' | 'trackers' | 'decisions';

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
          <TopNav currentPage={page} onNavigate={navigate} />
          <main className="main">
            <Suspense fallback={<div className="page-loading">Loading…</div>}>
              {page === 'dashboard'    && <Dashboard onNavigate={navigate} />}
              {page === 'meals'        && <Meals />}
              {page === 'grocery'      && <Grocery />}
              {page === 'dailyplanner' && <DailyPlanner />}
              {page === 'maidwizard'   && <MaidWizard />}
              {page === 'wallet'       && <Wallet />}
              {page === 'trackers'     && <TrackerPage />}
              {page === 'decisions'    && <DecisionTree />}
            </Suspense>
          </main>
        </div>
      </ToastProvider>
    </ThemeProvider>
  );
}
