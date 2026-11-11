// WildEncounter.tsx
// Tournaments tab (file name kept so imports don't change). Phase 1 of
// creature combat: enter a tournament match against a procedurally-rolled
// opponent (wereham, noodle, or dragon — species rolls independently of your
// own fighter's species) whose training scales with your fighter's. Fully
// self-contained — does its own Supabase reads/writes, doesn't touch
// useCreatureGrowth.ts or any other file. Requires the hamster_battle_log
// table (see migration) — table name kept as-is, now with an
// opponent_species column alongside the original fields.
//
// Combat is move-by-move: each round, whichever side is faster acts first
// (opponent's move auto-resolves), then the player picks one of their
// creature's abilities. Every ability has a hidden power/accuracy trade-off
// (see moveStats in battle.ts) — always throwing the flashiest move is a
// real way to lose, since the biggest hits are also the least likely to
// land. There is no auto-resolve-the-whole-fight path anymore; the outcome
// depends on what you pick each round, not just stats + one RNG roll.

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "../lib/supabase"; // match your actual client path
import Icon from "../components/Icon";
import { allBabiesFor, imageForForm, SPECIES_LABELS } from "./creatures";
import type { EvolutionStage, Species } from "./creatures";
import { useCreatureGrowth } from "./CreatureGrowthContext";
import { BATTLE_REWARDS } from "./battle";
import { useAuth } from "../context/AuthContext";
import { triggerActionEvent } from "../lib/questSystem";
import {
  canBattle,
  deriveBattleStats,
  rollWildCreature,
  hydrateWildCreature,
  abilityShortName,
  moveFlavor,
  resolveAttack,
  pickOpponentMove,
  rollsFirst,
} from "./battle";
import type { WildCreature, AttackOutcome, TrainedStats } from "./battle";
import EmptyState from '../components/EmptyState';
import emptyHabitat from '../assets/icons/empty-habitat.png';


interface FighterEntry {
  id: number;
  creatureId: string;
  species: Species;
  name: string | null;
  stage: EvolutionStage;
  abilities: string[];
  image: string;
  trainedStats: TrainedStats;
}

type Phase = "pick" | "scouting" | "found" | "battling" | "result";

function HpBar({ current, max, tone }: { current: number; max: number; tone: "player" | "opponent" }) {
  const pct = Math.max(0, Math.round((current / max) * 100));
  return (
    <div className="progress">
      <div
        className={`progress-fill ${tone === "player" ? "is-pink" : "is-danger"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function WildEncounter() {
  const { wildEncounter, clearWildEncounter, awardBattleWin } = useCreatureGrowth();
  const { user } = useAuth();
  const [reward, setReward] = useState<{ statPoints: number; shopPoints: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [fighters, setFighters] = useState<FighterEntry[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("pick");
  const [wild, setWild] = useState<WildCreature | null>(null);
  const [isAutoSpawned, setIsAutoSpawned] = useState(false);
  const [winner, setWinner] = useState<"player" | "opponent" | null>(null);

  // Live battle state
  const [playerHp, setPlayerHp] = useState(0);
  const [opponentHp, setOpponentHp] = useState(0);
  const [log, setLog] = useState<AttackOutcome[]>([]);
  const [roundQueue, setRoundQueue] = useState<Array<"player" | "opponent">>([]);
  const [busy, setBusy] = useState(false); // true while an auto/animated move is resolving
  const opponentActingRef = useRef(false);

  // A wild creature spawned automatically from an accomplishment (see
  // useCreatureGrowth.ts) shows up here immediately instead of requiring the
  // manual "go find one" button.
  useEffect(() => {
    if (wildEncounter && phase === "pick" && !wild) {
      setWild(hydrateWildCreature(wildEncounter));
      setIsAutoSpawned(true);
    }
  }, [wildEncounter, phase, wild]);

  const loadFighters = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("hamster_collection")
      .select("id, hamster_id, species, name, stage, teen_form_id, final_form_id, abilities, trained_hp, trained_attack, trained_defense, trained_speed")
      .order("hatched_at", { ascending: false });

    const entries: FighterEntry[] = (data || []).map((r) => {
      const species = (r.species as Species) || "wereham";
      const base = allBabiesFor(species).find((h) => h.id === r.hamster_id);
      const baseImage = base?.image || "";
      const image = imageForForm(species, r.stage as EvolutionStage, r.teen_form_id, r.final_form_id, baseImage);
      return {
        id: r.id,
        creatureId: r.hamster_id,
        species,
        name: r.name ?? null,
        stage: r.stage as EvolutionStage,
        abilities: r.abilities || [],
        image,
        trainedStats: {
          hp: Number(r.trained_hp) || 0,
          attack: Number(r.trained_attack) || 0,
          defense: Number(r.trained_defense) || 0,
          speed: Number(r.trained_speed) || 0,
        },
      };
    });

    setFighters(entries.filter((e) => canBattle(e.stage)));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadFighters();
  }, [loadFighters]);

  const selected = useMemo(() => fighters.find((f) => f.id === selectedId) || null, [fighters, selectedId]);

  const playerStats = useMemo(
    () => (selected ? deriveBattleStats(selected.stage, selected.abilities, selected.trainedStats) : null),
    [selected]
  );

const goScout = () => {
  if (!selected) return;

  setPhase("scouting");

  setTimeout(() => {
    // Opponent is always exactly the same evolution stage as the creature
    // selected for battle, and its trained stats scale with how far along
    // your fighter's own training is, so matches stay competitive. Its
    // species rolls independently of your fighter's.
    setWild(rollWildCreature(selected.stage, undefined, selected.trainedStats));
    setIsAutoSpawned(false);
    setPhase("found");
  }, 900);
};

  const startFight = () => {
  if (!selected || !playerStats || !wild) return;

  // Absolute stage restriction.
  // A fight cannot begin unless both creatures are the same evolution stage.
  if (selected.stage !== wild.stage) return;

  setPlayerHp(playerStats.hp);
  setOpponentHp(wild.stats.hp);
  setLog([]);
  setWinner(null);
  setPhase("battling");

  const order: Array<"player" | "opponent"> = rollsFirst(playerStats, wild.stats)
    ? ["player", "opponent"]
    : ["opponent", "player"];

  setRoundQueue(order);
};

  // Auto-resolves the opponent's move whenever it's next in the queue.
  useEffect(() => {
    if (phase !== "battling") return;
    if (roundQueue[0] !== "opponent") return;
    if (playerHp <= 0 || opponentHp <= 0) return;
    if (opponentActingRef.current) return;
    if (!wild || !playerStats) return;

    opponentActingRef.current = true;
    setBusy(true);
    const move = pickOpponentMove(wild.abilities);
    const t = setTimeout(() => {
      const outcome = resolveAttack("opponent", move, wild.stats, playerStats, playerHp);
      setLog((prev) => [...prev, outcome]);
      setPlayerHp(outcome.hpAfter);
      setRoundQueue((q) => q.slice(1));
      setBusy(false);
      opponentActingRef.current = false;
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, roundQueue, playerHp, opponentHp, wild, playerStats]);

  // Once a round's two moves are both spent (and nobody's fainted), roll a
  // fresh order for the next round.
  useEffect(() => {
    if (phase !== "battling") return;
    if (roundQueue.length > 0) return;
    if (playerHp <= 0 || opponentHp <= 0) return;
    if (!wild || !playerStats) return;
    const order: Array<"player" | "opponent"> = rollsFirst(playerStats, wild.stats)
      ? ["player", "opponent"]
      : ["opponent", "player"];
    setRoundQueue(order);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, roundQueue.length, playerHp, opponentHp, wild, playerStats]);

  // Whenever either side's HP hits 0, end the fight.
  useEffect(() => {
    if (phase !== "battling") return;
    if (playerHp <= 0) {
      setWinner("opponent");
      setPhase("result");
    } else if (opponentHp <= 0) {
      setWinner("player");
      setPhase("result");
    }
  }, [phase, playerHp, opponentHp]);

  const useMove = (ability: string) => {
    if (!selected || !playerStats || !wild || busy) return;
    if (roundQueue[0] !== "player") return;
    setBusy(true);
    const outcome = resolveAttack("player", ability, playerStats, wild.stats, opponentHp);
    setLog((prev) => [...prev, outcome]);
    setOpponentHp(outcome.hpAfter);
    setRoundQueue((q) => q.slice(1));
    setBusy(false);
  };

  const logBattle = useCallback(
    async () => {
      if (!selected || !wild || !winner) return;
      await supabase.from("hamster_battle_log").insert({
        player_hamster_entry_id: selected.id,
        opponent_hamster_id: wild.creatureId,
        opponent_species: wild.species,
        opponent_stage: wild.stage,
        opponent_form_id: wild.formId,
        opponent_personality: wild.personality,
        opponent_abilities: wild.abilities,
        result: winner === "player" ? "win" : "loss",
        turns: log,
        tamed: false,
      });
    },
    [selected, wild, winner, log]
  );

  useEffect(() => {
    if (phase === "result" && winner) {
      logBattle();
      if (isAutoSpawned) clearWildEncounter();
      if (winner === "player" && selected && wild) {
        awardBattleWin(selected.id, wild.stage).then((res) => {
          if (res.ok) setReward({ statPoints: res.statPoints, shopPoints: res.shopPoints });
        });
        if (user) triggerActionEvent(user.id, "battle_won");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const reset = () => {
    setPhase("pick");
    setWild(null);
    setIsAutoSpawned(false);
    setWinner(null);
    setLog([]);
    setRoundQueue([]);
    setPlayerHp(0);
    setOpponentHp(0);
    setBusy(false);
    opponentActingRef.current = false;
    setReward(null);
  };

  if (loading) {
    return (
      <div className="card">
        <div className="card-body center-text muted-text">
          checking the tournament board...
        </div>
      </div>
    );
  }

  const playersTurn = phase === "battling" && roundQueue[0] === "player" && !busy;
  const lastEntry = log.length ? log[log.length - 1] : null;

  return (
    <div className="card">
      <div className="card-body">
        <div className="section-label">
          <Icon name="map-pin" size={16} /> Tournaments
        </div>

        {fighters.length === 0 ? (
        <EmptyState image={emptyHabitat} message="No creatures yet — visit the breeder to adopt your first one." />
) : (
          <>
            {(phase === "pick" || phase === "scouting" || phase === "found") && (
              <>
                <div className="mini-label">Choose your fighter</div>
                <div className="fighter-row">
                  {fighters.map((f) => (
                    <button
                      key={f.id}
                      className={`fighter-btn${selectedId === f.id ? " is-selected" : ""}`}
                      onClick={() => setSelectedId(f.id)}
                      disabled={phase !== "pick"}
                    >
                      <img src={f.image} alt={f.creatureId} />
                    </button>
                  ))}
                </div>
              </>
            )}

            {phase === "pick" && isAutoSpawned && (
              <div className="match-notice">
                <Icon name="hamster-wild" size={20} />
                A tournament match is open for entry!
              </div>
            )}

            {phase === "pick" && (
              <button
                className="btn btn-primary btn-block"
                disabled={!selected}
                onClick={goScout}
              >
                <Icon name="lightning" size={14} />{" "}
                {isAutoSpawned ? "Enter the match!" : "Enter a tournament"}
              </button>
            )}

            {phase === "scouting" && (
              <div className="center-text muted-text arena-wait">
                finding you a matchup...
              </div>
            )}

            {(phase === "found" || phase === "battling" || phase === "result") && wild && selected && playerStats && (
              <div className="arena">
                <div className="arena-row">
                  <div className="arena-side">
                    <img src={selected.image} alt="your creature" />
                    <div className="arena-name">{selected.name || `Your ${SPECIES_LABELS[selected.species].toLowerCase()}`}</div>
                    <HpBar
                      current={phase === "found" ? playerStats.hp : playerHp}
                      max={playerStats.hp}
                      tone="player"
                    />
                    <div className="help-text">
                      {phase === "found" ? playerStats.hp : playerHp} / {playerStats.hp} HP
                    </div>
                  </div>
                  <div className="arena-vs">vs</div>
                  <div className="arena-side">
                    <img src={wild.image} alt="opponent" />
                    <div className="arena-name">
                      Opponent: {wild.stage} {SPECIES_LABELS[wild.species].toLowerCase()}
                    </div>
                    <HpBar
                      current={phase === "found" ? wild.stats.hp : opponentHp}
                      max={wild.stats.hp}
                      tone="opponent"
                    />
                    <div className="help-text">
                      {phase === "found" ? wild.stats.hp : opponentHp} / {wild.stats.hp} HP
                    </div>
                  </div>
                </div>

                {phase === "found" && (
                  <>
                    <div className="help-text center-text subsection">
                      Quirk: {wild.personality.quirk}
                    </div>
                    <div className="help-text center-text">
                      Knows: {wild.abilities.map(abilityShortName).join(", ")}
                    </div>
                    <div className="help-text center-text">
                      Win for +{BATTLE_REWARDS[wild.stage].statPoints} TP / +{BATTLE_REWARDS[wild.stage].shopPoints} bank points
                    </div>
                    <button className="btn btn-primary btn-block is-spaced" onClick={startFight}>
                      <Icon name="lightning" size={14} /> Fight!
                    </button>
                  </>
                )}

                {(phase === "battling" || phase === "result") && (
                  <>
                    {lastEntry && (
                      <div className={`battle-line${lastEntry.hit ? "" : " is-miss"}`}>
                        {lastEntry.side === "player" ? "Yours" : "Opponent"} used{" "}
                        <strong>{lastEntry.move}</strong>{lastEntry.hit ? ` — ${lastEntry.damage} dmg` : " — missed!"}
                      </div>
                    )}

                    {log.length > 1 && (
                      <div className="battle-log">
                        {log.slice(0, -1).map((t, i) => (
                          <div key={i}>
                            {t.side === "player" ? "Yours" : "Opponent"} used {t.move}
                            {t.hit ? ` — ${t.damage} dmg` : " — missed"}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {phase === "battling" && (
                  <div className="subsection">
                    {playersTurn ? (
                      <>
                        <div className="mini-label center-text">Pick a move</div>
                        <div className="move-list">
                          {(selected.abilities.length ? selected.abilities : ["Nibble"]).map((a) => (
                            <button
                              key={a}
                              className="move-btn"
                              onClick={() => useMove(a)}
                            >
                              <span>{abilityShortName(a)}</span>
                              <span className="move-flavor">{moveFlavor(a)}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="help-text center-text">
                        {busy ? "..." : "waiting..."}
                      </div>
                    )}
                  </div>
                )}

                {phase === "result" && winner && (
                  <div className="result-block">
                    {winner === "player" ? (
                      <>
                        <div className="result-title">
                          <Icon name="trophy" size={18} /> Victory!
                        </div>
                        {reward && (
                          <div className="help-text">
                            +{reward.statPoints} TP for {selected?.name || "your creature"} • +{reward.shopPoints} bank points
                          </div>
                        )}
                        <button className="btn btn-primary btn-block is-spaced" onClick={reset}>
                          Next match
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="result-title is-lose">
                          <Icon name="mood-sad" size={18} /> Not this time — the opponent took the match...
                        </div>
                        <button className="btn btn-primary btn-block is-spaced" onClick={reset}>
                          Rematch
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
