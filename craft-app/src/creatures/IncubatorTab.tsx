// IncubatorTab.tsx
// Location: craft-app/src/creatures/IncubatorTab.tsx
//
// Sits alongside the Breeder tab on the habitat page. Shows the current
// incubating egg (if any) with a live countdown, and lets the user collect
// it once ready.
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { collectEgg } from '../lib/questSystem';

interface IncubatorTabProps {
  userId: string;
}

type EggState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'incubating'; hatchAt: Date }
  | { status: 'ready' };

function formatCountdown(msRemaining: number) {
  if (msRemaining <= 0) return 'Ready!';
  const totalSeconds = Math.floor(msRemaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

export default function IncubatorTab({ userId }: IncubatorTabProps) {
  const [egg, setEgg] = useState<EggState>({ status: 'loading' });
  const [now, setNow] = useState(Date.now());
  const [hatching, setHatching] = useState(false);
  const [justHatched, setJustHatched] = useState<{ species: string } | null>(null);

  // Load current egg state
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await supabase
        .from('polly_companion')
        .select('active_egg_hatch_at')
        .eq('user_id', userId)
        .single();

      if (cancelled) return;

      if (!data?.active_egg_hatch_at) {
        setEgg({ status: 'empty' });
        return;
      }

      const hatchAt = new Date(data.active_egg_hatch_at);
      setEgg(hatchAt <= new Date() ? { status: 'ready' } : { status: 'incubating', hatchAt });
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Tick every second while incubating, and flip to "ready" when the timer runs out
  useEffect(() => {
    if (egg.status !== 'incubating') return;
    const interval = setInterval(() => {
      setNow(Date.now());
      if (egg.status === 'incubating' && egg.hatchAt.getTime() <= Date.now()) {
        setEgg({ status: 'ready' });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [egg]);

  async function handleCollect() {
    setHatching(true);
    const result = await collectEgg(userId);
    setHatching(false);

    if (result.ok) {
      setJustHatched({ species: result.creature.species });
      setEgg({ status: 'empty' });
    }
  }

  return (
    <div className="incubator-tab">
      <h2 className="incubator-tab__title">Incubator</h2>

      {egg.status === 'loading' && (
        <p className="incubator-tab__hint">Checking the nest...</p>
      )}

      {egg.status === 'empty' && !justHatched && (
        <p className="incubator-tab__hint">
          No egg right now. Rare quest rewards will show up here when you find one.
        </p>
      )}

      {egg.status === 'incubating' && (
        <div className="incubator-tab__egg incubator-tab__egg--warming">
          <img src="/icons/egg.png" alt="An egg, slowly warming" className="incubator-tab__egg-icon" />
          <p className="incubator-tab__countdown">
            {formatCountdown(egg.hatchAt.getTime() - now)}
          </p>
        </div>
      )}

      {egg.status === 'ready' && (
        <div className="incubator-tab__egg incubator-tab__egg--ready">
          <img src="/icons/egg-ready.png" alt="An egg about to hatch" className="incubator-tab__egg-icon" />
          <button
            className="incubator-tab__collect-btn"
            onClick={handleCollect}
            disabled={hatching}
          >
            {hatching ? 'Hatching...' : 'Collect Egg'}
          </button>
        </div>
      )}

      {justHatched && (
        <div className="incubator-tab__reveal">
          <p>
            A new friend hatched! Say hello to your new <strong>{justHatched.species}</strong> in
            the collection.
          </p>
        </div>
      )}
    </div>
  );
}
