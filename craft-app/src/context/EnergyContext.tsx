import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type EnergyMode = 'normal' | 'low' | 'bare';

interface EnergyContextValue {
  mode: EnergyMode;
  setMode: (mode: EnergyMode) => void;
}

const EnergyContext = createContext<EnergyContextValue | undefined>(undefined);

const STORAGE_KEY = 'polly-energy';

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Low Energy / Bare Minimum is meant to be a "today only" state, not a
// permanent setting someone forgets they turned on — so the stored value is
// scoped to a date. A new day always starts back at Normal.
export function EnergyProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<EnergyMode>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (stored && stored.date === todayISO() && (stored.mode === 'low' || stored.mode === 'bare')) {
        return stored.mode;
      }
    } catch { /* ignore malformed storage */ }
    return 'normal';
  });

  const setMode = (next: EnergyMode) => {
    setModeState(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: next, date: todayISO() }));
  };

  // If the tab's been open across midnight, snap back to Normal on the next
  // date check rather than silently staying in a stale low-energy state.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (parsed.date !== todayISO()) setModeState('normal');
    } catch { /* ignore */ }
  }, []);

  return (
    <EnergyContext.Provider value={{ mode, setMode }}>{children}</EnergyContext.Provider>
  );
}

export function useEnergy() {
  const ctx = useContext(EnergyContext);
  if (!ctx) throw new Error('useEnergy must be used within an EnergyProvider');
  return ctx;
}
