// useHamsterGrowth.ts
// Fully self-contained — does NOT touch Wallet.tsx at all. Instead, it
// checks your existing tables (bill_payments, debts, daily_log) each time
// it loads and figures out what's new since the last check, then adds
// growth points for it. Hatches a random hamster when the threshold hits.

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase"; // match your actual client path
import { Hamster, rollRandomHamster } from "./hamsters";

const POINTS = {
  bill_paid_on_time: 10,
  debt_payment_logged: 12,
  debt_paid_off: 40,
  savings_contribution: 8,
} as const;

interface HamsterCollectionEntry {
  id: number;
  hamsterId: string;
  hatchedAt: string;
  source: string | null;
}

export function useHamsterGrowth() {
  const [points, setPoints] = useState(0);
  const [threshold, setThreshold] = useState(100);
  const [collection, setCollection] = useState<HamsterCollectionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [justHatched, setJustHatched] = useState<Hamster | null>(null);

  const refreshCollection = useCallback(async () => {
    const { data } = await supabase
      .from("hamster_collection")
      .select("id, hamster_id, hatched_at, source")
      .order("hatched_at", { ascending: false });
    setCollection(
      (data || []).map((r) => ({ id: r.id, hamsterId: r.hamster_id, hatchedAt: r.hatched_at, source: r.source }))
    );
  }, []);

  // Adds points, hatching as many times as needed if a jump crosses the
  // threshold more than once, and persists everything.
  const addPoints = useCallback(
    async (amount: number, source: string, currentPoints: number) => {
      let newPoints = currentPoints + amount;
      let hatched = false;

      while (newPoints >= threshold) {
        const h = rollRandomHamster();
        newPoints -= threshold;
        await supabase.from("hamster_collection").insert({ hamster_id: h.id, source });
        setJustHatched(h);
        hatched = true;
      }

      await supabase.from("hamster_growth").upsert({ id: 1, points: newPoints, threshold });
      if (hatched) await refreshCollection();
      return newPoints;
    },
    [threshold, refreshCollection]
  );

  // The core check — call this whenever the app loads. It looks at what's
  // changed in your real tables since the last check and awards growth.
  const checkForNewGrowth = useCallback(async () => {
    const { data: lastCheck } = await supabase
      .from("hamster_last_check")
      .select("last_bill_check, last_log_check, debt_snapshot")
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

    setPoints(runningPoints);

    await supabase
      .from("hamster_last_check")
      .upsert({ id: 1, last_bill_check: now, last_log_check: now, debt_snapshot: newSnapshot });
  }, [points, addPoints]);

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
      setLoading(false);
    })();
  }, [refreshCollection]);

  useEffect(() => {
    if (!loading) checkForNewGrowth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const clearJustHatched = useCallback(() => setJustHatched(null), []);

  return {
    loading,
    points,
    threshold,
    progressPct: Math.min(100, Math.round((points / threshold) * 100)),
    collection,
    justHatched,
    clearJustHatched,
  };
}
