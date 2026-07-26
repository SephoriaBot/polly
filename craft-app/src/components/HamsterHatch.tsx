import { useState, useEffect } from 'react';
import hamsterHatchCrack from '../assets/illustrations/hamster-hatch-crack.PNG';
import hamsterHatchRibbon from '../assets/illustrations/hamster-hatch-ribbon.PNG';

interface HamsterHatchProps {
  onDismiss: () => void;
}

export function HamsterHatch({ onDismiss }: HamsterHatchProps) {
  const [showRibbon, setShowRibbon] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowRibbon(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onDismiss}
    >
      <div
        style={{
          background: 'var(--color-cream)',
          borderRadius: '24px',
          padding: '2rem',
          textAlign: 'center',
          maxWidth: '340px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={showRibbon ? hamsterHatchRibbon : hamsterHatchCrack}
          alt="A hamster hatched!"
          style={{ width: '220px' }}
        />
        <p style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', marginTop: '1rem' }}>
          {showRibbon ? 'A new hamster hatched!' : 'Something\'s happening...'}
        </p>
        {showRibbon && (
          <button
            onClick={onDismiss}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1.5rem',
              borderRadius: '999px',
              background: 'var(--color-gold)',
              border: 'none',
              fontFamily: 'var(--font-body)',
            }}
          >
            Add to habitat
          </button>
        )}
      </div>
    </div>
  );
}
