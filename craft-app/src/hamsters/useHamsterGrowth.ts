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
//
// Stat training: every point-earning event also awards 1 training point to
// EVERY hamster in the collection (unlike evolution points, this includes
// final-stage hamsters — training is the progression loop that keeps going
// after evolution caps out). Points are spent permanently via allocateStat,
// clamped to the stage's cap (see STAT_CAPS in battle.ts).

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase"; // match your actual client path
import type { IconName } from "../components/Icon";
import { rollRandomHamster, rollTeenForm, rollFinalForm } from "./hamsters";
import type { Hamster, EvolutionStage } from "./hamsters";
import { rollPersonality, rollAbilities, TEEN_ABILITIES, FINAL_ABILITIES } from "./personalities";
import type { Personality } from "./personalities";
import { rollWildHamster, capFor } from "./battle";
import type { WildHamster, TrainedStats } from "./battle";

// NOTE: this hook does real Supabase reads/writes and hatches/evolves
// hamsters as a side effect. It must only ever be instantiated ONCE in the
// component tree — use HamsterGrowthContext.tsx's <HamsterGrowthProvider>
// + useHamsterGrowth() everywhere instead of calling this directly. Two
// independent instances (e.g. one per component) race against the same
// "last checked" timestamp and can double-award points, which is what
// caused two hamsters to hatch from a single accomplishment.

const POINTS = {
  bill_paid_on_time: 15,
  debt_payment_logged: 12,
  debt_paid_off: 40,
  savings_contribution: 8,
  tracker_log_entry: 6,
  daily_task_list_complete: 10,
  daily_focuses_complete: 20,
} as const;

// Chance, per point-earning event, that a wild hamster shows up. Only rolls
// at all if you already have a teen/final hamster capable of fighting, and
// never stacks a second encounter on top of one you haven't dealt with yet.
const WILD_ENCOUNTER_CHANCE = 0.18;

const TRAINED_STAT_COLUMNS: Record<keyof TrainedStats, string> = {
  hp: "trained_hp",
  attack: "trained_attack",
  defense: "trained_defense",
  speed: "trained_speed",
};

interface HamsterCollectionEntry {
  id: number;
  hamsterId: string;
  name: string | null;
  hatchedAt: string;
  source: string | null;
  personality: Personality | null;
  stage: EvolutionStage;
  evolutionPoints: number;
  teenFormId: string | null;
  finalFormId: string | null;
  abilities: string[];
  trainingPoints: number;
  trainedStats: TrainedStats;
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

export interface AllocateStatResult {
  ok: boolean;
  reason?: string;
}

export const SOURCE_LABELS: Record<string, { text: string; icon: IconName }> = {
  bill_paid_on_time: { text: "Bill paid on time", icon: "house" },
  debt_payment_logged: { text: "Debt payment", icon: "calculator-hearts" },
  debt_paid_off: { text: "Debt paid off", icon: "trophy" },
  savings_contribution: { text: "Savings contribution", icon: "piggy-bank" },
  tracker_log_entry: { text: "Tracker log", icon: "notebook-pen" },
  daily_task_list_complete: { text: "Full task list", icon: "clipboard-check" },
  daily_focuses_complete: { text: "All focuses completed", icon: "clipboard-check"},
};

export function useHamsterGrowthState() {
  const [points, setPoints] = useState(0);
  const [threshold, setThreshold] = useState(100);
  const [collection, setCollection] = useState<HamsterCollectionEntry[]>([]);
  const [recentPoints, setRecentPoints] = useState<PointsLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [justHatched, setJustHatched] = useState<Hamster | null>(null);
  const [justEvolved, setJustEvolved] = useState<JustEvolved | null>(null);
  const [wildEncounter, setWildEncounter] = useState<WildHamster | null>(null);

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
      .select(
        "id, hamster_id, name, hatched_at, source, personality, stage, evolution_points, teen_form_id, final_form_id, abilities, training_points, trained_hp, trained_attack, trained_defense, trained_speed"
      )
      .order("hatched_at", { ascending: false });
    setCollection(
      (data || []).map((r) => ({
        id: r.id,
        hamsterId: r.hamster_id,
        name: r.name ?? null,
        hatchedAt: r.hatched_at,
        source: r.source,
        personality: r.personality,
        stage: (r.stage as EvolutionStage) || "baby",
        evolutionPoints: Number(r.evolution_points) || 0,
        teenFormId: r.teen_form_id,
        finalFormId: r.final_form_id,
        abilities: r.abilities || [],
        trainingPoints: Number(r.training_points) || 0,
        trainedStats: {
          hp: Number(r.trained_hp) || 0,
          attack: Number(r.trained_attack) || 0,
          defense: Number(r.trained_defense) || 0,
          speed: Number(r.trained_speed) || 0,
        },
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

  // Awards training points to EVERY hamster in the collection, including
  // final-stage ones — unlike evolution points, training doesn't stop once
  // a hamster is fully evolved, it just means there's less room left under
  // the stage's cap. Points sit unspent until allocateStat is called.
  const growTrainingPoints = useCallback(async (amount: number) => {
    const { data } = await supabase.from("hamster_collection").select("id, training_points");
    for (const row of data || []) {
      const tp = (Number(row.training_points) || 0) + amount;
      await supabase.from("hamster_collection").update({ training_points: tp }).eq("id", row.id);
    }
  }, []);

  // Rolls a chance to spawn a wild hamster whenever an accomplishment is
  // earned — same trigger points as nest/evolution growth, so it feels like
  // part of the same loop instead of a separate grind. Only spawns if you
  // have at least one teen/final hamster to fight with, and never stacks a
  // second encounter on top of one that's still sitting unresolved.
  const checkWildEncounterSpawn = useCallback(async () => {
    const { data: pending } = await supabase
      .from("wild_encounter_pending")
      .select("hamster_id, stage, form_id, personality, abilities")
      .eq("id", 1)
      .maybeSingle();

    if (pending?.hamster_id) {
      // Already have one waiting — surface it locally if it's not already
      // in state (e.g. this is a fresh mount picking up where a previous
      // session left off) and stop, don't roll another.
      if (!wildEncounter) {
        setWildEncounter({
          hamsterId: pending.hamster_id,
          stage: pending.stage,
          formId: pending.form_id,
          image: "",
          personality: pending.personality,
          abilities: pending.abilities || [],
          stats: { hp: 0, attack: 0, defense: 0, speed: 0 }, // recomputed by battle.ts on use
        } as WildHamster);
      }
      return;
    }

    const { data: fighters } = await supabase
      .from("hamster_collection")
      .select("stage")
      .neq("stage", "baby")
      .limit(1);
    if (!fighters || fighters.length === 0) return;

    if (Math.random() >= WILD_ENCOUNTER_CHANCE) return;

    const { data: allNonBaby } = await supabase.from("hamster_collection").select("stage").neq("stage", "baby");
    const playerMaxStage: EvolutionStage = (allNonBaby || []).some((r) => r.stage === "final") ? "final" : "teen";

    const wild = rollWildHamster(playerMaxStage);
    await supabase.from("wild_encounter_pending").upsert({
      id: 1,
      hamster_id: wild.hamsterId,
      stage: wild.stage,
      form_id: wild.formId,
      personality: wild.personality,
      abilities: wild.abilities,
      spawned_at: new Date().toISOString(),
    });
    setWildEncounter(wild);
  }, [wildEncounter]);

  // Adds points, hatching as many times as needed if a jump crosses the
  // threshold more than once, and persists everything. Also grows every
  // existing hamster toward its next evolution at the same rate, and awards
  // training points to the whole collection.
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
      await growTrainingPoints(amount);
      await checkWildEncounterSpawn();

      await supabase.from("hamster_growth").upsert({ id: 1, points: newPoints, threshold });
      if (hatched || evolved) await refreshCollection();
      await refreshRecentPoints();
      return newPoints;
    },
    [threshold, growCollection, growTrainingPoints, refreshCollection, refreshRecentPoints, checkWildEncounterSpawn]
  );

  // The core check — call this whenever the app loads. It looks at what's
  // changed in your real tables since the last check and awards growth.
  const runGrowthCheck = useCallback(async () => {
    let { data: lastCheck } = await supabase
      .from("hamster_last_check")
      .select("last_bill_check, last_log_check, last_tracker_check, focus_all_done_awarded, debt_snapshot, tasks_all_done_awarded")
      .eq("id", 1)
      .maybeSingle();

    // If this row has never been created, every check silently no-ops
    // forever (bills, debts, savings, trackers — nothing ever gets
    // credited). Seed it with an old timestamp so already-paid-on-time
    // bills/logs since day one are picked up on this first run, instead
    // of only starting to count from whenever the row happens to exist.
    if (!lastCheck) {
      const seed = {
        id: 1,
        last_bill_check: "2000-01-01T00:00:00.000Z",
        last_log_check: "2000-01-01T00:00:00.000Z",
        last_tracker_check: "2000-01-01T00:00:00.000Z",
        focus_all_done_awarded: false,
        debt_snapshot: {},
        tasks_all_done_awarded: false,
      };
      await supabase.from("hamster_last_check").upsert(seed);
      lastCheck = seed;
    }

    let runningPoints = points;
    const now = new Date().toISOString();

    // 1. Bills paid on time — tracked with a per-payment "hamster_credited"
    // flag instead of a timestamp cursor. A timestamp cursor (paid_at >
    // last_bill_check) means that once a payment is checked once, editing
    // its due date afterward can never trigger a re-check — paid_at never
    // changes, so it stays permanently behind the cursor. That's why fixing
    // a due date silently did nothing unless you deleted and re-added the
    // bill (which produces a brand new payment row with a fresh paid_at).
    //
    // Instead: only stop looking at a payment once it's actually been
    // credited with on-time points. If it currently reads as late, it stays
    // eligible, so correcting the due date later will pick it up on the
    // very next check using whatever due_day is current at that point.
    const { data: newPayments } = await supabase
      .from("bill_payments")
      .select("id, paid, paid_at, due_day, month, year, bill_id, hamster_credited")
      .eq("paid", true)
      .or("hamster_credited.is.null,hamster_credited.eq.false");

    for (const p of newPayments || []) {
      if (!p.paid_at) continue;
      let dueDay = p.due_day;
      if (dueDay == null) {
        const { data: bill } = await supabase.from("bills").select("due_day").eq("id", p.bill_id).maybeSingle();
        dueDay = bill?.due_day;
      }
      if (dueDay != null) {
        // End of the due day, not the start — otherwise anything paid
        // after midnight on the actual due date (i.e. any normal payment
        // made during the day) reads as late.
        const dueDate = new Date(p.year, p.month - 1, dueDay, 23, 59, 59, 999);
        if (new Date(p.paid_at) <= dueDate) {
          runningPoints = await addPoints(POINTS.bill_paid_on_time, "bill_paid_on_time", runningPoints);
          // Lock in credit so this exact payment can never be double-counted.
          await supabase.from("bill_payments").update({ hamster_credited: true }).eq("id", p.id);
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

    // 6. Full focus list for the day completed
    const { data: dailyFocuses } = await supabase
    .from("focuses")
    .select("is_done");

const totalFocuses = (dailyFocuses || []).length;
const doneFocuses = (dailyFocuses || []).filter((f) => f.done).length;
const allFinished =  totalFocuses > 0 && doneFocuses === totalFocuses;
const focusAllDoneAwarded = lastCheck.focus_all_done_awarded;
 
if (allFinished && !focusAllDoneAwarded) {
  runningPoints = await addPoints(
    POINTS.daily_focuses_complete,
    "daily_focuses_complete",
    runningPoints
  );
  focusAllDoneAwarded = true;
} else if (!allDone) {
  focusAllDoneAwarded = false;
}

    setPoints(runningPoints);

    await supabase
      .from("hamster_last_check")
      .upsert({
        id: 1,
        last_bill_check: now,
        last_log_check: now,
        last_tracker_check: now,
        focus_all_done_awarded: focusAllDoneAwarded,
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

  // Manual refresh for the button on the Habitat page. Does the same
  // real-table growth check as the auto-triggers (mount + focus), plus an
  // unconditional refetch of the collection/points log afterward — the
  // auto-triggers only refetch those when addPoints actually hatched or
  // evolved something, which is normally fine but would make a manual
  // "refresh" button feel like it did nothing if you were staring right at
  // slightly-stale numbers from another tab/device. checkingRef guards
  // against double-firing if you tap it while a check is already running.
  const refresh = useCallback(async () => {
    if (checkingRef.current) return;
    setRefreshing(true);
    try {
      await checkForNewGrowth();
      await refreshCollection();
      await refreshRecentPoints();
    } finally {
      setRefreshing(false);
    }
  }, [checkForNewGrowth, refreshCollection, refreshRecentPoints]);

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

      const { data: pending } = await supabase
        .from("wild_encounter_pending")
        .select("hamster_id, stage, form_id, personality, abilities")
        .eq("id", 1)
        .maybeSingle();
      if (pending?.hamster_id) {
        setWildEncounter({
          hamsterId: pending.hamster_id,
          stage: pending.stage,
          formId: pending.form_id,
          image: "",
          personality: pending.personality,
          abilities: pending.abilities || [],
          stats: { hp: 0, attack: 0, defense: 0, speed: 0 },
        } as WildHamster);
      }

      setLoading(false);
    })();
  }, [refreshCollection, refreshRecentPoints]);

    useEffect(() => {
    if (!loading) checkForNewGrowth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  useEffect(() => {
    const onFocus = () => { if (!loading) checkForNewGrowth(); };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [loading, checkForNewGrowth]);

  const clearJustHatched = useCallback(() => setJustHatched(null), []);
  const clearJustEvolved = useCallback(() => setJustEvolved(null), []);

  // Call once a wild encounter has been fought (win, loss, or tamed) so a
  // new one can spawn later instead of the same one sitting there forever.
  const clearWildEncounter = useCallback(async () => {
    await supabase.from("wild_encounter_pending").upsert({
      id: 1,
      hamster_id: null,
      stage: null,
      form_id: null,
      personality: null,
      abilities: null,
      spawned_at: null,
    });
    setWildEncounter(null);
  }, []);

  // Renames a hamster. Empty/whitespace-only clears the name back to null
  // (falls back to the default label in the UI). Capped at 24 chars to keep
  // it readable in the small habitat cards.
  const renameHamster = useCallback(
    async (entryId: number, name: string) => {
      const trimmed = name.trim().slice(0, 24);
      await supabase.from("hamster_collection").update({ name: trimmed || null }).eq("id", entryId);
      await refreshCollection();
    },
    [refreshCollection]
  );

  // Spends one training point on one stat, permanently. Re-reads the row
  // fresh from Supabase first (rather than trusting local state) so a stat
  // cap can never be exceeded by a stale evolution stage. Returns a reason
  // string when it can't spend, for the UI to surface.
  const allocateStat = useCallback(
    async (entryId: number, stat: keyof TrainedStats): Promise<AllocateStatResult> => {
      const { data: row } = await supabase
        .from("hamster_collection")
        .select("stage, training_points, trained_hp, trained_attack, trained_defense, trained_speed")
        .eq("id", entryId)
        .maybeSingle();

      if (!row) return { ok: false, reason: "Hamster not found" };

      const stage = (row.stage as EvolutionStage) || "baby";
      const unspent = Number(row.training_points) || 0;
      if (unspent <= 0) return { ok: false, reason: "No training points to spend yet" };

      const column = TRAINED_STAT_COLUMNS[stat];
      const current = Number((row as Record<string, unknown>)[column]) || 0;
      const cap = capFor(stage, stat);
      if (current >= cap) return { ok: false, reason: `Maxed out for ${stage} stage — evolve to raise the cap` };

      await supabase
        .from("hamster_collection")
        .update({ [column]: current + 1, training_points: unspent - 1 })
        .eq("id", entryId);

      await refreshCollection();
      return { ok: true };
    },
    [refreshCollection]
  );

  return {
    loading,
    refreshing,
    refresh,
    points,
    threshold,
    progressPct: Math.min(100, Math.round((points / threshold) * 100)),
    collection,
    recentPoints,
    justHatched,
    clearJustHatched,
    justEvolved,
    clearJustEvolved,
    wildEncounter,
    clearWildEncounter,
    renameHamster,
    allocateStat,
  };
}