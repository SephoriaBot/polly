import { useEnergy, type EnergyMode } from '../context/EnergyContext';

const OPTIONS: { mode: EnergyMode; label: string; icon?: string }[] = [
  { mode: 'normal', label: 'Normal' },
  { mode: 'noEnergy', label: 'No Energy', icon: '/icons/lowenergy.png' },
];

export default function EnergyModeSwitch() {
  const { mode, setMode } = useEnergy();

  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
      {OPTIONS.map(opt => {
        const active = mode === opt.mode;
        return (
          <button
            key={opt.mode}
            onClick={() => setMode(opt.mode)}
            style={{
              padding: '5px 10px', borderRadius: 12,
              background: active ? 'var(--blush)' : 'transparent',
              border: `1.5px solid ${active ? 'var(--pink-dark)' : 'var(--border)'}`,
              color: active ? 'var(--pink-dark)' : 'var(--ink-muted)',
              fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer',
              fontFamily: 'IBM Plex Mono, monospace',
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}
          >
            {opt.icon && (
              <img
                src={opt.icon}
                alt=""
                style={{ width: 14, height: 14, objectFit: 'contain' }}
              />
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
