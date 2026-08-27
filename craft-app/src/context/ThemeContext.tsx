import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';
export type Palette = 'teddy-bear' | 'strawberry' | 'sunny-skies';

export interface PaletteOption {
  id: Palette;
  label: string;
  emoji: string;
}

export const PALETTES: PaletteOption[] = [
  { id: 'teddy-bear', label: 'Teddy Bear', emoji: '🧸' },
  { id: 'strawberry', label: 'Strawberry', emoji: '🍓' },
  { id: 'sunny-skies', label: 'Sunny Skies', emoji: '☀️' },
];

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  palette: Palette;
  setPalette: (palette: Palette) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'polly-theme';
const PALETTE_STORAGE_KEY = 'polly-palette';

function isPalette(value: string | null): value is Palette {
  return value === 'teddy-bear' || value === 'strawberry' || value === 'sunny-skies';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [palette, setPaletteState] = useState<Palette>(() => {
    const stored = localStorage.getItem(PALETTE_STORAGE_KEY);
    return isPalette(stored) ? stored : 'teddy-bear';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-palette', palette);
    localStorage.setItem(PALETTE_STORAGE_KEY, palette);
  }, [palette]);

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  const setPalette = (next: Palette) => setPaletteState(next);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, palette, setPalette }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
