import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export type PollySpecies = 'wereham' | 'noodle' | 'dragon' | 'bunt' | 'wrendel';

interface EquippedHeadwear {
  id: string;
  assetKey: string;
}

interface PollyCompanionContextValue {
  /** Defaults to 'wereham' while loading or if no choice has been saved yet. */
  species: PollySpecies;
  /** True once we've checked Supabase for a saved choice. */
  loaded: boolean;
  /** True if the user has never picked a companion — used to show the picker. */
  needsChoice: boolean;
  chooseSpecies: (species: PollySpecies) => Promise<void>;
  /** Currently equipped headwear cosmetic, or null if none equipped. */
  equippedHeadwear: EquippedHeadwear | null;
  /** Pass a cosmetic id to equip it, or null to unequip. Returns an error message on failure. */
  setEquippedHeadwear: (cosmeticId: string | null) => Promise<{ error: string | null }>;
}

const PollyCompanionContext = createContext<PollyCompanionContextValue | undefined>(undefined);

export function PollyCompanionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [species, setSpecies] = useState<PollySpecies>('wereham');
  const [loaded, setLoaded] = useState(false);
  const [needsChoice, setNeedsChoice] = useState(false);
  const [equippedHeadwear, setEquippedHeadwearState] = useState<EquippedHeadwear | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCompanion() {
      if (!user) {
        if (!cancelled) {
          setLoaded(false);
          setNeedsChoice(false);
          setEquippedHeadwearState(null);
        }
        return;
      }

      setLoaded(false);
      const { data, error } = await supabase
        .from('polly_companion')
        .select('species, equipped_headwear_id, cosmetics(id, asset_key)')
        .maybeSingle();

      if (cancelled) return;

      if (!error && data?.species) {
        setSpecies(data.species as PollySpecies);
        setNeedsChoice(false);
        const cosmetic = Array.isArray(data.cosmetics) ? data.cosmetics[0] : data.cosmetics;
        setEquippedHeadwearState(
          cosmetic ? { id: cosmetic.id, assetKey: cosmetic.asset_key } : null
        );
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

  async function setEquippedHeadwear(cosmeticId: string | null): Promise<{ error: string | null }> {
    const { data, error } = await supabase
      .from('polly_companion')
      .update({ equipped_headwear_id: cosmeticId })
      .select('cosmetics(id, asset_key)')
      .maybeSingle();

    if (error) {
      console.error('Failed to update equipped headwear:', error);
      return { error: error.message };
    }

    const cosmetic = Array.isArray(data?.cosmetics) ? data?.cosmetics[0] : data?.cosmetics;
    setEquippedHeadwearState(cosmetic ? { id: cosmetic.id, assetKey: cosmetic.asset_key } : null);
    return { error: null };
  }

  return (
    <PollyCompanionContext.Provider
      value={{ species, loaded, needsChoice, chooseSpecies, equippedHeadwear, setEquippedHeadwear }}
    >
      {children}
    </PollyCompanionContext.Provider>
  );
}

export function usePollyCompanion() {
  const ctx = useContext(PollyCompanionContext);
  if (!ctx) throw new Error('usePollyCompanion must be used within a PollyCompanionProvider');
  return ctx;
}