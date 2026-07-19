import { useState } from "react";
import { useHamsterGrowth } from "./useHamsterGrowth";
import { HAMSTERS } from "./hamsters";

function imageFor(hamsterId: string) {
  return HAMSTERS.find((h) => h.id === hamsterId)?.image;
}

export default function HamsterHabitat() {
  const { loading, collection } = useHamsterGrowth();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  if (loading) return null;

  const selected = collection.find((c) => c.id === selectedId) || null;

  return (
    <div className="card">
      <div className="card-body">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div className="section-label" style={{ marginBottom: 0 }}>🏡 Habitat</div>
          <span className="badge badge-pink">{collection.length} hatched</span>
        </div>

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
                const img = imageFor(entry.hamsterId);
                const isSelected = entry.id === selectedId;
                return (
                  <button
                    key={entry.id}
                    onClick={() => setSelectedId(isSelected ? null : entry.id)}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center",
                      background: isSelected ? "var(--blush)" : "transparent",
                      border: isSelected ? "1.5px solid var(--pink-light)" : "1.5px solid transparent",
                      borderRadius: 12, padding: 4, cursor: "pointer",
                    }}
                  >
                    {img && <img src={img} alt={entry.hamsterId} style={{ width: 48, height: 48, objectFit: "contain" }} />}
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
                  {imageFor(selected.hamsterId) && (
                    <img src={imageFor(selected.hamsterId)} alt="" style={{ width: 40, height: 40, objectFit: "contain" }} />
                  )}
                  <div style={{ fontSize: 11, color: "var(--ink-muted)" }}>
                    hatched {new Date(selected.hatchedAt).toLocaleDateString()}
                  </div>
                </div>
                {selected.personality ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                    <div style={{ color: "var(--green-dark)", fontWeight: 600 }}>✓ {selected.personality.good[0]}</div>
                    <div style={{ color: "var(--green-dark)", fontWeight: 600 }}>✓ {selected.personality.good[1]}</div>
                    <div style={{ color: "var(--pink-dark)", fontWeight: 600 }}>⚡ {selected.personality.quirk}</div>
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: "var(--ink-muted)" }}>no personality on record yet</div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
