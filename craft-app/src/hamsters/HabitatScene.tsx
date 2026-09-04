import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useHamsterGrowth } from './HamsterGrowthContext';

const SHELF_PATH = '/shelf';
const MAX_PER_SHELF = 4;
const REGULAR_COST = 15;
const LARGE_COST = 25;

// How many locked items are purchasable on any given day. Everything
// already unlocked stays visible/placeable regardless of this.
const DAILY_MARKET_SIZE = 4;

type ShelfNum = 1 | 2 | 3 | 4;

interface HabitatItem {
  key: string;
  label: string;
  image: string;
  shelf: ShelfNum;
  // Visual size multiplier applied on top of the base width. Source PNGs
  // don't all have the same amount of transparent padding around the
  // object, so two icons at the same base width can render very
  // differently sized on the shelf. Default 1 = no correction. Nudge up
  // for icons that read too small (lots of padding in the crop), down
  // for icons that read too big (object fills most of the canvas).
  scale?: number;
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
  // Was reading too small on the shelf — icon-picnic.png appears to have
  // extra transparent margin around the basket vs. its neighbors.
  { key: 'picnic', label: 'Picnic Basket', image: `${SHELF_PATH}/icon-picnic.png`, shelf: 1, scale: 1.6 },
  { key: 'veggies', label: 'Veggies', image: `${SHELF_PATH}/icon-veggies.png`, shelf: 1 },
  // Oddities batch, moved here to even out shelf counts
  { key: 'stitched-doll', label: 'Stitched Doll', image: `${SHELF_PATH}/stitched_doll.png`, shelf: 1 },
  { key: 'skeleton-coin', label: 'Skeleton Coin', image: `${SHELF_PATH}/skeleton_coin.png`, shelf: 1 },
  { key: 'ouija-planchette', label: 'Ouija Planchette', image: `${SHELF_PATH}/ouija_planchette.png`, shelf: 1 },
  { key: 'ghost-bottle', label: 'Ghost in a Bottle', image: `${SHELF_PATH}/ghost_bottle.png`, shelf: 1 },
  // New batch, generated for the daily-market expansion
  { key: 'honey-jar', label: 'Honey Jar', image: `${SHELF_PATH}/icon_01_01.png`, shelf: 1 },
  { key: 'strawberry-cake', label: 'Strawberry Cake', image: `${SHELF_PATH}/icon_01_02.png`, shelf: 1 },
  { key: 'hot-cocoa', label: 'Hot Cocoa', image: `${SHELF_PATH}/icon_01_03.png`, shelf: 1 },
  { key: 'macaron-basket', label: 'Macaron Basket', image: `${SHELF_PATH}/icon_01_04.png`, shelf: 1 },
  { key: 'jam-jar', label: 'Jam Jar', image: `${SHELF_PATH}/icon_01_05.png`, shelf: 1 },
  { key: 'cherry-bowl', label: 'Bowl of Cherries', image: `${SHELF_PATH}/icon_01_06.png`, shelf: 1 },
  { key: 'mini-teapot', label: 'Mini Teapot', image: `${SHELF_PATH}/icon_01_07.png`, shelf: 1 },
  // Narrow/tall crop reads small at the same width % as its neighbors
  { key: 'ice-cream-cone', label: 'Ice Cream Cone', image: `${SHELF_PATH}/icon_01_08.png`, shelf: 1, scale: 1.15 },
  { key: 'gingerbread-cookie', label: 'Gingerbread Cookie', image: `${SHELF_PATH}/icon_01_10.png`, shelf: 1 },

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
  // Oddities batch, moved here to even out shelf counts
  { key: 'astrolabe', label: 'Astrolabe', image: `${SHELF_PATH}/astrolabe.png`, shelf: 2 },
  { key: 'music-box', label: 'Music Box', image: `${SHELF_PATH}/music_box.png`, shelf: 2 },
  { key: 'clockwork-beetle', label: 'Clockwork Beetle', image: `${SHELF_PATH}/clockwork_beetle.png`, shelf: 2 },
  // New batch, generated for the daily-market expansion
  { key: 'typewriter', label: 'Typewriter', image: `${SHELF_PATH}/icon_02_01.png`, shelf: 2 },
  { key: 'pincushion', label: 'Pincushion & Scissors', image: `${SHELF_PATH}/icon_02_04.png`, shelf: 2 },
  { key: 'paint-palette', label: 'Paint Palette', image: `${SHELF_PATH}/icon_02_05.png`, shelf: 2 },
  // Narrow/tall crop reads small at the same width % as its neighbors
  { key: 'chess-knight', label: 'Chess Knight', image: `${SHELF_PATH}/icon_02_06.png`, shelf: 2, scale: 1.15 },
  { key: 'compass', label: 'Compass', image: `${SHELF_PATH}/icon_02_07.png`, shelf: 2 },
  { key: 'key-ring', label: 'Antique Key Ring', image: `${SHELF_PATH}/icon_02_08.png`, shelf: 2 },
  { key: 'sheet-music', label: 'Sheet Music Roll', image: `${SHELF_PATH}/icon_02_09.png`, shelf: 2 },
  { key: 'embroidery-hoop', label: 'Embroidery Hoop', image: `${SHELF_PATH}/icon_02_10.png`, shelf: 2 },

  // Shelf 3 — cozy & botanical
  { key: 'candle', label: 'Candle', image: `${SHELF_PATH}/icon-candle.png`, shelf: 3 },
  { key: 'lantern', label: 'Lantern', image: `${SHELF_PATH}/icon-lantern.png`, shelf: 3 },
  { key: 'lights', label: 'Fairy Lights', image: `${SHELF_PATH}/icon-lights.png`, shelf: 3 },
  { key: 'fireflies', label: 'Fireflies Jar', image: `${SHELF_PATH}/icon-fireflies.png`, shelf: 3 },
  { key: 'gem', label: 'Gem', image: `${SHELF_PATH}/icon-gem.png`, shelf: 3 },
  { key: 'terrarium', label: 'Terrarium', image: `${SHELF_PATH}/icon-terrarium.png`, shelf: 3 },
  { key: 'mushroom', label: 'Mushroom', image: `${SHELF_PATH}/icon-mushroom.png`, shelf: 3 },
  { key: 'flowers', label: 'Flowers', image: `${SHELF_PATH}/icon-flowers.png`, shelf: 3 },
  // Oddities batch, moved here to even out shelf counts
  { key: 'black-candle', label: 'Black Candle', image: `${SHELF_PATH}/black_candle.png`, shelf: 3 },
  { key: 'moon-cauldron', label: 'Moon Cauldron', image: `${SHELF_PATH}/moon_cauldron.png`, shelf: 3 },
  { key: 'framed-butterfly', label: 'Framed Butterfly', image: `${SHELF_PATH}/framed_butterfly.png`, shelf: 3 },
  { key: 'jackalope', label: 'Jackalope', image: `${SHELF_PATH}/jackalope.png`, shelf: 3 },
  // New batch, generated for the daily-market expansion
  { key: 'flower-book', label: 'Pressed Flower Book', image: `${SHELF_PATH}/icon_03_01.png`, shelf: 3 },
  { key: 'watering-can', label: 'Watering Can', image: `${SHELF_PATH}/icon_03_02.png`, shelf: 3 },
  { key: 'succulent', label: 'Potted Succulent', image: `${SHELF_PATH}/icon_03_03.png`, shelf: 3 },
  { key: 'lavender-bundle', label: 'Lavender Bundle', image: `${SHELF_PATH}/icon_03_04.png`, shelf: 3 },
  { key: 'snail-shell', label: 'Snail Shell', image: `${SHELF_PATH}/icon_03_05.png`, shelf: 3 },
  { key: 'moss-terrarium', label: 'Moss Terrarium', image: `${SHELF_PATH}/icon_03_06.png`, shelf: 3 },
  { key: 'acorn-cluster', label: 'Acorn Cluster', image: `${SHELF_PATH}/icon_03_07.png`, shelf: 3 },
  // Narrow/tall crop reads small at the same width % as its neighbors
  { key: 'butterfly-net', label: 'Butterfly Net', image: `${SHELF_PATH}/icon_03_08.png`, shelf: 3, scale: 1.15 },
  { key: 'honeycomb', label: 'Honeycomb', image: `${SHELF_PATH}/icon_03_09.png`, shelf: 3 },
  { key: 'birds-nest', label: "Bird's Nest", image: `${SHELF_PATH}/icon_03_10.png`, shelf: 3 },

  // Shelf 4 (bottom) — curiosities
  { key: 'birdhouse', label: 'Birdhouse', image: `${SHELF_PATH}/icon-birdhouse.png`, shelf: 4 },
  { key: 'boot', label: 'Boot', image: `${SHELF_PATH}/icon-boot.png`, shelf: 4 },
  { key: 'fishbowl', label: 'Fishbowl', image: `${SHELF_PATH}/icon-fishbowl.png`, shelf: 4 },
  // Was reading too big on the shelf — icon-gumball-machine.png appears
  // to be cropped tight to the object, unlike its neighbors.
  { key: 'gumball-machine', label: 'Gumball Machine', image: `${SHELF_PATH}/icon-gumball-machine.png`, shelf: 4, scale: 0.80 },
  { key: 'suitcases', label: 'Suitcases', image: `${SHELF_PATH}/icon-suitcases.png`, shelf: 4 },
  { key: 'vase', label: 'Vase', image: `${SHELF_PATH}/icon-vase.png`, shelf: 4 },
  { key: 'wheel', label: 'Wheel', image: `${SHELF_PATH}/icon-wheel.png`, shelf: 4 },
  { key: 'camera', label: 'Camera', image: `${SHELF_PATH}/item-camera.png`, shelf: 4 },
  { key: 'chest', label: 'Treasure Chest', image: `${SHELF_PATH}/item-chest.png`, shelf: 4 },
  // Oddities batch — the rest stay here on their original curiosities shelf
  { key: 'anatomical-heart', label: 'Anatomical Heart', image: `${SHELF_PATH}/anatomical_heart.png`, shelf: 4 },
  { key: 'bound-bones', label: 'Bound Bones', image: `${SHELF_PATH}/bound_bones.png`, shelf: 4 },
  { key: 'eyeball-jar', label: 'Eyeball Jar', image: `${SHELF_PATH}/eyeball_jar.png`, shelf: 4 },
  { key: 'moth-skull', label: 'Moth Skull', image: `${SHELF_PATH}/moth_skull.png`, shelf: 4 },
  // New batch, generated for the daily-market expansion
  { key: 'crystal-ball', label: 'Crystal Ball', image: `${SHELF_PATH}/icon_04_01.png`, shelf: 4 },
  // Wide/short crop reads a touch big at the same width % as its neighbors
  { key: 'raven-skull', label: 'Raven Skull', image: `${SHELF_PATH}/icon_04_02.png`, shelf: 4, scale: 0.9 },
  { key: 'spellbook', label: 'Spellbook', image: `${SHELF_PATH}/icon_04_03.png`, shelf: 4 },
  { key: 'black-cat', label: 'Black Cat', image: `${SHELF_PATH}/icon_04_04.png`, shelf: 4 },
  { key: 'tiny-cauldron', label: 'Tiny Cauldron', image: `${SHELF_PATH}/icon_04_05.png`, shelf: 4 },
  { key: 'bat-wing-charm', label: 'Bat Wing Charm', image: `${SHELF_PATH}/icon_04_06.png`, shelf: 4 },
  { key: 'glowing-potion', label: 'Glowing Potion Vial', image: `${SHELF_PATH}/icon_04_08.png`, shelf: 4 },
  { key: 'tarot-deck', label: 'Tarot Deck', image: `${SHELF_PATH}/icon_04_09.png`, shelf: 4 },
  { key: 'pocket-watch', label: 'Pocket Watch', image: `${SHELF_PATH}/icon_04_10.png`, shelf: 4 },
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
// surface, measured off the close-up shelf-closeup.png crop (no outer
// cabinet frame, 4 compartments edge-to-edge). Shelves 1–3 anchor to the
// visible plank highlight line below each compartment; shelf 4's own
// floor board is cropped out of frame, so its items are anchored near
const SHELF_BOTTOM: Record<ShelfNum, number> = {
  1: 81,
  2: 52,
  3: 25,
  4: 0.5,
};

// 4 slots, evenly spaced at 20% intervals (20%–80%) — wider gaps than the
// old 5-slot/15% spacing, which is what was crowding oversized items.
const SLOT_LEFT = ['22%', '41%', '59%', '78%'];

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

// Base shelf-slot width (before per-item scale correction) as a % of
// the scene container width.
function baseWidthFor(item: HabitatItem): number {
  return LARGE_ITEMS.has(item.key) ? 14 : 9;
}

// Final rendered width, after applying the item's scale correction to
// its base width.
function widthFor(item: HabitatItem): string {
  return `${baseWidthFor(item) * (item.scale ?? 1)}%`;
}

interface HabitatThemeRow {
  id: number;
  background_key: string | null;
  decor_keys: string[] | null;
}

// --- Daily rotating market -------------------------------------------
//
// Only a handful of locked items are purchasable on any given day, so
// the shop feels like it's stocked fresh rather than a static catalog.
// Everything already unlocked stays visible/placeable regardless.

// Small deterministic PRNG, seeded from a plain date string (not a
// timestamp), so the draw is stable all day and only changes when the
// calendar date rolls over.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return hash;
}

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

// Picks today's rotating market from the full catalog, seeded by the
// calendar date. Owned items can still land in the draw — harmless,
// since they're already unlocked and the "today's pick" styling is
// just a no-op for those.
function pickDailyMarket(dateStr: string, allKeys: string[], count: number): Set<string> {
  const rng = mulberry32(hashString(dateStr));
  const pool = [...allKeys];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return new Set(pool.slice(0, count));
}

export default function HabitatScene() {
  const { loading, decorPoints, spendDecorPoints } = useHamsterGrowth();
  const [decor, setDecor] = useState<string[]>([]);
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [unlockingKey, setUnlockingKey] = useState<string | null>(null);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [selectedShelf, setSelectedShelf] = useState<ShelfNum>(1);
  // Collection = items you own, browsable/placeable any time. Market =
  // today's rotating specials, the only locked items you can currently
  // buy. Everything else stays hidden rather than shown-but-disabled.
  const [viewMode, setViewMode] = useState<'collection' | 'market'>('collection');

  // Today's 4 purchasable locked items. Drawn once, right after the
  // unlocked list finishes loading, from only the items not yet owned
  // at that moment — this keeps the market from landing entirely on
  // stuff you already have. Deliberately NOT recomputed when `unlocked`
  // changes afterward, so buying one of today's picks doesn't reshuffle
  // the other three out from under you.
  const [todaysMarket, setTodaysMarket] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!themeLoaded) return;
    setTodaysMarket(prev => {
      if (prev.size > 0) return prev; // already drawn for today
      const lockedKeys = HABITAT_ITEMS.filter(i => !unlocked.includes(i.key)).map(i => i.key);
      return pickDailyMarket(todayKey(), lockedKeys, DAILY_MARKET_SIZE);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeLoaded]);

  // Load the saved theme + unlocked items once on mount.
  useEffect(() => {
    let cancelled = false;

    async function loadTheme() {
      try {
        const [themeRes, unlockedRes] = await Promise.all([
          supabase.from('habitat_theme').select('decor_keys').maybeSingle(),
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
    await supabase.from('habitat_theme').upsert(
      {
        background_key: 'shelf_empty',
        decor_keys: nextDecor,
      },
      { onConflict: 'user_id' }
    );
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
    if (!todaysMarket.has(key)) return; // not in today's rotation

    setUnlockError(null);
    setUnlockingKey(key);

    const cost = costFor(key);
    const result = await spendDecorPoints(cost);
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

  // Collection view: items you already own, for the selected shelf — this
  // is what the shelf tabs are for.
  // Market view: today's rotating picks, pulled from ONE bank across the
  // whole catalog (not per shelf) — you don't know which shelf they'll
  // belong to until you see them. Shelf tabs don't apply here.
  const visibleItems =
    viewMode === 'collection'
      ? HABITAT_ITEMS.filter(item => item.shelf === selectedShelf && unlocked.includes(item.key))
      : HABITAT_ITEMS.filter(item => !unlocked.includes(item.key) && todaysMarket.has(item.key));

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
            {decorPoints} pts
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
              const width = widthFor(item);
              const tilt = tiltFor(item.key);

              return (
                <div
                  key={item.key}
                  style={{
                    position: 'absolute',
                    left,
                    bottom,
                    width,
                    transform: 'translate(-50%)',
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
          }}
        >
          {(
            [
              { key: 'collection' as const, label: 'My Collection' },
              { key: 'market' as const, label: "Today's Market" },
            ]
          ).map(tab => (
            <button
              key={tab.key}
              onClick={() => setViewMode(tab.key)}
              style={{
                flex: 1,
                padding: '7px 10px',
                borderRadius: 10,
                fontSize: '0.64rem',
                fontWeight: 700,
                fontFamily: 'inherit',
                cursor: 'pointer',
                border: `1.5px solid ${
                  viewMode === tab.key
                    ? tab.key === 'market'
                      ? '#caa14d'
                      : 'var(--pink-dark)'
                    : 'var(--border)'
                }`,
                background:
                  viewMode === tab.key
                    ? tab.key === 'market'
                      ? '#faf1de'
                      : 'var(--blush)'
                    : 'var(--white)',
                color: 'var(--ink)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {viewMode === 'collection' && (
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
        )}

        <div
          style={{
            fontSize: '0.62rem',
            color: 'var(--ink-muted)',
            marginBottom: 8,
          }}
        >
          {viewMode === 'collection'
            ? `Tap an item you own to place or remove it from this shelf. Up to ${MAX_PER_SHELF} per shelf.`
            : `Only ${DAILY_MARKET_SIZE} items are up for grabs today, pulled from every shelf's catalog — you won't know which shelf they land on until you see them here ✨`}
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

        {visibleItems.length === 0 ? (
          <div
            style={{
              padding: '18px 10px',
              textAlign: 'center',
              fontSize: '0.64rem',
              color: 'var(--ink-muted)',
              border: '1.5px dashed var(--border)',
              borderRadius: 12,
            }}
          >
            {viewMode === 'collection'
              ? "You don't own anything for this shelf yet — check Today's Market ✨"
              : "That's odd — no specials today. Try refreshing, or check back tomorrow ✨"}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 6,
            }}
          >
            {visibleItems.map(item => {
              // In collection mode every item here is already owned; in
              // market mode every item here is today's purchasable pick.
              // No third state to render — hidden items never reach this
              // list at all.
              const active = decor.includes(item.key);
              const cost = costFor(item.key);
              const busy = unlockingKey === item.key;

              return (
                <button
                  key={item.key}
                  onClick={() => {
                    if (viewMode === 'collection') toggleDecor(item.key);
                    else unlockItem(item.key);
                  }}
                  disabled={busy}
                  title={
                    viewMode === 'collection'
                      ? item.label
                      : `${item.label} — ${cost} pts to unlock (today's pick!)`
                  }
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
                    background: active ? 'var(--blush)' : 'var(--white)',
                    border: `1.5px solid ${
                      active
                        ? 'var(--pink-dark)'
                        : viewMode === 'market'
                        ? '#caa14d'
                        : 'var(--border)'
                    }`,
                    cursor: busy ? 'wait' : 'pointer',
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
                    {viewMode === 'collection' ? item.label : `✨ ${cost} pts`}
                  </span>
                  {viewMode === 'market' && (
                    <span
                      style={{
                        fontSize: '0.48rem',
                        color: '#a4813a',
                        fontWeight: 600,
                        textAlign: 'center',
                        lineHeight: 1,
                      }}
                    >
                      {SHELVES.find(s => s.key === item.shelf)?.label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
