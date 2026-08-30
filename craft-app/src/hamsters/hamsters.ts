// hamsters.ts
// The 20-hamster roster and the random "which one hatches" logic.
// Duplicates are allowed — fully random every time, per your call.

export interface Hamster {
  id: string;
  image: string; // path to /assets/hamsters/<id>.png
}

export const HAMSTERS: Hamster[] = Array.from({ length: 20 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return { id: `hamster_${n}`, image: `/assets/hamsters/hamster_${n}.png` };
});

// --- Seasonal babies --------------------------------------------------
// 16 limited babies, only available to hatch during their real-world
// season. They still evolve through the same TEEN_FORMS / FINAL_FORMS
// pools as everyone else — evolution art was already random and
// independent of which baby hatched, so no seasonal teen/final art is
// needed.

export type Season = "spring" | "summer" | "fall" | "winter";

export interface SeasonalHamster extends Hamster {
  season: Season;
}

const SEASONAL_COUNTS: Record<Season, number> = {
  spring: 3,
  summer: 3,
  fall: 3,
  winter: 7,
};

export const SEASONAL_HAMSTERS: SeasonalHamster[] = (
  Object.keys(SEASONAL_COUNTS) as Season[]
).flatMap((season) =>
  Array.from({ length: SEASONAL_COUNTS[season] }, (_, i) => {
    const n = i + 1;
    return {
      id: `hamster_${season}_${n}`,
      image: `/assets/hamsters/hamster_${season}_${n}.JPG`,
      season,
    };
  })
);

// Every baby, standard + seasonal. Anything that looks up a hatched
// hamster's image by id (habitat display, gallery, etc.) should search
// this, not the plain HAMSTERS array, or seasonal hatches will fail to
// render.
export const ALL_HAMSTERS: Hamster[] = [...HAMSTERS, ...SEASONAL_HAMSTERS];

// Meteorological seasons, Northern Hemisphere: Dec/Jan/Feb = winter,
// Mar/Apr/May = spring, Jun/Jul/Aug = summer, Sep/Oct/Nov = fall.
export function currentSeason(date: Date = new Date()): Season {
  const month = date.getMonth(); // 0-11
  if (month === 11 || month === 0 || month === 1) return "winter";
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  return "fall";
}

// Odds that a hatch rolls today's seasonal pool instead of the standard
// 20 — kept low so seasonal babies stay a "no way, I got one!" moment
// rather than the default.
const SEASONAL_HATCH_CHANCE = 0.12;

export function rollRandomHamster(): Hamster {
  const seasonalPool = SEASONAL_HAMSTERS.filter((h) => h.season === currentSeason());
  if (seasonalPool.length > 0 && Math.random() < SEASONAL_HATCH_CHANCE) {
    return seasonalPool[Math.floor(Math.random() * seasonalPool.length)];
  }
  return HAMSTERS[Math.floor(Math.random() * HAMSTERS.length)];
}

// --- Evolution forms -------------------------------------------------
// Teen and final forms are rolled independently and at random — they are
// NOT tied to which of the 20 baby hamsters started the chain. Every
// hamster in the collection keeps its baby image, personality, and traits
// forever; evolving only adds a teen/final image + new combat abilities
// on top.

export type EvolutionStage = "baby" | "teen" | "final";

export interface EvolutionForm {
  id: string;
  image: string; // path to /assets/hamsters/<teen|final>/<id>.png
}

export const TEEN_FORMS: EvolutionForm[] = Array.from({ length: 20 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return { id: `teen_${n}`, image: `/assets/hamsters/teen_${n}.png` };
});

export const FINAL_FORMS: EvolutionForm[] = Array.from({ length: 20 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return { id: `final_${n}`, image: `/assets/hamsters/final_${n}.png` };
});


export function rollTeenForm(): EvolutionForm {
  return TEEN_FORMS[Math.floor(Math.random() * TEEN_FORMS.length)];
}

export function rollFinalForm(): EvolutionForm {
  return FINAL_FORMS[Math.floor(Math.random() * FINAL_FORMS.length)];
}

export function imageForForm(stage: EvolutionStage, teenFormId: string | null, finalFormId: string | null, baseImage: string) {
  if (stage === "final" && finalFormId) return FINAL_FORMS.find((f) => f.id === finalFormId)?.image || baseImage;
  if (stage === "teen" && teenFormId) return TEEN_FORMS.find((f) => f.id === teenFormId)?.image || baseImage;
  return baseImage;
}
