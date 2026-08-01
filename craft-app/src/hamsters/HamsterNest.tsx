import { useEffect, useState } from "react";
import { useHamsterGrowth } from "./HamsterGrowthContext";
import { SOURCE_LABELS } from "./useHamsterGrowth";
import Icon from "../components/Icon";
import hamsterHatchCrack from "../assets/illustrations/hamster-hatch-crack.PNG";
import hamsterHatchRibbon from "../assets/illustrations/hamster-hatch-ribbon.PNG";

function NestEgg({ progressPct }: { progressPct: number }) {
  const showSmallCrack = progressPct >= 35;
  const showBigCrack = progressPct >= 70;
  const showGap = progressPct >= 92;

  return (
    <svg width="88" height="100" viewBox="0 0 88 100" style={{ display: "block" }}>
      {/* nest */}
      <ellipse cx="44" cy="88" rx="38" ry="9" fill="#E8C99A" opacity="0.5" />
      <path
        d="M8 88 Q10 78 20 80 Q26 74 34 79 Q44 72 54 79 Q62 74 68 80 Q78 78 80 88 Z"
        fill="#D9A66C"
        stroke="#8A5A2B"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* egg body */}
      <ellipse cx="44" cy="46" rx="30" ry="38" fill="#FBEADF" stroke="#8A5A2B" strokeWidth="2.5" />

      {/* speckles */}
      <circle cx="32" cy="34" r="2.4" fill="#F3B8C4" />
      <circle cx="54" cy="42" r="2" fill="#F6D9A0" />
      <circle cx="40" cy="58" r="2.2" fill="#F3B8C4" />
      <circle cx="58" cy="60" r="1.8" fill="#F6D9A0" />
      <circle cx="30" cy="52" r="1.6" fill="#F6D9A0" />

      {/* cracks, revealed progressively */}
      {showSmallCrack && (
        <path
          d="M38 24 L42 32 L37 38 L44 44"
          fill="none"
          stroke="#8A5A2B"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {showBigCrack && (
        <path
          d="M56 30 L51 38 L57 44 L50 52"
          fill="none"
          stroke="#8A5A2B"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {showGap && (
        <path
          d="M44 44 L47 50 L42 55"
          fill="none"
          stroke="#8A5A2B"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export default function HamsterNest() {
  const { loading, refreshing, refresh, points, threshold, progressPct, recentPoints, justHatched, clearJustHatched } = useHamsterGrowth();
  const [hatchStage, setHatchStage] = useState<"crack" | "ribbon" | "hamster">("crack");

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
            <Icon name="icon-refreshcw"
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
              <NestEgg progressPct={progressPct} />
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
