import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useHamsterGrowth } from './HamsterGrowthContext';

const SHELF_PATH = '/shelf';
const MAX_PER_SHELF = 5;
const REGULAR_COST = 15;
const LARGE_COST = 25;

type ShelfNum = 1 | 2 | 3 | 4;

interface HabitatItem {
  key: string;
  label: string;
  image: string;
  shelf: ShelfNum;
}

// Every item that was cropped and dropped into public/shelf, sorted onto
// one of the 4 physical shelves in shelf-empty.PNG. item-camera and
// item-chest are the two "large" pieces — everything else is a regular
// icon-*.png.
const HABITAT_ITEMS: HabitatItem[] = [
  // Shelf 1 (top) — sweets & snacks
  { key: 'cup', label: 'Teacup', image: `${SHELF_PATH}/icon-cup.png`, shelf: 1 },
  { key: 'cupcakes', label: 'Cupcakes', image: `${SHELF_PATH}/icon-cupcakes.png`, shelf: 1 },
  { key: 'cookies', label: 'Cookies', image: `${SHELF_PATH}/icon-cookies.png`, shelf: 1 },
  { key: 'candy', label: 'Candy', image: `${SHELF_PATH}/icon-candy.png`, shelf: 1 },
  { key: 'donut-hut', label: 'Donut Hut', image: `${SHELF_PATH}/icon-donut-hut.png`, shelf: 1 },
  { key: 'pancakes', label: 'Pancakes', image: `${SHELF_PATH}/icon-pancakes.png`, shelf: 1 },
  { key: 'picnic', label: 'Picnic Basket', image: `${SHELF_PATH}/icon-picnic.png`, shelf: 1 },
  { key: 'veggies', label: 'Veggies', image: `${SHELF_PATH}/icon-veggies.png`, shelf: 1 },

  // Shelf 2 — study & hobby corner
  { key: 'books', label: 'Books', image: `${SHELF_PATH}/icon-books.png`, shelf: 2 },
  { key: 'scroll', label: 'Scroll', image: `${SHELF_PATH}/icon-scroll.png`, shelf: 2 },
  { key: 'fortune', label: 'Fortune Teller', image: `${SHELF_PATH}/icon-fortune.png`, shelf: 2 },
  { key: 'globe', label: 'Globe', image: `${SHELF_PATH}/icon-globe.png`, shelf: 2 },
  { key: 'record', label: 'Record', image: `${SHELF_PATH}/icon-record.png`, shelf: 2 },
  { key: 'pic-board', label: 'Pinboard', image: `${SHELF_PATH}/icon-pic-board.png`, shelf: 2 },
  { key: 'mirror', label: 'Mirror', image: `${SHELF_PATH}/icon-mirror.png`, shelf: 2 },
  { key: 'instapix', label: 'Instapix', image: `${SHELF_PATH}/icon-instapix.png`, shelf: 2 },
  { key: 'tv', label: 'TV', image: `${SHELF_PATH}/icon-tv.png`, shelf: 2 },

  // Shelf 3 — cozy & botanical
  { key: 'candle', label: 'Candle', image: `${SHELF_PATH}/icon-candle.png`, shelf: 3 },
  { key: 'lantern', label: 'Lantern', image: `${SHELF_PATH}/icon-lantern.png`, shelf: 3 },
  { key: 'lights', label: 'Fairy Lights', image: `${SHELF_PATH}/icon-lights.png`, shelf: 3 },
  { key: 'fireflies', label: 'Fireflies Jar', image: `${SHELF_PATH}/icon-fireflies.png`, shelf: 3 },
  { key: 'gem', label: 'Gem', image: `${SHELF_PATH}/icon-gem.png`, shelf: 3 },
  { key: 'terrarium', label: 'Terrarium', image: `${SHELF_PATH}/icon-terrarium.png`, shelf: 3 },
  { key: 'mushroom', label: 'Mushroom', image: `${SHELF_PATH}/icon-mushroom.png`, shelf: 3 },
  { key: 'flowers', label: 'Flowers', image: `${SHELF_PATH}/icon-flowers.png`, shelf: 3 },

  // Shelf 4 (bottom) — curiosities
  { key: 'birdhouse', label: 'Birdhouse', image: `${SHELF_PATH}/icon-birdhouse.png`, shelf: 4 },
  { key: 'boot', label: 'Boot', image: `${SHELF_PATH}/icon-boot.png`, shelf: 4 },
  { key: 'fishbowl', label: 'Fishbowl', image: `${SHELF_PATH}/icon-fishbowl.png`, shelf: 4 },
  { key: 'gumball-machine', label: 'Gumball Machine', image: `${SHELF_PATH}/icon-gumball-machine.png`, shelf: 4 },
  { key: 'suitcases', label: 'Suitcases', image: `${SHELF_PATH}/icon-suitcases.png`, shelf: 4 },
  { key: 'vase', label: 'Vase', image: `${SHELF_PATH}/icon-vase.png`, shelf: 4 },
  { key: 'wheel', label: 'Wheel', image: `${SHELF_PATH}/icon-wheel.png`, shelf: 4 },
  { key: 'camera', label: 'Camera', image: `${SHELF_PATH}/item-camera.png`, shelf: 4 },
  { key: 'chest', label: 'Treasure Chest', image: `${SHELF_PATH}/item-chest.png`, shelf: 4 },
];

const SHELVES: { key: ShelfNum; label: string }[] = [
  { key: 1, label: 'Top Shelf' },
  { key: 2, label: 'Second Shelf' },
  { key: 3, label: 'Third Shelf' },
  { key: 4, label: 'Bottom Shelf' },
];

// Items that read visually "bigger" and need a larger footprint on the
// shelf — and cost more points to unlock.
const LARGE_ITEMS = new Set(['camera', 'chest']);

function costFor(key: string): number {
  return LARGE_ITEMS.has(key) ? LARGE_COST : REGULAR_COST;
}

// Bottom-offset (as % of the shelf image's height) of each shelf's top
// surface, measured off shelf-empty.PNG — this is where an item's base
// should sit so it reads as resting on the wood, not floating above it
// or sinking into the plank shadow below.
const SHELF_BOTTOM: Record<ShelfNum, number> = {
  1: 66,
  2: 49,
  3: 31,
  4: 9,
};

// Left-offset (as % of width) for up to MAX_PER_SHELF items placed
// left-to-right along a shelf.
const SLOT_LEFT = ['15%', '32.5%', '50%', '67.5%', '85%'];

// Small deterministic "hand-placed" tilt per item, based on its key, so
// items don't all sit perfectly flat like stamped stickers.
function tiltFor(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  const range = 6; // degrees, total spread
  return (Math.abs(hash) % range) - range / 2;
}

interface HabitatThemeRow {
  id: number;
  background_key: string | null;
  decor_keys: string[] | null;
}

export default function HabitatScene() {
  const { loading, points, spendPoints } = useHamsterGrowth();
  const [decor, setDecor] = useState<string[]>([]);
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [unlockingKey, setUnlockingKey] = useState<string | null>(null);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [selectedShelf, setSelectedShelf] = useState<ShelfNum>(1);

  // Load the saved theme + unlocked items once on mount.
  useEffect(() => {
    let cancelled = false;

    async function loadTheme() {
      try {
        const [themeRes, unlockedRes] = await Promise.all([
          supabase.from('habitat_theme').select('decor_keys').eq('id', 1).maybeSingle(),
          supabase.from('habitat_unlocked_items').select('item_key'),
        ]);

        if (!cancelled) {
          if (!themeRes.error && themeRes.data?.decor_keys) {
            setDecor(themeRes.data.decor_keys);
          }
          if (!unlockedRes.error && unlockedRes.data) {
            setUnlocked(unlockedRes.data.map(r => r.item_key));
          }
          setThemeLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setThemeLoaded(true);
        }
      }
    }

    loadTheme();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveTheme(nextDecor: string[]) {
    await supabase.from('habitat_theme').upsert({
      id: 1,
      background_key: 'shelf_empty',
      decor_keys: nextDecor,
    });
  }

  function toggleDecor(key: string) {
    if (!unlocked.includes(key)) return;

    const item = HABITAT_ITEMS.find(i => i.key === key);
    if (!item) return;

    setDecor(prev => {
      let next: string[];

      if (prev.includes(key)) {
        next = prev.filter(k => k !== key);
      } else {
        // Cap is per-shelf, so filling up the top shelf doesn't evict
        // decor you already placed on the other shelves.
        const sameShelfKeys = prev.filter(k => {
          const other = HABITAT_ITEMS.find(h => h.key === k);
          return other?.shelf === item.shelf;
        });

        if (sameShelfKeys.length >= MAX_PER_SHELF) {
          const oldestOnShelf = sameShelfKeys[0];
          next = [...prev.filter(k => k !== oldestOnShelf), key];
        } else {
          next = [...prev, key];
        }
      }

      void saveTheme(next);
      return next;
    });
  }

  async function unlockItem(key: string) {
    if (unlocked.includes(key) || unlockingKey) return;
    setUnlockError(null);
    setUnlockingKey(key);

    const cost = costFor(key);
    const result = await spendPoints(cost);

    if (!result.ok) {
      setUnlockError(result.reason || "Couldn't unlock that yet");
      setUnlockingKey(null);
      return;
    }

    const { error } = await supabase
      .from('habitat_unlocked_items')
      .upsert({ item_key: key }, { onConflict: 'item_key' });

    if (error) {
      setUnlockError('Unlock saved points but failed to record — try again');
      setUnlockingKey(null);
      return;
    }

    setUnlocked(prev => [...prev, key]);
    setUnlockingKey(null);
  }

  if (loading || !themeLoaded) {
    return null;
  }

  // Everything placed and unlocked shows up on the shelf at once — the
  // shelf tabs below only filter which items you're browsing/unlocking,
  // not what's visible in the scene.
  const activeDecor = HABITAT_ITEMS.filter(
    item => decor.includes(item.key) && unlocked.includes(item.key)
  );

  const visibleItems = HABITAT_ITEMS.filter(item => item.shelf === selectedShelf);

  return (
    <div className="card">
      <div className="card-body">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <div className="section-label">Decorate the shelf</div>
          <div
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              color: 'var(--ink-muted)',
            }}
          >
            {points} pts
          </div>
        </div>
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1 / 1',
            maxHeight: 340,
            borderRadius: 20,
            overflow: 'hidden',
            border: '1.5px solid var(--border)',
            marginBottom: 14,
            background: 'var(--cream)',
          }}
        >
          <img
            src={`${SHELF_PATH}/shelf-empty.PNG`}
            alt="Hamster shelf"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              zIndex: 1,
            }}
          />
          {SHELVES.map(({ key: shelfNum }) => {
            const shelfItems = activeDecor.filter(item => item.shelf === shelfNum);
            const bottom = `${SHELF_BOTTOM[shelfNum]}%`;

            return shelfItems.map((item, index) => {
              const large = LARGE_ITEMS.has(item.key);
              const left = SLOT_LEFT[index] ?? '50%';
              const width = large ? '19%' : '13%';
              const maxHeight = large ? '17%' : '12%';
              const tilt = tiltFor(item.key);

              return (
                <div
                  key={item.key}
                  style={{
                    position: 'absolute',
                    left,
                    bottom,
                    width,
                    maxHeight,
                    transform: 'translateX(-50%)',
                    zIndex: 10 + index,
                    pointerEvents: 'none',
                  }}
                >
                  {/* Flat, unrotated shadow anchored to the shelf line */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '50%',
                      bottom: 0,
                      width: large ? '70%' : '58%',
                      height: large ? '10%' : '8%',
                      transform: 'translateX(-50%)',
                      background: 'rgba(70, 55, 45, 0.16)',
                      filter: 'blur(3px)',
                      borderRadius: '50%',
                    }}
                  />
                  {/* Item gets a slight hand-placed tilt, anchored at its base */}
                  <img
                    src={item.image}
                    alt={item.label}
                    title={item.label}
                    style={{
                      display: 'block',
                      width: '100%',
                      height: 'auto',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      position: 'relative',
                      transform: `rotate(${tilt}deg)`,
                      transformOrigin: 'bottom center',
                      filter: 'drop-shadow(0 2px 3px rgba(70,55,45,0.22))',
                    }}
                  />
                </div>
              );
            });
          })}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 6,
            marginBottom: 10,
            flexWrap: 'wrap',
          }}
        >
          {SHELVES.map(shelf => (
            <button
              key={shelf.key}
              onClick={() => setSelectedShelf(shelf.key)}
              style={{
                padding: '5px 10px',
                borderRadius: 999,
                fontSize: '0.62rem',
                fontWeight: 700,
                fontFamily: 'inherit',
                cursor: 'pointer',
                border: `1.5px solid ${
                  selectedShelf === shelf.key ? 'var(--pink-dark)' : 'var(--border)'
                }`,
                background: selectedShelf === shelf.key ? 'var(--blush)' : 'var(--white)',
                color: 'var(--ink)',
              }}
            >
              {shelf.label}
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
          Pick up to {MAX_PER_SHELF} unlocked items per shelf. Locked items cost
          points to unlock — same points that hatch and train your hamsters.
        </div>
        {unlockError && (
          <div
            style={{
              fontSize: '0.6rem',
              color: 'var(--pink-dark)',
              marginBottom: 8,
            }}
          >
            {unlockError}
          </div>
        )}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 6,
          }}
        >
          {visibleItems.map(item => {
            const isUnlocked = unlocked.includes(item.key);
            const active = decor.includes(item.key);
            const cost = costFor(item.key);
            const busy = unlockingKey === item.key;

            return (
              <button
                key={item.key}
                onClick={() =>
                  isUnlocked ? toggleDecor(item.key) : unlockItem(item.key)
                }
                disabled={busy}
                title={isUnlocked ? item.label : `${item.label} — ${cost} pts to unlock`}
                style={{
                  position: 'relative',
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
                    active ? 'var(--pink-dark)' : 'var(--border)'
                  }`,
                  cursor: busy ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                  overflow: 'hidden',
                  opacity: isUnlocked ? 1 : 0.55,
                }}
              >
                <img
                  src={item.image}
                  alt={item.label}
                  style={{
                    width: 48,
                    height: 48,
                    objectFit: 'contain',
                    filter: isUnlocked ? 'none' : 'grayscale(60%)',
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
                  {isUnlocked ? item.label : `🔒 ${cost} pts`}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}