// WildEncounterAlert.tsx
// Floating popup that lets you know a wild hamster has appeared, no matter
// what page you're on. Tapping it jumps to the Habitat page, where
// WildEncounter.tsx already auto-skips to the "Face it!" step for
// auto-spawned encounters (see isAutoSpawned in WildEncounter.tsx).
//
// Deliberately does NOT render the fight itself here — the fight UI stays a
// single instance inside Habitat.tsx. Two mounted <WildEncounter /> copies
// would both try to log/tame the same encounter, which is the same class of
// bug useHamsterGrowth.ts's checkingRef guards against (two hamsters from
// one accomplishment). This component only ever reads wildEncounter, never
// resolves it.

import { useEffect, useState } from "react";
import { useHamsterGrowth } from "./HamsterGrowthContext";
import Icon from "../components/Icon";

interface Props {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function WildEncounterAlert({ currentPage, onNavigate }: Props) {
  const { wildEncounter } = useHamsterGrowth();
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);

  // Reset dismissal whenever a genuinely new/different encounter shows up,
  // so dismissing today's hamster doesn't silently swallow tomorrow's.
  useEffect(() => {
    setDismissed(false);
  }, [wildEncounter?.hamsterId, wildEncounter?.formId]);

  // Small delay + transition so it slides in instead of popping in place.
  useEffect(() => {
    if (wildEncounter && !dismissed) {
      const t = setTimeout(() => setVisible(true), 30);
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [wildEncounter, dismissed]);

  if (!wildEncounter || dismissed || currentPage === "habitat") return null;

  return (
    <div
      role="button"
            onClick={() => onNavigate("habitat", "wild")}
      style={{
        position: "fixed",
        top: visible ? 14 : -80,
        left: 12,
        right: 12,
        zIndex: 999,
        margin: "0 auto",
        maxWidth: 420,
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "var(--blush)",
        border: "2px solid var(--pink-dark)",
        borderRadius: 16,
        padding: "10px 12px",
        boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
        cursor: "pointer",
        transition: "top 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
    >
      <Icon name="hamster-wild" size={30} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "var(--pink-dark)" }}>
          A wild hamster appeared!
        </div>
        <div style={{ fontSize: 10, color: "var(--ink-muted)" }}>Tap to go fight it</div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setDismissed(true);
        }}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--ink-muted)",
          fontSize: 18,
          lineHeight: 1,
          padding: 4,
          cursor: "pointer",
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}