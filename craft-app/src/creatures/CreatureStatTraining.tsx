// CreatureStatTraining.tsx
// Permanent stat allocation UI for a single selected hamster, plus the
// rename control. Drop this into CreatureHabitat.tsx's detail panel — it
// pulls allocateStat/renameCreature from the shared CreatureGrowthContext so
// it doesn't need its own Supabase calls.

import { useState } from "react";
import Icon from "../components/Icon";
import { STAT_CAPS } from "./battle";
import type { TrainedStats } from "./battle";
import type { EvolutionStage } from "./creatures";
import { useCreatureGrowth } from "./CreatureGrowthContext";

interface CreatureStatTrainingProps {
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
  incrementLabel,
}: {
  stat: keyof TrainedStats;
  value: number;
  cap: number;
  disabled: boolean;
  onAllocate: () => void;
  incrementLabel: string;
}) {
  const label = STAT_LABELS[stat];
  const pct = Math.min(100, Math.round((value / cap) * 100));
  const maxed = value >= cap;

  return (
    <div className="stat-row-line">
      <div className="stat-name">
        <Icon name={label.icon} size={16} /> {label.text}
      </div>
      <div className="stat-bar">
        <div className="progress is-thick">
          <div
            className={`progress-fill${maxed ? " is-ready" : " is-pink"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="stat-count">{value}/{cap}</div>
      <button
        className="stat-plus"
        onClick={onAllocate}
        disabled={disabled || maxed}
        aria-label={`Add ${incrementLabel} to ${label.text}`}
      >
        +
      </button>
    </div>
  );
}

const INCREMENT_OPTIONS: Array<{ label: string; value: number }> = [
  { label: "+1", value: 1 },
  { label: "+5", value: 5 },
  { label: "+10", value: 10 },
  { label: "Max", value: Infinity },
];

export default function CreatureStatTraining({ entryId, stage, name, trainingPoints, trainedStats }: CreatureStatTrainingProps) {
  const { allocateStat, renameCreature } = useCreatureGrowth();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(name || "");
  const [busyStat, setBusyStat] = useState<keyof TrainedStats | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [increment, setIncrement] = useState<number>(1);

  const cap = STAT_CAPS[stage];

  const handleAllocate = async (stat: keyof TrainedStats) => {
    if (busyStat) return;
    setBusyStat(stat);
    setMessage(null);
    const result = await allocateStat(entryId, stat, increment);
    if (!result.ok && result.reason) {
      setMessage(result.reason);
    } else if (result.ok && result.spent) {
      setMessage(result.spent === 1 ? "+1 point spent" : `+${result.spent} points spent`);
    }
    setBusyStat(null);
  };

  const saveName = async () => {
    await renameCreature(entryId, nameDraft);
    setEditingName(false);
  };

  return (
    <div className="training-block">
      <div className="training-name">
        {editingName ? (
          <div className="add-row">
            <input
              autoFocus
              className="form-input grow"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              placeholder="Give it a name..."
              maxLength={24}
            />
            <button className="btn btn-primary btn-sm" onClick={saveName}>
              Save
            </button>
          </div>
        ) : (
          <button
            className={`name-btn${name ? "" : " is-empty"}`}
            onClick={() => {
              setNameDraft(name || "");
              setEditingName(true);
            }}
            aria-label={name ? "Edit creature name" : "Name this creature"}
          >
            {name ? (
              <>{name} <Icon name="notepad-pencil" size={16} /> Edit</>
            ) : (
              <><Icon name="notepad-pencil" size={16} /> Name this creature</>
            )}
          </button>
        )}
      </div>

      <div className="section-head">
        <div className="mini-label">Stat training</div>
        <span className="badge badge-pink">{trainingPoints} TP</span>
      </div>

      <div className="seg-row">
        {INCREMENT_OPTIONS.map((opt) => {
          const selected = increment === opt.value;
          return (
            <button
              key={opt.label}
              className={`seg-btn${selected ? " is-on" : ""}`}
              onClick={() => setIncrement(opt.value)}
              aria-pressed={selected}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {STAT_ORDER.map((stat) => (
        <StatRow
          key={stat}
          stat={stat}
          value={trainedStats[stat]}
          cap={cap[stat]}
          disabled={busyStat !== null || trainingPoints <= 0}
          onAllocate={() => handleAllocate(stat)}
          incrementLabel={INCREMENT_OPTIONS.find((o) => o.value === increment)?.label || "+1"}
        />
      ))}

      {message && <div className="help-text">{message}</div>}
      {trainingPoints <= 0 && !message && (
        <div className="help-text">Win battles to earn TP for this creature.</div>
      )}
    </div>
  );
}
