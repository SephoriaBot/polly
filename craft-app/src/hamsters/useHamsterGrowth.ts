// useHamsterGrowth.ts
// Fully self-contained — does NOT touch Wallet.tsx at all. Instead, it
// checks your existing tables (bill_payments, debts, daily_log) each time
// it loads and figures out what's new since the last check, then adds
// growth points for it. Hatches a random hamster when the threshold hits.
//
// Daily accomplishments (bills, chores, tasks, etc.) now ONLY move the egg
// toward hatching — see addPoints below. They no longer touch evolution,
// stat training, or the habitat shop currency; those all come exclusively
// from winning battles (see awardBattleWin and WildEncounter.tsx).
//
// Evolution: no longer point/threshold-based. A hamster is eligible to
// evolve (baby -> teen -> final) once every one of its trained stats is
// maxed for its current stage (see isMaxedOut in battle.ts) — i.e. it has
// to actually win enough fights and spend the stat points on training
// before it can evolve. evolveHamster() below performs the evolution once
// eligible. Old traits/abilities are never removed — evolving only rolls a
// random teen/final form (1 of 20, independent of the starter and of each
// other) and appends 1-2 new combat abilities on top.
//
// Stat training ("TP"): earned only by winning battles, credited to the
// specific hamster that fought (see awardBattleWin). Spent permanently via
// allocateStat, clamped to the stage's cap (see STAT_CAPS in battle.ts).

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase"; // match your actual client path
import type { IconName } from "../components/Icon";
import { rollRandomHamster, rollTeenForm, rollFinalForm } from "./hamsters";
import type { Hamster, EvolutionStage } from "./hamsters";
import { rollPersonality, rollAbilities, BABY_ABILITIES, TEEN_ABILITIES, FINAL_ABILITIES } from "./personalities";
import type { Personality } from "./personalities";
import { rollWildHamster, capFor, isMaxedOut, BATTLE_REWARDS } from "./battle";
import type { WildHamster, TrainedStats } from "./battle";

// NOTE: this hook does real Supabase reads/writes and hatches/evolves
// hamsters as a side effect. It must only ever be instantiated ONCE in the
// component tree — use HamsterGrowthContext.tsx's <HamsterGrowthProvider>
// + useHamsterGrowth() everywhere instead of calling this directly. Two
// independent instances (e.g. one per component) race against the same
// "last checked" timestamp and can double-award points, which is what
// caused two hamsters to hatch from a single accomplishment.

const POINTS = {
  bill_paid_on_time: 20,
  debt_payment_logged: 10,
  debt_paid_off: 40,
  savings_contribution: 8,
  tracker_log_entry: 4,
  daily_task_list_complete: 3,
  daily_focuses_complete: 7,
  appointment_attended: 10,
  goal_step_completed: 2,
  chore_completed: 3,
  life_event_item_completed: 2,
  grocery_list_completed: 5,
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
  spent?: number;
}

export const SOURCE_LABELS: Record<string, { text: string; icon: IconName }> = {
  bill_paid_on_time: { text: "Bill paid on time", icon: "house" },
  debt_payment_logged: { text: "Debt payment", icon: "calculator-hearts" },
  debt_paid_off: { text: "Debt paid off", icon: "trophy" },
  savings_contribution: { text: "Savings contribution", icon: "piggy-bank" },
  tracker_log_entry: { text: "Tracker log", icon: "notebook-pen" },
  daily_task_list_complete: { text: "Full task list", icon: "clipboard-check" },
    daily_focuses_complete: { text: "All focuses completed", icon: "clipboard-check"},
  appointment_attended: { text: "Appointment attended", icon: "notebook-pen" },
  goal_step_completed: { text: "Goal step completed", icon: "clipboard-check" },
  chore_completed: { text: "Chore done", icon: "house" },
  life_event_item_completed: { text: "Life event step", icon: "clipboard-check" },
  grocery_list_completed: { text: "Grocery list finished", icon: "notebook-pen" },
  battle_win: { text: "Battle won", icon: "trophy" },
};

export function useHamsterGrowthState() {
  const [points, setPoints] = useState(0);
  const [threshold, setThreshold] = useState(100);
  // Separate currency from `points` — `points` drives hatching/evolution
  // via the threshold above; `decorPoints` is spent unlocking shelf items
  // in the Habitat and never touches the hatch balance. Both are credited
  // together by the same accomplishments (see addPoints), but spending one
  // has zero effect on the other.
  const [decorPoints, setDecorPoints] = useState(0);
  const [collection, setCollection] = useState<HamsterCollectionEntry[]>([]);
  const [recentPoints, setRecentPoints] = useState<PointsLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [justHatched, setJustHatched] = useState<Hamster | null>(null);
  const [justEvolved, setJustEvolved] = useState<JustEvolved | null>(null);
  const [wildEncounter, setWildEncounter] = useState<WildHamster | null>(null);

  // Surfaced Supabase errors from the writes that guard against double
  // counting (credit flags, awarded flags, points/threshold persistence,
  // hatch inserts). These are the writes where a silent failure means "this
  // accomplishment looks new again next load" — i.e. the exact bug that
  // handed out 15 free hamsters from a column-name mismatch. Since there's
  // no console access on mobile, this state is the only way to see it: the
  // Habitat page should render a small banner when it's non-null.
  const [growthError, setGrowthError] = useState<string | null>(null);
  const clearGrowthError = useCallback(() => setGrowthError(null), []);

  // Logs + surfaces a Supabase error for a labeled write. Returns true if
  // there WAS an error (so callers can `if (reportError(...)) return/continue;`
  // to bail instead of proceeding as if the write succeeded).
  const reportError = useCallback((label: string, error: { message?: string } | null) => {
    if (!error) return false;
    console.error(`[useHamsterGrowth] ${label} failed:`, error);
    setGrowthError(`${label} failed: ${error.message || "unknown error"}`);
    return true;
  }, []);

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

  // Rolls a chance to spawn a wild hamster whenever an accomplishment is
  // earned — battling is still tied to the same daily-activity trigger, it
  // just no longer hands out evolution/training/shop points directly.
  // Spawns as long as you have at least one hatched hamster to fight with
  // (babies included — see canBattle in battle.ts), and never stacks a
  // second encounter on top of one that's still sitting unresolved.
  const checkWildEncounterSpawn = useCallback(async () => {
    const { data: pending } = await supabase
      .from("wild_encounter_pending")
      .select("hamster_id, stage, form_id, personality, abilities")
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

    const { data: fighters } = await supabase.from("hamster_collection").select("stage").limit(1);
    if (!fighters || fighters.length === 0) return;

    if (Math.random() >= WILD_ENCOUNTER_CHANCE) return;

    const { data: allHamsters } = await supabase.from("hamster_collection").select("stage");
    const stages = (allHamsters || []).map((r) => r.stage as EvolutionStage);
    const playerMaxStage: EvolutionStage = stages.includes("final") ? "final" : stages.includes("teen") ? "teen" : "baby";

    const wild = rollWildHamster(playerMaxStage);
    const { error } = await supabase.from("wild_encounter_pending").upsert(
      {
        hamster_id: wild.hamsterId,
        stage: wild.stage,
        form_id: wild.formId,
        personality: wild.personality,
        abilities: wild.abilities,
        spawned_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (reportError("Save wild encounter", error)) return;
    setWildEncounter(wild);
  }, [wildEncounter, reportError]);

  // Adds points, hatching as many times as needed if a jump crosses the
  // threshold more than once, and persists everything. This is now the
  // ONLY thing daily accomplishments do — no more evolution growth,
  // training points, or decor currency from here. Those all come from
  // winning battles (see awardBattleWin below).
  const addPoints = useCallback(
    async (amount: number, source: string, currentPoints: number) => {
      let newPoints = currentPoints + amount;
      let hatched = false;

      const { error: logError } = await supabase.from("hamster_points_log").insert({ source, amount });
      reportError("Log points", logError);

      while (newPoints >= threshold) {
        const h = rollRandomHamster();
        const personality = rollPersonality();
        const abilities = rollAbilities(BABY_ABILITIES, 1);
        const pointsBeforeHatch = newPoints;
        newPoints -= threshold;
        const { error: hatchError } = await supabase
          .from("hamster_collection")
          .insert({
            hamster_id: h.id,
            source,
            personality,
            stage: "baby",
            evolution_points: 0,
            abilities,
            hatched_at: new Date().toISOString(),
            training_points: 0,
            trained_hp: 0,
            trained_attack: 0,
            trained_defense: 0,
            trained_speed: 0,
          });

        // If the insert failed, no hamster actually exists to show for the
        // points we're about to spend. Put the points back and stop trying
        // to hatch, rather than silently draining points into nothing.
        if (reportError("Hatch hamster", hatchError)) {
          newPoints = pointsBeforeHatch;
          break;
        }

        setJustHatched(h);
        hatched = true;
      }

      // Still rolls a chance at a wild encounter on every accomplishment —
      // that trigger is about pacing/frequency, not about paying out
      // points, so it stays here even though the points it used to grant
      // don't exist anymore.
      await checkWildEncounterSpawn();

      const { error: growthSaveError } = await supabase
        .from("hamster_growth")
        .upsert({ points: newPoints, threshold }, { onConflict: "user_id" });

      // This is THE write that caused the original bug: if points/threshold
      // don't persist, the next load re-reads the old (lower) points value,
      // and any progress this call made toward a hatch effectively repeats
      // itself on the next check. Surface it loudly rather than pressing on
      // as if newPoints is safely saved.
      reportError("Save points/threshold", growthSaveError);

      if (hatched) await refreshCollection();
      await refreshRecentPoints();
      return newPoints;
    },
    [threshold, refreshCollection, refreshRecentPoints, checkWildEncounterSpawn, reportError]
  );

  // Credits stat points (training_points) to the specific hamster that won
  // a battle, plus habitat shop currency to the shared decor pool — the
  // only two places evolution/shop progress can come from now. Losses
  // never call this. Rewards scale with how tough the opponent was (see
  // BATTLE_REWARDS in battle.ts).
  const awardBattleWin = useCallback(
    async (entryId: number, opponentStage: "teen" | "final") => {
      const reward = BATTLE_REWARDS[opponentStage];

      const { data: row } = await supabase
        .from("hamster_collection")
        .select("training_points")
        .eq("id", entryId)
        .maybeSingle();
      if (!row) return { ok: false as const, statPoints: 0, shopPoints: 0, reason: "Hamster not found" };

      const newTP = (Number(row.training_points) || 0) + reward.statPoints;
      const { error: tpError } = await supabase
        .from("hamster_collection")
        .update({ training_points: newTP })
        .eq("id", entryId);
      if (reportError("Award battle stat points", tpError)) {
        return { ok: false as const, statPoints: 0, shopPoints: 0, reason: tpError.message || "Save failed" };
      }

      const { data: decorRow } = await supabase.from("habitat_points").select("points").maybeSingle();
      const newDecorPoints = (Number(decorRow?.points) || 0) + reward.shopPoints;
      const { error: decorError } = await supabase
        .from("habitat_points")
        .upsert({ points: newDecorPoints }, { onConflict: "user_id" });
      if (!reportError("Award battle shop points", decorError)) {
        setDecorPoints(newDecorPoints);
      }

      await supabase.from("hamster_points_log").insert({ source: "battle_win", amount: reward.statPoints });

      await refreshCollection();
      await refreshRecentPoints();
      return { ok: true as const, statPoints: reward.statPoints, shopPoints: reward.shopPoints };
    },
    [refreshCollection, refreshRecentPoints, reportError]
  );

  // Evolves a hamster (baby -> teen -> final) once every trained stat is
  // maxed for its current stage. Re-reads fresh from Supabase rather than
  // trusting local state so a stale `collection` entry can't slip an
  // ineligible hamster through. Old abilities are kept; evolving rolls a
  // random new form and appends 1-2 new combat abilities, same as before.
  const evolveHamster = useCallback(
    async (entryId: number) => {
      const { data: row } = await supabase
        .from("hamster_collection")
        .select("id, hamster_id, stage, teen_form_id, final_form_id, abilities, trained_hp, trained_attack, trained_defense, trained_speed")
        .eq("id", entryId)
        .maybeSingle();
      if (!row) return { ok: false, reason: "Hamster not found" };

      const stage = (row.stage as EvolutionStage) || "baby";
      if (stage === "final") return { ok: false, reason: "Already at final form" };

      const trained: TrainedStats = {
        hp: Number(row.trained_hp) || 0,
        attack: Number(row.trained_attack) || 0,
        defense: Number(row.trained_defense) || 0,
        speed: Number(row.trained_speed) || 0,
      };
      if (!isMaxedOut(stage, trained)) {
        return { ok: false, reason: "Stats aren't maxed out yet — win more battles and train" };
      }

      let newStage: EvolutionStage;
      let teenFormId: string | null = row.teen_form_id;
      let finalFormId: string | null = row.final_form_id;
      let newAbilities: string[];
      const existingAbilities: string[] = row.abilities || [];

      if (stage === "baby") {
        newStage = "teen";
        teenFormId = rollTeenForm().id;
        newAbilities = rollAbilities(TEEN_ABILITIES, 2, existingAbilities);
      } else {
        newStage = "final";
        finalFormId = rollFinalForm().id;
        newAbilities = rollAbilities(FINAL_ABILITIES, 2, existingAbilities);
      }
      const abilities = [...existingAbilities, ...newAbilities];

      const { error } = await supabase
        .from("hamster_collection")
        .update({ stage: newStage, teen_form_id: teenFormId, final_form_id: finalFormId, abilities })
        .eq("id", entryId);
      if (error) return { ok: false, reason: error.message || "Save failed" };

      setJustEvolved({
        entryId,
        hamsterId: row.hamster_id,
        stage: newStage,
        formId: newStage === "teen" ? teenFormId! : finalFormId!,
        newAbilities,
      });
      await refreshCollection();
      return { ok: true };
    },
    [refreshCollection]
  );

  // The core check — call this whenever the app loads. It looks at what's
  // changed in your real tables since the last check and awards growth.
  const runGrowthCheck = useCallback(async () => {
    let { data: lastCheck } = await supabase
      .from("hamster_last_check")
      .select(
        "last_bill_check, last_log_check, last_tracker_check, focus_all_done_awarded, debt_snapshot, tasks_all_done_awarded, last_chore_check, grocery_snapshot"
      )
      .maybeSingle();

    // If this row has never been created, every check silently no-ops
    // forever (bills, debts, savings, trackers — nothing ever gets
    // credited). Seed it with an old timestamp so already-paid-on-time
    // bills/logs since day one are picked up on this first run, instead
    // of only starting to count from whenever the row happens to exist.
    if (!lastCheck) {
      const seed = {
        last_bill_check: "2000-01-01T00:00:00.000Z",
        last_log_check: "2000-01-01T00:00:00.000Z",
        last_tracker_check: "2000-01-01T00:00:00.000Z",
        focus_all_done_awarded: false,
        debt_snapshot: {},
        tasks_all_done_awarded: false,
        last_chore_check: "2000-01-01T00:00:00.000Z",
        grocery_snapshot: {},
      };
      const { error: seedError } = await supabase
        .from("hamster_last_check")
        .upsert(seed, { onConflict: "user_id" });
      if (reportError("Seed hamster_last_check", seedError)) return;
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
          // If THIS write fails, the payment still looks uncredited next
          // check even though points were just awarded for it — which is
          // exactly how a schema mismatch here mints duplicate hamsters. So
          // surface it loudly instead of moving on quietly.
          const { error: creditError } = await supabase
            .from("bill_payments")
            .update({ hamster_credited: true })
            .eq("id", p.id);
          reportError(`Lock credit for bill payment #${p.id}`, creditError);
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
    const { data: dailyFocuses } = await supabase.from("focuses").select("completed");

    const totalFocuses = (dailyFocuses || []).length;
    const doneFocuses = (dailyFocuses || []).filter((f) => f.completed).length;
    const allFinished = totalFocuses > 0 && doneFocuses === totalFocuses;
    let focusAllDoneAwarded = lastCheck.focus_all_done_awarded;

    if (allFinished && !focusAllDoneAwarded) {
      runningPoints = await addPoints(
        POINTS.daily_focuses_complete,
        "daily_focuses_complete",
        runningPoints
      );
      focusAllDoneAwarded = true;
    } else if (!allFinished) {
      focusAllDoneAwarded = false;
    }

        // 7. Appointments marked attended — credited flag works the same way
    // as bill_payments, so re-checking an appointment can't double-credit.
    const { data: attendedAppts } = await supabase
      .from("appointments")
      .select("id, hamster_credited")
      .eq("attended", true)
      .or("hamster_credited.is.null,hamster_credited.eq.false");

    for (const appt of attendedAppts || []) {
      runningPoints = await addPoints(POINTS.appointment_attended, "appointment_attended", runningPoints);
      const { error: creditError } = await supabase
        .from("appointments")
        .update({ hamster_credited: true })
        .eq("id", appt.id);
      reportError(`Lock credit for appointment #${appt.id}`, creditError);
    }

    // 8. Goal steps checked off — same credited-flag pattern as bills/
    // appointments so unchecking-then-rechecking the SAME step can't
    // double-award, but a genuinely new step always can.
    const { data: doneSteps } = await supabase
      .from("goal_steps")
      .select("id, hamster_credited")
      .eq("done", true)
      .or("hamster_credited.is.null,hamster_credited.eq.false");

    for (const step of doneSteps || []) {
      runningPoints = await addPoints(POINTS.goal_step_completed, "goal_step_completed", runningPoints);
      const { error: creditError } = await supabase
        .from("goal_steps")
        .update({ hamster_credited: true })
        .eq("id", step.id);
      reportError(`Lock credit for goal step #${step.id}`, creditError);
    }

    // 9. Life event checklist items checked off — same pattern.
    const { data: doneLifeItems } = await supabase
      .from("life_event_items")
      .select("id, hamster_credited")
      .eq("done", true)
      .or("hamster_credited.is.null,hamster_credited.eq.false");

    for (const item of doneLifeItems || []) {
      runningPoints = await addPoints(POINTS.life_event_item_completed, "life_event_item_completed", runningPoints);
      const { error: creditError } = await supabase
        .from("life_event_items")
        .update({ hamster_credited: true })
        .eq("id", item.id);
      reportError(`Lock credit for life event item #${item.id}`, creditError);
    }

    // 10. Chores marked done — chores don't have a settle-able "done" flag,
    // just a `last_done_at` that gets bumped every time you complete a
    // recurring chore, so this is a cursor comparison like the savings/
    // tracker checks above rather than a credited-flag pattern.
    const { data: doneChores } = await supabase
      .from("chores")
      .select("id, last_done_at")
      .gt("last_done_at", lastCheck.last_chore_check);

    for (const _ of doneChores || []) {
      runningPoints = await addPoints(POINTS.chore_completed, "chore_completed", runningPoints);
    }

    // 11. Grocery lists fully checked off — tracked as a per-list snapshot
    // keyed by list_id (a real FK now, added specifically so this can't be
    // fooled by deleting a finished list and creating a new one with the
    // same name — that new list gets a fresh id and starts with a clean
    // slate) like the debt balance snapshot above: award once when a list
    // flips from "not fully checked" to "fully checked", and re-arm if
    // it's no longer fully checked so finishing it again later can re-award.
    const { data: groceryItems } = await supabase.from("grocery_items").select("list_id, checked");
    const prevGrocery: Record<string, boolean> = lastCheck.grocery_snapshot || {};
    const newGrocery: Record<string, boolean> = {};
    const byList: Record<string, { total: number; checked: number }> = {};

    for (const item of groceryItems || []) {
      if (!item.list_id) continue; // pre-migration row that never got backfilled
      const key = item.list_id;
      if (!byList[key]) byList[key] = { total: 0, checked: 0 };
      byList[key].total += 1;
      if (item.checked) byList[key].checked += 1;
    }

    for (const [listId, counts] of Object.entries(byList)) {
      const fullyChecked = counts.total > 0 && counts.checked === counts.total;
      newGrocery[listId] = fullyChecked;
      if (fullyChecked && !prevGrocery[listId]) {
        runningPoints = await addPoints(POINTS.grocery_list_completed, "grocery_list_completed", runningPoints);
      }
    }

    setPoints(runningPoints);

    const { error: finalSaveError } = await supabase
      .from("hamster_last_check")
      .upsert(
        {
          last_bill_check: now,
          last_log_check: now,
          last_tracker_check: now,
          focus_all_done_awarded: focusAllDoneAwarded,
          debt_snapshot: newSnapshot,
          tasks_all_done_awarded: tasksAllDoneAwarded,
          last_chore_check: now,
          grocery_snapshot: newGrocery,
        },
        { onConflict: "user_id" }
      );

    // The other write that caused the original bug: if the awarded flags
    // and debt snapshot don't persist here, every "all done" state looks
    // fresh again on the next load and gets re-credited. Surface it.
    reportError("Save last-check state", finalSaveError);
  }, [points, addPoints, reportError]);

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
      const { data: growthRow } = await supabase.from("hamster_growth").select("points, threshold").maybeSingle();
      if (growthRow) {
        setPoints(Number(growthRow.points) || 0);
        setThreshold(Number(growthRow.threshold) || 100);
      } else {
        const { error } = await supabase
          .from("hamster_growth")
          .upsert({ points: 0, threshold: 100 }, { onConflict: "user_id" });
        reportError("Initialize hamster_growth", error);
      }

      const { data: decorRow } = await supabase.from("habitat_points").select("points").maybeSingle();
      if (decorRow) {
        setDecorPoints(Number(decorRow.points) || 0);
      } else {
        const { error } = await supabase.from("habitat_points").upsert({ points: 0 }, { onConflict: "user_id" });
        reportError("Initialize habitat_points", error);
      }

      await refreshCollection();
      await refreshRecentPoints();

      const { data: pending } = await supabase
        .from("wild_encounter_pending")
        .select("hamster_id, stage, form_id, personality, abilities")
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
  }, [refreshCollection, refreshRecentPoints, reportError]);

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

  // Safety net only — focus/visibilitychange above only fire on switching
  // tabs/apps and back, which never happens on plain in-app navigation
  // (e.g. Wallet -> Habitat via the router, same tab). That's why a manual
  // refresh used to be the only reliable way to see new points. The real
  // fix is notifyGrowth() below, called right after each point-earning
  // write; this interval just catches anything that writes to the DB
  // without going through notifyGrowth (another device/tab, a future page
  // that forgets to call it) so points never sit stale for long.
  useEffect(() => {
    if (loading) return;
    const id = setInterval(() => { checkForNewGrowth(); }, 45_000);
    return () => clearInterval(id);
  }, [loading, checkForNewGrowth]);

  // Call this immediately after any write that could earn points (paying a
  // bill, checking off a chore, finishing a grocery list, etc.) instead of
  // waiting for the next focus event or a manual refresh tap. Safe to call
  // from anywhere via useHamsterGrowth() — checkingRef already guards
  // against overlapping runs, so firing this from several pages in quick
  // succession just coalesces into whichever check is already in flight.
  const notifyGrowth = useCallback(() => { checkForNewGrowth(); }, [checkForNewGrowth]);

  const clearJustHatched = useCallback(() => setJustHatched(null), []);
  const clearJustEvolved = useCallback(() => setJustEvolved(null), []);

  // Call once a wild encounter has been fought (win, loss, or tamed) so a
  // new one can spawn later instead of the same one sitting there forever.
  const clearWildEncounter = useCallback(async () => {
    const { error } = await supabase.from("wild_encounter_pending").upsert(
      {
        hamster_id: null,
        stage: null,
        form_id: null,
        personality: null,
        abilities: null,
        spawned_at: null,
      },
      { onConflict: "user_id" }
    );
    if (reportError("Clear wild encounter", error)) return;
    setWildEncounter(null);
  }, [reportError]);

  // Renames a hamster. Empty/whitespace-only clears the name back to null
  // (falls back to the default label in the UI). Capped at 24 chars to keep
  // it readable in the small habitat cards.
  const renameHamster = useCallback(
    async (entryId: number, name: string) => {
      const trimmed = name.trim().slice(0, 24);
      const { error } = await supabase.from("hamster_collection").update({ name: trimmed || null }).eq("id", entryId);
      reportError("Rename hamster", error);
      await refreshCollection();
    },
    [refreshCollection, reportError]
  );

  // Spends training points on one stat, permanently. `amount` defaults to 1
  // for backward compatibility; pass Infinity (or any large number) to mean
  // "max out this stat." Re-reads the row fresh from Supabase first (rather
  // than trusting local state) so a stat cap can never be exceeded by a
  // stale evolution stage. The actual amount spent is clamped to whichever
  // is smaller: unspent TP, or room left under the stage's cap — so a
  // "+10" tap with only 3 TP left, or with only 3 points of cap room left,
  // silently spends what it can rather than failing outright. Returns a
  // reason string only when NOTHING could be spent, for the UI to surface.
  const allocateStat = useCallback(
    async (entryId: number, stat: keyof TrainedStats, amount: number = 1): Promise<AllocateStatResult> => {
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
      const room = cap - current;
      if (room <= 0) return { ok: false, reason: `Maxed out for ${stage} stage — evolve to raise the cap` };

      const requested = Math.max(1, Math.floor(amount));
      const spend = Math.min(requested, unspent, room);
      if (spend <= 0) return { ok: false, reason: "No training points to spend yet" };

      const { error } = await supabase
        .from("hamster_collection")
        .update({ [column]: current + spend, training_points: unspent - spend })
        .eq("id", entryId);

      if (error) return { ok: false, reason: error.message || "Save failed" };

      await refreshCollection();
      return { ok: true, spent: spend };
    },
    [refreshCollection]
  );

  // Spends points from the same shared balance that drives hatching, e.g.
  // for unlocking a habitat item. Re-reads the row fresh from Supabase
  // first (rather than trusting local state) so two quick spends can't
  // both succeed against a stale balance. Returns a reason string when the
  // spend can't happen at all; never partially spends.
  const spendPoints = useCallback(
    async (amount: number): Promise<{ ok: boolean; reason?: string }> => {
      const { data: row } = await supabase
        .from("hamster_growth")
        .select("points, threshold")
        .maybeSingle();

      const current = Number(row?.points) || 0;
      if (current < amount) {
        return { ok: false, reason: "Not enough points yet" };
      }

      const newPoints = current - amount;
      const { error } = await supabase
        .from("hamster_growth")
        .upsert({ points: newPoints, threshold: Number(row?.threshold) || threshold }, { onConflict: "user_id" });

      if (reportError("Spend points", error)) {
        return { ok: false, reason: error.message || "Save failed" };
      }

      setPoints(newPoints);
      return { ok: true };
    },
    [threshold, reportError]
  );

  // Spends from the separate decor pool used for unlocking habitat shelf
  // items. Completely independent of `points`/spendPoints above — spending
  // here can never reduce hatch/evolution progress. Same re-read-fresh
  // pattern as spendPoints so two quick spends can't both succeed against a
  // stale balance.
  const spendDecorPoints = useCallback(
    async (amount: number): Promise<{ ok: boolean; reason?: string }> => {
      const { data: row } = await supabase
        .from("habitat_points")
        .select("points")
        .maybeSingle();

      const current = Number(row?.points) || 0;
      if (current < amount) {
        return { ok: false, reason: "Not enough points yet" };
      }

      const newDecorPoints = current - amount;
      const { error } = await supabase
        .from("habitat_points")
        .upsert({ points: newDecorPoints }, { onConflict: "user_id" });

      if (reportError("Spend decor points", error)) {
        return { ok: false, reason: error.message || "Save failed" };
      }

      setDecorPoints(newDecorPoints);
      return { ok: true };
    },
    [reportError]
  );

  return {
    loading,
    refreshing,
    refresh,
    notifyGrowth,
    points,
    threshold,
    progressPct: Math.min(100, Math.round((points / threshold) * 100)),
    decorPoints,
    spendDecorPoints,
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
    spendPoints,
    awardBattleWin,
    evolveHamster,
    growthError,
    clearGrowthError,
  };
}
