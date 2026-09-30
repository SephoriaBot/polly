// payProjection.ts
// The ONE copy of Polly's paycheck / Anytime Pay / bills projection.
// Wallet's Money Calendar + Safe to Spend card and lib/money.ts
// (getSafeToSpend -> "Can I afford this?") both run this code, so the two
// can never disagree. If you change pay math, change it here.

import { supabase } from './supabase';

export interface ProjBill {
  id: number;
  name: string;
  amount: number;
  due_day: number;
  recurring: boolean;
  bill_month?: number;
  bill_year?: number;
  frequency_unit?: "month" | "week";
  frequency_interval?: number;
  anchor_date?: string | null;
}

export interface ProjPayment {
  id?: number;
  bill_id: number;
  month: number;
  year: number;
  paid: boolean;
  name?: string;
  amount?: number;
  due_day?: number;
  due_date?: string;
}

export type BillsByDate = Record<string, { id: number; name: string; amount: number }[]>;
export interface HoursEntry { reg: string; ot: string }
export interface WeekHours { weekStart: string; reg: string; ot: string }

export interface PayProjectionInputs {
  hourlyWage: number;
  otWage: number;
  netToGrossRatio: number;
  flatDeductionsPrev: number;
  taxRate: number;
  earlyPayPreset: EarlyPayPreset;
  priorWeekHours: WeekHours;
  closedWeekHours: WeekHours;
  dailyHours: Record<string, HoursEntry>;
  recurringHours: Record<number, HoursEntry>;
  extraFunds: Record<string, string>;
  extraExpenses: Record<string, string>;
}

// Safe-to-spend settings shared by the Wallet card and "Can I afford this?".
export const SAFE_TO_SPEND_LOOKAHEAD_DAYS = 10;
export const SAFE_TO_SPEND_BUFFER = 50;

export function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export const isoDate = dateKey;

export function currentWeekStartKey() {
  const now = new Date();
  const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  return dateKey(sunday);
}

export type EarlyPayPresetId = "amazon" | "custom";

export interface EarlyPayPreset {
  id: EarlyPayPresetId;
  label: string;
  garnishments: number;
  safetyBufferNormal: number;
  safetyBufferHighHours: number;
  highHoursThreshold: number;
}

export const EARLY_PAY_PRESETS: Record<EarlyPayPresetId, EarlyPayPreset> = {
  amazon: {
    id: "amazon",
    label: "Amazon Anytime Pay",
    garnishments: 0,
    safetyBufferNormal: 0.02,
    safetyBufferHighHours: 0.08,
    highHoursThreshold: 55,
  },
  custom: {
    id: "custom",
    label: "Custom / Other Employer",
    garnishments: 0,
    safetyBufferNormal: 0.02,
    safetyBufferHighHours: 0.02,
    highHoursThreshold: 999,
  },
};

function getSafetyBuffer(hoursSoFar: number, preset: EarlyPayPreset) {
  return hoursSoFar >= preset.highHoursThreshold
    ? preset.safetyBufferHighHours
    : preset.safetyBufferNormal;
}

export function eligiblePercent(preTaxEarnedSoFar: number, netToGrossRatio: number, flatDeductionsPrev: number, hoursSoFar: number, preset: EarlyPayPreset) {
  if (preTaxEarnedSoFar <= 0 || netToGrossRatio <= 0) return 0;
  const availableEarlyPay = preTaxEarnedSoFar * netToGrossRatio;
  const afterFlatDeductions = availableEarlyPay - flatDeductionsPrev;
  const afterGarnishments = afterFlatDeductions - preset.garnishments;
  const rawPct = afterGarnishments / preTaxEarnedSoFar;
  return Math.max(0, rawPct - getSafetyBuffer(hoursSoFar, preset));
}


// All occurrence dates for a week-based bill that fall within [rangeStart, rangeEnd] (inclusive).
export function weeklyOccurrencesInRange(anchor: Date, intervalWeeks: number, rangeStart: Date, rangeEnd: Date): Date[] {
  const stepDays = Math.max(1, intervalWeeks) * 7;
  let cursor = new Date(anchor);
  if (cursor < rangeStart) {
    const diffDays = Math.ceil((rangeStart.getTime() - cursor.getTime()) / (1000 * 60 * 60 * 24));
    const steps = Math.ceil(diffDays / stepDays);
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + steps * stepDays);
  }
  const occurrences: Date[] = [];
  while (cursor <= rangeEnd) {
    occurrences.push(new Date(cursor));
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + stepDays);
  }
  return occurrences;
}


export function buildBillsByDate(bills: ProjBill[], payments: ProjPayment[], allDays: Date[]): BillsByDate {
  const map: BillsByDate = {};
  const monthsInView = new Set(allDays.map(d => `${d.getFullYear()}-${d.getMonth() + 1}`));

  bills.forEach(bill => {
    if (bill.recurring) {
      monthsInView.forEach(key => {
        const [y, m] = key.split("-").map(Number);
        const occurrences = payments.filter(p => p.bill_id === bill.id && p.month === m && p.year === y);

        if (occurrences.length === 0) {
          // Payment row(s) not generated yet (Wallet's ensurePaymentsExist
          // hasn't run for that month, e.g. next month when only the quick
          // "can I afford this" check has been used) — synthesize them so
          // nothing silently disappears from the projection.
          if (bill.frequency_unit === "week" && bill.anchor_date) {
            const interval = bill.frequency_interval && bill.frequency_interval > 0 ? bill.frequency_interval : 1;
            const monthStart = new Date(y, m - 1, 1);
            const monthEnd = new Date(y, m, 0);
            weeklyOccurrencesInRange(new Date(bill.anchor_date + "T00:00:00"), interval, monthStart, monthEnd).forEach(occ => {
              const oKey = dateKey(occ);
              if (!map[oKey]) map[oKey] = [];
              map[oKey].push({ id: bill.id, name: bill.name, amount: bill.amount });
            });
            return;
          }
          const dueDate = new Date(y, m - 1, bill.due_day);
          const dKey = dateKey(dueDate);
          if (!map[dKey]) map[dKey] = [];
          map[dKey].push({ id: bill.id, name: bill.name, amount: bill.amount });
          return;
        }

        occurrences.forEach(payment => {
          if (payment.paid) return;
          const effectiveDueDay = payment.due_day ?? bill.due_day;
          const amount = payment.amount ?? bill.amount;
          const name = payment.name ?? bill.name;
          const dueDate = payment.due_date ? new Date(payment.due_date + "T00:00:00") : new Date(y, m - 1, effectiveDueDay);
          const dKey = dateKey(dueDate);
          if (!map[dKey]) map[dKey] = [];
          map[dKey].push({ id: bill.id, name, amount });
        });
      });
    } else if (bill.bill_month && bill.bill_year) {
      const payment = payments.find(p => p.bill_id === bill.id && p.month === bill.bill_month && p.year === bill.bill_year);
      const paid = payment?.paid ?? false;
      if (paid) return;
      const dueDate = new Date(bill.bill_year, bill.bill_month - 1, bill.due_day);
      const dKey = dateKey(dueDate);
      if (!map[dKey]) map[dKey] = [];
      map[dKey].push({ id: bill.id, name: bill.name, amount: bill.amount });
    }
  });
  return map;
}


export function buildMoneyCalendarRows(inputs: PayProjectionInputs, allDays: Date[], startingBalance: number, billsMap: BillsByDate) {
  const { priorWeekHours, closedWeekHours, dailyHours, recurringHours, extraFunds, extraExpenses, taxRate, earlyPayPreset } = inputs;
  const effectiveOtWage = inputs.otWage;
  const budget = {
    hourly_wage: inputs.hourlyWage,
    net_to_gross_ratio: inputs.netToGrossRatio,
    flat_deductions_prev: inputs.flatDeductionsPrev,
  };
  let runningBalance = startingBalance;

  let periodEarnedGross = 0;
  let periodHoursSoFar = 0;
  let periodWithdrawnGross = 0;
  let pendingPayout = 0;

  const grossHourlyWage = budget.hourly_wage || 0;
  const grossOtWage = effectiveOtWage || 0;

  if (allDays.length && allDays[0].getDay() !== 0 && priorWeekHours.weekStart === currentWeekStartKey()) {
    const priorReg = parseFloat(priorWeekHours.reg) || 0;
    const priorOt = parseFloat(priorWeekHours.ot) || 0;
    const priorGross = priorReg * grossHourlyWage + priorOt * grossOtWage;

    const priorHours = priorReg + priorOt;
    periodEarnedGross = priorGross;
    periodHoursSoFar = priorHours;
    periodWithdrawnGross = priorGross * eligiblePercent(priorGross, budget.net_to_gross_ratio, budget.flat_deductions_prev, priorHours, earlyPayPreset);
  }

  // A week's leftover payout only needs to come from the manual
  // closedWeekHours card when that week's *Sunday* isn't in the visible
  // range — i.e. the loop can't see enough of the week to total it itself.
  // (Checking "does a Saturday appear before the first Wednesday in the
  // array" instead of this breaks for any month/view starting on a
  // Thu/Fri/Sat, since the closing Saturday can still land inside the
  // visible window even though the week's Sunday doesn't — e.g. a month
  // that starts on a Thursday, where day 3 of the view is a Saturday but
  // the week began the prior Sunday, outside the view.)
  const firstWednesdayIdx = allDays.findIndex(d => d.getDay() === 3);
  let closedWeekEndKey: string | null = null;
  if (firstWednesdayIdx !== -1) {
    const firstWednesday = allDays[firstWednesdayIdx];
    const closingSaturday = new Date(firstWednesday);
    closingSaturday.setDate(closingSaturday.getDate() - 4);
    const periodStartSunday = new Date(closingSaturday);
    periodStartSunday.setDate(periodStartSunday.getDate() - 6);

    if (periodStartSunday < allDays[0]) {
      const periodStartKey = dateKey(periodStartSunday);

      if (closedWeekHours.weekStart === periodStartKey) {
        const closedReg = parseFloat(closedWeekHours.reg) || 0;
        const closedOt = parseFloat(closedWeekHours.ot) || 0;
        const closedEarnedGross = closedReg * grossHourlyWage + closedOt * grossOtWage;
        const closedHours = closedReg + closedOt;
        const closedWithdrawnGross = closedEarnedGross * eligiblePercent(closedEarnedGross, budget.net_to_gross_ratio, budget.flat_deductions_prev, closedHours, earlyPayPreset);
        const closedTaxableGross = Math.max(0, closedEarnedGross - budget.flat_deductions_prev);
        const closedNetOwed = closedTaxableGross * (1 - taxRate / 100);
        pendingPayout = Math.max(0, closedNetOwed - closedWithdrawnGross);
        // Any part of this same week that IS visible (e.g. Oct 1–3 when the
        // week started Sept 27) is already folded into that manual total —
        // mark it so the loop below skips re-accumulating those days.
        closedWeekEndKey = dateKey(closingSaturday);
      }
    }
  }

  const rows = allDays.map(d => {
    const key = dateKey(d);
    const dow = d.getDay();
    const alreadyCoveredByClosedWeekCard = closedWeekEndKey !== null && key <= closedWeekEndKey;

    if (dow === 0) {
      periodEarnedGross = 0;
      periodHoursSoFar = 0;
      periodWithdrawnGross = 0;
    }

    const extraToday = parseFloat(extraFunds[key]) || 0;
    const extraExpenseToday = parseFloat(extraExpenses[key]) || 0;
    const billsToday = billsMap[key] || [];
    const billsTotal = billsToday.reduce((s, b) => s + b.amount, 0);

    const regHoursToday = parseFloat(dailyHours[key]?.reg ?? recurringHours[dow]?.reg ?? "") || 0;
    const otHoursToday = parseFloat(dailyHours[key]?.ot ?? recurringHours[dow]?.ot ?? "") || 0;
    const hoursToday = regHoursToday + otHoursToday;

    const fullEarnedToday =
      grossHourlyWage > 0
        ? regHoursToday * grossHourlyWage + otHoursToday * grossOtWage
        : 0;

    if (!alreadyCoveredByClosedWeekCard) {
      periodEarnedGross += fullEarnedToday;
      periodHoursSoFar += hoursToday;
    }

    const eligiblePct = eligiblePercent(periodEarnedGross, budget.net_to_gross_ratio, budget.flat_deductions_prev, periodHoursSoFar, earlyPayPreset);
    const maxWithdrawableGrossSoFar = periodEarnedGross * eligiblePct;
    const withdrawnBeforeToday = periodWithdrawnGross;
    const availableToday = alreadyCoveredByClosedWeekCard ? 0 : Math.max(0, maxWithdrawableGrossSoFar - periodWithdrawnGross);
    periodWithdrawnGross += availableToday;

        if (dow === 6 && !alreadyCoveredByClosedWeekCard) {
      const taxableGross = Math.max(0, periodEarnedGross - budget.flat_deductions_prev);
      const netOwedForPeriod = taxableGross * (1 - taxRate / 100);
      pendingPayout += Math.max(0, netOwedForPeriod - periodWithdrawnGross);
    }


    let releasedToday = 0;
    if (dow === 3 && pendingPayout > 0) {
      releasedToday = pendingPayout;
      pendingPayout = 0;
    }

    runningBalance += availableToday + releasedToday + extraToday - extraExpenseToday - billsTotal;
    const heldInPool = Math.max(0, periodEarnedGross - periodWithdrawnGross);

    return {
      date: d, key, billsToday, billsTotal, regHoursToday, otHoursToday,
      hoursToday, earnedToday: fullEarnedToday, availableToday, releasedToday,
      eligiblePct, heldInPool, extraToday, extraExpenseToday, balance: runningBalance,
      ceilingToday: maxWithdrawableGrossSoFar, withdrawnBeforeToday,
    };
  });

  return { rows, endingBalance: runningBalance };
}




/* ------------------------------------------------------------------
   LOADER — fetches everything the projection needs, exactly the way
   Wallet loads it, for callers outside the Wallet page.
   ------------------------------------------------------------------ */
export async function loadPayProjectionData(): Promise<{
  inputs: PayProjectionInputs;
  bills: ProjBill[];
  payments: ProjPayment[];
  currentBalance: number;
}> {
  const [budgetRes, billsRes, paymentsRes, settingsRes, dailyRes, fundsRes, expensesRes, periodRes, recurringRes] = await Promise.all([
    supabase.from("budget").select("*").eq("id", 1).maybeSingle(),
    supabase.from("bills").select("*"),
    supabase.from("bill_payments").select("*"),
    supabase.from("wallet_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("daily_hours_log").select("*"),
    supabase.from("extra_funds_log").select("*"),
    supabase.from("extra_expenses_log").select("*"),
    supabase.from("wallet_pay_period").select("*").eq("id", 1).maybeSingle(),
    supabase.from("recurring_hours").select("*"),
  ]);

  for (const [name, res] of Object.entries({ budgetRes, billsRes, paymentsRes, settingsRes, dailyRes, fundsRes, expensesRes, periodRes, recurringRes })) {
    if (res.error) console.error(`payProjection ${name} failed:`, res.error);
  }

  const budget: any = budgetRes.data ?? {};
  const hourlyWage = budget.hourly_wage || 0;
  const taxRate = budget.tax_rate != null ? Number(budget.tax_rate) : 20;

  const settings: any = settingsRes.data;
  const otOverride = settings?.ot_wage_override || "";
  const presetId: EarlyPayPresetId = settings?.early_pay_preset_id === "custom" ? "custom" : "amazon";
  const customPreset: EarlyPayPreset = settings?.custom_early_pay_preset
    ? { ...EARLY_PAY_PRESETS.custom, ...settings.custom_early_pay_preset }
    : EARLY_PAY_PRESETS.custom;
  const earlyPayPreset = presetId === "custom" ? customPreset : EARLY_PAY_PRESETS[presetId];
  const otWage = parseFloat(otOverride) > 0 ? parseFloat(otOverride) : hourlyWage * 1.5;

  const dailyHours: Record<string, HoursEntry> = {};
  (dailyRes.data ?? []).forEach((r: any) => { dailyHours[r.date] = { reg: r.reg || "", ot: r.ot || "" }; });

  const extraFunds: Record<string, string> = {};
  (fundsRes.data ?? []).forEach((r: any) => { extraFunds[r.date] = r.amount || ""; });

  const extraExpenses: Record<string, string> = {};
  (expensesRes.data ?? []).forEach((r: any) => { extraExpenses[r.date] = r.amount || ""; });

  const recurringHours: Record<number, HoursEntry> = {};
  (recurringRes.data ?? []).forEach((r: any) => { recurringHours[r.weekday] = { reg: r.reg || "", ot: r.ot || "" }; });

  const period: any = periodRes.data;
  let priorWeekHours: WeekHours = { weekStart: currentWeekStartKey(), reg: "", ot: "" };
  if (period?.prior_week_start === currentWeekStartKey()) {
    priorWeekHours = { weekStart: period.prior_week_start, reg: period.prior_week_reg || "", ot: period.prior_week_ot || "" };
  }
  let closedWeekHours: WeekHours = { weekStart: "", reg: "", ot: "" };
  if (period?.closed_week_start) {
    closedWeekHours = { weekStart: period.closed_week_start, reg: period.closed_week_reg || "", ot: period.closed_week_ot || "" };
  }

  return {
    inputs: {
      hourlyWage, otWage,
      netToGrossRatio: budget.net_to_gross_ratio,
      flatDeductionsPrev: budget.flat_deductions_prev,
      taxRate, earlyPayPreset, priorWeekHours, closedWeekHours,
      dailyHours, recurringHours, extraFunds, extraExpenses,
    },
    bills: (billsRes.data ?? []) as ProjBill[],
    payments: (paymentsRes.data ?? []) as ProjPayment[],
    currentBalance: Number(budget.current_balance) || 0,
  };
}
