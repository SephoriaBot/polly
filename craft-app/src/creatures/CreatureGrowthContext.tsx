import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { useCreatureGrowthState } from "./useCreatureGrowth";

// This is the fix for the "two hamsters from one egg" bug: CreatureNest and
// CreatureHabitat used to each call the growth hook independently, which
// meant two separate instances both raced to check + award the same
// real-world accomplishment before either had updated hamster_last_check —
// double-counting it and sometimes double-hatching/double-evolving as a
// result.
//
// Wrap the part of the app that renders CreatureNest/CreatureHabitat in
// <CreatureGrowthProvider>, and have both of those components call
// useCreatureGrowth() from THIS file (not from useCreatureGrowth.ts
// directly). That guarantees there's only ever one growth-check running,
// with both components reading from the same shared state.

type CreatureGrowthValue = ReturnType<typeof useCreatureGrowthState>;

const CreatureGrowthContext = createContext<CreatureGrowthValue | null>(null);

export function CreatureGrowthProvider({ children }: { children: ReactNode }) {
  const value = useCreatureGrowthState();
  return <CreatureGrowthContext.Provider value={value}>{children}</CreatureGrowthContext.Provider>;
}

export function useCreatureGrowth() {
  const ctx = useContext(CreatureGrowthContext);
  if (!ctx) {
    throw new Error("useCreatureGrowth must be used within a <CreatureGrowthProvider>. Wrap the section of Dashboard.tsx that renders CreatureNest/CreatureHabitat.");
  }
  return ctx;
}
