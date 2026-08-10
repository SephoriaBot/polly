import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useHamsterGrowth } from './HamsterGrowthContext';
import { imageForForm, HAMSTERS } from './hamsters';

const HABITAT_PATH = '/habitat';
const MAX_DECOR = 3;

type HabitatSlot = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

type Season = 'spring' | 'summer' | 'fall' | 'winter';

interface HabitatItem {
  key: string;
  label: string;
  image: string;
  season: Season;
  slot: HabitatSlot;
}

const HABITAT_ITEMS: HabitatItem[] = [
  {
    key: 'spring-daisy-bed',
    label: 'Daisy Bed',
    image: `${HABITAT_PATH}/item_spring_daisy-bed.png`,
    season: 'spring',
    slot: 1,
  },
  {
    key: 'spring-floral-bridge',
    label: 'Floral Bridge',
    image: `${HABITAT_PATH}/item_spring_floral-bridge.png`,
    season: 'spring',
    slot: 2,
  },
  {
    key: 'spring-floral-swing',
    label: 'Floral Swing',
    image: `${HABITAT_PATH}/item_spring_floral-swing.png`,
    season: 'spring',
    slot: 3,
  },
  {
    key: 'spring-mushroom-house',
    label: 'Mushroom House',
    image: `${HABITAT_PATH}/item_spring_mushroom-house.png`,
    season: 'spring',
    slot: 4,
  },
  {
    key: 'spring-nest-bed',
    label: 'Nest Bed',
    image: `${HABITAT_PATH}/item_spring_nest-bed.png`,
    season: 'spring',
    slot: 5,
  },
  {
    key: 'spring-teacup-bath',
    label: 'Teacup Bath',
    image: `${HABITAT_PATH}/item_spring_teacup-bath.png`,
    season: 'spring',
    slot: 6,
  },
  {
    key: 'spring-tulip-bed',
    label: 'Tulip Bed',
    image: `${HABITAT_PATH}/item_spring_tulip-bed.png`,
    season: 'spring',
    slot: 7,
  },

  {
    key: 'summer-beach-chair-umbrella',
    label: 'Beach Chair',
    image: `${HABITAT_PATH}/item_summer_beach-chair-umbrella.png`,
    season: 'summer',
    slot: 1,
  },
  {
    key: 'summer-coconut-hut',
    label: 'Coconut Hut',
    image: `${HABITAT_PATH}/item_summer_coconut-hut.png`,
    season: 'summer',
    slot: 2,
  },
  {
    key: 'summer-hammock-palms',
    label: 'Palm Hammock',
    image: `${HABITAT_PATH}/item_summer_hammock-palms.png`,
    season: 'summer',
    slot: 3,
  },
  {
    key: 'summer-pineapple-house',
    label: 'Pineapple House',
    image: `${HABITAT_PATH}/item_summer_pineapple-house.png`,
    season: 'summer',
    slot: 4,
  },
  {
    key: 'summer-sandcastle-house',
    label: 'Sandcastle House',
    image: `${HABITAT_PATH}/item_summer_sandcastle-house.png`,
    season: 'summer',
    slot: 5,
  },
  {
    key: 'summer-shell-bed',
    label: 'Shell Bed',
    image: `${HABITAT_PATH}/item_summer_shell-bed.png`,
    season: 'summer',
    slot: 6,
  },
  {
    key: 'summer-surfboard-rocks',
    label: 'Surfboard',
    image: `${HABITAT_PATH}/item_summer_surfboard-rocks.png`,
    season: 'summer',
    slot: 7,
  },
  {
    key: 'summer-watermelon-bed',
    label: 'Watermelon Bed',
    image: `${HABITAT_PATH}/item_summer_watermelon-bed.png`,
    season: 'summer',
    slot: 8,
  },

  {
    key: 'fall-book-stack-den',
    label: 'Book Stack Den',
    image: `${HABITAT_PATH}/item_fall_book-stack-den.png`,
    season: 'fall',
    slot: 1,
  },
  {
    key: 'fall-campfire',
    label: 'Campfire',
    image: `${HABITAT_PATH}/item_fall_campfire.png`,
    season: 'fall',
    slot: 2,
  },
  {
    key: 'fall-log-mushroom-house',
    label: 'Log Mushroom House',
    image: `${HABITAT_PATH}/item_fall_log-mushroom-house.png`,
    season: 'fall',
    slot: 3,
  },
  {
    key: 'fall-mushroom-table',
    label: 'Mushroom Table',
    image: `${HABITAT_PATH}/item_fall_mushroom-table.png`,
    season: 'fall',
    slot: 4,
  },
  {
    key: 'fall-plaid-armchair',
    label: 'Plaid Armchair',
    image: `${HABITAT_PATH}/item_fall_plaid-armchair.png`,
    season: 'fall',
    slot: 5,
  },
  {
    key: 'fall-plaid-loveseat',
    label: 'Plaid Loveseat',
    image: `${HABITAT_PATH}/item_fall_plaid-loveseat.png`,
    season: 'fall',
    slot: 6,
  },
  {
    key: 'fall-pumpkin-house',
    label: 'Pumpkin House',
    image: `${HABITAT_PATH}/item_fall_pumpkin-house.png`,
    season: 'fall',
    slot: 7,
  },
  {
    key: 'fall-wagon-wheel',
    label: 'Wagon Wheel',
    image: `${HABITAT_PATH}/item_fall_wagon-wheel.png`,
    season: 'fall',
    slot: 8,
  },

  {
    key: 'winter-igloo',
    label: 'Igloo',
    image: `${HABITAT_PATH}/item_winter_igloo.png`,
    season: 'winter',
    slot: 1,
  },
  {
    key: 'winter-sled',
    label: 'Sled',
    image: `${HABITAT_PATH}/item_winter_sled.png`,
    season: 'winter',
    slot: 2,
  },
  {
    key: 'winter-snowflake-teacup',
    label: 'Snowflake Teacup',
    image: `${HABITAT_PATH}/item_winter_snowflake-teacup.png`,
    season: 'winter',
    slot: 3,
  },
  {
    key: 'winter-snowglobe-bed',
    label: 'Snowglobe Bed',
    image: `${HABITAT_PATH}/item_winter_snowglobe-bed.png`,
    season: 'winter',
    slot: 4,
  },
  {
    key: 'winter-snowman',
    label: 'Snowman',
    image: `${HABITAT_PATH}/item_winter_snowman.png`,
    season: 'winter',
    slot: 5,
  },
  {
    key: 'winter-snowy-hammock',
    label: 'Snowy Hammock',
    image: `${HABITAT_PATH}/item_winter_snowy-hammock.png`,
    season: 'winter',
    slot: 6,
  },
  {
    key: 'winter-snowy-tunnel',
    label: 'Snowy Tunnel',
    image: `${HABITAT_PATH}/item_winter_snowy-tunnel.png`,
    season: 'winter',
    slot: 7,
  },
];

const SEASONS: { key: Season; label: string }[] = [
  { key: 'spring', label: 'Spring' },
  { key: 'summer', label: 'Summer' },
  { key: 'fall', label: 'Fall' },
  { key: 'winter', label: 'Winter' },
];

const SLOT_STYLES: Record<HabitatSlot, React.CSSProperties> = {
  1: {
    left: '2%',
    top: '7%',
    width: '22%',
    maxHeight: '42%',
  },
  2: {
    left: '39%',
    top: '5%',
    width: '22%',
    maxHeight: '40%',
  },
  3: {
    right: '2%',
    top: '7%',
    width: '22%',
    maxHeight: '42%',
  },
  4: {
    left: '15%',
    top: '32%',
    width: '22%',
    maxHeight: '43%',
  },
  5: {
    right: '15%',
    top: '32%',
    width: '22%',
    maxHeight: '43%',
  },
  6: {
    left: '2%',
    bottom: '2%',
    width: '22%',
    maxHeight: '38%',
  },
  7: {
    left: '39%',
    bottom: '2%',
    width: '22%',
    maxHeight: '38%',
  },
  8: {
    right: '2%',
    bottom: '2%',
    width: '22%',
    maxHeight: '38%',
  },
};

const STAGE_RANK: Record<string, number> = {
  baby: 0,
  teen: 1,
  final: 2,
};

interface HabitatThemeRow {
  id: number;
  background_key: string | null;
  decor_keys: string[] | null;
}

function baseImageFor(hamsterId: string): string {
  return HAMSTERS.find(h => h.id === hamsterId)?.image || '';
}

export default function HabitatScene() {
  const { loading, collection } = useHamsterGrowth();
  const [decor, setDecor] = useState<string[]>([]);
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [selectedSeason, setSelectedSeason] =
    useState<Season>('spring');

  useEffect(() => {
    async function loadTheme() {
      const { data } = await supabase
        .from('habitat_theme')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      const row = data as HabitatThemeRow | null;

      if (row) {
        setDecor(row.decor_keys || []);
      }

      setThemeLoaded(true);
    }

    void loadTheme();
  }, []);

  async function saveTheme(nextDecor: string[]) {
    await supabase
      .from('habitat_theme')
      .upsert({
        id: 1,
        background_key: 'room_empty_base',
        decor_keys: nextDecor,
      });
  }

  function toggleDecor(key: string) {
    setDecor(prev => {
      let next: string[];

      if (prev.includes(key)) {
        next = prev.filter(item => item !== key);
      } else if (prev.length >= MAX_DECOR) {
        next = [...prev.slice(1), key];
      } else {
        next = [...prev, key];
      }

      void saveTheme(next);
      return next;
    });
  }

  if (loading || !themeLoaded) {
    return null;
  }

  const featured = [...collection].sort((a, b) => {
    const stageDiff =
      (STAGE_RANK[b.stage] ?? 0) -
      (STAGE_RANK[a.stage] ?? 0);

    if (stageDiff !== 0) {
      return stageDiff;
    }

    return (
      new Date(b.hatchedAt).getTime() -
      new Date(a.hatchedAt).getTime()
    );
  })[0];

  const activeDecor = HABITAT_ITEMS.filter(item =>
    decor.includes(item.key)
  );

  const visibleItems = HABITAT_ITEMS.filter(
    item => item.season === selectedSeason
  );

  return (
    <div className="card">
      <div className="card-body">
        <div
          className="section-label"
          style={{ marginBottom: 10 }}
        >
          Decorate the habitat
        </div>

        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 9',
            maxHeight: 300,
            borderRadius: 20,
            overflow: 'hidden',
            border: '1.5px solid var(--border)',
            marginBottom: 14,
            background: 'var(--cream)',
          }}
        >
          <img
            src={`${HABITAT_PATH}/room_empty_base.png`}
            alt="Hamster habitat"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              zIndex: 1,
            }}
          />

          {activeDecor.map(item => (
            <img
              key={item.key}
              src={item.image}
              alt={item.label}
              title={item.label}
              style={{
                position: 'absolute',
                height: 'auto',
                objectFit: 'contain',
                pointerEvents: 'none',
                zIndex: 2,
                ...SLOT_STYLES[item.slot],
              }}
            />
          ))}

          {featured ? (
            <img
              src={imageForForm(
                featured.stage,
                featured.teenFormId,
                featured.finalFormId,
                baseImageFor(featured.hamsterId)
              )}
              alt={featured.name || featured.hamsterId}
              style={{
                position: 'absolute',
                left: '50%',
                bottom: '7%',
                transform: 'translateX(-50%)',
                width: 62,
                height: 62,
                objectFit: 'contain',
                zIndex: 5,
                pointerEvents: 'none',
              }}
            />
          ) : (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: 20,
                fontSize: '0.75rem',
                color: 'var(--ink-muted)',
                fontWeight: 600,
                zIndex: 6,
              }}
            >
              No hamster hatched yet — the nest is empty for now
            </div>
          )}
        </div>

        <div
          style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--ink-muted)',
            marginBottom: 8,
          }}
        >
          Habitat items
        </div>

        <div
          style={{
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            paddingBottom: 6,
            marginBottom: 10,
          }}
        >
          {SEASONS.map(season => (
            <button
              key={season.key}
              onClick={() => setSelectedSeason(season.key)}
              style={{
                padding: '7px 12px',
                borderRadius: 12,
                border:
                  selectedSeason === season.key
                    ? '1.5px solid var(--pink-dark)'
                    : '1.5px solid var(--border)',
                background:
                  selectedSeason === season.key
                    ? 'var(--blush)'
                    : 'var(--white)',
                color: 'var(--ink)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: '0.68rem',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {season.label}
            </button>
          ))}
        </div>

        <div
          style={{
            fontSize: '0.62rem',
            color: 'var(--ink-muted)',
            marginBottom: 8,
          }}
        >
          Pick up to {MAX_DECOR} items
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 6,
          }}
        >
          {visibleItems.map(item => {
            const active = decor.includes(item.key);

            return (
              <button
                key={item.key}
                onClick={() => toggleDecor(item.key)}
                title={item.label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  minHeight: 76,
                  padding: '6px 4px',
                  borderRadius: 12,
                  background: active
                    ? 'var(--blush)'
                    : 'var(--white)',
                  border: `1.5px solid ${
                    active
                      ? 'var(--pink-dark)'
                      : 'var(--border)'
                  }`,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  overflow: 'hidden',
                }}
              >
                <img
                  src={item.image}
                  alt={item.label}
                  style={{
                    width: 48,
                    height: 48,
                    objectFit: 'contain',
                  }}
                />

                <span
                  style={{
                    fontSize: '0.55rem',
                    color: 'var(--ink-muted)',
                    fontWeight: 600,
                    textAlign: 'center',
                    lineHeight: 1.1,
                  }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}