import { useTheme, PALETTES, type Palette } from '../context/ThemeContext';

export default function PaletteDropdown() {
  const { palette, setPalette } = useTheme();

  return (
    <select
      value={palette}
      onChange={(e) => setPalette(e.target.value as Palette)}
      aria-label="Choose Polly's look"
      style={{
        appearance: 'none',
        WebkitAppearance: 'none',
        MozAppearance: 'none',
        border: '1px solid var(--color-border)',
        borderRadius: 999,
        padding: '5px 26px 5px 10px',
        fontSize: '0.78rem',
        fontWeight: 700,
        fontFamily: 'inherit',
        color: 'var(--color-text)',
        background:
          "var(--color-surface-raised) url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23A0907C' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\") no-repeat right 10px center",
        cursor: 'pointer',
        minHeight: 30,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {PALETTES.map((p) => (
        <option key={p.id} value={p.id}>
          {p.emoji} {p.label}
        </option>
      ))}
    </select>
  );
}
