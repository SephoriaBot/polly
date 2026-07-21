// personalities.ts
// A pool of good traits and quirky "bad" traits. Each hatched hamster gets
// 2 good traits + 1 quirk, rolled randomly and saved permanently with it.

export const GOOD_TRAITS: string[] = [
  "Hoards seeds like buried treasure",
  "Naps in whatever sunbeam it can find",
  "Stuffs cheeks first, asks questions later",
  "Fiercely loyal to its favorite blanket corner",
  "Greets you by standing straight up",
  "Excellent tunnel architect",
  "Never met a cardboard box it didn't love",
  "Surprisingly good listener",
  "Hums while it eats",
  "Collects the softest bedding scraps",
  "Always shares (eventually, reluctantly)",
  "Very brave about very small things",
  "Keeps its nest immaculately tidy",
  "Loves a good grooming session",
  "Curious about literally everything",
  "Snuggles up when it's cold",
  "Makes tiny happy popcorn jumps",
  "Devoted wheel-runner at 2am",
];

export const QUIRKY_TRAITS: string[] = [
  "Steals snacks the second you look away",
  "Refuses to use the wheel out of principle",
  "Dramatic about the tiniest inconveniences",
  "Hides food in places even it forgets",
  "Judges your life choices silently",
  "Wakes up on the wrong side of the nest, always",
  "Suspicious of new bedding for at least a week",
  "Hoards way more than it could ever eat",
  "Gives you the cold shoulder for no reason",
  "Insists on redecorating the nest nightly",
  "Chronically overdramatic about baths",
  "Petty about sharing the good hiding spot",
  "Naps through anything important",
  "Bites first, cuddles later",
  "Extremely stubborn about nap schedule",
];

export interface Personality {
  good: [string, string];
  quirk: string;
}

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function rollPersonality(): Personality {
  const [g1, g2] = pickRandom(GOOD_TRAITS, 2);
  const [quirk] = pickRandom(QUIRKY_TRAITS, 1);
  return { good: [g1, g2], quirk };
}

// --- Combat abilities --------------------------------------------------
// Rolled when a hamster evolves. Old traits/abilities are never removed —
// evolving only adds more on top. Teen abilities lean scrappy/defensive;
// final abilities lean bigger and more offensive, matching the jump in
// form size on the teen -> final art.

export const TEEN_ABILITIES: string[] = [
  "Bristle Charge — lowers head and rushes a rival",
  "Cheek Pouch Slam — bops foes with fully-stuffed cheeks",
  "Burrow Dodge — vanishes underground to dodge a hit",
  "Static Fur — small shock on contact",
  "Piercing Squeak — a shriek that rattles nearby foes",
  "Claw Flurry — quick scrappy scratching combo",
  "Thorn Nibble — gnaws through an opponent's guard",
  "Warning Stomp — tiny feet, surprisingly loud thud",
  "Sticky Paws — grapples and holds an opponent briefly",
  "Adrenaline Sprint — a burst of reckless speed",
];

export const FINAL_ABILITIES: string[] = [
  "Seed Cannon — launches hardened seeds at range",
  "Overgrowth Roots — traps a foe in sudden vines",
  "Sonic Whisker Boom — a shockwave squeak that stuns",
  "Molten Cheek Pouch — superheated projectile bite",
  "Guardian's Bulwark — hunkers down, nearly unmovable",
  "Frenzied Rampage — relentless multi-hit assault",
  "Venom Nibble — a bite that saps a rival's strength",
  "Storm Caller — summons wind to batter opponents",
  "Void Burrow — phases through attacks entirely",
  "Apex Roar — a commanding cry that breaks enemy morale",
];

export function rollAbilities(pool: string[], count: number, exclude: string[] = []): string[] {
  const available = pool.filter((a) => !exclude.includes(a));
  return pickRandom(available, Math.min(count, available.length));
}
