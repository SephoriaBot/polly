// battle.ts
// Wild hamster encounters + turn-based battle resolution. Fully self-
// contained — reuses the existing rolling functions from hamsters.ts and
// personalities.ts, and adds no new dependencies or tables to those files.
//
// Stat philosophy: abilities already exist as flavor-text strings with no
// numeric attributes attached, and adding a whole new "ability stats" table
// would mean hand-tuning 30 entries. Instead each ability's stat bonus is
// derived deterministically from a hash of its own text — same ability
// always contributes the same attack/defense/speed bump, no extra schema
// needed, and the bonus can't be seen/gamed since it's just a hash.
//
// Stat training: on top of ability-derived stats, each hamster can have
// permanent trained bonuses spent from training points earned the same way
// as evolution points. Caps rise with evolution stage (see STAT_CAPS) so a
// maxed-out baby can't out-stat a final-stage hamster by hoarding points —
// it just means less room to spend until it evolves.

import { HAMSTERS, TEEN_FORMS, FINAL_FORMS, rollTeenForm, rollFinalForm } from "./hamsters";
import type { EvolutionStage } from "./hamsters";
import { rollPersonality, rollAbilities, TEEN_ABILITIES, FINAL_ABILITIES } from "./personalities";
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

const BASE_STATS: Record<EvolutionStage, BattleStats> = {
  baby: { hp: 25, attack: 3, defense: 3, speed: 3 },
  teen: { hp: 55, attack: 9, defense: 7, speed: 7 },
  final: { hp: 95, attack: 16, defense: 12, speed: 11 },
};

// Every stage can battle now, babies included — battling is how a baby
// earns the stat points it needs to evolve in the first place, so gating
// it behind "not a baby" would make evolution impossible to bootstrap.
// Kept as a function (rather than inlining `true` at call sites) so a
// future stage-based restriction has one place to change.
export function canBattle(_stage: EvolutionStage): boolean {
  return true;
}

// Stat points and shop currency awarded for winning a wild encounter,
// scaled by how tough the opponent was. This is now the ONLY source of
// training points (stat points) and habitat shop currency — daily
// accomplishments only feed the egg. Losses pay out nothing.
export const BATTLE_REWARDS: Record<"teen" | "final", { statPoints: number; shopPoints: number }> = {
  teen: { statPoints: 3, shopPoints: 4 },
  final: { statPoints: 6, shopPoints: 8 },
};

// A hamster is ready to evolve once every trained stat is maxed out for
// its current stage — i.e. it's fought and trained enough to hit the
// ceiling battle.ts already enforces via STAT_CAPS. Final-stage hamsters
// have nowhere further to go.
export function isMaxedOut(stage: EvolutionStage, trained: TrainedStats): boolean {
  if (stage === "final") return false;
  const cap = STAT_CAPS[stage];
  return trained.hp >= cap.hp && trained.attack >= cap.attack && trained.defense >= cap.defense && trained.speed >= cap.speed;
}

// trained defaults to EMPTY_TRAINED_STATS so every existing call site that
// doesn't pass trained stats (wild hamsters, anything untrained) still
// works exactly as before. Trained bonuses are clamped to the stage's cap
// here too, as a defensive backstop on top of the cap check at spend-time.
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

// --- Wild hamster encounters ----------------------------------------------

export interface WildHamster {
  hamsterId: string; // base portrait id, for flavor only
  stage: "teen" | "final";
  formId: string;
  image: string;
  personality: Personality;
  abilities: string[];
  stats: BattleStats;
}

// Odds shift toward "final" as the player's own furthest-evolved hamster
// climbs, so wild encounters get a little tougher over time without a
// separate leveling system to maintain.
export function rollWildHamster(playerMaxStage: EvolutionStage = "baby"): WildHamster {
  const finalChance = playerMaxStage === "final" ? 0.45 : playerMaxStage === "teen" ? 0.3 : 0.15;
  const stage: "teen" | "final" = Math.random() < finalChance ? "final" : "teen";

  const base = HAMSTERS[Math.floor(Math.random() * HAMSTERS.length)];
  const form = stage === "final" ? rollFinalForm() : rollTeenForm();
  const abilityPool = stage === "final" ? FINAL_ABILITIES : TEEN_ABILITIES;
  const abilityCount = stage === "final" ? (Math.random() < 0.5 ? 3 : 2) : 2;
  const abilities = rollAbilities(abilityPool, abilityCount);
  const personality = rollPersonality();

  return {
    hamsterId: base.id,
    stage,
    formId: form.id,
    image: form.image,
    personality,
    abilities,
    stats: deriveBattleStats(stage, abilities),
  };
}

// A wild encounter persisted to wild_encounter_pending only stores the raw
// fields (id, stage, form, personality, abilities) — image and stats are
// derived, not stored, so they're recomputed here when loading it back in.
export function hydrateWildHamster(w: WildHamster): WildHamster {
  const forms = w.stage === "final" ? FINAL_FORMS : TEEN_FORMS;
  const form = forms.find((f) => f.id === w.formId);
  return {
    ...w,
    image: form?.image || w.image,
    stats: deriveBattleStats(w.stage, w.abilities),
  };
}

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
// picked moves on both sides — there's no player decision in it, so a loss
// only ever comes from raw stat/RNG bad luck, not from choosing badly. The
// functions below let the UI ask the player which ability to use each turn,
// and make that choice actually matter: every ability has its own hidden
// power/accuracy trade-off (big hits are less likely to land), so "always
// pick the flashiest move" is a real way to lose.

export interface MoveStats {
  power: number; // damage multiplier applied to attack stat
  accuracy: number; // 0-100, chance the move connects at all
}

// Deterministic per-ability, same trick as abilityBonus (hash of the text)
// but salted differently so a move's power/accuracy can't be reverse-
// guessed from its stat bonus. Every ability trades something: the
// highest-power moves land in the 65-75% accuracy range, the safest moves
// cap out around 1.0x power, so there's no single "always correct" pick.
export function moveStats(ability: string): MoveStats {
  const h = hashString("move::" + ability);
  const power = Math.round((0.7 + ((h % 9) / 10)) * 100) / 100; // 0.70 - 1.50
  const accuracy = 65 + ((h >> 4) % 31); // 65 - 95
  return { power, accuracy };
}

// Loose flavor label so the fighter screen can hint at a move's risk
// profile without printing raw numbers (keeps it a gut-feel choice, not a
// spreadsheet).
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

// Resolves one single attack (one ability, one side) against the
// defender's current HP. Call this once per move instead of simulating the
// whole fight — the caller decides whose turn it is and which ability they
// used.
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

// Simple opponent "AI": mostly picks whichever of its abilities has the
// best expected value (power * accuracy), but goes off-script sometimes so
// it's not perfectly readable turn to turn.
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

// Speed decides who acts first each round, same formula as resolveBattle's
// one-shot version, just callable per-round instead of once for the whole
// fight.
export function rollsFirst(sideStats: BattleStats, otherStats: BattleStats): boolean {
  return sideStats.speed + Math.random() * 2 >= otherStats.speed + Math.random() * 2;
}