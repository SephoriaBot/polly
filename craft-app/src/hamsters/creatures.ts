// creatures.ts
// Replaces hamsters.ts. The roster now spans three species — hamster,
// noodle (cat-like), dragon — each with their own baby/teen/final art.
// Duplicates are allowed within a species — fully random every time, per
// your original call.

export type Species = "hamster" | "noodle" | "dragon";

export const SPECIES: Species[] = ["hamster", "noodle", "dragon"];

export const SPECIES_LABELS: Record<Species, string> = {
  hamster: "Hamster",
  noodle: "Noodle",
  dragon: "Dragon",
};

export interface Creature {
  id: string;
  species: Species;
  image: string;
}

// Roster sizes differ per species based on how much baby art exists.
const ROSTER_SIZE: Record<Species, number> = {
  hamster: 20,
  noodle: 15,
  dragon: 15,
};

// Baby image path per species — matches the actual asset folder layout.
// Hamster kept its historical zero-padded naming; noodle/dragon match the
// files as uploaded (no zero-padding, different per-stage prefixes).
function babyImage(species: Species, n: number): string {
  if (species === "hamster") {
    const padded = String(n).padStart(2, "0");
    return `/assets/hamsters/hamster_${padded}.png`;
  }
  if (species === "noodle") {
    return `/assets/noodles/baby${n}.png`;
  }
  // dragon
  return `/assets/Dragons/babydragon${n}.png`;
}

function teenImage(species: Species, n: number): string {
  if (species === "hamster") {
    const padded = String(n).padStart(2, "0");
    return `/assets/hamsters/teen_${padded}.png`;
  }
  if (species === "noodle") {
    return `/assets/noodles/middle${n}.png`;
  }
  return `/assets/Dragons/middledragon${n}.png`;
}

function finalImage(species: Species, n: number): string {
  if (species === "hamster") {
    const padded = String(n).padStart(2, "0");
    return `/assets/hamsters/final_${padded}.png`;
  }
  if (species === "noodle") {
    return `/assets/noodles/finalcat${n}.png`;
  }
  return `/assets/Dragons/godd${n}.png`;
}

function buildRoster(species: Species): Creature[] {
  return Array.from({ length: ROSTER_SIZE[species] }, (_, i) => {
    const n = i + 1;
    return { id: `${species}_${String(n).padStart(2, "0")}`, species, image: babyImage(species, n) };
  });
}

export const HAMSTERS: Creature[] = buildRoster("hamster");
export const NOODLES: Creature[] = buildRoster("noodle");
export const DRAGONS: Creature[] = buildRoster("dragon");

export const ROSTER_BY_SPECIES: Record<Species, Creature[]> = {
  hamster: HAMSTERS,
  noodle: NOODLES,
  dragon: DRAGONS,
};

// --- Seasonal babies (hamster-only, unchanged) -------------------------
// 16 limited babies, only available to hatch during their real-world
// season. They still evolve through the same TEEN_FORMS / FINAL_FORMS
// pools as everyone else — evolution art was already random and
// independent of which baby hatched, so no seasonal teen/final art is
// needed. Seasonal babies remain hamster-exclusive; noodles and dragons
// don't roll into the seasonal pool.

export type Season = "spring" | "summer" | "fall" | "winter";

export interface SeasonalCreature extends Creature {
  season: Season;
}

const SEASONAL_COUNTS: Record<Season, number> = {
  spring: 3,
  summer: 3,
  fall: 3,
  winter: 7,
};

export const SEASONAL_HAMSTERS: SeasonalCreature[] = (
  Object.keys(SEASONAL_COUNTS) as Season[]
).flatMap((season) =>
  Array.from({ length: SEASONAL_COUNTS[season] }, (_, i) => {
    const n = i + 1;
    return {
      id: `hamster_${season}_${n}`,
      species: "hamster" as Species,
      image: `/assets/hamsters/hamster_${season}_${n}.png`,
      season,
    };
  })
);

// Every baby, standard + seasonal, for a given species. Anything that
// looks up a hatched creature's image by id (habitat display, gallery,
// etc.) should search this, not the plain roster array, or seasonal
// hatches will fail to render.
export function allBabiesFor(species: Species): Creature[] {
  if (species === "hamster") return [...HAMSTERS, ...SEASONAL_HAMSTERS];
  return ROSTER_BY_SPECIES[species];
}

// Kept for any call sites that haven't migrated to allBabiesFor("hamster")
// yet.
export const ALL_HAMSTERS: Creature[] = allBabiesFor("hamster");

// Meteorological seasons, Northern Hemisphere: Dec/Jan/Feb = winter,
// Mar/Apr/May = spring, Jun/Jul/Aug = summer, Sep/Oct/Nov = fall.
export function currentSeason(date: Date = new Date()): Season {
  const month = date.getMonth(); // 0-11
  if (month === 11 || month === 0 || month === 1) return "winter";
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  return "fall";
}

// Odds that a hamster hatch rolls today's seasonal pool instead of the
// standard 20 — kept low so seasonal babies stay a "no way, I got one!"
// moment rather than the default. Only applies when the roll is already
// for a hamster.
const SEASONAL_HATCH_CHANCE = 0.12;

// Rolls a random creature of the given species. Species selection (which
// species hatches at all) happens at the call site — this just picks
// which individual within that species.
export function rollRandomCreature(species: Species): Creature {
  if (species === "hamster") {
    const seasonalPool = SEASONAL_HAMSTERS.filter((h) => h.season === currentSeason());
    if (seasonalPool.length > 0 && Math.random() < SEASONAL_HATCH_CHANCE) {
      return seasonalPool[Math.floor(Math.random() * seasonalPool.length)];
    }
    return HAMSTERS[Math.floor(Math.random() * HAMSTERS.length)];
  }
  const roster = ROSTER_BY_SPECIES[species];
  return roster[Math.floor(Math.random() * roster.length)];
}

// Rolls a species uniformly at random, then a creature within it. Use this
// at the hatch site instead of always assuming hamster.
export function rollRandomSpecies(): Species {
  return SPECIES[Math.floor(Math.random() * SPECIES.length)];
}

// Backward-compatible alias for old call sites (always hamster). Prefer
// rollRandomCreature(species) or rollRandomSpecies() + rollRandomCreature
// in new code.
export function rollRandomHamster(): Creature {
  return rollRandomCreature("hamster");
}

// --- Evolution forms -------------------------------------------------
// Teen and final forms are rolled independently and at random — they are
// NOT tied to which baby started the chain. Every creature in the
// collection keeps its baby image, personality, and traits forever;
// evolving only adds a teen/final image + new combat abilities on top.
// Forms are species-scoped: a hatched dragon only ever rolls dragon
// teen/final art, never noodle or hamster art.

export type EvolutionStage = "baby" | "teen" | "final";

export interface EvolutionForm {
  id: string;
  species: Species;
  image: string;
}

function buildForms(species: Species, imageFn: (s: Species, n: number) => string, prefix: string): EvolutionForm[] {
  return Array.from({ length: ROSTER_SIZE[species] }, (_, i) => {
    const n = i + 1;
    return { id: `${species}_${prefix}_${String(n).padStart(2, "0")}`, species, image: imageFn(species, n) };
  });
}

export const TEEN_FORMS_BY_SPECIES: Record<Species, EvolutionForm[]> = {
  hamster: buildForms("hamster", teenImage, "teen"),
  noodle: buildForms("noodle", teenImage, "teen"),
  dragon: buildForms("dragon", teenImage, "teen"),
};

export const FINAL_FORMS_BY_SPECIES: Record<Species, EvolutionForm[]> = {
  hamster: buildForms("hamster", finalImage, "final"),
  noodle: buildForms("noodle", finalImage, "final"),
  dragon: buildForms("dragon", finalImage, "final"),
};

// Flattened across all species — kept for any old call site that expects
// a single combined pool (e.g. hydrating from a stored id without knowing
// species ahead of time).
export const TEEN_FORMS: EvolutionForm[] = SPECIES.flatMap((s) => TEEN_FORMS_BY_SPECIES[s]);
export const FINAL_FORMS: EvolutionForm[] = SPECIES.flatMap((s) => FINAL_FORMS_BY_SPECIES[s]);

export function rollTeenForm(species: Species): EvolutionForm {
  const pool = TEEN_FORMS_BY_SPECIES[species];
  return pool[Math.floor(Math.random() * pool.length)];
}

export function rollFinalForm(species: Species): EvolutionForm {
  const pool = FINAL_FORMS_BY_SPECIES[species];
  return pool[Math.floor(Math.random() * pool.length)];
}

export function imageForForm(
  species: Species,
  stage: EvolutionStage,
  teenFormId: string | null,
  finalFormId: string | null,
  baseImage: string
) {
  if (stage === "final" && finalFormId) {
    return FINAL_FORMS_BY_SPECIES[species].find((f) => f.id === finalFormId)?.image || baseImage;
  }
  if (stage === "teen" && teenFormId) {
    return TEEN_FORMS_BY_SPECIES[species].find((f) => f.id === teenFormId)?.image || baseImage;
  }
  return baseImage;
}
