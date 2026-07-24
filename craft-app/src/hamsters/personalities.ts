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
  "Bristle Charge — lowers a head that turns too far to rush a rival",
  "Cheek Pouch Slam — the impact sounds wetter than it should",
  "Burrow Dodge — vanishes underground; something else surfaces where it left",
  "Static Fur — a shock on contact, and for a second its shadow doesn't match it",
  "Piercing Squeak — a shriek pitched wrong, like it's coming from behind you",
  "Claw Flurry — a scratching combo too fast to count the hands",
  "Thorn Nibble — gnaws clean through an opponent's guard without slowing down",
  "Warning Stomp — tiny feet, a thud that comes from directly underneath you",
  "Sticky Paws — grapples and holds; it does not let go, does not tire, does not blink",
  "Adrenaline Sprint — a burst of speed, eyes gone fully black, smile a little too wide",
  "Hollow Stare — locks eyes and the rival simply forgets how to move",
  "Molt Shed — sheds fur that keeps twitching, keeps crawling, long after",
  "Second Mouth — a seam along the cheek opens where no mouth should be",
  "Wrong Number of Legs — for one frame there are more of them than there should be",
];

export const FINAL_ABILITIES: string[] = [
  "Seed Cannon — launches hardened seeds hard enough to go clean through bark and bone",
  "Overgrowth Roots — vines erupt from beneath and drag a foe down into the dark",
  "Sonic Whisker Boom — a shockwave squeak that cracks stone and stops hearts for a beat",
  "Molten Cheek Pouch — the bite that follows smells like it shouldn't still be alive",
  "Guardian's Bulwark — hunkers down, and the ground around it stops obeying physics",
  "Frenzied Rampage — a relentless assault with too many limbs moving out of sync",
  "Venom Nibble — a bite that spreads numbness, then silence, then nothing at all",
  "Storm Caller — the sky answers something that isn't quite a hamster anymore",
  "Void Burrow — the tunnel it opens has no bottom, and something breathes up from it",
  "Apex Roar — a cry too big for something this small, in a voice that isn't its own",
  "Maw Beneath the Fur — the cheek pouches split open onto rows of teeth that don't fit",
  "Thousand-Eye Nest — every shadow in the room opens an eye and turns to watch",
  "Undying Gnaw — jaws lock on and keep working long after the rest of it stops moving",
  "Warren of the Lost — the burrow opens onto somewhere that was never the yard",
  "Skin It Wears — for a moment the fur is not fur, and it is not alone in there",
  "Nest of Small Hungers — a hundred tiny mouths answer from beneath the bedding",
];


export function rollAbilities(pool: string[], count: number, exclude: string[] = []): string[] {
  const available = pool.filter((a) => !exclude.includes(a));
  return pickRandom(available, Math.min(count, available.length));
}
