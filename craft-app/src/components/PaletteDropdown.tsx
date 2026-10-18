import { useTheme, PALETTES, type Palette } from '../context/ThemeContext';

export default function PaletteDropdown() {
  const { palette, setPalette } = useTheme();

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        color: 'var(--ink)',
      }}
    >
      <select
        value={palette}
        onChange={(e) => setPalette(e.target.value as Palette)}
        aria-label="Choose Polly's look"
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          border: '1px solid var(--border)',
          borderRadius: 999,
          padding: '5px 30px 5px 12px',
          fontSize: '0.78rem',
          fontWeight: 700,
          fontFamily: 'inherit',
          color: 'inherit',
          background: 'var(--surface)',
          cursor: 'pointer',
          minHeight: 30,
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {PALETTES.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>

      {/* chevron drawn in the current text color so it shows in every palette */}
      <svg
        aria-hidden="true"
        width="12"
        height="8"
        viewBox="0 0 10 6"
        style={{
          position: 'absolute',
          right: 11,
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
        }}
      >
        <path
          d="M1 1l4 4 4-4"
          stroke="currentColor"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
