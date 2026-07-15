import { useState, Suspense, lazy } from 'react';
import TopNav from './components/TopNav';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Cook = lazy(() => import('./pages/Cook'));
const Grocery = lazy(() => import('./pages/Grocery'));
const Planner = lazy(() => import('./pages/Planner'));
const Suggest = lazy(() => import('./pages/Suggest'));
const DailyPlanner = lazy(() => import('./pages/DailyPlanner'));
const MaidWizard = lazy(() => import('./pages/MaidWizard'));
const Wallet = lazy(() => import('./pages/Wallet'));
const TrackerPage = lazy(() => import('./pages/TrackerPage'));
const DecisionTree = lazy(() => import('./pages/DecisionTree'));

import { ToastProvider } from './hooks/useToast';

type Page = 'dashboard' | 'cook' | 'grocery' | 'planner' | 'suggest' | 'dailyplanner' | 'maidwizard' | 'wallet' | 'trackers' | 'decisions';

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  function navigate(p: string) {
    setPage(p as Page);
    window.scrollTo(0, 0);
  }
  return (
    <ToastProvider>
      <div className="app-shell">
        <TopNav currentPage={page} onNavigate={navigate} />
        <main className="main">
          <Suspense fallback={<div className="page-loading">Loading…</div>}>
            {page === 'dashboard'    && <Dashboard onNavigate={navigate} />}
            {page === 'cook'         && <Cook />}
            {page === 'grocery'      && <Grocery />}
            {page === 'planner'      && <Planner onNavigate={navigate} />}
            {page === 'suggest'      && <Suggest />}
            {page === 'dailyplanner' && <DailyPlanner />}
            {page === 'maidwizard'   && <MaidWizard />}
            {page === 'wallet'       && <Wallet />}
            {page === 'trackers'     && <TrackerPage />}
            {page === 'decisions'    && <DecisionTree />}
          </Suspense>
        </main>
      </div>
    </ToastProvider>
  );
}
