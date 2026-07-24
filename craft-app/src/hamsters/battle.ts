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

// Babies have no abilities to fight with yet — they can hatch and grow,
// but only teen/final hamsters (yours or wild) can actually battle.
export function canBattle(stage: EvolutionStage): boolean {
  return stage !== "baby";
}

export function deriveBattleStats(stage: EvolutionStage, abilities: string[]): BattleStats {
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
  return { hp: base.hp, attack, defense, speed };
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
