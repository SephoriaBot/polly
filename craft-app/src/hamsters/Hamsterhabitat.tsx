import { useHamsterGrowth } from "./useHamsterGrowth";
import { HAMSTERS } from "./hamsters";

function imageFor(hamsterId: string) {
  return HAMSTERS.find((h) => h.id === hamsterId)?.image;
}

export default function HamsterHabitat() {
  const { loading, collection } = useHamsterGrowth();

  if (loading) return null;

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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(56px, 1fr))",
              gap: 8,
            }}
          >
            {collection.map((entry) => {
              const img = imageFor(entry.hamsterId);
              return (
                <div key={entry.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  {img && <img src={img} alt={entry.hamsterId} style={{ width: 48, height: 48, objectFit: "contain" }} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
