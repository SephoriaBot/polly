// hamsters.ts
// TRANSITIONAL SHIM — the real roster/species logic now lives in
// creatures.ts. This file just re-exports the hamster-flavored pieces so
// any file still importing from "./hamsters" keeps working untouched while
// the rest of the app migrates over. Once every file in src/hamsters and
// src/components imports from "./creatures" directly, this file can be
// deleted.

export type {
  Species,
  Creature as Hamster,
  Season,
  SeasonalCreature as SeasonalHamster,
  EvolutionStage,
  EvolutionForm,
} from "./creatures";

export {
  HAMSTERS,
  SEASONAL_HAMSTERS,
  ALL_HAMSTERS,
  currentSeason,
  rollRandomHamster,
  TEEN_FORMS,
  FINAL_FORMS,
} from "./creatures";

import { rollTeenForm as rollTeenFormSpecies, rollFinalForm as rollFinalFormSpecies, imageForForm as imageForFormSpecies } from "./creatures";
import type { EvolutionStage } from "./creatures";

// Old signatures took no species arg (hamster-only) and old imageForForm
// took 4 args with no species. These wrappers reproduce those exact
// signatures, pinned to "hamster", so every untouched call site
// (HamsterHabitat.tsx, WildEncounter.tsx, useHamsterGrowth.ts, the old
// battle.ts) keeps compiling exactly as before until it's migrated to
// import from "./creatures" directly with an explicit species.
export function rollTeenForm() {
  return rollTeenFormSpecies("hamster");
}
export function rollFinalForm() {
  return rollFinalFormSpecies("hamster");
}
export function imageForForm(
  stage: EvolutionStage,
  teenFormId: string | null,
  finalFormId: string | null,
  baseImage: string
) {
  return imageForFormSpecies("hamster", stage, teenFormId, finalFormId, baseImage);
}
