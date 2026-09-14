// dailyRandom.ts
// Small deterministic PRNG utilities for anything that needs a "changes
// once a day, same for everyone loading the page that day" randomized
// pick — the habitat's rotating decor market (HabitatScene.tsx) and the
// breeder's daily litter (CreatureBreeder.tsx) both use this.

// Seeded from a plain date string (not a timestamp), so a draw is stable
// all day and only changes when the calendar date rolls over at local
// midnight.
export function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return hash;
}

// Local calendar date, not a timestamp — this is what makes a seeded draw
// reset at local midnight and stay stable for the rest of the day.
export function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

// Deterministically shuffles `pool` using a seed derived from `seedStr`
// and returns the first `count` items. The same seedStr always produces
// the same draw, so everyone loading the page on the same calendar day
// (with the same input pool) sees the same picks. Use a distinct suffix
// per feature (e.g. `${todayKey()}:breeder` vs plain `todayKey()`) so two
// different daily draws don't end up correlated with each other.
export function pickDaily<T>(seedStr: string, pool: T[], count: number): T[] {
  const rng = mulberry32(hashString(seedStr));
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}