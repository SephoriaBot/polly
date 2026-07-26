import { useEffect, useState } from 'react';

interface WeatherState {
  tempF: number | null;
  code: number | null;
  loading: boolean;
  error: boolean;
}

const CACHE_KEY = 'polly_weather_cache';
const CACHE_MS = 30 * 60 * 1000; // 30 min

function iconFor(code: number | null) {
  if (code === null) return '🌤️';
  if (code === 0) return '☀️';
  if ([1, 2].includes(code)) return '🌤️';
  if (code === 3) return '☁️';
  if ([45, 48].includes(code)) return '🌫️';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 80, 81, 82].includes(code)) return '🌧️';
  if ([66, 67, 71, 73, 75, 77, 85, 86].includes(code)) return '❄️';
  if ([95, 96, 99].includes(code)) return '⛈️';
  return '🌤️';
}

export default function WeatherBadge() {
  const [weather, setWeather] = useState<WeatherState>({ tempF: null, code: null, loading: true, error: false });

  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.time < CACHE_MS) {
          setWeather({ tempF: parsed.tempF, code: parsed.code, loading: false, error: false });
          return;
        }
      } catch {}
    }

    if (!navigator.geolocation) {
      setWeather(w => ({ ...w, loading: false, error: true }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`
          );
          const data = await res.json();
          const tempF = Math.round(data.current.temperature_2m);
          const code = data.current.weather_code;
          localStorage.setItem(CACHE_KEY, JSON.stringify({ tempF, code, time: Date.now() }));
          setWeather({ tempF, code, loading: false, error: false });
        } catch {
          setWeather(w => ({ ...w, loading: false, error: true }));
        }
      },
      () => setWeather(w => ({ ...w, loading: false, error: true })),
      { timeout: 8000 }
    );
  }, []);

  if (weather.loading || weather.error || weather.tempF === null) return null;

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: '0.78rem', color: 'var(--ink-muted)',
      fontFamily: 'IBM Plex Mono, monospace', marginTop: 2,
    }}>
      <span>{iconFor(weather.code)}</span>
      <span>{weather.tempF}°F</span>
    </div>
  );
}
