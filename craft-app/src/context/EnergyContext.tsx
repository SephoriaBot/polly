import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
export type EnergyMode = 'normal' | 'none';
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
// "None" is meant to be a "today only" state, not a permanent setting.
// A new day always starts back at Normal.
export function EnergyProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<EnergyMode>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (
        stored &&
        stored.date === todayISO() &&
        stored.mode === 'none'
      ) {
        return 'none';
      }
    } catch {
      /* ignore malformed storage */
    }
    return 'normal';
  });
  const setMode = (next: EnergyMode) => {
    setModeState(next);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        mode: next,
        date: todayISO(),
      })
    );
  };
  // If the tab has been open across midnight, snap back to Normal.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (parsed.date !== todayISO()) {
        setModeState('normal');
      }
    } catch {
      /* ignore malformed storage */
    }
  }, []);
  return (
    <EnergyContext.Provider value={{ mode, setMode }}>
      {children}
    </EnergyContext.Provider>
  );
}
export function useEnergy() {
  const ctx = useContext(EnergyContext);
  if (!ctx) {
    throw new Error('useEnergy must be used within an EnergyProvider');
  }
  return ctx;
}