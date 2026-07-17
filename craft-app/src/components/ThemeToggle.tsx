import { Flower2, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      role="switch"
      aria-checked={isDark}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      style={{
        position: 'relative',
        width: 56,
        height: 30,
        borderRadius: 999,
        border: `1px solid var(--color-border)`,
        background: isDark ? 'var(--color-surface-raised)' : 'var(--color-accent-pink)',
        cursor: 'pointer',
        transition: 'background-color 0.4s ease',
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: isDark ? 28 : 2,
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: 'var(--color-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'left 0.3s ease',
          boxShadow: '0 1px 3px var(--color-shadow)',
        }}
      >
        {isDark ? (
          <Moon size={14} color="var(--color-accent-apricot)" />
        ) : (
          <Flower2 size={14} color="var(--color-accent-strong)" />
        )}
      </span>
    </button>
  );
}
