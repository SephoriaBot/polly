import { useState, Suspense, lazy } from 'react';
import BottomNav from './components/BottomNav';
import ThemeToggle from './components/ThemeToggle';
import BrainDump from './components/BrainDump';
import { ThemeProvider } from './context/ThemeContext';
import { EnergyProvider } from './context/EnergyContext';
import ShapeDefs from './components/ShapeDefs';
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Grocery = lazy(() => import('./pages/Grocery'));
const DailyPlanner = lazy(() => import('./pages/DailyPlanner'));
const Wallet = lazy(() => import('./pages/Wallet'));
const TrackerPage = lazy(() => import('./pages/TrackerPage'));
const DecisionTree = lazy(() => import('./pages/DecisionTree'));
const Habitat = lazy(() => import('./hamsters/Habitat'));

import { ToastProvider } from './hooks/useToast';
import { HamsterGrowthProvider } from './hamsters/HamsterGrowthContext';
import WildEncounterAlert from './hamsters/WildEncounterAlert';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';

type Page = 'dashboard' | 'grocery' | 'dailyplanner' | 'maidwizard' | 'wallet' | 'trackers' | 'decisions' | 'habitat';

  export default function App() {
  const { session, loading, signOut } = useAuth();
  const [page, setPage] = useState<Page>('dashboard');
  const [initialTab, setInitialTab] = useState<string | undefined>(undefined);
  const [brainDumpOpen, setBrainDumpOpen] = useState(false);
  function navigate(p: string, tab?: string) {
    setPage(p as Page);
    setInitialTab(tab);
    window.scrollTo(0, 0);
  }

  return (
    <ThemeProvider>
      {loading ? (
        <div className="page-loading">Loading…</div>
      ) : !session ? (
        <Login />
      ) : (
    <EnergyProvider>
      <ShapeDefs />
      <ToastProvider>
        {/* Lives at the app root (not just on the Habitat page) so the
            growth check runs on every app load regardless of which page you
            land on, and so a pending wild encounter can pop up no matter
            where you are. */}
        <HamsterGrowthProvider>
          <WildEncounterAlert currentPage={page} onNavigate={navigate} />
          <div className="app-shell">
            <header className="topbar">
              <span className="topbar-mark">Polly</span>
              <div className="topbar-actions">
  <span
    style={{
      fontSize: '0.72rem',
      fontWeight: 700,
      color: 'var(--ink-muted)',
      whiteSpace: 'nowrap',
    }}
  >
    Brain Dump
  </span>
  <button
    onClick={() => setBrainDumpOpen(true)}
    aria-label="Get it out of my head"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'var(--blush)', border: '1.5px solid var(--border)',
                    cursor: 'pointer', color: 'var(--pink-dark)', fontSize: '1.1rem',
                    fontWeight: 700, lineHeight: 1, padding: 0,
                  }}
                >
                  +
                </button>
                <div
  style={{
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  }}
>
  <span
    style={{
      fontSize: '0.72rem',
      fontWeight: 700,
      color: 'var(--ink-muted)',
      whiteSpace: 'nowrap',
    }}
  >
    Day / Night
  </span>
  <ThemeToggle />
</div>
  <button
    onClick={() => signOut()}
    aria-label="Sign out"
    style={{
      fontSize: '0.72rem',
      fontWeight: 700,
      color: 'var(--ink-muted)',
      background: 'none',
      border: '1.5px solid var(--border)',
      borderRadius: 8,
      padding: '4px 8px',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    }}
  >
    Sign out
  </button>
              </div>
            </header>
            <BrainDump open={brainDumpOpen} onClose={() => setBrainDumpOpen(false)} />
            <main className="main">
              <Suspense fallback={<div className="page-loading">Loading…</div>}>
                {page === 'dashboard'    && <Dashboard onNavigate={navigate} />}
                {page === 'grocery'      && <Grocery />}
                {page === 'dailyplanner' && <DailyPlanner initialTab={initialTab as 'tasks' | 'appointments' | 'chores' | 'events' | 'goals' | 'notes' | undefined} />}
                {page === 'wallet'       && <Wallet initialView={initialTab as 'home' | 'calendar' | 'bills' | 'debts' | undefined} />}
                {page === 'trackers'     && <TrackerPage />}
                {page === 'decisions'    && <DecisionTree />}
                {page === 'habitat'      && <Habitat />}
              </Suspense>
            </main>
            <BottomNav currentPage={page} onNavigate={navigate} />
          </div>
        </HamsterGrowthProvider>
      </ToastProvider>
    </EnergyProvider>
      )}
    </ThemeProvider>
  );
}