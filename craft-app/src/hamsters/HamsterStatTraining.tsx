// HamsterStatTraining.tsx
// Permanent stat allocation UI for a single selected hamster, plus the
// rename control. Drop this into HamsterHabitat.tsx's detail panel — it
// pulls allocateStat/renameHamster from the shared HamsterGrowthContext so
// it doesn't need its own Supabase calls.

import { useState } from "react";
import Icon from "../components/Icon";
import { STAT_CAPS } from "./battle";
import type { TrainedStats } from "./battle";
import type { EvolutionStage } from "./hamsters";
import { useHamsterGrowth } from "./HamsterGrowthContext";

interface HamsterStatTrainingProps {
  entryId: number;
  stage: EvolutionStage;
  name: string | null;
  trainingPoints: number;
  trainedStats: TrainedStats;
}

const STAT_ORDER: Array<keyof TrainedStats> = ["hp", "attack", "defense", "speed"];

const STAT_LABELS: Record<keyof TrainedStats, { text: string; icon: "heart-medical" | "lightning" | "lock-heart" | "sparkle-single" }> = {
  hp: { text: "Vitality", icon: "heart-medical" },
  attack: { text: "Attack", icon: "lightning" },
  defense: { text: "Defense", icon: "lock-heart" },
  speed: { text: "Speed", icon: "sparkle-single" },
};

function StatRow({
  stat,
  value,
  cap,
  disabled,
  onAllocate,
}: {
  stat: keyof TrainedStats;
  value: number;
  cap: number;
  disabled: boolean;
  onAllocate: () => void;
}) {
  const label = STAT_LABELS[stat];
  const pct = Math.min(100, Math.round((value / cap) * 100));
  const maxed = value >= cap;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <div style={{ width: 78, fontSize: 11, color: "var(--ink)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
        <Icon name={label.icon} size={13} /> {label.text}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ height: 7, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: maxed ? "var(--accent)" : "var(--pink-dark)",
              borderRadius: 99,
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>
      <div style={{ width: 46, fontSize: 10, color: "var(--ink-muted)", textAlign: "right" }}>
        {value}/{cap}
      </div>
      <button
        onClick={onAllocate}
        disabled={disabled || maxed}
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          border: "1.5px solid var(--pink-light)",
          background: disabled || maxed ? "transparent" : "var(--blush)",
          color: "var(--pink-dark)",
          fontSize: 13,
          fontWeight: 800,
          lineHeight: 1,
          cursor: disabled || maxed ? "default" : "pointer",
          opacity: disabled || maxed ? 0.35 : 1,
          flexShrink: 0,
        }}
        aria-label={`Add a point to ${label.text}`}
      >
        +
      </button>
    </div>
  );
}

export default function HamsterStatTraining({ entryId, stage, name, trainingPoints, trainedStats }: HamsterStatTrainingProps) {
  const { allocateStat, renameHamster } = useHamsterGrowth();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(name || "");
  const [busyStat, setBusyStat] = useState<keyof TrainedStats | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const cap = STAT_CAPS[stage];

  const handleAllocate = async (stat: keyof TrainedStats) => {
    if (busyStat) return;
    setBusyStat(stat);
    setMessage(null);
    const result = await allocateStat(entryId, stat);
    if (!result.ok && result.reason) setMessage(result.reason);
    setBusyStat(null);
  };

  const saveName = async () => {
    await renameHamster(entryId, nameDraft);
    setEditingName(false);
  };

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        {editingName ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center", flex: 1 }}>
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              placeholder="Give it a name..."
              maxLength={24}
              style={{
                flex: 1,
                fontSize: 13,
                fontFamily: "var(--font-heading)",
                padding: "4px 8px",
                borderRadius: 8,
                border: "1.5px solid var(--pink-light)",
                background: "var(--white)",
                color: "var(--ink)",
              }}
            />
            <button
              onClick={saveName}
              style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, border: "none", background: "var(--gold, var(--pink-dark))", color: "var(--ink)", fontWeight: 700 }}
            >
              Save
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setNameDraft(name || "");
              setEditingName(true);
            }}
            style={{
              display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none",
              padding: 0, cursor: "pointer", fontFamily: "var(--font-heading)", fontSize: 14, fontWeight: 700,
              color: name ? "var(--ink)" : "var(--ink-muted)",
            }}
          >
            {name || "Name this hamster"} <Icon name="notepad-pencil" size={13} />
          </button>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>
          Stat training
        </div>
        <span className="badge badge-pink" style={{ fontSize: 10 }}>
          {trainingPoints} TP
        </span>
      </div>

      {STAT_ORDER.map((stat) => (
        <StatRow
          key={stat}
          stat={stat}
          value={trainedStats[stat]}
          cap={cap[stat]}
          disabled={busyStat !== null || trainingPoints <= 0}
          onAllocate={() => handleAllocate(stat)}
        />
      ))}

      {message && (
        <div style={{ fontSize: 10, color: "var(--ink-muted)", marginTop: 2 }}>{message}</div>
      )}
      {trainingPoints <= 0 && !message && (
        <div style={{ fontSize: 10, color: "var(--ink-muted)", marginTop: 2 }}>
          Earn more TP from the same actions that grow your hamsters.
        </div>
      )}
    </div>
  );
}