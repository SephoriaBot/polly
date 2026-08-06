// WildEncounter.tsx
// Phase 1 of hamster combat: fight procedurally-rolled wild hamsters using
// your own teen/final hamsters. Fully self-contained — does its own
// Supabase reads/writes, doesn't touch useHamsterGrowth.ts or any other
// hamster file. Requires the hamster_battle_log table (see migration).
//
// Combat is move-by-move: each round, whichever side is faster acts first
// (opponent's move auto-resolves), then the player picks one of their
// hamster's abilities. Every ability has a hidden power/accuracy trade-off
// (see moveStats in battle.ts) — always throwing the flashiest move is a
// real way to lose, since the biggest hits are also the least likely to
// land. There is no auto-resolve-the-whole-fight path anymore; the outcome
// depends on what you pick each round, not just stats + one RNG roll.

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "../lib/supabase"; // match your actual client path
import Icon from "../components/Icon";
import { HAMSTERS, imageForForm } from "./hamsters";
import type { EvolutionStage } from "./hamsters";
import { useHamsterGrowth } from "./HamsterGrowthContext";
import {
  canBattle,
  deriveBattleStats,
  rollWildHamster,
  hydrateWildHamster,
  abilityShortName,
  moveFlavor,
  resolveAttack,
  pickOpponentMove,
  rollsFirst,
} from "./battle";
import type { WildHamster, AttackOutcome, TrainedStats } from "./battle";
import EmptyState from '../components/EmptyState';
import empty3Img from '../assets/icons/empty3.png';


interface FighterEntry {
  id: number;
  hamsterId: string;
  name: string | null;
  stage: EvolutionStage;
  abilities: string[];
  image: string;
  trainedStats: TrainedStats;
}

type Phase = "pick" | "scouting" | "found" | "battling" | "result";

function HpBar({ current, max, color }: { current: number; max: number; color: string }) {
  const pct = Math.max(0, Math.round((current / max) * 100));
  return (
    <div style={{ height: 8, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99, transition: "width 0.35s ease" }} />
    </div>
  );
}

export default function WildEncounter() {
  const { wildEncounter, clearWildEncounter } = useHamsterGrowth();
  const [loading, setLoading] = useState(true);
  const [fighters, setFighters] = useState<FighterEntry[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("pick");
  const [wild, setWild] = useState<WildHamster | null>(null);
  const [isAutoSpawned, setIsAutoSpawned] = useState(false);
  const [winner, setWinner] = useState<"player" | "opponent" | null>(null);
  const [tamed, setTamed] = useState(false);

  // Live battle state
  const [playerHp, setPlayerHp] = useState(0);
  const [opponentHp, setOpponentHp] = useState(0);
  const [log, setLog] = useState<AttackOutcome[]>([]);
  const [roundQueue, setRoundQueue] = useState<Array<"player" | "opponent">>([]);
  const [busy, setBusy] = useState(false); // true while an auto/animated move is resolving
  const opponentActingRef = useRef(false);

  // A wild hamster spawned automatically from an accomplishment (see
  // useHamsterGrowth.ts) shows up here immediately instead of requiring the
  // manual "go find one" button.
  useEffect(() => {
    if (wildEncounter && phase === "pick" && !wild) {
      setWild(hydrateWildHamster(wildEncounter));
      setIsAutoSpawned(true);
    }
  }, [wildEncounter, phase, wild]);

  const loadFighters = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("hamster_collection")
      .select("id, hamster_id, name, stage, teen_form_id, final_form_id, abilities, trained_hp, trained_attack, trained_defense, trained_speed")
      .neq("stage", "baby")
      .order("hatched_at", { ascending: false });

    const entries: FighterEntry[] = (data || []).map((r) => {
      const base = HAMSTERS.find((h) => h.id === r.hamster_id);
      const baseImage = base?.image || "";
      const image = imageForForm(r.stage as EvolutionStage, r.teen_form_id, r.final_form_id, baseImage);
      return {
        id: r.id,
        hamsterId: r.hamster_id,
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

  const playerMaxStage: EvolutionStage = useMemo(() => {
    if (fighters.some((f) => f.stage === "final")) return "final";
    if (fighters.some((f) => f.stage === "teen")) return "teen";
    return "baby";
  }, [fighters]);

  const playerStats = useMemo(
    () => (selected ? deriveBattleStats(selected.stage, selected.abilities, selected.trainedStats) : null),
    [selected]
  );

  const goScout = () => {
    setTamed(false);
    if (isAutoSpawned && wild) {
      // Already rolled — just move to the reveal, no need to fake a delay.
      setPhase("found");
      return;
    }
    setPhase("scouting");
    setTimeout(() => {
      setWild(rollWildHamster(playerMaxStage));
      setPhase("found");
    }, 900);
  };

  const startFight = () => {
    if (!selected || !playerStats || !wild) return;
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
    async (didTame: boolean) => {
      if (!selected || !wild || !winner) return;
      await supabase.from("hamster_battle_log").insert({
        player_hamster_entry_id: selected.id,
        opponent_hamster_id: wild.hamsterId,
        opponent_stage: wild.stage,
        opponent_form_id: wild.formId,
        opponent_personality: wild.personality,
        opponent_abilities: wild.abilities,
        result: winner === "player" ? "win" : "loss",
        turns: log,
        tamed: didTame,
      });
    },
    [selected, wild, winner, log]
  );

  useEffect(() => {
    if (phase === "result" && winner) {
      logBattle(false);
      if (isAutoSpawned) clearWildEncounter();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const tame = async () => {
    if (!wild) return;
    await supabase.from("hamster_collection").insert({
      hamster_id: wild.hamsterId,
      source: "wild_tame",
      personality: wild.personality,
      stage: wild.stage,
      evolution_points: 0,
      teen_form_id: wild.stage === "teen" ? wild.formId : null,
      final_form_id: wild.stage === "final" ? wild.formId : null,
      abilities: wild.abilities,
    });
    setTamed(true);
    await logBattle(true);
    await loadFighters();
  };

  const reset = () => {
    setPhase("pick");
    setWild(null);
    setIsAutoSpawned(false);
    setWinner(null);
    setTamed(false);
    setLog([]);
    setRoundQueue([]);
    setPlayerHp(0);
    setOpponentHp(0);
    setBusy(false);
    opponentActingRef.current = false;
  };

  if (loading) {
    return (
      <div className="card">
        <div className="card-body" style={{ textAlign: "center", fontSize: 12, color: "var(--ink-muted)" }}>
          scouting the tall grass...
        </div>
      </div>
    );
  }

  const playersTurn = phase === "battling" && roundQueue[0] === "player" && !busy;
  const lastEntry = log.length ? log[log.length - 1] : null;

  return (
    <div className="card">
      <div className="card-body">
        <div className="section-label" style={{ marginBottom: 10 }}>
          <Icon name="map-pin" size={16} /> Wild Encounter
        </div>

        {fighters.length === 0 ? (
        <EmptyState image={empty3Img} message="No hamsters are old enough to battle yet!" />
) : (
          <>
            {(phase === "pick" || phase === "scouting" || phase === "found") && (
              <>
                <div style={{ fontSize: 11, color: "var(--ink-muted)", marginBottom: 8 }}>Choose your fighter</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  {fighters.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setSelectedId(f.id)}
                      disabled={phase !== "pick"}
                      style={{
                        border: `2px solid ${selectedId === f.id ? "var(--pink-dark)" : "var(--border)"}`,
                        background: selectedId === f.id ? "var(--blush)" : "transparent",
                        borderRadius: 12,
                        padding: 4,
                        cursor: phase === "pick" ? "pointer" : "default",
                      }}
                    >
                      <img src={f.image} alt={f.hamsterId} style={{ width: 48, height: 48, objectFit: "contain" }} />
                    </button>
                  ))}
                </div>
              </>
            )}

            {phase === "pick" && isAutoSpawned && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--pink-dark)",
                  fontWeight: 700,
                  textAlign: "center",
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Icon name="hamster-wild" size={18} />
                A wild hamster appeared while you were busy!
              </div>
            )}

            {phase === "pick" && (
              <button
                className="btn-primary"
                disabled={!selected}
                onClick={goScout}
                style={{ width: "100%", opacity: selected ? 1 : 0.5 }}
              >
                <Icon name="lightning" size={14} />{" "}
                {isAutoSpawned ? "Face it!" : "Go find a wild hamster"}
              </button>
            )}

            {phase === "scouting" && (
              <div style={{ textAlign: "center", fontSize: 12, color: "var(--ink-muted)", padding: "16px 0" }}>
                rustling in the bushes...
              </div>
            )}

            {(phase === "found" || phase === "battling" || phase === "result") && wild && selected && playerStats && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, textAlign: "center" }}>
                    <img src={selected.image} alt="your hamster" style={{ width: 64, height: 64, objectFit: "contain" }} />
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--pink-dark)" }}>{selected.name || "Your hamster"}</div>
                    <HpBar
                      current={phase === "found" ? playerStats.hp : playerHp}
                      max={playerStats.hp}
                      color="var(--pink-dark)"
                    />
                    <div style={{ fontSize: 10, color: "var(--ink-muted)" }}>
                      {phase === "found" ? playerStats.hp : playerHp} / {playerStats.hp} HP
                    </div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink-muted)" }}>vs</div>
                  <div style={{ flex: 1, textAlign: "center" }}>
                    <img src={wild.image} alt="wild hamster" style={{ width: 64, height: 64, objectFit: "contain" }} />
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--pink-dark)" }}>
                      Wild {wild.stage} hamster
                    </div>
                    <HpBar
                      current={phase === "found" ? wild.stats.hp : opponentHp}
                      max={wild.stats.hp}
                      color="#B85C5C"
                    />
                    <div style={{ fontSize: 10, color: "var(--ink-muted)" }}>
                      {phase === "found" ? wild.stats.hp : opponentHp} / {wild.stats.hp} HP
                    </div>
                  </div>
                </div>

                {phase === "found" && (
                  <>
                    <div style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 10, textAlign: "center" }}>
                      Quirk: {wild.personality.quirk}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 2, textAlign: "center" }}>
                      Knows: {wild.abilities.map(abilityShortName).join(", ")}
                    </div>
                    <button className="btn-primary" onClick={startFight} style={{ width: "100%", marginTop: 12 }}>
                      <Icon name="lightning" size={14} /> Fight!
                    </button>
                  </>
                )}

                {(phase === "battling" || phase === "result") && (
                  <>
                    {lastEntry && (
                      <div style={{ fontSize: 12, textAlign: "center", marginTop: 12, minHeight: 18 }}>
                        {lastEntry.hit ? (
                          <span style={{ color: "var(--ink)" }}>
                            {lastEntry.side === "player" ? "Yours" : "Wild hamster"} used{" "}
                            <strong>{lastEntry.move}</strong> — {lastEntry.damage} dmg
                          </span>
                        ) : (
                          <span style={{ color: "var(--ink-muted)" }}>
                            {lastEntry.side === "player" ? "Yours" : "Wild hamster"} used{" "}
                            <strong>{lastEntry.move}</strong> — missed!
                          </span>
                        )}
                      </div>
                    )}

                    {log.length > 1 && (
                      <div
                        style={{
                          marginTop: 6,
                          maxHeight: 90,
                          overflowY: "auto",
                          fontSize: 10,
                          color: "var(--ink-muted)",
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                        }}
                      >
                        {log.slice(0, -1).map((t, i) => (
                          <div key={i}>
                            {t.side === "player" ? "Yours" : "Wild hamster"} used {t.move}
                            {t.hit ? ` — ${t.damage} dmg` : " — missed"}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {phase === "battling" && (
                  <div style={{ marginTop: 14 }}>
                    {playersTurn ? (
                      <>
                        <div style={{ fontSize: 11, color: "var(--ink-muted)", marginBottom: 6, textAlign: "center" }}>
                          Pick a move
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {(selected.abilities.length ? selected.abilities : ["Nibble"]).map((a) => (
                            <button
                              key={a}
                              onClick={() => useMove(a)}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                border: "2px solid var(--border)",
                                background: "transparent",
                                borderRadius: 10,
                                padding: "8px 10px",
                                cursor: "pointer",
                                fontSize: 12,
                                textAlign: "left",
                              }}
                            >
                              <span>{abilityShortName(a)}</span>
                              <span style={{ fontSize: 10, color: "var(--ink-muted)" }}>{moveFlavor(a)}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div style={{ textAlign: "center", fontSize: 11, color: "var(--ink-muted)", padding: "8px 0" }}>
                        {busy ? "..." : "waiting..."}
                      </div>
                    )}
                  </div>
                )}

                {phase === "result" && winner && (
                  <div style={{ marginTop: 12, textAlign: "center" }}>
                    {winner === "player" ? (
                      <>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--pink-dark)" }}>
                          <Icon name="trophy" size={16} /> Victory!
                        </div>
                        {!tamed ? (
                          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                            <button className="btn-primary" onClick={tame} style={{ flex: 1 }}>
                              <Icon name="sparkles-cluster" size={14} /> Tame it
                            </button>
                            <button onClick={reset} style={{ flex: 1 }}>
                              Let it go
                            </button>
                          </div>
                        ) : (
                          <>
                            <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 6 }}>
                              Added to your collection!
                            </div>
                            <button className="btn-primary" onClick={reset} style={{ width: "100%", marginTop: 10 }}>
                              Find another
                            </button>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#B85C5C" }}>
                          <Icon name="mood-sad" size={16} /> It got away with the win...
                        </div>
                        <button className="btn-primary" onClick={reset} style={{ width: "100%", marginTop: 10 }}>
                          Try again
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