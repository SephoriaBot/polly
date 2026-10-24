import { useEffect, useState } from 'react';
import { getPushState, enablePush, disablePush, type PushState } from '../lib/push';

// Small on/off switch for phone notifications, styled like ThemeToggle.
export default function PushToggle() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPushState().then(setState).catch(() => setState('unsupported'));
  }, []);

  if (state === null || state === 'unsupported') return null;

  const isOn = state === 'on';
  const note =
    state === 'needs-install'
      ? 'Add Polly to your Home Screen first, then open it from there to turn on notifications.'
      : state === 'denied'
        ? 'Notifications are blocked. Allow them for Polly in your phone settings.'
        : '';

  async function toggle() {
    if (busy || note) {
      if (note) window.alert(note);
      return;
    }
    setBusy(true);
    try {
      setState(isOn ? await disablePush() : await enablePush());
    } catch (e) {
      console.error('PushToggle failed', e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      role="switch"
      aria-checked={isOn}
      aria-label={isOn ? 'Turn off notifications' : 'Turn on notifications'}
      style={{
        position: 'relative',
        width: 56,
        height: 30,
        borderRadius: 999,
        border: '1px solid var(--color-border)',
        background: isOn ? 'var(--gold-light)' : 'var(--color-surface-raised)',
        cursor: 'pointer',
        transition: 'background-color 0.4s ease',
        padding: 0,
        opacity: busy ? 0.6 : 1,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: isOn ? 28 : 2,
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: 'var(--color-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'left 0.3s ease',
          boxShadow: '0 1px 3px var(--color-shadow)',
          fontSize: 13,
        }}
      >
        {isOn ? '🔔' : '🔕'}
      </span>
    </button>
  );
}