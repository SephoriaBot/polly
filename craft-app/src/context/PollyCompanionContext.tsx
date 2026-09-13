import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export type PollySpecies = 'wereham' | 'noodle' | 'dragon' | 'bunt';

interface PollyCompanionContextValue {
  /** Defaults to 'wereham' while loading or if no choice has been saved yet. */
  species: PollySpecies;
  /** True once we've checked Supabase for a saved choice. */
  loaded: boolean;
  /** True if the user has never picked a companion — used to show the picker. */
  needsChoice: boolean;
  chooseSpecies: (species: PollySpecies) => Promise<void>;
}

const PollyCompanionContext = createContext<PollyCompanionContextValue | undefined>(undefined);

export function PollyCompanionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [species, setSpecies] = useState<PollySpecies>('wereham');
  const [loaded, setLoaded] = useState(false);
  const [needsChoice, setNeedsChoice] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadCompanion() {
      if (!user) {
        if (!cancelled) {
          setLoaded(false);
          setNeedsChoice(false);
        }
        return;
      }

      setLoaded(false);
      const { data, error } = await supabase
        .from('polly_companion')
        .select('species')
        .maybeSingle();

      if (cancelled) return;

      if (!error && data?.species) {
        setSpecies(data.species as PollySpecies);
        setNeedsChoice(false);
      } else {
        setNeedsChoice(true);
      }
      setLoaded(true);
    }

    loadCompanion();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function chooseSpecies(next: PollySpecies) {
    setSpecies(next);
    setNeedsChoice(false);
    const { error } = await supabase
      .from('polly_companion')
      .upsert({ species: next, chosen_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) console.error('Failed to save Polly companion choice:', error);
  }

  return (
    <PollyCompanionContext.Provider value={{ species, loaded, needsChoice, chooseSpecies }}>
      {children}
    </PollyCompanionContext.Provider>
  );
}

export function usePollyCompanion() {
  const ctx = useContext(PollyCompanionContext);
  if (!ctx) throw new Error('usePollyCompanion must be used within a PollyCompanionProvider');
  return ctx;
}