// HabitatScene.tsx
// Tier 3, item 2: habitat customization. Built from CSS gradient themes and
// the existing icon set rather than new illustrated art (none exists yet
// for room backgrounds/furniture) — still a genuine pick-and-arrange
// customization layer, just a lighter-weight one than a fully illustrated
// room. The featured hamster is whichever one in the collection has
// evolved furthest (ties broken by most recently hatched), so the scene
// reflects real progress rather than a static picture.

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useHamsterGrowth } from './HamsterGrowthContext';
import { imageForForm, HAMSTERS } from './hamsters';
import Icon, { type IconName } from '../components/Icon';

interface BackgroundTheme {
  key: string;
  label: string;
  css: string;
}

const BACKGROUNDS: BackgroundTheme[] = [
  { key: 'meadow', label: 'Meadow', css: 'linear-gradient(180deg, #DCEFD8 0%, #B9E0A5 100%)' },
  { key: 'sunset', label: 'Sunset', css: 'linear-gradient(180deg, #FCE1D0 0%, #F3B88A 100%)' },
  { key: 'starry', label: 'Starry Night', css: 'linear-gradient(180deg, #2E2B4E 0%, #4A4570 100%)' },
  { key: 'cotton-candy', label: 'Cotton Candy', css: 'linear-gradient(180deg, #F6D6E8 0%, #D8CFF2 100%)' },
  { key: 'forest', label: 'Forest', css: 'linear-gradient(180deg, #CFE3C8 0%, #8FB884 100%)' },
  { key: 'beach', label: 'Beach', css: 'linear-gradient(180deg, #BEE7F2 0%, #F2E6BE 100%)' },
];

const MAX_DECOR = 3;

const DECOR_OPTIONS: { key: string; icon: IconName; label: string; slot: 'bottomLeft' | 'bottomRight' | 'topRight' | 'topLeft' }[] = [
  { key: 'plant', icon: 'potted-plant', label: 'Potted plant', slot: 'bottomLeft' },
  { key: 'flowers', icon: 'flowerfull', label: 'Flowers', slot: 'bottomRight' },
  { key: 'lavender', icon: 'lavender', label: 'Lavender', slot: 'bottomLeft' },
  { key: 'sparkles', icon: 'sparkles-cluster', label: 'Sparkles', slot: 'topRight' },
  { key: 'moon', icon: 'moon-full', label: 'Moon', slot: 'topLeft' },
  { key: 'sun', icon: 'sun-cloud', label: 'Sun & clouds', slot: 'topLeft' },
  { key: 'music', icon: 'music-note', label: 'Music notes', slot: 'topRight' },
  { key: 'trophy', icon: 'trophy', label: 'Trophy shelf', slot: 'bottomRight' },
];

const SLOT_POSITION: Record<string, React.CSSProperties> = {
  bottomLeft: { left: 10, bottom: 8 },
  bottomRight: { right: 10, bottom: 8 },
  topLeft: { left: 10, top: 8 },
  topRight: { right: 10, top: 8 },
};

const STAGE_RANK: Record<string, number> = { baby: 0, teen: 1, final: 2 };

interface HabitatThemeRow {
  id: number;
  background_key: string;
  decor_keys: string[];
}

function baseImageFor(hamsterId: string): string {
  return HAMSTERS.find(h => h.id === hamsterId)?.image || '';
}

export default function HabitatScene() {
  const { loading, collection } = useHamsterGrowth();
  const [background, setBackground] = useState('meadow');
  const [decor, setDecor] = useState<string[]>([]);
  const [themeLoaded, setThemeLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('habitat_theme').select('*').eq('id', 1).maybeSingle();
      const row = data as HabitatThemeRow | null;
      if (row) {
        setBackground(row.background_key || 'meadow');
        setDecor(row.decor_keys || []);
      }
      setThemeLoaded(true);
    })();
  }, []);

  async function saveTheme(nextBackground: string, nextDecor: string[]) {
    await supabase.from('habitat_theme').upsert({ id: 1, background_key: nextBackground, decor_keys: nextDecor });
  }

  function pickBackground(key: string) {
    setBackground(key);
    saveTheme(key, decor);
  }

  function toggleDecor(key: string) {
    setDecor(prev => {
      let next: string[];
      if (prev.includes(key)) {
        next = prev.filter(d => d !== key);
      } else if (prev.length >= MAX_DECOR) {
        next = [...prev.slice(1), key]; // drop the oldest, add the new one
      } else {
        next = [...prev, key];
      }
      saveTheme(background, next);
      return next;
    });
  }

  if (loading || !themeLoaded) return null;

  const featured = [...collection].sort((a, b) => {
    const stageDiff = (STAGE_RANK[b.stage] ?? 0) - (STAGE_RANK[a.stage] ?? 0);
    if (stageDiff !== 0) return stageDiff;
    return new Date(b.hatchedAt).getTime() - new Date(a.hatchedAt).getTime();
  })[0];

  const bg = BACKGROUNDS.find(b => b.key === background) ?? BACKGROUNDS[0];
  const activeDecor = DECOR_OPTIONS.filter(d => decor.includes(d.key));

  return (
    <div className="card">
      <div className="card-body">
        <div className="section-label" style={{ marginBottom: 10 }}>
          <Icon name="icon-habitat" size={16} /> Decorate the habitat
        </div>

        <div style={{
          position: 'relative', height: 160, borderRadius: 20,
          background: bg.css, border: '1.5px solid var(--border)',
          overflow: 'hidden', marginBottom: 14,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          {activeDecor.map(d => (
            <div key={d.key} style={{ position: 'absolute', ...SLOT_POSITION[d.slot] }}>
              <Icon name={d.icon} size={26} style={{ opacity: 0.9 }} />
            </div>
          ))}
          {featured ? (
            <img
              src={imageForForm(featured.stage, featured.teenFormId, featured.finalFormId, baseImageFor(featured.hamsterId))}
              alt={featured.name || featured.hamsterId}
              style={{ width: 84, height: 84, objectFit: 'contain', marginBottom: 8 }}
            />
          ) : (
            <div style={{ fontSize: '0.75rem', color: 'rgba(0,0,0,0.5)', marginBottom: 16, fontWeight: 600 }}>
              No hamster hatched yet — the nest is empty for now
            </div>
          )}
        </div>

        <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-muted)', marginBottom: 8 }}>
          Background
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
          {BACKGROUNDS.map(b => (
            <button
              key={b.key}
              onClick={() => pickBackground(b.key)}
              title={b.label}
              style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: b.css, cursor: 'pointer',
                border: background === b.key ? '2.5px solid var(--pink-dark)' : '1.5px solid var(--border)',
              }}
            />
          ))}
        </div>

        <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-muted)', marginBottom: 8 }}>
          Decor (pick up to {MAX_DECOR})
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {DECOR_OPTIONS.map(d => {
            const active = decor.includes(d.key);
            return (
              <button
                key={d.key}
                onClick={() => toggleDecor(d.key)}
                title={d.label}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '8px 4px', borderRadius: 12,
                  background: active ? 'var(--blush)' : 'var(--white)',
                  border: `1.5px solid ${active ? 'var(--pink-dark)' : 'var(--border)'}`,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <Icon name={d.icon} size={18} style={{ color: 'var(--pink-dark)' }} />
                <span style={{ fontSize: '0.6rem', color: 'var(--ink-muted)', fontWeight: 600, textAlign: 'center' }}>{d.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
