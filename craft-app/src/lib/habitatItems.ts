// habitatItems.ts
// Location: craft-app/src/lib/habitatItems.ts
//
// Shared catalog of shelf/decor items. Previously lived only inside
// HabitatScene.tsx — pulled out here so questSystem.ts can also draw
// "shelf item" quest rewards from the exact same pool the market uses,
// without a circular import between a lib file and a component.

const SHELF_PATH = '/shelf';

export type ShelfNum = 1 | 2 | 3 | 4;

export interface HabitatItem {
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
export const HABITAT_ITEMS: HabitatItem[] = [
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
