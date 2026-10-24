import { useEffect, useState } from 'react';
import { getPushState, enablePush, disablePush, type PushState } from '../lib/push';

// Round bell button for the top bar, styled like the refresh button.
// activebell.png = notifications on, sleepingbell.png = off.
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
    if (note) {
      window.alert(note);
      return;
    }
    if (busy) return;
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
      type="button"
      onClick={toggle}
      aria-pressed={isOn}
      aria-label={isOn ? 'Turn off notifications' : 'Turn on notifications'}
      title={isOn ? 'Notifications on' : 'Notifications off'}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: isOn ? 'var(--gold-light)' : 'var(--surface)',
        border: '1.5px solid var(--border)',
        cursor: 'pointer',
        fontSize: '0.9rem',
        lineHeight: 1,
        padding: 0,
        flexShrink: 0,
        opacity: busy ? 0.6 : 1,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <img
        src={isOn ? '/activebell.png' : '/sleepingbell.png'}
        alt=""
        width={22}
        height={22}
        style={{ display: 'block', objectFit: 'contain', pointerEvents: 'none' }}
      />
    </button>
  );
}