// battle.ts
// Wild creature encounters + turn-based battle resolution, now
// species-aware. Growth math, stat caps, and battle resolution are
// identical across hamster/noodle/dragon — only which abilities get
// rolled differs, via abilityPoolFor(species, stage) from personalities.ts.
//
// Stat philosophy: abilities already exist as flavor-text strings with no
// numeric attributes attached, and adding a whole new "ability stats" table
// would mean hand-tuning every entry across three species. Instead each
// ability's stat bonus is derived deterministically from a hash of its own
// text — same ability always contributes the same attack/defense/speed
// bump, no extra schema needed, and the bonus can't be seen/gamed since
// it's just a hash. This applies unchanged regardless of species.
//
// Stat training: on top of ability-derived stats, each creature can have
// permanent trained bonuses spent from training points earned the same way
// as evolution points. Caps rise with evolution stage (see STAT_CAPS) so a
// maxed-out baby can't out-stat a final-stage creature by hoarding points —
// it just means less room to spend until it evolves. Caps are shared
// across species; nothing here favors one species' stat ceiling over
// another's.

import { HAMSTERS, ROSTER_BY_SPECIES, TEEN_FORMS_BY_SPECIES, FINAL_FORMS_BY_SPECIES, rollTeenForm, rollFinalForm } from "./creatures";
import type { EvolutionStage, Species } from "./creatures";
import { rollPersonality, rollAbilities, abilityPoolFor } from "./personalities";
import type { Personality } from "./personalities";

export interface BattleStats {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
}

export interface TrainedStats {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
}

export const EMPTY_TRAINED_STATS: TrainedStats = { hp: 0, attack: 0, defense: 0, speed: 0 };

// Caps per evolution stage. HP gets a bigger cap than the other three since
// base HP is already much larger (25/55/95) than base attack/defense/speed.
// Shared across every species.
export const STAT_CAPS: Record<EvolutionStage, TrainedStats> = {
  baby: { hp: 20, attack: 10, defense: 10, speed: 10 },
  teen: { hp: 50, attack: 25, defense: 25, speed: 25 },
  final: { hp: 100, attack: 50, defense: 50, speed: 50 },
};

export function capFor(stage: EvolutionStage, stat: keyof TrainedStats): number {
  return STAT_CAPS[stage][stat];
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function abilityBonus(ability: string): { atk: number; def: number; spd: number } {
  const h = hashString(ability);
  return {
    atk: 1 + (h % 4),
    def: 1 + ((h >> 3) % 4),
    spd: 1 + ((h >> 6) % 4),
  };
}

// Shared base stats per stage — species differ in flavor/abilities, not in
// raw stat curve, per your call that they all use the same growth/stat
// logic.
const BASE_STATS: Record<EvolutionStage, BattleStats> = {
  baby: { hp: 25, attack: 3, defense: 3, speed: 3 },
  teen: { hp: 55, attack: 9, defense: 7, speed: 7 },
  final: { hp: 95, attack: 16, defense: 12, speed: 11 },
};

// Every stage can battle now, babies included — battling is how a baby
// earns the stat points it needs to evolve in the first place, so gating
// it behind "not a baby" would make evolution impossible to bootstrap.
export function canBattle(_stage: EvolutionStage): boolean {
  return true;
}

// Stat points and shop currency awarded for winning a wild encounter,
// scaled by how tough the opponent was. Shared across species.
export const BATTLE_REWARDS: Record<EvolutionStage, { statPoints: number; shopPoints: number }> = {
  baby: { statPoints: 2, shopPoints: 2 },
  teen: { statPoints: 3, shopPoints: 4 },
  final: { statPoints: 6, shopPoints: 8 },
};

// A creature is ready to evolve once every trained stat is maxed out for
// its current stage. Final-stage creatures have nowhere further to go.
export function isMaxedOut(stage: EvolutionStage, trained: TrainedStats): boolean {
  if (stage === "final") return false;
  const cap = STAT_CAPS[stage];
  return trained.hp >= cap.hp && trained.attack >= cap.attack && trained.defense >= cap.defense && trained.speed >= cap.speed;
}

// trained defaults to EMPTY_TRAINED_STATS so every existing call site that
// doesn't pass trained stats (wild creatures, anything untrained) still
// works exactly as before. Trained bonuses are clamped to the stage's cap
// here too, as a defensive backstop on top of the cap check at spend-time.
// Species doesn't affect the math — only which abilities get passed in.
export function deriveBattleStats(
  stage: EvolutionStage,
  abilities: string[],
  trained: TrainedStats = EMPTY_TRAINED_STATS
): BattleStats {
  const base = BASE_STATS[stage];
  let attack = base.attack;
  let defense = base.defense;
  let speed = base.speed;
  for (const a of abilities) {
    const b = abilityBonus(a);
    attack += b.atk;
    defense += b.def;
    speed += b.spd;
  }
  const cap = STAT_CAPS[stage];
  return {
    hp: base.hp + Math.min(trained.hp, cap.hp),
    attack: attack + Math.min(trained.attack, cap.attack),
    defense: defense + Math.min(trained.defense, cap.defense),
    speed: speed + Math.min(trained.speed, cap.speed),
  };
}

// Abilities are stored as "Name — spooky description". Only the name is
// shown as the move label during a fight.
export function abilityShortName(ability: string): string {
  return ability.split("—")[0].trim();
}

// --- Wild creature encounters ----------------------------------------------

export interface WildCreature {
  creatureId: string; // base portrait id, for flavor only
  species: Species;
  stage: EvolutionStage;
  formId: string;
  image: string;
  personality: Personality;
  abilities: string[];
  stats: BattleStats;
}

// Backward-compatible alias for old imports.
export type WildHamster = WildCreature;

// Odds shift toward "final" as the player's own furthest-evolved creature
// climbs, so wild encounters get a little tougher over time without a
// separate leveling system to maintain. Species defaults to a uniform
// random pick across all three when not specified, so wild encounters draw
// from the whole roster rather than always being hamsters.
export function rollWildCreature(stage: EvolutionStage, species?: Species): WildCreature {
  const chosenSpecies: Species = species ?? (["hamster", "noodle", "dragon"] as Species[])[Math.floor(Math.random() * 3)];
  const roster = ROSTER_BY_SPECIES[chosenSpecies];
  const base = roster[Math.floor(Math.random() * roster.length)];

  const form =
    stage === "final"
      ? rollFinalForm(chosenSpecies)
      : stage === "teen"
        ? rollTeenForm(chosenSpecies)
        : { id: "baby", species: chosenSpecies, image: base.image };

  const abilityPool = abilityPoolFor(chosenSpecies, stage);

  const abilityCount = stage === "final"
    ? (Math.random() < 0.5 ? 3 : 2)
    : stage === "teen"
      ? 2
      : 1;

  const abilities = rollAbilities(abilityPool, abilityCount);

  const personality = rollPersonality();

  return {
    creatureId: base.id,
    species: chosenSpecies,
    stage,
    formId: form.id,
    image: form.image,
    personality,
    abilities,
    stats: deriveBattleStats(stage, abilities),
  };
}

// Backward-compatible alias — always rolls a hamster, matching the old
// hamster-only behavior for any call site that hasn't been updated yet.
export function rollWildHamster(stage: EvolutionStage): WildCreature {
  return rollWildCreature(stage, "hamster");
}

// A wild encounter persisted to wild_encounter_pending only stores the raw
// fields (id, species, stage, form, personality, abilities) — image and
// stats are derived, not stored, so they're recomputed here when loading
// it back in. species defaults to "hamster" for rows written before the
// species column existed.
export function hydrateWildCreature(w: WildCreature): WildCreature {
  const species = w.species || "hamster";
  const forms = w.stage === "final" ? FINAL_FORMS_BY_SPECIES[species] : TEEN_FORMS_BY_SPECIES[species];
  const form = forms.find((f) => f.id === w.formId);
  return {
    ...w,
    species,
    image: form?.image || w.image,
    stats: deriveBattleStats(w.stage, w.abilities),
  };
}

export const hydrateWildHamster = hydrateWildCreature;

// --- Battle resolution ------------------------------------------------------

export interface BattleTurn {
  turn: number;
  side: "player" | "opponent";
  move: string;
  damage: number;
  hpAfter: number;
}

export interface BattleResult {
  winner: "player" | "opponent";
  turns: BattleTurn[];
  playerFinalHp: number;
  opponentFinalHp: number;
}

function pickMove(abilities: string[]): string {
  if (abilities.length === 0) return "Nibble";
  return abilityShortName(abilities[Math.floor(Math.random() * abilities.length)]);
}

function rollDamage(attack: number, defense: number): number {
  const raw = attack - defense / 2 + (1 + Math.floor(Math.random() * 6));
  return Math.max(1, Math.round(raw));
}

export function resolveBattle(
  playerStats: BattleStats,
  playerAbilities: string[],
  opponentStats: BattleStats,
  opponentAbilities: string[]
): BattleResult {
  let playerHp = playerStats.hp;
  let opponentHp = opponentStats.hp;
  const turns: BattleTurn[] = [];
  let turnNum = 0;

  const playerFirst = playerStats.speed + Math.random() * 2 >= opponentStats.speed + Math.random() * 2;

  while (playerHp > 0 && opponentHp > 0 && turnNum < 40) {
    const order: Array<"player" | "opponent"> = playerFirst ? ["player", "opponent"] : ["opponent", "player"];
    for (const side of order) {
      if (playerHp <= 0 || opponentHp <= 0) break;
      turnNum++;
      if (side === "player") {
        const dmg = rollDamage(playerStats.attack, opponentStats.defense);
        opponentHp = Math.max(0, opponentHp - dmg);
        turns.push({ turn: turnNum, side, move: pickMove(playerAbilities), damage: dmg, hpAfter: opponentHp });
      } else {
        const dmg = rollDamage(opponentStats.attack, playerStats.defense);
        playerHp = Math.max(0, playerHp - dmg);
        turns.push({ turn: turnNum, side, move: pickMove(opponentAbilities), damage: dmg, hpAfter: playerHp });
      }
    }
  }

  return {
    winner: playerHp > 0 ? "player" : "opponent",
    turns,
    playerFinalHp: playerHp,
    opponentFinalHp: opponentHp,
  };
}

// --- Interactive move-by-move combat ----------------------------------------
//
// resolveBattle() above simulates a whole fight in one shot with randomly
// picked moves on both sides. The functions below let the UI ask the
// player which ability to use each turn, and make that choice actually
// matter: every ability has its own hidden power/accuracy trade-off (big
// hits are less likely to land), so "always pick the flashiest move" is a
// real way to lose. Identical across species.

export interface MoveStats {
  power: number; // damage multiplier applied to attack stat
  accuracy: number; // 0-100, chance the move connects at all
}

export function moveStats(ability: string): MoveStats {
  const h = hashString("move::" + ability);
  const power = Math.round((0.7 + ((h % 9) / 10)) * 100) / 100; // 0.70 - 1.50
  const accuracy = 65 + ((h >> 4) % 31); // 65 - 95
  return { power, accuracy };
}

export function moveFlavor(ability: string): string {
  const { power, accuracy } = moveStats(ability);
  if (power >= 1.25) return accuracy >= 80 ? "Strong" : "Strong, risky";
  if (accuracy >= 88) return "Reliable";
  if (power <= 0.85) return "Weak, safe";
  return "Balanced";
}

export interface AttackOutcome {
  side: "player" | "opponent";
  move: string;
  hit: boolean;
  damage: number;
  hpAfter: number;
}

export function resolveAttack(
  side: "player" | "opponent",
  ability: string,
  attackerStats: BattleStats,
  defenderStats: BattleStats,
  defenderHpBefore: number
): AttackOutcome {
  const move = abilityShortName(ability);
  const { power, accuracy } = moveStats(ability);
  const hit = Math.random() * 100 < accuracy;

  if (!hit) {
    return { side, move, hit: false, damage: 0, hpAfter: defenderHpBefore };
  }

  const raw = attackerStats.attack * power - defenderStats.defense / 2 + (1 + Math.floor(Math.random() * 6));
  const damage = Math.max(1, Math.round(raw));
  const hpAfter = Math.max(0, defenderHpBefore - damage);
  return { side, move, hit: true, damage, hpAfter };
}

export function pickOpponentMove(abilities: string[]): string {
  if (abilities.length === 0) return "Nibble";
  if (Math.random() < 0.25) {
    return abilities[Math.floor(Math.random() * abilities.length)];
  }
  let best = abilities[0];
  let bestEv = -Infinity;
  for (const a of abilities) {
    const { power, accuracy } = moveStats(a);
    const ev = power * accuracy;
    if (ev > bestEv) {
      bestEv = ev;
      best = a;
    }
  }
  return best;
}

export function rollsFirst(sideStats: BattleStats, otherStats: BattleStats): boolean {
  return sideStats.speed + Math.random() * 2 >= otherStats.speed + Math.random() * 2;
}
