import { useEffect, useState } from "react";
import { useHamsterGrowth } from "./useHamsterGrowth";
import { HAMSTERS, imageForForm } from "./hamsters";

function imageFor(hamsterId: string) {
  return HAMSTERS.find((h) => h.id === hamsterId)?.image;
}

const STAGE_LABEL: Record<string, string> = {
  baby: "🐹 Baby",
  teen: "🌿 Teen",
  final: "⚔️ Final Form",
};

// Same visual language as the nest's egg-crack meter — a simple filling
// bar, since evolution grows at the exact same rate as hatching.
function EvolutionMeter({ pts, threshold }: { pts: number; threshold: number }) {
  const pct = Math.min(100, Math.round((pts / threshold) * 100));
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ height: 8, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: "var(--pink-dark)",
            borderRadius: 99,
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <div style={{ fontSize: 10, color: "var(--ink-muted)", marginTop: 3, textAlign: "center" }}>
        {pts.toFixed(0)} / {threshold} to next evolution
      </div>
    </div>
  );
}

export default function HamsterHabitat() {
  const { loading, collection, threshold, justEvolved, clearJustEvolved } = useHamsterGrowth();
  const [selectedId, setSelectedId] = useState<number | null>(null);

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
          <div className="section-label" style={{ marginBottom: 0 }}>🏡 Habitat</div>
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
              {justEvolved.stage === "final" ? "Reached final form! ⚔️" : "Evolved! 🌿"}
            </div>
            {justEvolved.newAbilities.length > 0 && (
              <div style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 4 }}>
                New: {justEvolved.newAbilities.join(" • ")}
              </div>
            )}
          </div>
        )}

        {collection.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--ink-muted)", textAlign: "center", padding: "16px 0" }}>
            No hamsters yet — fill the nest to hatch your first one.
          </div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(56px, 1fr))",
                gap: 8,
              }}
            >
              {collection.map((entry) => {
                const img = imageForForm(entry.stage, entry.teenFormId, entry.finalFormId, imageFor(entry.hamsterId) || "");
                const isSelected = entry.id === selectedId;
                return (
                  <button
                    key={entry.id}
                    onClick={() => setSelectedId(isSelected ? null : entry.id)}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center",
                      background: isSelected ? "var(--blush)" : "transparent",
                      border: isSelected ? "1.5px solid var(--pink-light)" : "1.5px solid transparent",
                      borderRadius: 12, padding: 4, cursor: "pointer", position: "relative",
                    }}
                  >
                    {img && <img src={img} alt={entry.hamsterId} style={{ width: 48, height: 48, objectFit: "contain" }} />}
                    {entry.stage !== "baby" && (
                      <span style={{ position: "absolute", top: 0, right: 0, fontSize: 10 }}>
                        {entry.stage === "final" ? "⚔️" : "🌿"}
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
                      {STAGE_LABEL[selected.stage]}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink-muted)" }}>
                      hatched {new Date(selected.hatchedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {selected.personality ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, marginBottom: 8 }}>
                    <div style={{ color: "var(--green-dark)", fontWeight: 600 }}>✓ {selected.personality.good[0]}</div>
                    <div style={{ color: "var(--green-dark)", fontWeight: 600 }}>✓ {selected.personality.good[1]}</div>
                    <div style={{ color: "var(--pink-dark)", fontWeight: 600 }}>⚡ {selected.personality.quirk}</div>
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
                      <div key={i} style={{ color: "var(--ink)", fontWeight: 600 }}>⚔️ {a}</div>
                    ))}
                  </div>
                )}

                {selected.stage !== "final" && <EvolutionMeter pts={selected.evolutionPoints} threshold={threshold} />}
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
