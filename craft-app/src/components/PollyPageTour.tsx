import { useEffect, useState } from 'react';
import { Polly } from '../lib';
import { usePollyPageTour } from '../hooks/usePollyPageTour';
import { POLLY_TOUR_CONTENT } from '../lib/pollyTour';

export default function PollyPageTour({ page }: { page: string }) {
  const steps = POLLY_TOUR_CONTENT[page];
  const { showTour, dismissTour } = usePollyPageTour(page);
  const [stepIndex, setStepIndex] = useState(0);

  // Reset back to the first step whenever the page changes (or the tour
  // re-shows), so switching pages never leaves you stranded mid-way
  // through a previous page's steps.
  useEffect(() => {
    setStepIndex(0);
  }, [page]);

  if (!steps || steps.length === 0 || !showTour) return null;

  const content = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      dismissTour();
    } else {
      setStepIndex(i => i + 1);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'rgba(0,0,0,0.25)', padding: 16,
      }}
      onClick={dismissTour}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--white)', border: '1.5px solid var(--border)',
          borderRadius: 24, padding: 20, maxWidth: 360, width: '100%',
          display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12,
        }}
      >
        <Polly mood="cheering" size="medium" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--pink-dark)' }}>
            {content.title}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', marginTop: 4, lineHeight: 1.4 }}>
            {content.body}
          </div>
          <button onClick={handleNext} className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
            {isLastStep ? 'Got it!' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}