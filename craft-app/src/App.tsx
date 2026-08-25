import {
  useState,
  Suspense,
  lazy,
  Component,
  type ReactNode,
  type ErrorInfo,
} from 'react';

import BottomNav from './components/BottomNav';
import ThemeToggle from './components/ThemeToggle';
import BrainDump from './components/BrainDump';

import { ThemeProvider } from './context/ThemeContext';
import { EnergyProvider } from './context/EnergyContext';

import ShapeDefs from './components/ShapeDefs';

import { ToastProvider } from './hooks/useToast';
import { HamsterGrowthProvider } from './hamsters/HamsterGrowthContext';
import WildEncounterAlert from './hamsters/WildEncounterAlert';

import { useAuth } from './context/AuthContext';
import Login from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Grocery = lazy(() => import('./pages/Grocery'));
const DailyPlanner = lazy(() => import('./pages/DailyPlanner'));
const Wallet = lazy(() => import('./pages/Wallet'));
const TrackerPage = lazy(() => import('./pages/TrackerPage'));
const DecisionTree = lazy(() => import('./pages/DecisionTree'));
const Habitat = lazy(() => import('./hamsters/Habitat'));

type Page =
  | 'dashboard'
  | 'grocery'
  | 'dailyplanner'
  | 'maidwizard'
  | 'wallet'
  | 'trackers'
  | 'decisions'
  | 'habitat';

/* =========================================================
   APP RECOVERY
   ========================================================= */

function refreshPolly() {
  window.location.reload();
}

function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();

  return (
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('importing a module script failed') ||
    message.includes('loading chunk') ||
    message.includes('chunkloaderror') ||
    message.includes('dynamically imported module')
  );
}

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = {
    hasError: false,
    error: null as Error | null,
  };

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Polly page error:', error, errorInfo);

    /*
     * A failed Vite/React lazy chunk is usually recoverable with
     * a fresh document load. Try that automatically once.
     *
     * sessionStorage prevents an infinite reload loop if the same
     * broken chunk keeps failing.
     */
    if (isChunkLoadError(error)) {
      const retryKey = 'polly-chunk-retry';

      if (!sessionStorage.getItem(retryKey)) {
        sessionStorage.setItem(retryKey, '1');
        window.location.reload();
        return;
      }

      sessionStorage.removeItem(retryKey);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <PollyRecoveryScreen
          error={this.state.error}
        />
      );
    }

    return this.props.children;
  }
}

function PollyRecoveryScreen({ error }: { error: Error | null }) {
  const isChunkError = isChunkLoadError(error ?? undefined);

  return (
    <div
      style={{
        minHeight: '100dvh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        boxSizing: 'border-box',
        background: 'var(--bg, #fffaf4)',
        color: 'var(--ink, #3d2b1f)',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 360,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div
          style={{
            fontSize: '2.2rem',
            lineHeight: 1,
          }}
          aria-hidden="true"
        >
          ✦
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: '1.35rem',
            fontWeight: 800,
          }}
        >
          Polly got a little stuck
        </h1>

        <p
          style={{
            margin: 0,
            fontSize: '0.92rem',
            lineHeight: 1.5,
            color: 'var(--ink-muted, #776b60)',
          }}
        >
          {isChunkError
            ? 'That page did not finish loading correctly.'
            : 'Something went wrong while opening this page.'}
        </p>

        <button
          type="button"
          onClick={refreshPolly}
          style={{
            marginTop: 6,
            minHeight: 44,
            padding: '0 20px',
            borderRadius: 12,
            border: '1.5px solid var(--border)',
            background: 'var(--blush)',
            color: 'var(--pink-dark, #6d4b4b)',
            fontWeight: 800,
            fontSize: '0.92rem',
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          ↻ Refresh Polly
        </button>

        <button
          type="button"
          onClick={() => {
            window.location.href = '/';
          }}
          style={{
            border: 0,
            background: 'transparent',
            color: 'var(--ink-muted, #776b60)',
            fontWeight: 700,
            fontSize: '0.82rem',
            cursor: 'pointer',
            padding: '8px 12px',
          }}
        >
          Go home
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   APP
   ========================================================= */

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
    <AppErrorBoundary>
      <ThemeProvider>
        {loading ? (
          <div className="page-loading">Loading…</div>
        ) : !session ? (
          <Login />
        ) : (
          <EnergyProvider>
            <ShapeDefs />

            <ToastProvider>
              <HamsterGrowthProvider>
                <WildEncounterAlert
                  currentPage={page}
                  onNavigate={navigate}
                />

                <div className="app-shell">
                  <header className="topbar">
                    <span className="topbar-mark">Polly</span>

                    <div className="topbar-actions">

                      {/* BRAIN DUMP */}
                      <span
                        className="topbar-label"
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
                        type="button"
                        onClick={() => setBrainDumpOpen(true)}
                        aria-label="Get it out of my head"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: 'var(--blush)',
                          border: '1.5px solid var(--border)',
                          cursor: 'pointer',
                          color: 'var(--pink-dark)',
                          fontSize: '1.1rem',
                          fontWeight: 700,
                          lineHeight: 1,
                          padding: 0,
                          flexShrink: 0,
                        }}
                      >
                        +
                      </button>

                      {/* DAY / NIGHT */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span
                          className="topbar-label"
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: 'var(--ink-muted)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Mode Toggle
                        </span>

                        <ThemeToggle />
                      </div>

                      {/* SIGN OUT */}
                      <button
                        type="button"
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

                    {/* REFRESH */}
                      <button
                        type="button"
                        onClick={refreshPolly}
                        aria-label="Refresh Polly"
                        title="Refresh Polly"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: 'var(--surface)',
                          border: '1.5px solid var(--border)',
                          cursor: 'pointer',
                          color: 'var(--ink-muted)',
                          fontSize: '1rem',
                          fontWeight: 700,
                          lineHeight: 1,
                          padding: 0,
                          flexShrink: 0,
                          WebkitTapHighlightColor: 'transparent',
                        }}
                      >
                        ↻
                      </button>

                    </div>
                  </header>

                  <BrainDump
                    open={brainDumpOpen}
                    onClose={() => setBrainDumpOpen(false)}
                  />

                  <main className="main">
                    <Suspense
                      fallback={
                        <div className="page-loading">
                          Loading…
                        </div>
                      }
                    >
                      {page === 'dashboard' && (
                        <Dashboard onNavigate={navigate} />
                      )}

                      {page === 'grocery' && <Grocery />}

                      {page === 'dailyplanner' && (
                        <DailyPlanner
                          initialTab={
                            initialTab as
                              | 'tasks'
                              | 'appointments'
                              | 'chores'
                              | 'events'
                              | 'goals'
                              | 'notes'
                              | undefined
                          }
                        />
                      )}

                      {page === 'wallet' && (
                        <Wallet
                          initialView={
                            initialTab as
                              | 'home'
                              | 'calendar'
                              | 'bills'
                              | 'debts'
                              | undefined
                          }
                        />
                      )}

                      {page === 'trackers' && <TrackerPage />}

                      {page === 'decisions' && <DecisionTree />}

                      {page === 'habitat' && (
                        <Habitat
                          initialTab={
                            initialTab as
                              | 'shelf'
                              | 'nest'
                              | 'wild'
                              | 'collection'
                              | undefined
                          }
                        />
                      )}
                    </Suspense>
                  </main>

                  <BottomNav
                    currentPage={page}
                    onNavigate={navigate}
                  />
                </div>
              </HamsterGrowthProvider>
            </ToastProvider>
          </EnergyProvider>
        )}
      </ThemeProvider>
    </AppErrorBoundary>
  );
}