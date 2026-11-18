import Polly, { POLLY_IMAGES } from './Polly';
import { COMPANION_CACHE_KEY, type PollySpecies } from '../context/PollyCompanionContext';
import './PollyLoading.css';

interface PollyLoadingProps {
  /** Text shown under the companion, e.g. "Checking the nest..." */
  message?: string;
  size?: 'tiny' | 'small' | 'medium' | 'large';
  className?: string;
}

/**
 * Shared loading state. Shows the user's chosen companion (with any equipped
 * hat/outfit) in its "thinking" pose, with a message underneath.
 * Must be rendered inside PollyCompanionProvider.
 */
export default function PollyLoading({
  message = 'Loading…',
  size = 'medium',
  className = '',
}: PollyLoadingProps) {
  return (
    <div className={`polly-loading ${className}`} role="status" aria-live="polite">
      <Polly mood="searching" size={size} alt="" />
      <p className="polly-loading__text">{message}</p>
    </div>
  );
}

function cachedSpecies(): PollySpecies {
  try {
    const saved = localStorage.getItem(COMPANION_CACHE_KEY);
    if (saved && saved in POLLY_IMAGES) return saved as PollySpecies;
  } catch {
    /* ignore */
  }
  return 'wereham';
}

/**
 * Full-screen loading for app start-up, before sign-in / companion data
 * exists. Works outside PollyCompanionProvider by using the creature this
 * device last saw (falls back to the wereham on a first-ever visit).
 * Hats/outfits aren't shown here since those load with the companion data.
 */
export function PollyBootLoading({ message = 'Loading…' }: { message?: string }) {
  const species = cachedSpecies();
  return (
    <div className="polly-loading polly-loading--boot" role="status" aria-live="polite">
      <div className="polly polly-medium polly-animate">
        <img src={POLLY_IMAGES[species].searching} alt="" className="polly-image" />
      </div>
      <p className="polly-loading__text">{message}</p>
    </div>
  );
}
