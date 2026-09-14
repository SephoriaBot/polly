// creatures.ts
// Replaces hamsters.ts. The roster now spans five species — wereham,
// noodle (cat-like), dragon, bunt (sheep/bat hybrid), and wrendel
// (antlered forest wraith) — each with their own baby/teen/final art.
// Duplicates are allowed within a species — fully random every time, per
// your original call.

export type Species = "wereham" | "noodle" | "dragon" | "bunt" | "wrendel";

export const SPECIES: Species[] = ["wereham", "noodle", "dragon", "bunt", "wrendel"];

export const SPECIES_LABELS: Record<Species, string> = {
  wereham: "Wereham",
  noodle: "Noodle",
  dragon: "Dragon",
  bunt: "Bunt",
  wrendel: "Wrendel",
};

export interface Creature {
  id: string;
  species: Species;
  image: string;
}

// Roster sizes differ per species based on how much baby art exists.
const ROSTER_SIZE: Record<Species, number> = {
  wereham: 15,
  noodle: 15,
  dragon: 15,
  bunt: 10,
  wrendel: 10,
};

// Baby image path per species — matches the actual asset folder layout.
// Wereham kept its historical zero-padded naming; noodle/dragon match the
// files as uploaded (no zero-padding, different per-stage prefixes).
function babyImage(species: Species, n: number): string {
  if (species === "wereham") {
    const padded = String(n).padStart(2, "0");
    return `/assets/wereham/werehambaby_${padded}.png`;
  }
  if (species === "noodle") {
    return `/assets/noodles/baby${n}.png`;
  }
  if (species === "bunt") {
    return `/assets/bunts/buntbaby${n}.png`;
  }
  if (species === "wrendel") {
    return `/assets/wrendels/wrendelbaby${n}.png`;
  }
  // dragon
  return `/assets/Dragons/babydragon${n}.png`;
}

function teenImage(species: Species, n: number): string {
  if (species === "wereham") {
    const padded = String(n).padStart(2, "0");
    return `/assets/wereham/werehammiddle_${padded}.png`;
  }
  if (species === "noodle") {
    return `/assets/noodles/middle${n}.png`;
  }
  if (species === "bunt") {
    return `/assets/bunts/buntmiddle${n}.png`;
  }
  if (species === "wrendel") {
    return `/assets/wrendels/wrendelmiddle${n}.png`;
  }
  return `/assets/Dragons/middledragon${n}.png`;
}

function finalImage(species: Species, n: number): string {
  if (species === "wereham") {
    const padded = String(n).padStart(2, "0");
    return `/assets/wereham/werehamfinal_${padded}.png`;
  }
  if (species === "noodle") {
    return `/assets/noodles/finalcat${n}.png`;
  }
  if (species === "bunt") {
    return `/assets/bunts/buntfinal${n}.png`;
  }
  if (species === "wrendel") {
    return `/assets/wrendels/wrendelfinal${n}.png`;
  }
  return `/assets/Dragons/godd${n}.png`;
}

function buildRoster(species: Species): Creature[] {
  return Array.from({ length: ROSTER_SIZE[species] }, (_, i) => {
    const n = i + 1;
    return { id: `${species}_${String(n).padStart(2, "0")}`, species, image: babyImage(species, n) };
  });
}

export const WEREHAMS: Creature[] = buildRoster("wereham");
export const NOODLES: Creature[] = buildRoster("noodle");
export const DRAGONS: Creature[] = buildRoster("dragon");
export const BUNTS: Creature[] = buildRoster("bunt");
export const WRENDELS: Creature[] = buildRoster("wrendel");

export const ROSTER_BY_SPECIES: Record<Species, Creature[]> = {
  wereham: WEREHAMS,
  noodle: NOODLES,
  dragon: DRAGONS,
  bunt: BUNTS,
  wrendel: WRENDELS,
};

// Every baby for a given species. Anything that looks up a hatched
// creature's image by id (habitat display, gallery, etc.) should search
// this, not the plain roster array.
export function allBabiesFor(species: Species): Creature[] {
  return ROSTER_BY_SPECIES[species];
}

// Kept for any call sites that haven't migrated to allBabiesFor("wereham")
// yet.
export const ALL_WEREHAMS: Creature[] = allBabiesFor("wereham");

// Rolls a random creature of the given species. Species selection (which
// species hatches at all) happens at the call site — this just picks
// which individual within that species.
export function rollRandomCreature(species: Species): Creature {
  const roster = ROSTER_BY_SPECIES[species];
  return roster[Math.floor(Math.random() * roster.length)];
}

// Rolls a species uniformly at random, then a creature within it. Use this
// at the hatch site instead of always assuming wereham.
export function rollRandomSpecies(): Species {
  return SPECIES[Math.floor(Math.random() * SPECIES.length)];
}

// Backward-compatible alias for old call sites (always wereham). Prefer
// rollRandomCreature(species) or rollRandomSpecies() + rollRandomCreature
// in new code.
export function rollRandomWereham(): Creature {
  return rollRandomCreature("wereham");
}

// --- Evolution forms -------------------------------------------------
// Teen and final forms are rolled independently and at random — they are
// NOT tied to which baby started the chain. Every creature in the
// collection keeps its baby image, personality, and traits forever;
// evolving only adds a teen/final image + new combat abilities on top.
// Forms are species-scoped: a hatched dragon only ever rolls dragon
// teen/final art, never noodle or wereham art.

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
  wereham: buildForms("wereham", teenImage, "teen"),
  noodle: buildForms("noodle", teenImage, "teen"),
  dragon: buildForms("dragon", teenImage, "teen"),
  bunt: buildForms("bunt", teenImage, "teen"),
  wrendel: buildForms("wrendel", teenImage, "teen"),
};

export const FINAL_FORMS_BY_SPECIES: Record<Species, EvolutionForm[]> = {
  wereham: buildForms("wereham", finalImage, "final"),
  noodle: buildForms("noodle", finalImage, "final"),
  dragon: buildForms("dragon", finalImage, "final"),
  bunt: buildForms("bunt", finalImage, "final"),
  wrendel: buildForms("wrendel", finalImage, "final"),
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

// Pulls the trailing number off a creature id like "dragon_03" -> 3.
// Returns null if the id doesn't match that shape (shouldn't normally
// happen, but callers fall back to a random roll rather than crashing).
function indexFromCreatureId(id: string): number | null {
  const match = id.match(/_(\d+)$/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

// Looks up the teen/final form whose number matches a given index, so
// e.g. babydragon3 always evolves into middledragon3 / godd3 — same
// color/theme carried through every stage, since that's how the art was
// built. Wraps around if a species' teen/final pool is smaller than its
// baby roster (only relevant for bunt, which has fewer forms).
export function formForIndex(species: Species, stage: "teen" | "final", n: number): EvolutionForm {
  const pool = stage === "teen" ? TEEN_FORMS_BY_SPECIES[species] : FINAL_FORMS_BY_SPECIES[species];
  const wrapped = ((n - 1) % pool.length + pool.length) % pool.length;
  return pool[wrapped];
}

// Given the id of the creature that's evolving (its "hamster_id", e.g.
// "dragon_03"), returns the matching teen/final form by index. Falls back
// to a random roll only if the id can't be parsed, so evolution never
// hard-fails.
export function evolvedFormFor(species: Species, stage: "teen" | "final", creatureId: string): EvolutionForm {
  const n = indexFromCreatureId(creatureId);
  if (n === null) {
    return stage === "teen" ? rollTeenForm(species) : rollFinalForm(species);
  }
  return formForIndex(species, stage, n);
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