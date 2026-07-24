// WildEncounter.tsx
// Phase 1 of hamster combat: fight procedurally-rolled wild hamsters using
// your own teen/final hamsters. Fully self-contained — does its own
// Supabase reads/writes, doesn't touch useHamsterGrowth.ts or any other
// hamster file. Requires the hamster_battle_log table (see migration).

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase"; // match your actual client path
import Icon from "../components/Icon";
import { HAMSTERS, imageForForm } from "./hamsters";
import type { EvolutionStage } from "./hamsters";
import type { Personality } from "./personalities";
import {
  canBattle,
  deriveBattleStats,
  rollWildHamster,
  resolveBattle,
  abilityShortName,
} from "./battle";
import type { WildHamster, BattleTurn } from "./battle";

interface FighterEntry {
  id: number;
  hamsterId: string;
  stage: EvolutionStage;
  abilities: string[];
  image: string;
}

type Phase = "pick" | "scouting" | "found" | "fighting" | "result";

function HpBar({ current, max, color }: { current: number; max: number; color: string }) {
  const pct = Math.max(0, Math.round((current / max) * 100));
  return (
    <div style={{ height: 8, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99, transition: "width 0.35s ease" }} />
    </div>
  );
}

export default function WildEncounter() {
  const [loading, setLoading] = useState(true);
  const [fighters, setFighters] = useState<FighterEntry[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("pick");
  const [wild, setWild] = useState<WildHamster | null>(null);
  const [visibleTurns, setVisibleTurns] = useState<BattleTurn[]>([]);
  const [allTurns, setAllTurns] = useState<BattleTurn[]>([]);
  const [winner, setWinner] = useState<"player" | "opponent" | null>(null);
  const [tamed, setTamed] = useState(false);

  const loadFighters = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("hamster_collection")
      .select("id, hamster_id, stage, teen_form_id, final_form_id, abilities")
      .neq("stage", "baby")
      .order("hatched_at", { ascending: false });

    const entries: FighterEntry[] = (data || []).map((r) => {
      const base = HAMSTERS.find((h) => h.id === r.hamster_id);
      const baseImage = base?.image || "";
      const image = imageForForm(r.stage as EvolutionStage, r.teen_form_id, r.final_form_id, baseImage);
      return {
        id: r.id,
        hamsterId: r.hamster_id,
        stage: r.stage as EvolutionStage,
        abilities: r.abilities || [],
        image,
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

  const goScout = () => {
    setPhase("scouting");
    setTamed(false);
    setTimeout(() => {
      setWild(rollWildHamster(playerMaxStage));
      setPhase("found");
    }, 900);
  };

  const startFight = () => {
    if (!selected || !wild) return;
    const playerStats = deriveBattleStats(selected.stage, selected.abilities);
    const result = resolveBattle(playerStats, selected.abilities, wild.stats, wild.abilities);
    setAllTurns(result.turns);
    setVisibleTurns([]);
    setWinner(result.winner);
    setPhase("fighting");
  };

  // Reveal turns one at a time for a bit of drama instead of dumping the
  // whole log at once.
  useEffect(() => {
    if (phase !== "fighting") return;
    if (visibleTurns.length >= allTurns.length) {
      const t = setTimeout(() => setPhase("result"), 400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setVisibleTurns((prev) => [...prev, allTurns[prev.length]]);
    }, 550);
    return () => clearTimeout(t);
  }, [phase, visibleTurns, allTurns]);

  const playerStats = selected ? deriveBattleStats(selected.stage, selected.abilities) : null;
  const playerHpNow =
    playerStats && visibleTurns.length
      ? [...visibleTurns].reverse().find((t) => t.side === "opponent")?.hpAfter ?? playerStats.hp
      : playerStats?.hp ?? 0;
  const opponentHpNow =
    wild && visibleTurns.length
      ? [...visibleTurns].reverse().find((t) => t.side === "player")?.hpAfter ?? wild.stats.hp
      : wild?.stats.hp ?? 0;

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
        turns: allTurns,
        tamed: didTame,
      });
    },
    [selected, wild, winner, allTurns]
  );

  useEffect(() => {
    if (phase === "result" && winner) {
      logBattle(false);
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
    setAllTurns([]);
    setVisibleTurns([]);
    setWinner(null);
    setTamed(false);
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

  return (
    <div className="card">
      <div className="card-body">
        <div className="section-label" style={{ marginBottom: 10 }}>
          <Icon name="map-pin" size={16} /> Wild Encounter
        </div>

        {fighters.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--ink-muted)", textAlign: "center", padding: "10px 0" }}>
            No teen or final hamsters yet — evolve one before it can battle.
          </div>
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

            {phase === "pick" && (
              <button
                className="btn-primary"
                disabled={!selected}
                onClick={goScout}
                style={{ width: "100%", opacity: selected ? 1 : 0.5 }}
              >
                <Icon name="map-pin" size={14} /> Go find a wild hamster
              </button>
            )}

            {phase === "scouting" && (
              <div style={{ textAlign: "center", fontSize: 12, color: "var(--ink-muted)", padding: "16px 0" }}>
                rustling in the bushes...
              </div>
            )}

            {(phase === "found" || phase === "fighting" || phase === "result") && wild && selected && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, textAlign: "center" }}>
                    <img src={selected.image} alt="your hamster" style={{ width: 64, height: 64, objectFit: "contain" }} />
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--pink-dark)" }}>Your hamster</div>
                    {playerStats && <HpBar current={playerHpNow} max={playerStats.hp} color="var(--pink-dark)" />}
                    <div style={{ fontSize: 10, color: "var(--ink-muted)" }}>
                      {playerHpNow} / {playerStats?.hp} HP
                    </div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink-muted)" }}>vs</div>
                  <div style={{ flex: 1, textAlign: "center" }}>
                    <img src={wild.image} alt="wild hamster" style={{ width: 64, height: 64, objectFit: "contain" }} />
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--pink-dark)" }}>
                      Wild {wild.stage} hamster
                    </div>
                    <HpBar current={opponentHpNow} max={wild.stats.hp} color="#B85C5C" />
                    <div style={{ fontSize: 10, color: "var(--ink-muted)" }}>
                      {opponentHpNow} / {wild.stats.hp} HP
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

                {(phase === "fighting" || phase === "result") && (
                  <div
                    style={{
                      marginTop: 12,
                      maxHeight: 120,
                      overflowY: "auto",
                      fontSize: 11,
                      color: "var(--ink-muted)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 3,
                    }}
                  >
                    {visibleTurns.map((t, i) => (
                      <div key={i}>
                        {t.side === "player" ? "Yours" : "Wild hamster"} used <strong>{t.move}</strong> — {t.damage} dmg
                      </div>
                    ))}
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
