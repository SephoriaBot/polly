import { useEffect, useState } from "react";
import { useHamsterGrowth } from "./HamsterGrowthContext";
import { ALL_HAMSTERS, imageForForm } from "./hamsters";
import Icon, { type IconName } from "../components/Icon";
import HamsterStatTraining from "./HamsterStatTraining";
import EmptyState from '../components/EmptyState';
import emptyHabitat from '../assets/icons/empty-habitat.png';
import { STAT_CAPS, isMaxedOut } from "./battle";
import type { TrainedStats } from "./battle";

function imageFor(hamsterId: string) {
  return ALL_HAMSTERS.find((h) => h.id === hamsterId)?.image;
}

const STAGE_LABEL: Record<string, { text: string; icon: IconName }> = {
  baby: { text: "Baby", icon: "egg" },
  teen: { text: "Teen", icon: "potted-plant" },
  final: { text: "Final Form", icon: "medal-wings" },
};

// Evolution is no longer point/threshold-based — it's unlocked by maxing
// every trained stat for the current stage (see isMaxedOut in battle.ts).
// This shows how many of the 4 stats are maxed, and surfaces the Evolve
// button once all 4 are — so the meter reads as "battle & train more" until
// it's actually ready, rather than a generic progress bar.
function EvolutionReadiness({
  stage,
  trained,
  onEvolve,
  evolving,
}: {
  stage: "baby" | "teen";
  trained: TrainedStats;
  onEvolve: () => void;
  evolving: boolean;
}) {
  const cap = STAT_CAPS[stage];
  const statKeys: Array<keyof TrainedStats> = ["hp", "attack", "defense", "speed"];
  const maxedCount = statKeys.filter((k) => trained[k] >= cap[k]).length;
  const ready = isMaxedOut(stage, trained);

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ height: 8, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${(maxedCount / 4) * 100}%`,
            background: ready ? "var(--accent)" : "var(--pink-dark)",
            borderRadius: 99,
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <div style={{ fontSize: 10, color: "var(--ink-muted)", marginTop: 3, textAlign: "center" }}>
        {ready ? "Ready to evolve!" : `${maxedCount}/4 stats maxed — win battles to earn TP`}
      </div>
      {ready && (
        <button
          className="btn-primary"
          onClick={onEvolve}
          disabled={evolving}
          style={{ width: "100%", marginTop: 8, opacity: evolving ? 0.6 : 1 }}
        >
          <Icon name="sparkles-cluster" size={14} /> {evolving ? "Evolving..." : "Evolve!"}
        </button>
      )}
    </div>
  );
}

export default function HamsterHabitat() {
  const { loading, collection, justEvolved, clearJustEvolved, evolveHamster } = useHamsterGrowth();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [evolving, setEvolving] = useState(false);
  const [evolveMessage, setEvolveMessage] = useState<string | null>(null);

  const handleEvolve = async (entryId: number) => {
    setEvolving(true);
    setEvolveMessage(null);
    const result = await evolveHamster(entryId);
    if (!result.ok && result.reason) setEvolveMessage(result.reason);
    setEvolving(false);
  };

  useEffect(() => {
    if (justEvolved) {
      const t = setTimeout(clearJustEvolved, 3500);
      return () => clearTimeout(t);
    }
  }, [justEvolved, clearJustEvolved]);

  if (loading) return null;

  const selected = collection.find((c) => c.id === selectedId) || null;
  const evolvedEntry = justEvolved ? collection.find((c) => c.id === justEvolved.entryId) : null;

  return (
    <div className="card">
      <div className="card-body">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div className="section-label" style={{ marginBottom: 0 }}><Icon name="house" size={16} /> Habitat</div>
          <span className="badge badge-pink">{collection.length} hatched</span>
        </div>

        {justEvolved && evolvedEntry && (
          <div
            style={{
              textAlign: "center",
              padding: "10px 0",
              marginBottom: 10,
              background: "var(--blush)",
              border: "1.5px solid var(--pink-light)",
              borderRadius: 16,
            }}
          >
            <img
              src={imageForForm(justEvolved.stage, evolvedEntry.teenFormId, evolvedEntry.finalFormId, imageFor(evolvedEntry.hamsterId) || "")}
              alt="evolved"
              style={{ width: 88, height: 88, objectFit: "contain", animation: "hatchPop 0.7s ease" }}
            />
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--pink-dark)", marginTop: 6 }}>
              {justEvolved.stage === "final"
                ? <>Reached final form! <Icon name="medal-wings" size={14} /></>
                : <>Evolved! <Icon name="potted-plant" size={14} /></>}
            </div>
            {justEvolved.newAbilities.length > 0 && (
              <div style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 4 }}>
                New: {justEvolved.newAbilities.join(" • ")}
              </div>
            )}
          </div>
        )}

        {collection.length === 0 ? (
        <EmptyState image={emptyHabitat} message="No hamsters in the habitat yet." />
        ) : (
          <>
            <div
              style={{
                display: "grid",
gridTemplateColumns: "repeat(auto-fill, minmax(min(80px, 100%), 1fr))",

                gap: 8,
              }}
            >
              {collection.map((entry) => {
                const img = imageForForm(entry.stage, entry.teenFormId, entry.finalFormId, imageFor(entry.hamsterId) || "");
                const isSelected = entry.id === selectedId;
                return (
                  <button
                    key={entry.id}
                    onClick={() => {
                      setSelectedId(isSelected ? null : entry.id);
                      setEvolveMessage(null);
                    }}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center",
                      background: isSelected ? "var(--blush)" : "transparent",
                      border: isSelected ? "1.5px solid var(--pink-light)" : "1.5px solid transparent",
                      borderRadius: 12, padding: 4, cursor: "pointer", position: "relative",
                    }}
                  >
                    {img && <img src={img} alt={entry.name || entry.hamsterId} style={{ width: 72, height: 72, objectFit: "contain" }} />}
                    {entry.stage !== "baby" && (
                      <span style={{ position: "absolute", top: 0, right: 0, fontSize: 10 }}>
                        <Icon name={entry.stage === "final" ? "medal-wings" : "potted-plant"} size={12} />
                      </span>
                    )}
                    {entry.name && (
                      <span style={{ fontSize: 9, color: "var(--ink-muted)", marginTop: 2, maxWidth: 52, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {entry.name}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {selected && (
              <div
                style={{
                  marginTop: 12, padding: "12px 14px",
                  background: "var(--white)", border: "1.5px solid var(--border)",
                  borderRadius: 16,
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                  {imageForForm(selected.stage, selected.teenFormId, selected.finalFormId, imageFor(selected.hamsterId) || "") && (
                    <img
                      src={imageForForm(selected.stage, selected.teenFormId, selected.finalFormId, imageFor(selected.hamsterId) || "")}
                      alt=""
                      style={{ width: 44, height: 44, objectFit: "contain" }}
                    />
                  )}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--pink-dark)" }}>
                      <Icon name={STAGE_LABEL[selected.stage].icon} size={14} /> {STAGE_LABEL[selected.stage].text}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink-muted)" }}>
                      hatched {new Date(selected.hatchedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {selected.personality ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, marginBottom: 8 }}>
                    <div style={{ color: "var(--green-dark)", fontWeight: 600 }}><Icon name="clipboard-check" size={14} /> {selected.personality.good[0]}</div>
                    <div style={{ color: "var(--green-dark)", fontWeight: 600 }}><Icon name="clipboard-check" size={14} /> {selected.personality.good[1]}</div>
                    <div style={{ color: "var(--pink-dark)", fontWeight: 600 }}><Icon name="lightning" size={14} /> {selected.personality.quirk}</div>
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: "var(--ink-muted)" }}>no personality on record yet</div>
                )}

                {selected.abilities.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, marginTop: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>
                      Combat abilities
                    </div>
                    {selected.abilities.map((a, i) => (
                      <div key={i} style={{ color: "var(--ink)", fontWeight: 600 }}><Icon name="medal-wings" size={14} /> {a}</div>
                    ))}
                  </div>
                )}

                {selected.stage !== "final" && (
                  <>
                    <EvolutionReadiness
                      stage={selected.stage}
                      trained={selected.trainedStats}
                      onEvolve={() => handleEvolve(selected.id)}
                      evolving={evolving}
                    />
                    {evolveMessage && (
                      <div style={{ fontSize: 10, color: "var(--ink-muted)", marginTop: 4, textAlign: "center" }}>
                        {evolveMessage}
                      </div>
                    )}
                  </>
                )}

                <HamsterStatTraining
                  entryId={selected.id}
                  stage={selected.stage}
                  name={selected.name}
                  trainingPoints={selected.trainingPoints}
                  trainedStats={selected.trainedStats}
                />
              </div>
            )}
          </>
        )}

        <style>{`
          @keyframes hatchPop {
            0% { transform: scale(0.3); opacity: 0; }
            60% { transform: scale(1.15); opacity: 1; }
            100% { transform: scale(1); }
          }
        `}</style>
      </div>
    </div>
  );
}
