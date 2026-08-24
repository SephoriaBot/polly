import { useEffect, useState } from "react";
import { useHamsterGrowth } from "./HamsterGrowthContext";
import { SOURCE_LABELS } from "./useHamsterGrowth";
import Icon from "../components/Icon";
import hamsterHatchCrack from "../assets/illustrations/hamster-hatch-crack.PNG";
import hamsterHatchRibbon from "../assets/illustrations/hamster-hatch-ribbon.PNG";

// 15 hand-drawn egg colors, each with its own 1-crack / 3-crack / 6-crack
// sequence (egg{color}-1.png -> egg{color}-3.png in public/icons). Which
// color is currently in the nest is derived from how many hamsters have
// hatched so far, so it's stable for the whole time an egg is incubating
// and simply rotates to the next color once it hatches — no extra state
// or storage needed.
const EGG_COLOR_COUNT = 15;

function eggColorForCount(hatchedCount: number) {
  return (hatchedCount % EGG_COLOR_COUNT) + 1;
}

function eggStageForProgress(progressPct: number) {
  if (progressPct >= 67) return 3;
  if (progressPct >= 34) return 2;
  return 1;
}

function NestEgg({ progressPct, eggColor }: { progressPct: number; eggColor: number }) {
  const stage = eggStageForProgress(progressPct);
  return (
    <img
      src={`/icons/egg${eggColor}-${stage}.png`}
      alt="an egg in the nest, cracking as it grows"
      style={{ width: 88, height: "auto", display: "block", objectFit: "contain" }}
    />
  );
}

export default function HamsterNest() {
  const { loading, refreshing, refresh, points, threshold, progressPct, recentPoints, justHatched, clearJustHatched, collection } = useHamsterGrowth();
  const [hatchStage, setHatchStage] = useState<"crack" | "ribbon" | "hamster">("crack");
  const eggColor = eggColorForCount(collection.length);

  useEffect(() => {
  if (justHatched) {
    setHatchStage("crack");

    const ribbonTimer = setTimeout(() => setHatchStage("ribbon"), 600);
    const hamsterTimer = setTimeout(() => setHatchStage("hamster"), 1200);
    const clearTimer = setTimeout(clearJustHatched, 3000);

    return () => {
      clearTimeout(ribbonTimer);
      clearTimeout(hamsterTimer);
      clearTimeout(clearTimer);
    };
  }
}, [justHatched, clearJustHatched]);

  if (loading) {
    return (
      <div className="card">
        <div className="card-body" style={{ textAlign: "center", fontSize: 12, color: "var(--ink-muted)" }}>
          checking the nest...
        </div>
      </div>
    );
  }


  return (
    <div className="card">
      <div className="card-body">
        <div
          className="section-label"
          style={{ marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}
        >
          <span><Icon name="egg-nest" size={16} /> The Nest</span>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            aria-label="Refresh nest progress"
            title="Refresh nest progress"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 26,
              height: 26,
              padding: 0,
              border: "1px solid var(--pink-light)",
              borderRadius: 99,
              background: "var(--blush)",
              cursor: refreshing ? "default" : "pointer",
              opacity: refreshing ? 0.6 : 1,
            }}
          >
            <Icon name="icon-recur"
              size={13}
              color="var(--pink-dark)"
              style={refreshing ? { animation: "hamsterRefreshSpin 0.8s linear infinite" } : undefined}
            />
          </button>
        </div>

        {justHatched ? (
  <div style={{ textAlign: "center", padding: "10px 0" }}>
    <img
  src={
    hatchStage === "crack"
      ? hamsterHatchCrack
      : hatchStage === "ribbon"
      ? hamsterHatchRibbon
      : justHatched.image
  }
  alt={hatchStage === "hamster" ? "a new hamster hatched" : "the egg is hatching"}      style={{ width: 96, height: 96, objectFit: "contain", animation: "hatchPop 0.7s ease" }}
    />
    <div style={{ fontSize: 14, fontWeight: 800, color: "var(--pink-dark)", marginTop: 6 }}>
      {hatchStage === "hamster"
  ? <>A new hamster hatched! <Icon name="sparkles-cluster" size={16} /></>
  : "Something's happening..."}
    </div>
  </div>
) : (

          <>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
              <NestEgg progressPct={progressPct} eggColor={eggColor} />
            </div>
            <div style={{ height: 10, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${progressPct}%`,
                  background: "var(--pink-dark)",
                  borderRadius: 99,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 6, textAlign: "center" }}>
              {points.toFixed(0)} / {threshold} — pay bills, chip at debt, finish your day, and it grows
            </div>

            {recentPoints.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  overflowX: "auto",
                  marginTop: 10,
                  paddingBottom: 2,
                }}
              >
                {recentPoints.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      flexShrink: 0,
                      whiteSpace: "nowrap",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--pink-dark)",
                      background: "var(--blush)",
                      border: "1px solid var(--pink-light)",
                      borderRadius: 99,
                      padding: "4px 10px",
                    }}
                  >
                    {SOURCE_LABELS[entry.source]
                      ? <><Icon name={SOURCE_LABELS[entry.source].icon} size={13} /> {SOURCE_LABELS[entry.source].text}</>
                      : entry.source} +{entry.amount}
                  </div>
                ))}
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
          @keyframes hamsterRefreshSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
