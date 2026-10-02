// IncubatorTab.tsx
// Location: craft-app/src/creatures/IncubatorTab.tsx
//
// Sits alongside the Breeder tab on the habitat page. Shows the current
// incubating egg (if any) with a live countdown, and lets the user collect
// it once ready.
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { collectEgg } from '../lib/questSystem';
import { SPECIES_LABELS, type Species } from './creatures';

// There's no dedicated "ready" egg art yet, so both states use the same egg
// and the ready state is distinguished with a wobble + glow in CSS. Drop an
// egg-ready.png into public/icons and point EGG_READY_SRC at it to swap in.
const EGG_SRC = '/icons/egg.png';
const EGG_READY_SRC = '/icons/egg.png';

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
  const [justHatched, setJustHatched] = useState<{ species: Species; image: string } | null>(null);

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
      setJustHatched({ species: result.creature.species, image: result.creature.image });
      setEgg({ status: 'empty' });
    }
  }

  return (
    <div className="card incubator-tab">
      <div className="card-body">
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
            <div className="incubator-tab__egg-stage">
              <img src={EGG_SRC} alt="An egg, slowly warming" className="incubator-tab__egg-icon" />
            </div>
            <p className="incubator-tab__countdown">
              {formatCountdown(egg.hatchAt.getTime() - now)}
            </p>
          </div>
        )}

        {egg.status === 'ready' && (
          <div className="incubator-tab__egg incubator-tab__egg--ready">
            <div className="incubator-tab__egg-stage">
              <img src={EGG_READY_SRC} alt="An egg about to hatch" className="incubator-tab__egg-icon" />
            </div>
            <button
              className="btn btn-primary incubator-tab__collect-btn"
              onClick={handleCollect}
              disabled={hatching}
            >
              {hatching ? 'Hatching...' : 'Collect Egg'}
            </button>
          </div>
        )}

        {justHatched && (
          <div className="incubator-tab__reveal">
            <div className="incubator-tab__egg-stage incubator-tab__egg-stage--reveal">
              <img
                src={justHatched.image}
                alt={`A baby ${SPECIES_LABELS[justHatched.species]}`}
                className="incubator-tab__baby"
              />
            </div>
            <p>
              A new friend hatched! Say hello to your new{' '}
              <strong>{SPECIES_LABELS[justHatched.species]}</strong> in the collection.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
