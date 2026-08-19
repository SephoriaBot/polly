import { useState, type FormEvent, type CSSProperties } from 'react';
import { useAuth } from '../context/AuthContext';

const LAST_EMAIL_KEY = 'polly:last-email';

export default function Login() {
  const { signIn, signUp, signInAsGuest } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem(LAST_EMAIL_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setConfirmMsg(null);
    setBusy(true);
    try {
      try {
        localStorage.setItem(LAST_EMAIL_KEY, email);
      } catch {
        // ignore storage failures (e.g. private browsing)
      }
      if (mode === 'signin') {
        const { error } = await signIn(email, password);
        if (error) setError(error);
      } else {
        const { error, needsEmailConfirm } = await signUp(email, password);
        if (error) {
          setError(error);
        } else if (needsEmailConfirm) {
          setConfirmMsg('Check your email for a confirmation link, then come back and sign in.');
          setMode('signin');
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleGuest() {
    setError(null);
    setConfirmMsg(null);
    setBusy(true);
    try {
      const { error } = await signInAsGuest();
      if (error) setError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '24px',
        paddingTop: 'max(24px, 10dvh)',
        overflowY: 'auto',
        background: 'var(--color-bg)',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 360,
          background: 'var(--color-surface)',
          border: '1.5px solid var(--color-border)',
          borderRadius: 20,
          padding: '28px 24px',
          boxShadow: '0 8px 24px var(--color-shadow)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.6rem',
              fontWeight: 700,
              color: 'var(--color-accent-strong)',
            }}
          >
            Polly
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </div>
        </div>

        {confirmMsg && (
          <div
            style={{
              fontSize: '0.8rem',
              color: 'var(--color-accent-strong)',
              background: 'var(--color-surface-raised)',
              borderRadius: 10,
              padding: '8px 10px',
            }}
          >
            {confirmMsg}
          </div>
        )}
        {error && (
          <div style={{ fontSize: '0.8rem', color: '#b3413e', background: '#fbe4e2', borderRadius: 10, padding: '8px 10px' }}>
            {error}
          </div>
        )}

        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
          Email
          <input
            type="email"
            required
            autoComplete="email"
            enterKeyHint="next"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
          Password
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            enterKeyHint="go"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          style={{
            marginTop: 6,
            background: 'var(--color-accent-strong)',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '11px 0',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError(null);
            setConfirmMsg(null);
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-text-muted)',
            fontSize: '0.8rem',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            margin: '2px 0',
          }}
        >
          <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>or</span>
          <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
        </div>

        <button
          type="button"
          onClick={handleGuest}
          disabled={busy}
          style={{
            background: 'var(--color-surface-raised)',
            color: 'var(--color-accent-strong)',
            border: '1.5px solid var(--color-border)',
            borderRadius: 12,
            padding: '10px 0',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.7 : 1,
          }}
        >
          Continue as guest (demo)
        </button>
        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
          No email needed. Guest data can be cleared anytime and isn't tied to a real account.
        </div>
      </form>
    </div>
  );
}

const inputStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 5,
  padding: '9px 11px',
  borderRadius: 10,
  border: '1.5px solid var(--color-border)',
  background: 'var(--color-bg)',
  color: 'var(--color-text)',
  fontSize: '0.9rem',
  fontFamily: 'var(--font-body)',
  boxSizing: 'border-box',
};
