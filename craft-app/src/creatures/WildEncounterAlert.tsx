// WildEncounterAlert.tsx
// Floating popup that lets you know a tournament match is open, no matter
// what page you're on. Tapping it jumps to the Habitat page, where
// WildEncounter.tsx already auto-skips to the "Face it!" step for
// auto-spawned encounters (see isAutoSpawned in WildEncounter.tsx).
//
// Deliberately does NOT render the fight itself here — the fight UI stays a
// single instance inside Habitat.tsx. Two mounted <WildEncounter /> copies
// would both try to log/tame the same encounter, which is the same class of
// bug useCreatureGrowth.ts's checkingRef guards against (two hamsters from
// one accomplishment). This component only ever reads wildEncounter, never
// resolves it.

import { useEffect, useState } from "react";
import { useCreatureGrowth } from "./CreatureGrowthContext";
import Icon from "../components/Icon";

interface Props {
  currentPage: string;
  onNavigate: (page: string, tab?: string) => void;
}

export default function WildEncounterAlert({ currentPage, onNavigate }: Props) {
  const { wildEncounter } = useCreatureGrowth();
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);

  // Reset dismissal whenever a genuinely new/different encounter shows up,
  // so dismissing today's hamster doesn't silently swallow tomorrow's.
  useEffect(() => {
    setDismissed(false);
  }, [wildEncounter?.creatureId, wildEncounter?.formId]);

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
      className={`match-alert${visible ? " is-visible" : ""}`}
    >
      <Icon name="hamster-wild" size={32} />
      <div className="row-text">
        <div className="match-alert-title">A tournament match is open!</div>
        <div className="help-text">Tap to enter</div>
      </div>
      <button
        className="match-alert-close"
        onClick={(e) => {
          e.stopPropagation();
          setDismissed(true);
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
