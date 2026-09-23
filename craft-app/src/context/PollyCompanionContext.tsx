import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export type PollySpecies = 'wereham' | 'noodle' | 'dragon' | 'bunt' | 'wrendel';

interface EquippedHeadwear {
  id: string;
  assetKey: string;
}

interface EquippedOutfit {
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
  /** Currently equipped outfit cosmetic (e.g. the duck inner tube), or null if none equipped. */
  equippedOutfit: EquippedOutfit | null;
  /** Pass a cosmetic id to equip it, or null to unequip. Returns an error message on failure. */
  setEquippedOutfit: (cosmeticId: string | null) => Promise<{ error: string | null }>;
}

const PollyCompanionContext = createContext<PollyCompanionContextValue | undefined>(undefined);

export function PollyCompanionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [species, setSpecies] = useState<PollySpecies>('wereham');
  const [loaded, setLoaded] = useState(false);
  const [needsChoice, setNeedsChoice] = useState(false);
  const [equippedHeadwear, setEquippedHeadwearState] = useState<EquippedHeadwear | null>(null);
  const [equippedOutfit, setEquippedOutfitState] = useState<EquippedOutfit | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCompanion() {
      if (!user) {
        if (!cancelled) {
          setLoaded(false);
          setNeedsChoice(false);
          setEquippedHeadwearState(null);
          setEquippedOutfitState(null);
        }
        return;
      }

      setLoaded(false);
      // Two FK hints needed below (headwear + outfit) since both columns
      // reference cosmetics — without the !constraint hint the embed is
      // ambiguous and Supabase rejects the query.
      const { data, error } = await supabase
        .from('polly_companion')
        .select(
          'species, equipped_headwear_id, equipped_outfit_id, ' +
          'headwear_cosmetic:cosmetics!polly_companion_equipped_headwear_id_fkey(id, asset_key), ' +
          'outfit_cosmetic:cosmetics!polly_companion_equipped_outfit_id_fkey(id, asset_key)'
        )
        .maybeSingle();

      if (cancelled) return;

      if (!error && data?.species) {
        setSpecies(data.species as PollySpecies);
        setNeedsChoice(false);
        const headwearCosmetic = Array.isArray(data.headwear_cosmetic)
          ? data.headwear_cosmetic[0]
          : data.headwear_cosmetic;
        setEquippedHeadwearState(
          headwearCosmetic ? { id: headwearCosmetic.id, assetKey: headwearCosmetic.asset_key } : null
        );
        const outfitCosmetic = Array.isArray(data.outfit_cosmetic)
          ? data.outfit_cosmetic[0]
          : data.outfit_cosmetic;
        setEquippedOutfitState(
          outfitCosmetic ? { id: outfitCosmetic.id, assetKey: outfitCosmetic.asset_key } : null
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
    if (!user) return { error: 'Not signed in' };

    const { data, error } = await supabase
      .from('polly_companion')
      .update({ equipped_headwear_id: cosmeticId })
      .eq('user_id', user.id)
      .select('cosmetics:cosmetics!polly_companion_equipped_headwear_id_fkey(id, asset_key)')
      .maybeSingle();

    if (error) {
      console.error('Failed to update equipped headwear:', error);
      return { error: error.message };
    }

    const cosmetic = Array.isArray(data?.cosmetics) ? data?.cosmetics[0] : data?.cosmetics;
    setEquippedHeadwearState(cosmetic ? { id: cosmetic.id, assetKey: cosmetic.asset_key } : null);
    return { error: null };
  }

  async function setEquippedOutfit(cosmeticId: string | null): Promise<{ error: string | null }> {
    if (!user) return { error: 'Not signed in' };

    const { data, error } = await supabase
      .from('polly_companion')
      .update({ equipped_outfit_id: cosmeticId })
      .eq('user_id', user.id)
      .select('cosmetics:cosmetics!polly_companion_equipped_outfit_id_fkey(id, asset_key)')
      .maybeSingle();

    if (error) {
      console.error('Failed to update equipped outfit:', error);
      return { error: error.message };
    }

    const cosmetic = Array.isArray(data?.cosmetics) ? data?.cosmetics[0] : data?.cosmetics;
    setEquippedOutfitState(cosmetic ? { id: cosmetic.id, assetKey: cosmetic.asset_key } : null);
    return { error: null };
  }

  return (
    <PollyCompanionContext.Provider
      value={{
        species,
        loaded,
        needsChoice,
        chooseSpecies,
        equippedHeadwear,
        setEquippedHeadwear,
        equippedOutfit,
        setEquippedOutfit,
      }}
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