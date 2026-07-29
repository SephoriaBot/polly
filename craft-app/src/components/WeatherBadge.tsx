import { useEffect, useState } from 'react';
import sunnyImg from '../assets/illustrations/sunny.png';
import clearNightImg from '../assets/illustrations/clear_night.png';
import rainyImg from '../assets/illustrations/rainy.png';
import stormyImg from '../assets/illustrations/stormy.png';
import coldSnowyScarfImg from '../assets/illustrations/cold_snowy_scarf.png';
import snowCloudImg from '../assets/illustrations/snow_cloud.png';
import autumnWindyImg from '../assets/illustrations/autumn_windy.png';
import iglooSnowImg from '../assets/illustrations/igloo_snow.png';

interface WeatherState {
  tempF: number | null;
  code: number | null;
  isDay: boolean;
  windMph: number | null;
  loading: boolean;
  error: boolean;
}

const CACHE_KEY = 'polly_weather_cache';
const CACHE_MS = 30 * 60 * 1000; // 30 min

const SNOW_CODES = [71, 73, 75, 77, 85, 86];
const STORM_CODES = [95, 96, 99];
const RAIN_CODES = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82];
const CLOUDY_CODES = [3, 45, 48];

function iconFor(code: number | null, tempF: number | null, isDay: boolean, windMph: number | null) {
  if (tempF !== null && tempF <= 20) return iglooSnowImg;
  if (code !== null && SNOW_CODES.includes(code)) return coldSnowyScarfImg;
  if (code !== null && STORM_CODES.includes(code)) return stormyImg;
  if (code !== null && RAIN_CODES.includes(code)) return rainyImg;
  if (code !== null && CLOUDY_CODES.includes(code)) return snowCloudImg;
  if (windMph !== null && windMph >= 20) return autumnWindyImg;
  return isDay ? sunnyImg : clearNightImg;
}

export default function WeatherBadge() {
  const [weather, setWeather] = useState<WeatherState>({
    tempF: null, code: null, isDay: true, windMph: null, loading: true, error: false,
  });

  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.time < CACHE_MS) {
          setWeather({ ...parsed, loading: false, error: false });
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
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
            `&current=temperature_2m,weather_code,is_day,wind_speed_10m` +
            `&temperature_unit=fahrenheit&wind_speed_unit=mph`
          );
          const data = await res.json();
          const tempF = Math.round(data.current.temperature_2m);
          const code = data.current.weather_code;
          const isDay = data.current.is_day === 1;
          const windMph = Math.round(data.current.wind_speed_10m);
          const payload = { tempF, code, isDay, windMph, time: Date.now() };
          localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
          setWeather({ tempF, code, isDay, windMph, loading: false, error: false });
        } catch {
          setWeather(w => ({ ...w, loading: false, error: true }));
        }
      },
      () => setWeather(w => ({ ...w, loading: false, error: true })),
      { timeout: 8000 }
    );
  }, []);

  if (weather.loading || weather.error || weather.tempF === null) return null;

  const icon = iconFor(weather.code, weather.tempF, weather.isDay, weather.windMph);

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: '0.78rem', color: 'var(--ink-muted)',
      fontFamily: 'IBM Plex Mono, monospace', marginTop: 2,
    }}>
      <img src={icon} alt="" style={{ width: 26, height: 26, objectFit: 'contain' }} />
      <span>{weather.tempF}°F</span>
    </div>
  );
}
