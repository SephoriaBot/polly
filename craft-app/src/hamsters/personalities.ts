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
