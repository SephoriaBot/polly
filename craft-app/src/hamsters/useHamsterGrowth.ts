// useHamsterGrowth.ts
// Fully self-contained — does NOT touch Wallet.tsx at all. Instead, it
// checks your existing tables (bill_payments, debts, daily_log) each time
// it loads and figures out what's new since the last check, then adds
// growth points for it. Hatches a random hamster when the threshold hits.
//
// Evolution: every hamster in the collection that hasn't reached its final
// form grows toward its next stage (baby -> teen -> final) using the exact
// same point sources and the exact same threshold as the nest hatch. Old
// traits/abilities are never removed — evolving only rolls a random
// teen/final form (1 of 20, independent of the starter and of each other)
// and appends 1-2 new combat abilities on top.

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase"; // match your actual client path
import type { IconName } from "../components/Icon";
import { rollRandomHamster, rollTeenForm, rollFinalForm } from "./hamsters";
import type { Hamster, EvolutionStage } from "./hamsters";
import { rollPersonality, rollAbilities, TEEN_ABILITIES, FINAL_ABILITIES } from "./personalities";
import type { Personality } from "./personalities";

// NOTE: this hook does real Supabase reads/writes and hatches/evolves
// hamsters as a side effect. It must only ever be instantiated ONCE in the
// component tree — use HamsterGrowthContext.tsx's <HamsterGrowthProvider>
// + useHamsterGrowth() everywhere instead of calling this directly. Two
// independent instances (e.g. one per component) race against the same
// "last checked" timestamp and can double-award points, which is what
// caused two hamsters to hatch from a single accomplishment.

const POINTS = {
  bill_paid_on_time: 10,
  debt_payment_logged: 12,
  debt_paid_off: 40,
  savings_contribution: 8,
  tracker_log_entry: 6,
  daily_task_list_complete: 20,
} as const;

interface HamsterCollectionEntry {
  id: number;
  hamsterId: string;
  hatchedAt: string;
  source: string | null;
  personality: Personality | null;
  stage: EvolutionStage;
  evolutionPoints: number;
  teenFormId: string | null;
  finalFormId: string | null;
  abilities: string[];
}

export interface JustEvolved {
  entryId: number;
  hamsterId: string;
  stage: EvolutionStage; // the stage it evolved INTO
  formId: string;
  newAbilities: string[];
}

export interface PointsLogEntry {
  id: number;
  source: string;
  amount: number;
  createdAt: string;
}

export const SOURCE_LABELS: Record<string, { text: string; icon: IconName }> = {
  bill_paid_on_time: { text: "Bill paid on time", icon: "house" },
  debt_payment_logged: { text: "Debt payment", icon: "calculator-hearts" },
  debt_paid_off: { text: "Debt paid off", icon: "trophy" },
  savings_contribution: { text: "Savings contribution", icon: "piggy-bank" },
  tracker_log_entry: { text: "Tracker log", icon: "notebook-pen" },
  daily_task_list_complete: { text: "Full task list", icon: "clipboard-check" },
};

export function useHamsterGrowthState() {
  const [points, setPoints] = useState(0);
  const [threshold, setThreshold] = useState(100);
  const [collection, setCollection] = useState<HamsterCollectionEntry[]>([]);
  const [recentPoints, setRecentPoints] = useState<PointsLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [justHatched, setJustHatched] = useState<Hamster | null>(null);
  const [justEvolved, setJustEvolved] = useState<JustEvolved | null>(null);

  const refreshRecentPoints = useCallback(async () => {
    const { data } = await supabase
      .from("hamster_points_log")
      .select("id, source, amount, created_at")
      .order("created_at", { ascending: false })
      .limit(15);
    setRecentPoints(
      (data || []).map((r) => ({ id: r.id, source: r.source, amount: Number(r.amount), createdAt: r.created_at }))
    );
  }, []);

  const refreshCollection = useCallback(async () => {
    const { data } = await supabase
      .from("hamster_collection")
      .select("id, hamster_id, hatched_at, source, personality, stage, evolution_points, teen_form_id, final_form_id, abilities")
      .order("hatched_at", { ascending: false });
    setCollection(
      (data || []).map((r) => ({
        id: r.id,
        hamsterId: r.hamster_id,
        hatchedAt: r.hatched_at,
        source: r.source,
        personality: r.personality,
        stage: (r.stage as EvolutionStage) || "baby",
        evolutionPoints: Number(r.evolution_points) || 0,
        teenFormId: r.teen_form_id,
        finalFormId: r.final_form_id,
        abilities: r.abilities || [],
      }))
    );
  }, []);

  // Grows every not-yet-final hamster by the same amount that was just
  // earned, at the same threshold as the nest. Evolves any that cross it.
  const growCollection = useCallback(
    async (amount: number) => {
      const { data } = await supabase
        .from("hamster_collection")
        .select("id, hamster_id, stage, evolution_points, teen_form_id, final_form_id, abilities")
        .neq("stage", "final");

      let anyEvolved = false;

      for (const row of data || []) {
        let pts = (Number(row.evolution_points) || 0) + amount;
        let stage: EvolutionStage = (row.stage as EvolutionStage) || "baby";
        let teenFormId: string | null = row.teen_form_id;
        let finalFormId: string | null = row.final_form_id;
        let abilities: string[] = row.abilities || [];
        let evolvedThisRow = false;
        let lastNewAbilities: string[] = [];

        while (pts >= threshold && stage !== "final") {
          pts -= threshold;
          if (stage === "baby") {
            stage = "teen";
            teenFormId = rollTeenForm().id;
            lastNewAbilities = rollAbilities(TEEN_ABILITIES, 2, abilities);
          } else {
            stage = "final";
            finalFormId = rollFinalForm().id;
            lastNewAbilities = rollAbilities(FINAL_ABILITIES, 2, abilities);
          }
          abilities = [...abilities, ...lastNewAbilities];
          evolvedThisRow = true;
        }

        await supabase
          .from("hamster_collection")
          .update({
            stage,
            evolution_points: pts,
            teen_form_id: teenFormId,
            final_form_id: finalFormId,
            abilities,
          })
          .eq("id", row.id);

        if (evolvedThisRow) {
          anyEvolved = true;
          setJustEvolved({
            entryId: row.id,
            hamsterId: row.hamster_id,
            stage,
            formId: stage === "teen" ? teenFormId! : finalFormId!,
            newAbilities: lastNewAbilities,
          });
        }
      }

      return anyEvolved;
    },
    [threshold]
  );

  // Adds points, hatching as many times as needed if a jump crosses the
  // threshold more than once, and persists everything. Also grows every
  // existing hamster toward its next evolution at the same rate.
  const addPoints = useCallback(
    async (amount: number, source: string, currentPoints: number) => {
      let newPoints = currentPoints + amount;
      let hatched = false;

      await supabase.from("hamster_points_log").insert({ source, amount });

      while (newPoints >= threshold) {
        const h = rollRandomHamster();
        const personality = rollPersonality();
        newPoints -= threshold;
        await supabase.from("hamster_collection").insert({ hamster_id: h.id, source, personality, stage: "baby", evolution_points: 0, abilities: [] });
        setJustHatched(h);
        hatched = true;
      }

      const evolved = await growCollection(amount);

      await supabase.from("hamster_growth").upsert({ id: 1, points: newPoints, threshold });
      if (hatched || evolved) await refreshCollection();
      await refreshRecentPoints();
      return newPoints;
    },
    [threshold, growCollection, refreshCollection, refreshRecentPoints]
  );

  // The core check — call this whenever the app loads. It looks at what's
  // changed in your real tables since the last check and awards growth.
  const runGrowthCheck = useCallback(async () => {
    const { data: lastCheck } = await supabase
      .from("hamster_last_check")
      .select("last_bill_check, last_log_check, last_tracker_check, debt_snapshot, tasks_all_done_awarded")
      .eq("id", 1)
      .maybeSingle();

    if (!lastCheck) return;

    let runningPoints = points;
    const now = new Date().toISOString();

    // 1. Bills paid on time since last check
    const { data: newPayments } = await supabase
      .from("bill_payments")
      .select("paid, paid_at, due_day, month, year, bill_id")
      .eq("paid", true)
      .gt("paid_at", lastCheck.last_bill_check);

    for (const p of newPayments || []) {
      if (!p.paid_at) continue;
      let dueDay = p.due_day;
      if (dueDay == null) {
        const { data: bill } = await supabase.from("bills").select("due_day").eq("id", p.bill_id).maybeSingle();
        dueDay = bill?.due_day;
      }
      if (dueDay != null) {
        const dueDate = new Date(p.year, p.month - 1, dueDay);
        if (new Date(p.paid_at) <= dueDate) {
          runningPoints = await addPoints(POINTS.bill_paid_on_time, "bill_paid_on_time", runningPoints);
        }
      }
    }

    // 2. Debt changes: payments (balance dropped) and payoffs, vs last snapshot
    const { data: debts } = await supabase.from("debts").select("id, balance, deferred, paid_off");
    const prevSnapshot: Record<string, { balance: number; paid_off: boolean }> = lastCheck.debt_snapshot || {};
    const newSnapshot: Record<string, { balance: number; paid_off: boolean }> = {};

    for (const d of debts || []) {
      const key = String(d.id);
      newSnapshot[key] = { balance: Number(d.balance) || 0, paid_off: !!d.paid_off };
      const prev = prevSnapshot[key];
      if (!prev) continue; // first time seeing this debt, no comparison yet

      if (!prev.paid_off && d.paid_off) {
        runningPoints = await addPoints(POINTS.debt_paid_off, "debt_paid_off", runningPoints);
      } else if (!d.deferred && !d.paid_off && Number(d.balance) < prev.balance) {
        runningPoints = await addPoints(POINTS.debt_payment_logged, "debt_payment_logged", runningPoints);
      }
    }

    // 3. Savings/buffer contributions logged since last check
    const { data: newLogs } = await supabase
      .from("daily_log")
      .select("buffer_allocation, created_at")
      .gt("created_at", lastCheck.last_log_check);

    for (const log of newLogs || []) {
      if ((Number(log.buffer_allocation) || 0) > 0) {
        runningPoints = await addPoints(POINTS.savings_contribution, "savings_contribution", runningPoints);
      }
    }

    // 4. New tracker log entries (sleep/mood/weight/etc) since last check.
    // Assumes tracker_logs has a created_at column (standard Supabase default) —
    // if your table doesn't, tell me and I'll switch this to compare on log_date instead.
    const { data: newTrackerLogs } = await supabase
      .from("tracker_logs")
      .select("id, created_at")
      .gt("created_at", lastCheck.last_tracker_check);

    for (const _ of newTrackerLogs || []) {
      runningPoints = await addPoints(POINTS.tracker_log_entry, "tracker_log_entry", runningPoints);
    }

    // 5. Full daily task list completed (daily_tasks table, no date column —
    // "done" just re-arms once a task gets unchecked or Reset is hit).
    const { data: dailyTasks } = await supabase.from("daily_tasks").select("done");
    const total = (dailyTasks || []).length;
    const doneCount = (dailyTasks || []).filter((t) => t.done).length;
    const allDone = total > 0 && doneCount === total;
    let tasksAllDoneAwarded = lastCheck.tasks_all_done_awarded;

    if (allDone && !tasksAllDoneAwarded) {
      runningPoints = await addPoints(POINTS.daily_task_list_complete, "daily_task_list_complete", runningPoints);
      tasksAllDoneAwarded = true;
    } else if (!allDone) {
      tasksAllDoneAwarded = false;
    }

    setPoints(runningPoints);

    await supabase
      .from("hamster_last_check")
      .upsert({
        id: 1,
        last_bill_check: now,
        last_log_check: now,
        last_tracker_check: now,
        debt_snapshot: newSnapshot,
        tasks_all_done_awarded: tasksAllDoneAwarded,
      });
  }, [points, addPoints]);

  // Guards against overlapping/duplicate calls (e.g. React StrictMode's
  // dev-mode double-invoke, or an accidental extra mount) so a single
  // accomplishment can never be counted — and therefore hatched/evolved —
  // twice. The structural fix is using HamsterGrowthContext so there's only
  // ever one instance of this hook; this ref is a cheap backstop on top.
  const checkingRef = useRef(false);
  const checkForNewGrowth = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    try {
      await runGrowthCheck();
    } finally {
      checkingRef.current = false;
    }
  }, [runGrowthCheck]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: growthRow } = await supabase.from("hamster_growth").select("points, threshold").eq("id", 1).maybeSingle();
      if (growthRow) {
        setPoints(Number(growthRow.points) || 0);
        setThreshold(Number(growthRow.threshold) || 100);
      } else {
        await supabase.from("hamster_growth").upsert({ id: 1, points: 0, threshold: 100 });
      }
      await refreshCollection();
      await refreshRecentPoints();
      setLoading(false);
    })();
  }, [refreshCollection, refreshRecentPoints]);

  useEffect(() => {
    if (!loading) checkForNewGrowth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const clearJustHatched = useCallback(() => setJustHatched(null), []);
  const clearJustEvolved = useCallback(() => setJustEvolved(null), []);

  return {
    loading,
    points,
    threshold,
    progressPct: Math.min(100, Math.round((points / threshold) * 100)),
    collection,
    recentPoints,
    justHatched,
    clearJustHatched,
    justEvolved,
    clearJustEvolved,
  };
}
