import Polly from './Polly';
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