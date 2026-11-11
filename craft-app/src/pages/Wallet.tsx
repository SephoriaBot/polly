import { useState, useMemo, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { supabase } from '../lib/supabase';
import Icon from '../components/Icon';
import PageTabs, { type PageTab } from '../components/PageTabs';
import PlanTab from '../components/wallet/PlanTab';
import { useTheme } from '../context/ThemeContext';
import { Polly } from '../lib';
import emptyWallet from '../assets/icons/empty-wallet.png';
import EmptyState from '../components/EmptyState';
import StitchDivider from '../components/StitchDivider';
import CheckMark from '../components/CheckMark';
import { useCreatureGrowth } from '../creatures/CreatureGrowthContext';
import { triggerActionEvent } from '../lib/questSystem';
import PageTitleLogo from "../components/PageTitleLogo";
import {
  EARLY_PAY_PRESETS,
  buildBillsByDate as buildBillsByDateShared,
  buildMoneyCalendarRows as buildMoneyCalendarRowsShared,
  weeklyOccurrencesInRange,
  type EarlyPayPreset,
  type EarlyPayPresetId,
  type PayProjectionInputs,
  SAFE_TO_SPEND_LOOKAHEAD_DAYS,
} from "../lib/payProjection";

// Fires a quest event for the signed-in user (no-op if signed out).
async function fireQuestEvent(eventKey: string) {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) triggerActionEvent(data.session.user.id, eventKey);
}

interface Debt {
  id: number;
  name: string;
  balance: number;
  original_balance: number;
  apr: number;
  min_payment: number;
  deferred: boolean;
  paid_off?: boolean;
  last_processed_month?: string;
}

interface Budget {
  take_home: number;
  fixed_expenses: number;
  hourly_wage: number;
  current_balance: number;
  net_to_gross_ratio: number;
  flat_deductions_prev: number;
  tax_rate?: number;
}

interface Bill {
  id: number;
  name: string;
  amount: number;
  due_day: number;
  recurring: boolean;
  bill_month?: number;
  bill_year?: number;
  // Frequency for recurring bills. Absent/undefined means the original
  // behavior: once a month, on due_day. "week" lets a bill repeat every
  // N weeks from a fixed anchor date (e.g. rent every 2 weeks).
  frequency_unit?: "month" | "week";
  frequency_interval?: number; // only meaningful when frequency_unit === "week"
  anchor_date?: string | null; // ISO date, first occurrence — required for week-based bills
}

interface BillPayment {
  id?: number;
  bill_id: number;
  month: number;
  year: number;
  paid: boolean;
  paid_at?: string;
  name?: string;
  amount?: number;
  due_day?: number;
  due_date?: string; // ISO date — canonical occurrence date, lets a bill have multiple entries within one calendar month
}

type DebtStrategy = "snowball" | "avalanche";


interface MonthSnap {
  month: number;
  target: string;
  balances: Record<number, number>;
  deferredBalances: Record<number, number>;
  activeTotal: number;
  deferredTotal: number;
}

interface SavingsGoal {
  id: number;
  name: string;
  target: number;
  saved: number;
  position: number;
  created_at?: string;
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// Shift times replace typed hours. Paid hours = shift length minus an unpaid
// break. An end at or before the start means an overnight shift.
const UNPAID_BREAK_MIN = 30;
const MAX_SHIFT_MIN = 16 * 60;

type Shift = { start: string; end: string };

// One-tap fixes for a day's shift. Each chip moves the shift's end time, so
// "left an hour early" is one tap. "Off" clears the day's shift.
const SHIFT_CHIPS: { id: "off" | "minus1" | "minus30" | "plus30" | "plus1"; label: string; delta: number }[] = [
  { id: "off", label: "Off", delta: 0 },
  { id: "minus1", label: "End −1h", delta: -60 },
  { id: "minus30", label: "End −30m", delta: -30 },
  { id: "plus30", label: "End +30m", delta: 30 },
  { id: "plus1", label: "End +1h", delta: 60 },
];

function timeToMin(t?: string | null): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(t || "");
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function minToTime(n: number): string {
  const m = ((n % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// Paid hours for a shift ("" until both times are filled in).
function shiftHours(sh?: Shift | null): string {
  if (!sh) return "";
  const a = timeToMin(sh.start);
  const b = timeToMin(sh.end);
  if (a === null || b === null) return "";
  let len = b - a;
  if (len <= 0) len += 1440;
  // A "shift" over 16h is almost always a half-typed time (start edited past
  // the end), so it counts as nothing instead of inflating the week's hours.
  if (len > MAX_SHIFT_MIN) return "";
  return String(round2(Math.max(0, len - UNPAID_BREAK_MIN) / 60));
}

// The moment a day's shift ends (the next morning for an overnight shift).
function shiftEndsAt(dayKey: string, sh?: Shift | null): Date | null {
  if (!sh) return null;
  const a = timeToMin(sh.start);
  const b = timeToMin(sh.end);
  if (a === null || b === null) return null;
  const [y, m, d] = dayKey.split("-").map(Number);
  const end = new Date(y, m - 1, d, 0, 0, 0);
  end.setMinutes(b);
  if (b <= a) end.setDate(end.getDate() + 1);
  if (shiftHours(sh) === "") return null;
  return end;
}

// Hours past this many in a Sunday–Saturday week are paid at the OT wage.
// You only log total hours per day; the reg/OT split is worked out for you.
const OT_WEEKLY_THRESHOLD = 40;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// Older saves stored regular and OT hours separately. Merge them into one
// total ("" stays "" so a blank day still counts as an explicit zero).
function joinHours(reg?: string | null, ot?: string | null): string {
  const r = parseFloat(reg || "");
  const o = parseFloat(ot || "");
  if (isNaN(r) && isNaN(o)) return "";
  return String(round2((r || 0) + (o || 0)));
}

// The shared pay projection still wants reg and OT hours for a week, so a
// single "hours worked" total is split at the weekly OT threshold.
function splitWeekForPay(w: { weekStart: string; reg: string; ot: string }) {
  const total = (parseFloat(w.reg) || 0) + (parseFloat(w.ot) || 0);
  if (total <= 0) return { weekStart: w.weekStart, reg: "", ot: "" };
  const reg = Math.min(total, OT_WEEKLY_THRESHOLD);
  return { weekStart: w.weekStart, reg: String(round2(reg)), ot: String(round2(total - reg)) };
}

function runDebtPlan(
  debts: Debt[],
  takeHome: number,
  fixedExpenses: number,
  strategy: DebtStrategy
) {
  const active = debts
    .filter(d => !d.deferred && !d.paid_off && d.balance > 0)
    .map(d => ({ ...d, balance: Number(d.balance) || 0 }));
  const deferred = debts
    .filter(d => d.deferred)
    .map(d => ({ ...d, balance: Number(d.balance) || 0 }));
  const totalMins = active.reduce((s, d) => s + (Number(d.min_payment) || 0), 0);
  const extraDebtPayment = takeHome - fixedExpenses - totalMins;
  const months: MonthSnap[] = [];
  let state = active.map(d => ({ ...d }));
  let defState = deferred.map(d => ({ ...d }));
  for (let m = 1; m <= 120; m++) {
    const remaining = state.filter(d => d.balance > 0.01);
    if (remaining.length === 0) break;
    const target =
  strategy === "avalanche"
    ? remaining.reduce((a, b) => a.apr > b.apr ? a : b)
    : remaining.reduce((a, b) => a.balance < b.balance ? a : b);
    const otherMins = remaining.filter(d => d.id !== target.id).reduce((s, d) => s + (Number(d.min_payment) || 0), 0);
    const extraForTarget = extraDebtPayment - otherMins;
    const snap: MonthSnap = { month: m, target: target.name, balances: {}, deferredBalances: {}, activeTotal: 0, deferredTotal: 0 };
    state = state.map(d => {
      if (d.balance <= 0.01) { snap.balances[d.id] = 0; return { ...d, balance: 0 }; }
      const interest = d.balance * (Number(d.apr) / 100 / 12);
      const isTarget = d.id === target.id;
      const pmt = Math.min(d.balance + interest, isTarget ? (Number(d.min_payment) || 0) + Math.max(0, extraForTarget) : (Number(d.min_payment) || 0));
      const newBal = Math.max(0, d.balance + interest - pmt);
      snap.balances[d.id] = newBal;
      return { ...d, balance: newBal };
    });
    defState = defState.map(d => {
      const newBal = d.balance * (1 + Number(d.apr) / 100 / 12);
      snap.deferredBalances[d.id] = newBal;
      return { ...d, balance: newBal };
    });
    snap.activeTotal = state.reduce((s, d) => s + d.balance, 0);
    snap.deferredTotal = defState.reduce((s, d) => s + d.balance, 0);
    months.push(snap);
  }
  return { months, extraDebtPayment, totalMins };
}

function fmt(n: number) {
  if (n == null || isNaN(n)) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function isLate(dueDay: number, month: number, year: number, paid: boolean) {
  if (paid) return false;
  const today = new Date();
  const due = new Date(year, month - 1, dueDay + 1);
  return today >= due;
}

function daysUntilDue(dueDay: number, month: number, year: number) {
  const today = new Date();
  const due = new Date(year, month - 1, dueDay);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function frequencyLabel(unit: "month" | "week" | undefined, interval: number | undefined) {
  if (unit !== "week") return "Monthly";
  const n = interval && interval > 0 ? interval : 1;
  if (n === 1) return "Every week";
  if (n === 2) return "Every 2 weeks";
  return `Every ${n} weeks`;
}

// Early-pay presets + the eligiblePercent math now live in lib/payProjection.ts
// (shared with lib/money.ts so "Can I afford this?" matches this page).

const PERIOD_MULTIPLIERS: Record<string, number> = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  semimonthly: 2,
  monthly: 1,
};

const PERIOD_LABELS: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 Weeks",
  semimonthly: "Twice a Month",
  monthly: "Monthly",
};

function EditableCell({ value, onChange, type = "number", style, className, placeholder }: { value: string | number; onChange: (v: string) => void; type?: string; style?: CSSProperties; className?: string; placeholder?: string }) {
  const [draft, setDraft] = useState(String(value));
  const draftRef = useRef(draft);
  const valueRef = useRef(String(value));
  const onChangeRef = useRef(onChange);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setDraft(String(value)); valueRef.current = String(value); }, [value]);
  useEffect(() => { draftRef.current = draft; }, [draft]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  function commit() {
    if (draftRef.current !== valueRef.current) {
      onChangeRef.current(draftRef.current);
      valueRef.current = draftRef.current;
    }
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      commit();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <input
      type={type}
      className={className ?? 'cell-input'}
      placeholder={placeholder}
      value={draft}
      onChange={e => {
        setDraft(e.target.value);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(commit, 600);
      }}
      onBlur={() => { if (timerRef.current) clearTimeout(timerRef.current); commit(); }}
      onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      style={style}
    />
  );
}

export default function Wallet({ initialView }: { initialView?: 'home' | 'calendar' | 'bills' | 'debts' } = {}) {
  const { theme } = useTheme();
  const { notifyGrowth } = useCreatureGrowth();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [debtStrategy, setDebtStrategy] =
  useState<DebtStrategy>("snowball");
const [budget, setBudget] = useState<Budget>({ take_home: 0, fixed_expenses: 0, hourly_wage: 0, current_balance: 0, net_to_gross_ratio: 0, flat_deductions_prev: 0, tax_rate: 20 });
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<BillPayment[]>([]);
  const [nextId, setNextId] = useState(20);
  const [nextBillId, setNextBillId] = useState(10);
  const [view, setView] = useState<"home" | "plan" | "calendar" | "bills" | "debts">(initialView ?? "home");  const [showDeferred, setShowDeferred] = useState(false);
  const [, setLoading] = useState(true);
  const [showBillForm, setShowBillForm] = useState(false);
  const [billsTab, setBillsTab] = useState<"month" | "recurring">("month");
  const [newBill, setNewBill] = useState({
    name: "", amount: "", due_day: "", recurring: true,
    frequency_unit: "month" as "month" | "week",
    frequency_interval: "1",
    anchor_date: "",
  });
  const [showConfetti, setShowConfetti] = useState(false);
  const [celebration, setCelebration] = useState<{ title: string; subtitle: string }>({ title: "", subtitle: "" });

  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [newGoalName, setNewGoalName] = useState("");
  const [newGoalTarget, setNewGoalTarget] = useState("");
  const [otWageOverride, setOtWageOverride] = useState<string>("");
  const [walletSettingsLoaded, setWalletSettingsLoaded] = useState(false);
  const [earlyPayPresetId, setEarlyPayPresetId] = useState<EarlyPayPresetId>("amazon");
  const [customEarlyPayPreset, setCustomEarlyPayPreset] = useState<EarlyPayPreset>(EARLY_PAY_PRESETS.custom);
  const earlyPayPreset: EarlyPayPreset = earlyPayPresetId === "custom" ? customEarlyPayPreset : EARLY_PAY_PRESETS[earlyPayPresetId];
  // Tax rate now lives on the budget table (budget.tax_rate), saved via updateBudget like everything else on this page.
  const taxRate = budget.tax_rate != null ? Number(budget.tax_rate) : 20;

  async function updateOtWageOverride(v: string) {
    setOtWageOverride(v);
    const { error } = await supabase.from("wallet_settings").upsert({
      id: 1, ot_wage_override: v, early_pay_preset_id: earlyPayPresetId, custom_early_pay_preset: customEarlyPayPreset,
    });
    if (error) console.error("wallet_settings save failed:", error);
  }
  async function updateEarlyPayPresetId(v: EarlyPayPresetId) {
    setEarlyPayPresetId(v);
    const { error } = await supabase.from("wallet_settings").upsert({
      id: 1, ot_wage_override: otWageOverride, early_pay_preset_id: v, custom_early_pay_preset: customEarlyPayPreset,
    });
    if (error) console.error("wallet_settings save failed:", error);
  }
  async function updateCustomEarlyPayPreset(updater: (prev: EarlyPayPreset) => EarlyPayPreset) {
    const next = updater(customEarlyPayPreset);
    setCustomEarlyPayPreset(next);
    const { error } = await supabase.from("wallet_settings").upsert({
      id: 1, ot_wage_override: otWageOverride, early_pay_preset_id: earlyPayPresetId, custom_early_pay_preset: next,
    });
    if (error) console.error("wallet_settings save failed:", error);
  }


  const [calcRegWage, setCalcRegWage] = useState("");
  const [calcOtWage, setCalcOtWage] = useState("");
  const [calcRegHours, setCalcRegHours] = useState("");
  const [calcOtHours, setCalcOtHours] = useState("");
  const [calcPeriod, setCalcPeriod] = useState<"weekly" | "biweekly" | "semimonthly" | "monthly">("biweekly");
  const [budgetSavedMsg, setBudgetSavedMsg] = useState(false);
  const [budgetSaveError, setBudgetSaveError] = useState("");

  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());

  const availableMonths = useMemo(() => {
    const months = [];
    for (let i = 0; i <= 3; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      months.push({ month: d.getMonth() + 1, year: d.getFullYear(), label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` });
    }
    return months;
  }, []);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [
          { data: debtData },
          { data: budgetData },
          { data: billData },
          { data: paymentData },
          { data: goalData },
          { data: walletSettingsData },
          { data: dailyHoursData },
          { data: extraFundsData },
          { data: extraExpensesData },
          { data: payPeriodData },
          { data: recurringHoursData },
          { data: monthBalancesData },
        ] = await Promise.all([
          supabase.from("debts").select("*"),
          supabase.from("budget").select("*").eq("id", 1).maybeSingle(),
          supabase.from("bills").select("*").order("due_day"),
          supabase.from("bill_payments").select("*"),
          supabase.from("savings_goals").select("*").order("position").order("created_at"),
          supabase.from("wallet_settings").select("*").eq("id", 1).maybeSingle(),
          supabase.from("daily_hours_log").select("*"),
          supabase.from("extra_funds_log").select("*"),
          supabase.from("extra_expenses_log").select("*"),
          supabase.from("wallet_pay_period").select("*").eq("id", 1).maybeSingle(),
          supabase.from("recurring_hours").select("*"),
          supabase.from("wallet_month_balances").select("*"),
        ]);

        if (debtData && debtData.length > 0) {
          const fixed = debtData.map((d: Debt) => ({ ...d, original_balance: d.original_balance || d.balance }));
          setDebts(fixed);
          setNextId(Math.max(...fixed.map((d: Debt) => d.id)) + 1);
          await processMonthlyMinimums(fixed);
        } else {
          setDebts([]);
        }

        if (budgetData) setBudget(prev => ({ ...prev, ...budgetData }));
        if (goalData) {
          setGoals(goalData.map((g: SavingsGoal) => ({ ...g, target: Number(g.target) || 0, saved: Number(g.saved) || 0 })));
        }

        const isPastMonth = (m: number, y: number) =>
          y < today.getFullYear() || (y === today.getFullYear() && m < today.getMonth() + 1);

        if (billData) {
          const staleOneOffIds = billData.filter((b: Bill) => !b.recurring && isPastMonth(b.bill_month!, b.bill_year!)).map((b: Bill) => b.id);
          if (staleOneOffIds.length > 0) supabase.from("bills").delete().in("id", staleOneOffIds);
          const keptBills = billData.filter((b: Bill) => b.recurring || !isPastMonth(b.bill_month!, b.bill_year!));
          setBills(keptBills);
          if (keptBills.length > 0) setNextBillId(Math.max(...keptBills.map((b: Bill) => b.id)) + 1);
        }
        if (paymentData) {
          const stalePaymentIds = paymentData.filter((p: BillPayment) => isPastMonth(p.month, p.year)).map((p: BillPayment) => p.id).filter(Boolean);
          if (stalePaymentIds.length > 0) supabase.from("bill_payments").delete().in("id", stalePaymentIds);
          setPayments(paymentData.filter((p: BillPayment) => !isPastMonth(p.month, p.year)));
        }

        if (walletSettingsData) {
          const loadedOtWageOverride = walletSettingsData.ot_wage_override || "";
          const loadedEarlyPayPresetId: EarlyPayPresetId = walletSettingsData.early_pay_preset_id === "custom" ? "custom" : "amazon";
          const loadedCustomEarlyPayPreset = walletSettingsData.custom_early_pay_preset
            ? { ...EARLY_PAY_PRESETS.custom, ...walletSettingsData.custom_early_pay_preset }
            : customEarlyPayPreset;
          setOtWageOverride(loadedOtWageOverride);
          setEarlyPayPresetId(loadedEarlyPayPresetId);
          if (walletSettingsData.custom_early_pay_preset) setCustomEarlyPayPreset(loadedCustomEarlyPayPreset);
        }
        setWalletSettingsLoaded(true);

        if (dailyHoursData && dailyHoursData.length > 0) {
          const map: Record<string, string> = {};
          const shiftMap: Record<string, Shift> = {};
          dailyHoursData.forEach((row: { date: string; reg: string; ot: string; shift_start?: string | null; shift_end?: string | null }) => {
            map[row.date] = joinHours(row.reg, row.ot);
            // Every saved day has its own shift entry (blank = off / legacy hours only).
            shiftMap[row.date] = { start: (row.shift_start || "").slice(0, 5), end: (row.shift_end || "").slice(0, 5) };
          });
          setDailyHours(map);
          setDailyShifts(shiftMap);
        }

        if (extraFundsData && extraFundsData.length > 0) {
          const map: Record<string, string> = {};
          extraFundsData.forEach((row: { date: string; amount: string }) => {
            map[row.date] = row.amount || "";
          });
          setExtraFunds(map);
        }

        if (extraExpensesData && extraExpensesData.length > 0) {
          const map: Record<string, string> = {};
          extraExpensesData.forEach((row: { date: string; amount: string }) => {
            map[row.date] = row.amount || "";
          });
          setExtraExpenses(map);
        }

        if (payPeriodData) {
          if (payPeriodData.prior_week_start === currentWeekStartKey()) {
            setPriorWeekHours({
              weekStart: payPeriodData.prior_week_start,
              reg: joinHours(payPeriodData.prior_week_reg, payPeriodData.prior_week_ot),
              ot: "",
            });
            setPriorAnchor(payPeriodData.prior_week_anchor || "");
          }
          if (payPeriodData.closed_week_start) {
            setClosedWeekHours({
              weekStart: payPeriodData.closed_week_start,
              reg: joinHours(payPeriodData.closed_week_reg, payPeriodData.closed_week_ot),
              ot: "",
            });
          }
        }

        if (recurringHoursData && recurringHoursData.length > 0) {
          const map: Record<number, string> = {};
          const shiftMap: Record<number, Shift> = {};
          recurringHoursData.forEach((row: { weekday: number; reg: string; ot: string; shift_start?: string | null; shift_end?: string | null }) => {
            map[row.weekday] = joinHours(row.reg, row.ot);
            if (row.shift_start && row.shift_end) {
              shiftMap[row.weekday] = { start: row.shift_start.slice(0, 5), end: row.shift_end.slice(0, 5) };
            }
          });
          setRecurringHours(map);
          setRecurringShifts(shiftMap);
        }

        if (monthBalancesData && monthBalancesData.length > 0) {
          const map: Record<string, string> = {};
          monthBalancesData.forEach((row: { month: number; year: number; starting_balance: number | null }) => {
            map[`${row.year}-${row.month}`] = row.starting_balance != null ? String(row.starting_balance) : "";
          });
          setMonthBalances(map);
        }
      } catch (err) {
        console.error("Wallet loadData failed:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    async function ensurePaymentsExist() {
      if (bills.length === 0) return;
      const recurringBills = bills.filter(b => b.recurring);
      const rangeStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastAvailable = availableMonths[availableMonths.length - 1];
      // Last day of the furthest month currently in view (e.g. today + 3 months)
      const rangeEnd = lastAvailable ? new Date(lastAvailable.year, lastAvailable.month, 0) : rangeStart;

      for (const bill of recurringBills) {
        if (bill.frequency_unit === "week" && bill.anchor_date) {
          const anchor = new Date(bill.anchor_date + "T00:00:00");
          const interval = bill.frequency_interval && bill.frequency_interval > 0 ? bill.frequency_interval : 1;
          const occurrences = weeklyOccurrencesInRange(anchor, interval, rangeStart, rangeEnd);
          for (const occDate of occurrences) {
            const occKey = isoDate(occDate);
            const exists = payments.some(p => p.bill_id === bill.id && p.due_date === occKey);
            if (!exists) {
              const newPayment: BillPayment = {
                bill_id: bill.id,
                month: occDate.getMonth() + 1,
                year: occDate.getFullYear(),
                due_day: occDate.getDate(),
                due_date: occKey,
                paid: false,
                name: bill.name,
                amount: bill.amount,
              };
              const { data } = await supabase.from("bill_payments").insert(newPayment).select().single();
              if (data) setPayments(prev => [...prev, data]);
            }
          }
        } else {
          // Original monthly cadence — one occurrence per calendar month on due_day.
          for (const { month, year } of availableMonths) {
            const exists = payments.some(p => p.bill_id === bill.id && p.month === month && p.year === year);
            if (!exists) {
              const dueDate = new Date(year, month - 1, bill.due_day);
              const newPayment: BillPayment = {
                bill_id: bill.id, month, year, paid: false,
                name: bill.name, amount: bill.amount, due_day: bill.due_day,
                due_date: isoDate(dueDate),
              };
              const { data } = await supabase.from("bill_payments").insert(newPayment).select().single();
              if (data) setPayments(prev => [...prev, data]);
            }
          }
        }
      }
    }
    ensurePaymentsExist();
  }, [bills, availableMonths]);

  const { months, extraDebtPayment, totalMins } = useMemo(
  () =>
    runDebtPlan(
      debts,
      budget.take_home,
      budget.fixed_expenses,
      debtStrategy
    ));

    const activeDebts = useMemo(
    () => debts.filter(d => !d.deferred).sort((a, b) =>
      debtStrategy === "avalanche" ? b.apr - a.apr : a.balance - b.balance
    ),
    [debts, debtStrategy]
  );
  const deferredDebts = debts.filter(d => d.deferred);
  const goalTotals = useMemo(
    () => ({
      target: goals.reduce((sum, g) => sum + g.target, 0),
      saved: goals.reduce((sum, g) => sum + Math.min(g.saved, g.target), 0),
    }),
    [goals]
  );

  function dateKey(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  const calendarDays = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const isCurrentMonth = selectedYear === today.getFullYear() && selectedMonth === today.getMonth() + 1;
    const firstOfSelected = new Date(selectedYear, selectedMonth - 1, 1);
    const rangeStart = isCurrentMonth ? today : firstOfSelected;
    const lastOfSelected = new Date(selectedYear, selectedMonth, 0);
    const days: Date[] = [];
    const d = new Date(rangeStart);
    while (d <= lastOfSelected) {
      days.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return days;
  }, [selectedMonth, selectedYear, dateKey(new Date())]);

  function buildBillsByDate(allDays: Date[]) {
  const result = buildBillsByDateShared(bills, payments, allDays);

  const now = new Date();
  const todayKey = dateKey(now);
  const todayMonth = now.getMonth() + 1;
  const todayYear = now.getFullYear();
  const todayDay = now.getDate();

  // Rebuild today's bill list using the current due_day,
  // rather than an outdated stored due_date.
  const todayBills: { id: number; name: string; amount: number }[] = [];

  bills.forEach(bill => {
    if (bill.recurring) {
      if (bill.frequency_unit === "week") {
        // Keep weekly bills on their canonical occurrence dates.
        todayBills.push(
          ...(result[todayKey] || []).filter(b => b.id === bill.id)
        );
        return;
      }

      const payment = payments.find(
        p => p.bill_id === bill.id &&
          p.month === todayMonth &&
          p.year === todayYear
      );

      if (payment?.paid) return;

      const dueDay = payment?.due_day ?? bill.due_day;

      if (dueDay === todayDay) {
        todayBills.push({
          id: bill.id,
          name: payment?.name ?? bill.name,
          amount: payment?.amount ?? bill.amount,
        });
      }
    } else if (
      bill.bill_month === todayMonth &&
      bill.bill_year === todayYear &&
      bill.due_day === todayDay
    ) {
      const payment = payments.find(p => p.bill_id === bill.id);
      if (!payment?.paid) {
        todayBills.push({
          id: bill.id,
          name: bill.name,
          amount: bill.amount,
        });
      }
    }
  });

  result[todayKey] = todayBills;

  return result;
}

  const billsByDate = useMemo(
    () => buildBillsByDate(calendarDays),
    [bills, payments, calendarDays]
  );

  const [dailyHours, setDailyHours] = useState<Record<string, string>>({});
  const [dailyShifts, setDailyShifts] = useState<Record<string, Shift>>({});
  const [recurringShifts, setRecurringShifts] = useState<Record<number, Shift>>({});

  // "Regular shift": enter it once, pick the days, and it fills the weekly template.
  const [regStart, setRegStart] = useState("");
  const [regEnd, setRegEnd] = useState("");
  const [regDays, setRegDays] = useState<number[]>([]);
  useEffect(() => {
    if (regStart || regEnd) return;
    const days = Object.keys(recurringShifts).map(Number);
    if (days.length === 0) return;
    const first = recurringShifts[days[0]];
    setRegStart(first.start);
    setRegEnd(first.end);
    setRegDays(days);
  }, [recurringShifts, regStart, regEnd]);

  // Today's card stays put while you're editing it, and a slim "Edit" link
  // brings it back after its shift ends.
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [revealedDay, setRevealedDay] = useState<string | null>(null);

  // Ticks once a minute so today's card can disappear the moment its shift ends.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  const dailyHoursSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!walletSettingsLoaded) return;
    if (dailyHoursSaveTimer.current) clearTimeout(dailyHoursSaveTimer.current);
    dailyHoursSaveTimer.current = setTimeout(() => {
      const dates = Array.from(new Set([...Object.keys(dailyHours), ...Object.keys(dailyShifts)]));
      const rows = dates.map(date => ({
        date,
        reg: dailyHours[date] || "",
        ot: "",
        shift_start: dailyShifts[date]?.start || null,
        shift_end: dailyShifts[date]?.end || null,
      }));
      if (rows.length === 0) return;
      supabase.from("daily_hours_log").upsert(rows, { onConflict: "date" }).then(({ error }) => {
        if (error) console.error("daily_hours_log save failed:", error);
      });
    }, 800);
    return () => { if (dailyHoursSaveTimer.current) clearTimeout(dailyHoursSaveTimer.current); };
  }, [dailyHours, dailyShifts, walletSettingsLoaded]);

  // Editing a shift time also stores the paid hours it works out to, so the
  // pay projection keeps reading plain hours.
  function setDayShift(key: string, dow: number, field: "start" | "end", value: string) {
    const cur = dailyShifts[key] ?? recurringShifts[dow] ?? { start: "", end: "" };
    const next: Shift = { ...cur, [field]: value };
    const hrs = shiftHours(next);
    setDailyShifts(prev => ({ ...prev, [key]: next }));
    setDailyHours(prev => ({ ...prev, [key]: hrs }));
    if (hrs !== "") fireQuestEvent("money_hours_logged");
  }

  // Weekly recurring hours template (0=Sun..6=Sat). A day with no explicit
  // dailyHours entry falls back to its weekday's recurring value, so
  // future months don't sit blank unless you want them to. An explicit
  // dailyHours entry for a specific date always wins over the template.
  const [recurringHours, setRecurringHours] = useState<Record<number, string>>({});
  const recurringHoursSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!walletSettingsLoaded) return;
    if (recurringHoursSaveTimer.current) clearTimeout(recurringHoursSaveTimer.current);
    recurringHoursSaveTimer.current = setTimeout(() => {
      const rows = Object.entries(recurringHours).map(([weekday, v]) => ({
        weekday: Number(weekday),
        reg: v || "",
        ot: "",
        shift_start: recurringShifts[Number(weekday)]?.start || null,
        shift_end: recurringShifts[Number(weekday)]?.end || null,
      }));
      if (rows.length === 0) return;
      supabase.from("recurring_hours").upsert(rows, { onConflict: "weekday" }).then(({ error }) => {
        if (error) console.error("recurring_hours save failed:", error);
      });
    }, 800);
    return () => { if (recurringHoursSaveTimer.current) clearTimeout(recurringHoursSaveTimer.current); };
  }, [recurringHours, recurringShifts, walletSettingsLoaded]);

  async function toggleRecurringWeekday(dow: number, key: string, on: boolean) {
    if (on) {
      const current = dailyHours[key] ?? recurringHours[dow] ?? "";
      setRecurringHours(prev => ({ ...prev, [dow]: current }));
      const shift = dailyShifts[key] ?? recurringShifts[dow];
      if (shift && shift.start && shift.end) setRecurringShifts(prev => ({ ...prev, [dow]: shift }));
    } else {
      setRecurringHours(prev => {
        const next = { ...prev };
        delete next[dow];
        return next;
      });
      setRecurringShifts(prev => {
        const next = { ...prev };
        delete next[dow];
        return next;
      });
      const { error } = await supabase.from("recurring_hours").delete().eq("weekday", dow);
      if (error) console.error("recurring_hours delete failed:", error);
    }
  }

  // What a day's hours really are right now: its own entry if it has one,
  // otherwise the weekday's recurring value. Mirrors what the Hours input shows.
  function effectiveHours(key: string, dow: number) {
    return parseFloat(dailyHours[key] ?? recurringHours[dow] ?? "") || 0;
  }

  function plannedHours(dow: number) {
    return parseFloat(recurringHours[dow] ?? "") || 0;
  }

  // Writes the regular shift onto the weekly template for the chosen days and
  // clears the template on the rest. Days you've edited by hand keep their own
  // entry; "As planned" on a day sends it back to the template.
  async function applyRegularShift() {
    if (timeToMin(regStart) === null || timeToMin(regEnd) === null || regDays.length === 0) return;
    const shift: Shift = { start: regStart, end: regEnd };
    const hrs = shiftHours(shift);
    const nextShifts: Record<number, Shift> = {};
    const nextHours: Record<number, string> = {};
    regDays.forEach(d => { nextShifts[d] = shift; nextHours[d] = hrs; });
    const removed = [0, 1, 2, 3, 4, 5, 6].filter(d => recurringHours[d] !== undefined && !regDays.includes(d));
    setRecurringShifts(nextShifts);
    setRecurringHours(nextHours);
    if (removed.length > 0) {
      const { error } = await supabase.from("recurring_hours").delete().in("weekday", removed);
      if (error) console.error("recurring_hours delete failed:", error);
    }
    fireQuestEvent("money_hours_logged");
  }

  // One-tap shift fixes: move the end time, or mark the day off.
  function applyShiftChip(key: string, dow: number, chip: typeof SHIFT_CHIPS[number]["id"]) {
    if (chip === "off") {
      setDailyShifts(prev => ({ ...prev, [key]: { start: "", end: "" } }));
      setDailyHours(prev => ({ ...prev, [key]: "0" }));
      fireQuestEvent("money_hours_logged");
      return;
    }
    const cur = dailyShifts[key] ?? recurringShifts[dow];
    const startMin = timeToMin(cur?.start);
    const endMin = timeToMin(cur?.end);
    if (!cur || startMin === null || endMin === null) return;
    const delta = SHIFT_CHIPS.find(c => c.id === chip)?.delta ?? 0;
    let newEnd = endMin + delta;
    // Don't let a same-day shift slide back past its own start.
    if (endMin > startMin && newEnd <= startMin) newEnd = startMin + 1;
    const next: Shift = { ...cur, end: minToTime(newEnd) };
    setDailyShifts(prev => ({ ...prev, [key]: next }));
    setDailyHours(prev => ({ ...prev, [key]: shiftHours(next) }));
    fireQuestEvent("money_hours_logged");
  }

  // True once today's shift has ended (never for days with no shift times).
  function isShiftOver(key: string, dow: number) {
    const end = shiftEndsAt(key, dailyShifts[key] ?? recurringShifts[dow]);
    return !!end && nowTick >= end.getTime();
  }

  // Drop a day's own entry so it goes back to following the weekly template.
  async function resetDayHours(key: string) {
    setDailyHours(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setDailyShifts(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    const { error } = await supabase.from("daily_hours_log").delete().eq("date", key);
    if (error) console.error("daily_hours_log delete failed:", error);
  }

  // Per-month starting balance for the Money Calendar, keyed "YYYY-M".
  // Only the current month uses budget.current_balance (today's real
  // balance) — every other month starts blank until set here, so future
  // months never silently inherit another month's number.
  const [monthBalances, setMonthBalances] = useState<Record<string, string>>({});
  const monthBalancesSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!walletSettingsLoaded) return;
    if (monthBalancesSaveTimer.current) clearTimeout(monthBalancesSaveTimer.current);
    monthBalancesSaveTimer.current = setTimeout(() => {
      const rows = Object.entries(monthBalances)
        .filter(([, v]) => v !== "")
        .map(([ym, v]) => {
          const [year, month] = ym.split("-").map(Number);
          return { month, year, starting_balance: parseFloat(v) || 0 };
        });
      if (rows.length === 0) return;
      supabase.from("wallet_month_balances").upsert(rows, { onConflict: "month,year" }).then(({ error }) => {
        if (error) console.error("wallet_month_balances save failed:", error);
      });
    }, 800);
    return () => { if (monthBalancesSaveTimer.current) clearTimeout(monthBalancesSaveTimer.current); };
  }, [monthBalances, walletSettingsLoaded]);

  function setMonthBalance(month: number, year: number, value: string) {
    setMonthBalances(prev => ({ ...prev, [`${year}-${month}`]: value }));
  }


  function currentWeekStartKey() {
    const now = new Date();
    const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    return dateKey(sunday);
  }

  const [priorWeekHours, setPriorWeekHours] = useState<{ weekStart: string; reg: string; ot: string }>({
    weekStart: currentWeekStartKey(), reg: "", ot: "",
  });

  // The day the typed "worked this week" number runs up to (it covers Sunday
  // through the day before this date). Finished days from here on are added
  // automatically from what's on their day cards.
  const [priorAnchor, setPriorAnchor] = useState("");

  // The anchor for a typed number. If today's shift is already over, the
  // number you see (and edit) already includes today's hours, so counting
  // starts tomorrow. Otherwise the field would add today's hours on top of
  // whatever you type and keep refilling itself while you backspace.
  function typedAnchorKey() {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (isShiftOver(dateKey(d), d.getDay())) d.setDate(d.getDate() + 1);
    return dateKey(d);
  }

  function setPriorWeekHoursValue(value: string) {
    setPriorWeekHours({ weekStart: currentWeekStartKey(), reg: value, ot: "" });
    setPriorAnchor(typedAnchorKey());
  }

  // An older typed number has no anchor yet: treat it as covering through
  // yesterday, so nothing already in it gets counted twice.
  useEffect(() => {
    if (!walletSettingsLoaded || priorAnchor) return;
    if (priorWeekHours.weekStart === currentWeekStartKey() && priorWeekHours.reg !== "") {
      setPriorAnchor(typedAnchorKey());
    }
  }, [walletSettingsLoaded, priorAnchor, priorWeekHours]);

  // Hours worked Sunday through yesterday that the pay projection uses: the
  // typed number (if any) plus every finished day since its anchor, read from
  // the day's own entry or the weekly template. A new week starts from zero
  // and fills itself in as each day ends.
  // Once today's shift has ended its hours move into this total (and out of the
  // calendar's own count) right then, not at midnight.
  const todayKeyNow = dateKey(new Date());
  const todayDone = isShiftOver(todayKeyNow, new Date().getDay());

  const priorWeekEffective = (() => {
    const now = new Date();
    const todayD = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sundayD = new Date(todayD.getFullYear(), todayD.getMonth(), todayD.getDate() - todayD.getDay());
    const sundayKey = dateKey(sundayD);
    const sameWeek = priorWeekHours.weekStart === sundayKey;
    const base = sameWeek ? parseFloat(priorWeekHours.reg) || 0 : 0;
    let anchorKey = sameWeek && priorAnchor ? priorAnchor : sundayKey;
    if (anchorKey < sundayKey) anchorKey = sundayKey;
    const [ay, am, ad] = anchorKey.split("-").map(Number);
    let auto = 0;
    const endD = todayDone ? new Date(todayD.getFullYear(), todayD.getMonth(), todayD.getDate() + 1) : todayD;
    for (let day = new Date(ay, am - 1, ad); day < endD; day.setDate(day.getDate() + 1)) {
      auto += parseFloat(dailyHours[dateKey(day)] ?? recurringHours[day.getDay()] ?? "") || 0;
    }
    const raw = sameWeek ? priorWeekHours.reg : "";
    const total = round2(base + auto);
    return {
      weekStart: sundayKey,
      // Show exactly what was typed until a finished day gets added on top.
      reg: auto === 0 ? raw : String(total),
      ot: "",
    };
  })();

  const [closedWeekHours, setClosedWeekHours] = useState<{ weekStart: string; reg: string; ot: string }>({
    weekStart: "", reg: "", ot: "",
  });

  const payPeriodSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!walletSettingsLoaded) return;
    if (payPeriodSaveTimer.current) clearTimeout(payPeriodSaveTimer.current);
    payPeriodSaveTimer.current = setTimeout(() => {
      supabase.from("wallet_pay_period").upsert({
        id: 1,
        prior_week_start: priorWeekHours.weekStart,
        prior_week_reg: priorWeekHours.reg,
        prior_week_ot: priorWeekHours.ot,
        prior_week_anchor: priorAnchor || null,
        closed_week_start: closedWeekHours.weekStart,
        closed_week_reg: closedWeekHours.reg,
        closed_week_ot: closedWeekHours.ot,
      }).then(({ error }) => {
        if (error) console.error("wallet_pay_period save failed:", error);
      });
    }, 800);
    return () => { if (payPeriodSaveTimer.current) clearTimeout(payPeriodSaveTimer.current); };
  }, [priorWeekHours, priorAnchor, closedWeekHours, walletSettingsLoaded]);

  function setClosedWeekHoursValue(weekStart: string, value: string) {
    setClosedWeekHours({ weekStart, reg: value, ot: "" });
  }

  const [extraFunds, setExtraFunds] = useState<Record<string, string>>({});
  const extraFundsSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!walletSettingsLoaded) return;
    if (extraFundsSaveTimer.current) clearTimeout(extraFundsSaveTimer.current);
    extraFundsSaveTimer.current = setTimeout(() => {
      const rows = Object.entries(extraFunds).map(([date, amount]) => ({ date, amount: amount || "" }));
      if (rows.length === 0) return;
      supabase.from("extra_funds_log").upsert(rows, { onConflict: "date" }).then(({ error }) => {
        if (error) console.error("extra_funds_log save failed:", error);
      });
    }, 800);
    return () => { if (extraFundsSaveTimer.current) clearTimeout(extraFundsSaveTimer.current); };
  }, [extraFunds, walletSettingsLoaded]);

  const [extraExpenses, setExtraExpenses] = useState<Record<string, string>>({});
  const extraExpensesSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!walletSettingsLoaded) return;
    if (extraExpensesSaveTimer.current) clearTimeout(extraExpensesSaveTimer.current);
    extraExpensesSaveTimer.current = setTimeout(() => {
      const rows = Object.entries(extraExpenses).map(([date, amount]) => ({ date, amount: amount || "" }));
      if (rows.length === 0) return;
      supabase.from("extra_expenses_log").upsert(rows, { onConflict: "date" }).then(({ error }) => {
        if (error) console.error("extra_expenses_log save failed:", error);
      });
    }, 800);
    return () => { if (extraExpensesSaveTimer.current) clearTimeout(extraExpensesSaveTimer.current); };
  }, [extraExpenses, walletSettingsLoaded]);

  // Days the pay projection looks at: the visible calendar plus the safe-to-spend
  // lookahead past month end (and a little extra), so every day it reads has hours.
  const projectionDays = useMemo(() => {
    if (calendarDays.length === 0) return calendarDays;
    const days = [...calendarDays];
    const last = calendarDays[calendarDays.length - 1];
    for (let i = 1; i <= SAFE_TO_SPEND_LOOKAHEAD_DAYS + 7; i++) {
      const next = new Date(last);
      next.setDate(next.getDate() + i);
      days.push(next);
    }
    return days;
  }, [calendarDays]);

  // You log total hours per day. Walking each Sunday–Saturday week in order,
  // the first 40 hours (counting any hours already worked before the calendar
  // starts) are regular and everything after is OT. `split` is the reg/OT shape
  // the shared pay projection expects; `otByDay` drives the on-screen OT notes.
  const payHours = useMemo(() => {
    const split: Record<string, { reg: string; ot: string }> = {};
    const otByDay: Record<string, number> = {};
    const weekRunning: Record<string, number> = {};
    const offsets: Record<string, number> = {};
    const addOffset = (w: { weekStart: string; reg: string; ot: string }) => {
      const total = (parseFloat(w.reg) || 0) + (parseFloat(w.ot) || 0);
      if (w.weekStart && total > 0) offsets[w.weekStart] = (offsets[w.weekStart] || 0) + total;
    };
    // Hours worked before the calendar's first day come from exactly one box:
    // the "already worked this week" card in the current month, or the
    // "hours before this calendar starts" card in any other month. Counting
    // both would double count (and a stale saved entry from the other card
    // can push a day into OT that isn't).
    const viewingCurrentMonth = selectedYear === today.getFullYear() && selectedMonth === today.getMonth() + 1;
    addOffset(viewingCurrentMonth ? priorWeekEffective : closedWeekHours);
    projectionDays.forEach(d => {
      const key = dateKey(d);
      const dow = d.getDay();
      const weekKey = dateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow));
      const worked = weekRunning[weekKey] ?? offsets[weekKey] ?? 0;
      // A finished shift today is already inside the "worked this week" total.
      const hours = key === todayKeyNow && todayDone ? 0 : parseFloat(dailyHours[key] ?? recurringHours[dow] ?? "") || 0;
      const regPart = Math.min(hours, Math.max(0, OT_WEEKLY_THRESHOLD - worked));
      const otPart = hours - regPart;
      weekRunning[weekKey] = worked + hours;
      split[key] = { reg: String(round2(regPart)), ot: String(round2(otPart)) };
      otByDay[key] = otPart;
    });
    return { split, otByDay };
  }, [projectionDays, dailyHours, recurringHours, priorWeekEffective.reg, priorWeekEffective.weekStart, todayDone, closedWeekHours, selectedMonth, selectedYear]);

  const effectiveOtWage = parseFloat(otWageOverride) > 0 ? parseFloat(otWageOverride) : budget.hourly_wage * 1.5;
  const netHourlyWage = budget.hourly_wage > 0 ? budget.hourly_wage * (1 - taxRate / 100) : 0;
  const netOtWage = effectiveOtWage > 0 ? effectiveOtWage * (1 - taxRate / 100) : 0;

  // Everything the shared pay projection needs, gathered from page state.
  const payInputs: PayProjectionInputs = {
    hourlyWage: budget.hourly_wage || 0,
    otWage: effectiveOtWage || 0,
    netToGrossRatio: budget.net_to_gross_ratio,
    flatDeductionsPrev: budget.flat_deductions_prev,
    taxRate,
    earlyPayPreset,
    priorWeekHours: splitWeekForPay(priorWeekEffective),
    closedWeekHours: splitWeekForPay(closedWeekHours),
    dailyHours: payHours.split,
    recurringHours: {},
    extraFunds,
    extraExpenses,
  };

  function buildMoneyCalendarRows(allDays: Date[], startingBalance: number, billsMap: Record<string, { id: number; name: string; amount: number }[]> = billsByDate) {
    return buildMoneyCalendarRowsShared(payInputs, allDays, startingBalance, billsMap);
  }


  const isCalendarCurrentMonth = selectedYear === today.getFullYear() && selectedMonth === today.getMonth() + 1;
  const calendarMonthKey = `${selectedYear}-${selectedMonth}`;
  const calendarStartingBalance = isCalendarCurrentMonth
    ? (budget.current_balance || 0)
    : (parseFloat(monthBalances[calendarMonthKey]) || 0);

  const moneyCalendarResult = useMemo(
    () => buildMoneyCalendarRows(calendarDays, calendarStartingBalance),
    [calendarDays, billsByDate, dailyHours, recurringHours, payHours, extraFunds, extraExpenses, netHourlyWage, netOtWage, calendarStartingBalance, budget.hourly_wage, budget.net_to_gross_ratio, budget.flat_deductions_prev, taxRate, earlyPayPreset, effectiveOtWage, priorWeekEffective.reg, priorWeekEffective.weekStart, closedWeekHours]
  );

  const moneyCalendarWeekChunks = useMemo(() => {
    const rows = moneyCalendarResult.rows;
    const chunks: { title: string; rows: typeof rows }[] = [];
    for (let i = 0; i < rows.length; i += 7) {
      const chunkRows = rows.slice(i, i + 7);
      const first = chunkRows[0].date;
      const last = chunkRows[chunkRows.length - 1].date;
      const title = first.getTime() === last.getTime()
        ? first.toLocaleDateString(undefined, { month: "short", day: "numeric" })
        : `${first.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${last.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
      chunks.push({ title, rows: chunkRows });
    }
    return chunks;
  }, [moneyCalendarResult]);

  // Which week blocks are open, keyed by the week's first day. A week with no
  // entry here defaults to open only if it's the first one on screen (the
  // week containing today, or the first week of a future month).
  const [weekOpen, setWeekOpen] = useState<Record<string, boolean>>({});

  const monthBills = useMemo(() => {
    const rows: (Bill & { name: string; amount: number; due_day: number; paid: boolean; late: boolean; days: number; paymentId?: number })[] = [];

    bills.forEach(bill => {
      if (bill.recurring) {
        const occurrences = payments.filter(p => p.bill_id === bill.id && p.month === selectedMonth && p.year === selectedYear);

        if (occurrences.length === 0) {
          // Fallback row while ensurePaymentsExist is still generating this month's payment(s)
          const due_day = bill.due_day;
          rows.push({
            ...bill, name: bill.name, amount: bill.amount, due_day, paid: false,
            late: isLate(due_day, selectedMonth, selectedYear, false),
            days: daysUntilDue(due_day, selectedMonth, selectedYear),
            paymentId: undefined,
          });
          return;
        }

        occurrences.forEach(payment => {
          const paid = payment.paid ?? false;
          const name = payment.name ?? bill.name;
          const amount = payment.amount ?? bill.amount;
          const due_day = payment.due_day ?? bill.due_day;
          rows.push({
            ...bill, name, amount, due_day, paid,
            late: isLate(due_day, selectedMonth, selectedYear, paid),
            days: daysUntilDue(due_day, selectedMonth, selectedYear),
            paymentId: payment.id,
          });
        });
      } else if (bill.bill_month === selectedMonth && bill.bill_year === selectedYear) {
        const payment = payments.find(p => p.bill_id === bill.id && p.month === selectedMonth && p.year === selectedYear);
        const paid = payment?.paid ?? false;
        const due_day = bill.due_day;
        rows.push({
          ...bill, name: bill.name, amount: bill.amount, due_day, paid,
          late: isLate(due_day, selectedMonth, selectedYear, paid),
          days: daysUntilDue(due_day, selectedMonth, selectedYear),
          paymentId: payment?.id,
        });
      }
    });

    return rows.sort((a, b) => a.due_day - b.due_day);
  }, [bills, payments, selectedMonth, selectedYear]);

  const urgentBills = monthBills.filter(b => !b.paid && b.days <= 7 && b.days >= 0);
  const totalMonthlyBills = monthBills.reduce((s, b) => s + b.amount, 0);
  const paidTotal = monthBills.filter(b => b.paid).reduce((s, b) => s + b.amount, 0);
  const unpaidTotal = monthBills.filter(b => !b.paid).reduce((s, b) => s + b.amount, 0);

  const calcRegWageNum = parseFloat(calcRegWage) || 0;
  const calcOtWageNum = parseFloat(calcOtWage) || 0;
  const calcRegHoursNum = parseFloat(calcRegHours) || 0;
  const calcOtHoursNum = parseFloat(calcOtHours) || 0;
  const calcHasInput = calcRegWageNum > 0 && calcRegHoursNum > 0;
  const calcGrossPerPeriod = calcRegWageNum * calcRegHoursNum + calcOtWageNum * calcOtHoursNum;
  const calcEstMonthlyTakeHome = calcGrossPerPeriod * PERIOD_MULTIPLIERS[calcPeriod];

  async function processMonthlyMinimums(debtList: Debt[]) {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const updates: Promise<void>[] = [];
    const updatedDebts = debtList.map(debt => {
      if (debt.paid_off || debt.last_processed_month === currentMonth) return debt;
      const interest = debt.balance * (debt.apr / 100 / 12);
      const newBalance = Math.max(0, debt.balance + interest - debt.min_payment);
      updates.push(Promise.resolve(supabase.from("debts").update({ balance: newBalance, last_processed_month: currentMonth }).eq("id", debt.id).then(() => {})));
      return { ...debt, balance: newBalance, last_processed_month: currentMonth };
    });
    await Promise.all(updates);
    if (updates.length > 0) setDebts(updatedDebts);
  }

  async function togglePaid(bill: typeof monthBills[0]) {
    const newPaid = !bill.paid;
    if (bill.paymentId) {
      await supabase.from("bill_payments").update({ paid: newPaid, paid_at: newPaid ? new Date().toISOString() : null }).eq("id", bill.paymentId);
      setPayments(prev => prev.map(p => p.id === bill.paymentId ? { ...p, paid: newPaid } : p));
    } else {
      const newPayment: BillPayment = { bill_id: bill.id, month: selectedMonth, year: selectedYear, paid: newPaid, paid_at: newPaid ? new Date().toISOString() : undefined };
      const { data } = await supabase.from("bill_payments").insert(newPayment).select().single();
      if (data) setPayments(prev => [...prev, data]);
    }

    if (newPaid) {
      setCelebration({ title: "BILL PAID!", subtitle: bill.name });
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3200);
    }
  }

  
async function updateMonthBill(
  bill: typeof monthBills[0],
  field: "name" | "amount" | "due_day",
  value: string | number
) {
  if (bill.recurring) {
    const updates: Record<string, any> = { [field]: value };

    // Keep the canonical payment date synchronized with the edited day.
    if (field === "due_day" && bill.frequency_unit !== "week") {
      const day = Number(value);
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      const safeDay = Math.min(Math.max(1, day), lastDay);

      updates.due_date = isoDate(
        new Date(selectedYear, selectedMonth - 1, safeDay)
      );
    }

    if (bill.paymentId) {
      const { error } = await supabase
        .from("bill_payments")
        .update(updates)
        .eq("id", bill.paymentId);

      if (error) {
        console.error("updateMonthBill failed:", error);
        return;
      }

      setPayments(prev =>
        prev.map(p =>
          p.id === bill.paymentId ? { ...p, ...updates } : p
        )
      );
    } else {
      const newPayment: BillPayment = {
        bill_id: bill.id,
        month: selectedMonth,
        year: selectedYear,
        paid: false,
        name: bill.name,
        amount: bill.amount,
        due_day: bill.due_day,
        ...updates,
      };

      const { data, error } = await supabase
        .from("bill_payments")
        .insert(newPayment)
        .select()
        .single();

      if (error) {
        console.error("updateMonthBill insert failed:", error);
        return;
      }

      if (data) setPayments(prev => [...prev, data]);
    }
  } else {
    const { error } = await supabase
      .from("bills")
      .update({ [field]: value })
      .eq("id", bill.id);

    if (error) {
      console.error("updateMonthBill (bills) failed:", error);
      return;
    }

    setBills(prev =>
      prev.map(b =>
        b.id === bill.id ? { ...b, [field]: value } : b
      )
    );
  }
}


  async function saveBudgetCalc() {
    if (!calcHasInput) return;
    await updateBudget("hourly_wage", calcRegWageNum);
    await updateBudget("take_home", calcEstMonthlyTakeHome);
    setBudgetSavedMsg(true);
    setTimeout(() => setBudgetSavedMsg(false), 2000);
  }

  async function addGoal() {
    const name = newGoalName.trim();
    const target = parseFloat(newGoalTarget);
    if (!name || !(target > 0)) return;
    const position = goals.length > 0 ? Math.max(...goals.map(g => g.position)) + 1 : 0;
    const { data, error } = await supabase
      .from("savings_goals")
      .insert({ name, target, saved: 0, position })
      .select()
      .single();
    if (error) { console.error("addGoal failed:", error); return; }
    fireQuestEvent("savings_goal_added");
    if (data) setGoals(prev => [...prev, { ...data, target: Number(data.target) || 0, saved: Number(data.saved) || 0 }]);
    setNewGoalName("");
    setNewGoalTarget("");
  }

  async function updateGoal(id: number, patch: Partial<Pick<SavingsGoal, "name" | "target" | "saved">>) {
    setGoals(prev => prev.map(g => (g.id === id ? { ...g, ...patch } : g)));
    const { error } = await supabase.from("savings_goals").update(patch).eq("id", id);
    if (error) { console.error("updateGoal failed:", error); return; }
    const before = goals.find(g => g.id === id);
    if (before) {
      const after = { ...before, ...patch };
      if (after.target > 0 && after.saved >= after.target) fireQuestEvent("savings_goal_completed");
    }
    // Only a saved/target edit can complete a goal. The growth check's own
    // hamster_credited flag is what actually prevents double-awarding.
    if (patch.saved !== undefined || patch.target !== undefined) notifyGrowth();
  }

  async function moveGoal(id: number, dir: -1 | 1) {
    const idx = goals.findIndex(g => g.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= goals.length) return;
    const next = [...goals];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    const renumbered = next.map((g, i) => ({ ...g, position: i }));
    setGoals(renumbered);
    const changed = renumbered.filter(g => goals.find(o => o.id === g.id)?.position !== g.position);
    const results = await Promise.all(
      changed.map(g => supabase.from("savings_goals").update({ position: g.position }).eq("id", g.id))
    );
    if (results.some(r => r.error)) console.error("moveGoal failed:", results.map(r => r.error).filter(Boolean));
  }

  async function deleteGoal(id: number) {
    setGoals(prev => prev.filter(g => g.id !== id));
    const { error } = await supabase.from("savings_goals").delete().eq("id", id);
    if (error) console.error("deleteGoal failed:", error);
  }

  async function addBill() {
    const isWeekly = newBill.recurring && newBill.frequency_unit === "week";
    if (!newBill.name || !newBill.amount) return;
    if (isWeekly ? !newBill.anchor_date : !newBill.due_day) return;

    const interval = Math.max(1, parseInt(newBill.frequency_interval) || 1);
    const due_day = isWeekly
      ? parseInt(newBill.anchor_date.split("-")[2], 10)
      : parseInt(newBill.due_day);

    const bill: Bill = {
      id: nextBillId,
      name: newBill.name,
      amount: parseFloat(newBill.amount),
      due_day,
      recurring: newBill.recurring,
      bill_month: newBill.recurring ? undefined : selectedMonth,
      bill_year: newBill.recurring ? undefined : selectedYear,
      frequency_unit: newBill.recurring ? newBill.frequency_unit : undefined,
      frequency_interval: isWeekly ? interval : undefined,
      anchor_date: isWeekly ? newBill.anchor_date : null,
    };
    setBills(prev => [...prev, bill].sort((a, b) => a.due_day - b.due_day));
    setNextBillId(n => n + 1);
    await supabase.from("bills").insert(bill);
    setNewBill({ name: "", amount: "", due_day: "", recurring: billsTab === "recurring", frequency_unit: "month", frequency_interval: "1", anchor_date: "" });
    setShowBillForm(false);
  }

  async function removeBill(id: number) {
    setBills(prev => prev.filter(b => b.id !== id));
    setPayments(prev => prev.filter(p => p.bill_id !== id));
    await supabase.from("bill_payments").delete().eq("bill_id", id);
    await supabase.from("bills").delete().eq("id", id);
  }

  function openBillForm(recurring: boolean) {
    setNewBill(p => ({ ...p, recurring }));
    setShowBillForm(v => !v);
  }

  // Edit a recurring bill once and push the change to every unpaid month
  // from the current month forward. Paid months keep what they were.
  async function updateRecurringBill(
    bill: Bill,
    patch: Partial<Pick<Bill, "name" | "amount" | "due_day" | "frequency_interval" | "anchor_date">>
  ) {
    const isWeekly = bill.frequency_unit === "week";
    const updated: Bill = { ...bill, ...patch };
    if (isWeekly && patch.anchor_date) {
      const day = parseInt(patch.anchor_date.split("-")[2], 10);
      if (day) updated.due_day = day;
    }
    const dbPatch: Record<string, unknown> = { ...patch };
    if (updated.due_day !== bill.due_day) dbPatch.due_day = updated.due_day;

    const curIdx = today.getFullYear() * 12 + today.getMonth();
    const isUpcomingUnpaid = (p: BillPayment) =>
      p.bill_id === bill.id && !p.paid && p.year * 12 + (p.month - 1) >= curIdx;
    const affected = payments.filter(isUpcomingUnpaid);
    const scheduleChanged = isWeekly && (patch.anchor_date !== undefined || patch.frequency_interval !== undefined);

    setBills(prev => prev.map(b => (b.id === bill.id ? updated : b)).sort((a, b) => a.due_day - b.due_day));
    if (scheduleChanged) {
      // The set of due dates changes, so drop the unpaid upcoming ones and
      // let ensurePaymentsExist regenerate them from the new schedule.
      setPayments(prev => prev.filter(p => !isUpcomingUnpaid(p)));
    }

    const { error } = await supabase.from("bills").update(dbPatch).eq("id", bill.id);
    if (error) {
      console.error("updateRecurringBill failed:", error);
      setBills(prev => prev.map(b => (b.id === bill.id ? bill : b)));
      if (scheduleChanged) setPayments(prev => [...prev, ...affected]);
      return;
    }

    if (scheduleChanged) {
      const ids = affected.map(p => p.id).filter((id): id is number => id !== undefined);
      if (ids.length > 0) await supabase.from("bill_payments").delete().in("id", ids);
      return;
    }

    const payUpdates: Record<string, unknown> = {};
    if (patch.name !== undefined) payUpdates.name = patch.name;
    if (patch.amount !== undefined) payUpdates.amount = patch.amount;
    const dueChanged = !isWeekly && patch.due_day !== undefined;

    const buildUpdate = (p: BillPayment) => {
      const u: Record<string, unknown> = { ...payUpdates };
      if (dueChanged) {
        const lastDay = new Date(p.year, p.month, 0).getDate();
        const day = Math.min(Math.max(1, Number(patch.due_day)), lastDay);
        u.due_day = Number(patch.due_day);
        u.due_date = isoDate(new Date(p.year, p.month - 1, day));
      }
      return u;
    };

    if (affected.length === 0 || (Object.keys(payUpdates).length === 0 && !dueChanged)) return;
    setPayments(prev => prev.map(p => (isUpcomingUnpaid(p) ? { ...p, ...buildUpdate(p) } : p)));
    await Promise.all(
      affected.map(p => supabase.from("bill_payments").update(buildUpdate(p)).eq("id", p.id))
    );
  }

  function renderBillForm() {
    return (
<div className="form-panel is-accent">
                    <div className="section-label">{newBill.recurring ? "New recurring bill" : `One-time bill for ${MONTH_NAMES[selectedMonth - 1]}`}</div>
                    <div className="field-grid">
                      <div>
                        <div className="form-label">Bill Name</div>
                        <input className="form-input" type="text" placeholder="e.g. Rent" value={newBill.name} onChange={e => setNewBill(p => ({ ...p, name: e.target.value }))} />
                      </div>
                      <div>
                        <div className="form-label">Amount ($)</div>
                        <input className="form-input" type="number" placeholder="e.g. 1375" value={newBill.amount} onChange={e => setNewBill(p => ({ ...p, amount: e.target.value }))} />
                      </div>

                      {newBill.recurring && (
                        <div>
                          <div className="form-label">Frequency</div>
                          <select
                            className="form-input"
                            value={newBill.frequency_unit}
                            onChange={e => setNewBill(p => ({ ...p, frequency_unit: e.target.value as "month" | "week" }))}
                          >
                            <option value="month">Once a month</option>
                            <option value="week">Every N weeks</option>
                          </select>
                        </div>
                      )}

                      {newBill.recurring && newBill.frequency_unit === "week" ? (
                        <>
                          <div>
                            <div className="form-label">First Due Date</div>
                            <input className="form-input" type="date" value={newBill.anchor_date} onChange={e => setNewBill(p => ({ ...p, anchor_date: e.target.value }))} />
                          </div>
                          <div>
                            <div className="form-label">Every how many weeks?</div>
                            <input className="form-input" type="number" min="1" placeholder="e.g. 2" value={newBill.frequency_interval} onChange={e => setNewBill(p => ({ ...p, frequency_interval: e.target.value }))} />
                          </div>
                        </>
                      ) : (
                        <div>
                          <div className="form-label">Due Day</div>
                          <input className="form-input" type="number" placeholder="e.g. 1" value={newBill.due_day} onChange={e => setNewBill(p => ({ ...p, due_day: e.target.value }))} />
                        </div>
                      )}
                    </div>
                    <button className="btn btn-green btn-block" onClick={addBill}>Save Bill</button>
                  </div>
    );
  }

  async function updateDebt(id: number, field: keyof Debt, val: string | number | boolean) {
    setDebts(prev => prev.map(d => d.id === id ? { ...d, [field]: val } : d));
    await supabase.from("debts").update({ [field]: val }).eq("id", id);
  }

  async function addDebt(deferred = false) {
    const newDebt: Debt = { id: nextId, name: "New Debt", balance: 0, original_balance: 0, apr: 0, min_payment: 0, deferred };
    setDebts(prev => [...prev, newDebt]);
    setNextId(n => n + 1);
    await supabase.from("debts").insert(newDebt);
  }

  async function markDebtPaid(id: number, name: string) {
    setDebts(prev => prev.map(d => d.id === id ? { ...d, balance: 0, paid_off: true } : d));
    await supabase.from("debts").update({ balance: 0, paid_off: true }).eq("id", id);
    setCelebration({ title: "DEBT PAID OFF!", subtitle: name });
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 4000);
  }

  async function unmarkDebtPaid(id: number) {
    setDebts(prev => prev.map(d => d.id === id ? { ...d, paid_off: false } : d));
    await supabase.from("debts").update({ paid_off: false }).eq("id", id);
  }

  async function activateDebt(id: number) {
    const debt = debts.find(d => d.id === id);
    if (!debt) return;
    const original = debt.original_balance || debt.balance;
    setDebts(prev => prev.map(d => d.id === id ? { ...d, deferred: false, original_balance: original } : d));
    await supabase.from("debts").update({ deferred: false, original_balance: original }).eq("id", id);
  }

  async function removeDebt(id: number) {
    setDebts(prev => prev.filter(d => d.id !== id));
    await supabase.from("debts").delete().eq("id", id);
  }

  async function updateBudget(field: keyof Budget, val: number) {
    const nextBudget = { ...budget, [field]: val };
    setBudget(nextBudget);
    const { error } = await supabase.from("budget").upsert({ id: 1, ...nextBudget });
    if (error) {
      console.error("updateBudget failed:", error);
      setBudgetSaveError(error.message || "Save failed — see console for details.");
    } else {
      setBudgetSaveError("");
    }
  }

  const payoffMonth = months.length;
  const finalDeferred = months.length > 0
    ? Object.values(months[months.length - 1].deferredBalances).reduce((s, v) => s + v, 0)
    : deferredDebts.reduce((s, d) => s + d.balance, 0);

  const Confetti = () => {
    const colors = ["var(--pink-dark)","var(--green-dark)","var(--pink-light-solid)","var(--ink-soft)","var(--gold-light-solid)"];
    return (
      <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 9999, overflow: "hidden" }}>
        {Array.from({ length: 60 }).map((_, i) => (
          <div key={i} style={{ position: "absolute", left: `${Math.random() * 100}%`, top: "-10px", width: `${Math.random() * 8 + 4}px`, height: `${Math.random() * 8 + 4}px`, background: colors[Math.floor(Math.random() * colors.length)], borderRadius: Math.random() > 0.5 ? "50%" : "0", animation: `fall ${Math.random() * 2 + 2}s linear ${Math.random() * 2}s forwards` }} />
        ))}
        <style>{`@keyframes fall { to { transform: translateY(100vh) rotate(720deg); opacity: 0; } }`}</style>
        <div className="celebrate-box">
                    <Polly mood="cheering" size="large" animate={false} />
          <div className="celebrate-title">{celebration.title}</div>
          <div className="celebrate-sub">{celebration.subtitle}</div>
          <div className="celebrate-note">Keep going — you are crushing it!</div>
        </div>
      </div>
    );
  };

    const VIEW_TITLES: Record<typeof view, { text: string; icon?: IconName }> = {
    home: { text: "Overview", icon: "title-wallet" },
    plan: { text: "Plan", icon: "piggy-bank" },
    calendar: { text: "Money Calendar", icon: "calendar" },
    bills: { text: "Bills", icon: "house" },
    debts: { text: "Debts", icon: "calculator-hearts" },
  };

  const WALLET_TABS: PageTab<typeof view>[] = [
    { key: "home", label: "Overview", icon: "title-wallet" },
    { key: "plan", label: "Plan", icon: "piggy-bank" },
    { key: "calendar", label: "Money Calendar", icon: "calendar" },
    { key: "bills", label: "Bills", icon: "house" },
    { key: "debts", label: "Debts", icon: "calculator-hearts" },
  ];

  return (
    <div>
      {showConfetti && <Confetti />}

      <div className="page-header">
        <h1><PageTitleLogo name="wallet" height={28} /></h1>
      </div>

      <h2 className="view-title">
        {VIEW_TITLES[view].icon && <Icon name={VIEW_TITLES[view].icon!} size={20} />} {VIEW_TITLES[view].text}
      </h2>

      <PageTabs
        tabs={WALLET_TABS}
        active={view}
        onChange={setView}
      />

      <div className="page-body">

        {view === "home" && (
          <>

            {urgentBills.length > 0 && (
              <div className="alert is-danger">
                Bills due within 7 days: {urgentBills.map(b => `${b.name} (${fmt(b.amount)}) in ${b.days}d`).join(" · ")}
              </div>
            )}

            {/* ── SAVINGS GOALS ── */}
            <div className="card">
              <div className="card-body">
                <div className="section-head">
                  <div className="section-label"><Icon name="piggy-bank" size={16} /> Savings Goals</div>
                  <button className="pill-btn" onClick={() => setShowGoalForm(v => !v)}>+ Add Goal</button>
                </div>

                {showGoalForm && (
                  <div className="add-row subsection-end">
                    <input
                      type="text"
                      className="form-input grow-2"
                      placeholder="What do you want?"
                      value={newGoalName}
                      onChange={e => setNewGoalName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") addGoal(); }}
                      autoFocus
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      className="form-input grow"
                      placeholder="How much?"
                      value={newGoalTarget}
                      onChange={e => setNewGoalTarget(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") addGoal(); }}
                    />
                    <button className="btn btn-green btn-sm" onClick={addGoal}>Add</button>
                  </div>
                )}

                {goals.length === 0 ? (
                  <EmptyState image={emptyWallet} message="No savings goals yet. Add something you're saving for." />
                ) : (
                  <>
                    <p className="hint-text">
                      {fmt(goalTotals.saved)} saved of {fmt(goalTotals.target)} across {goals.length} {goals.length === 1 ? "goal" : "goals"}. Top of the list is what you want first.
                    </p>

                    <div className="goal-list">
                      {goals.map((g, i) => {
                        const done = g.target > 0 && g.saved >= g.target;
                        const fill = g.target > 0 ? Math.min(100, (g.saved / g.target) * 100) : 0;
                        const remaining = Math.max(0, g.target - g.saved);
                        return (
                          <div key={g.id} className="goal-item">
                            <div className="goal-head">
                              <div className="goal-rank">{i + 1}</div>
                              <div className="row-text">
                                <EditableCell
                                  type="text"
                                  value={g.name}
                                  onChange={v => { const name = v.trim(); if (name) updateGoal(g.id, { name }); }}
                                  className="cell-input is-bold"
                                />
                              </div>
                              <button className="row-icon-btn" onClick={() => moveGoal(g.id, -1)} disabled={i === 0} aria-label="Move up">
                                <Icon name="icon-chevronup" size={20} />
                              </button>
                              <button className="row-icon-btn" onClick={() => moveGoal(g.id, 1)} disabled={i === goals.length - 1} aria-label="Move down">
                                <Icon name="icon-chevrondown" size={20} />
                              </button>
                              <button className="row-icon-btn" onClick={() => deleteGoal(g.id)} aria-label="Delete goal">
                                ✕
                              </button>
                            </div>

                            <div className="progress is-thick">
                              <div className={`progress-fill${done ? " is-green" : ""}`} style={{ width: `${fill}%` }} />
                            </div>

                            <div className="goal-foot">
                              <span>Saved $</span>
                              <div className="money-field">
                                <EditableCell
                                  type="number"
                                  value={g.saved || ""}
                                  placeholder="0"
                                  onChange={v => updateGoal(g.id, { saved: Math.max(0, parseFloat(v) || 0) })}
                                />
                              </div>
                              <span>of $</span>
                              <div className="money-field">
                                <EditableCell
                                  type="number"
                                  value={g.target || ""}
                                  placeholder="0"
                                  onChange={v => { const t = parseFloat(v); if (t > 0) updateGoal(g.id, { target: t }); }}
                                />
                              </div>
                              <span className={`goal-status${done ? " is-done" : ""}`}>
                                {done ? "Goal reached!" : `${Math.round(fill)}% · ${fmt(remaining)} to go`}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
            </>
            )}

{view === "calendar" && (
  <>
            <div className="card">
              <div className="card-body">
                <div className="card-heading"><Icon name="calendar" size={24} /> Money Calendar</div>
                <p className="card-sub">
                  Log your shift times (or planned shift times) each day to see your projected pay through the end of the month. Hours past 40 in a Sunday–Saturday week are paid at your OT wage automatically.
                </p>

                <div className="scroll-chips">
                  {availableMonths.map(({ month, year, label }) => (
                    <button
                      key={`${month}-${year}`}
                      onClick={() => { setSelectedMonth(month); setSelectedYear(year); }}
                      className={selectedMonth === month && selectedYear === year ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="field-group">
                  <div className="form-label">Early Pay Settings</div>
                  <select
                    className="form-input"
                    value={earlyPayPresetId}
                    onChange={e => updateEarlyPayPresetId(e.target.value as EarlyPayPresetId)}
                  >
                    {Object.values(EARLY_PAY_PRESETS).map(p => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                  <div className="help-text">
                    {earlyPayPresetId === "amazon"
                      ? "A 2% safety buffer that steps up to 8% once you've logged 55+ hours in the week."
                      : "Set your own safety buffer and hours threshold below."}
                  </div>
                  {earlyPayPresetId === "custom" && (
                    <div className="field-grid">
                      <div>
                        <div className="form-label">Safety Buffer (%)</div>
                        <input
                          type="number" className="form-input"
                          value={customEarlyPayPreset.safetyBufferNormal * 100}
                          onChange={e => updateCustomEarlyPayPreset(prev => ({ ...prev, safetyBufferNormal: (parseFloat(e.target.value) || 0) / 100 }))}
                        />
                      </div>
                      <div>
                        <div className="form-label">High-Hours Buffer (%)</div>
                        <input
                          type="number" className="form-input"
                          value={customEarlyPayPreset.safetyBufferHighHours * 100}
                          onChange={e => updateCustomEarlyPayPreset(prev => ({ ...prev, safetyBufferHighHours: (parseFloat(e.target.value) || 0) / 100 }))}
                        />
                      </div>
                      <div>
                        <div className="form-label">High-Hours Threshold</div>
                        <input
                          type="number" className="form-input"
                          value={customEarlyPayPreset.highHoursThreshold}
                          onChange={e => updateCustomEarlyPayPreset(prev => ({ ...prev, highHoursThreshold: parseFloat(e.target.value) || 0 }))}
                        />
                      </div>
                      <div>
                        <div className="form-label">Garnishments ($)</div>
                        <input
                          type="number" className="form-input"
                          value={customEarlyPayPreset.garnishments}
                          onChange={e => updateCustomEarlyPayPreset(prev => ({ ...prev, garnishments: parseFloat(e.target.value) || 0 }))}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {isCalendarCurrentMonth && new Date().getDay() !== 0 && (
                  <div className="info-card">
                    <div className="form-label">
                      Hours already worked this week (Sun–yesterday)
                    </div>
                    <div className="help-text">
                      The calendar below only starts from today, so this covers the part it can't see. It adds each finished day from your day cards on its own. If it's off, type the right number and it keeps adding from there.
                    </div>
                    <div>
                      <div className="form-label">Hours worked</div>
                      <input
                        type="number" inputMode="decimal" step="0.5" className="form-input" placeholder="0"
                        value={priorWeekEffective.reg}
                        onChange={e => setPriorWeekHoursValue(e.target.value)}
                      />
                      <div className="help-text">
                        Past 40 hours for the week counts as OT automatically.
                      </div>
                    </div>
                  </div>
                )}

                {(() => {
  // Whenever the calendar's visible window doesn't reach back to the
  // Sunday–Saturday week that most recently closed, we need a manual-hours
  // card for that week — it's the week whose remaining payout releases on
  // the next Wednesday. This used to only happen for future/past months
  // (which always start on the 1st), but since the current month's
  // calendar now starts at "today" instead of the 1st, this same gap can
  // open up mid-month too — e.g. viewing today (a Mon/Tue) after last
  // week's closing Saturday but before this week's release Wednesday.

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const rangeStart = isCalendarCurrentMonth
    ? today
    : new Date(selectedYear, selectedMonth - 1, 1);

  // Find the first Wednesday at or after the visible range's start.
  const firstWednesday = new Date(rangeStart);
  while (firstWednesday.getDay() !== 3) {
    firstWednesday.setDate(firstWednesday.getDate() + 1);
  }

  // The pay week closes the Saturday immediately before that Wednesday.
  const closingSaturday = new Date(firstWednesday);
  closingSaturday.setDate(closingSaturday.getDate() - 4);

  // Sunday starting that closed week.
  const periodStartSunday = new Date(closingSaturday);
  periodStartSunday.setDate(periodStartSunday.getDate() - 6);

  // Only current-month view has a fallback for a still-open week (the
  // "hours already worked this week" card + the day-by-day loop). For any
  // other case where this week's Sunday isn't visible — including a
  // genuinely fully-closed week, or a future month like October whose
  // first pay-period starts in the prior month — show this card.
  const weekIsStillOpen = isCalendarCurrentMonth && closingSaturday >= rangeStart;
  if (periodStartSunday >= rangeStart || weekIsStillOpen) return null;

  const periodStartKey = dateKey(periodStartSunday);
  const partlyVisibleWeek = closingSaturday >= rangeStart;
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });

  return (
    <div className="info-card">
      <div className="form-label">
        {partlyVisibleWeek
          ? <>Hours worked {fmt(periodStartSunday)}–{fmt(new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate() - 1))} (before this calendar starts)</>
          : <>Hours worked {fmt(periodStartSunday)}–{fmt(closingSaturday)}</>}
      </div>

      <div className="help-text">
        {partlyVisibleWeek
          ? <>This week started before the calendar's first day. Enter only the hours
            from before {fmt(rangeStart)} here — the days you log below ({fmt(rangeStart)}–{fmt(closingSaturday)}) count
            on their own, and Wednesday {fmt(firstWednesday)} shows the release for the whole week.</>
          : <>This week already closed out before the calendar's visible window,
            so it never had a row to log hours into. Enter it here and
            Wednesday {fmt(firstWednesday)} will show its release using the
            same math as everywhere else.</>}
      </div>

      <div>
        <div className="form-label">Hours worked</div>
        <input
          type="number"
          inputMode="decimal"
          step="0.5"
          className="form-input"
          placeholder="0"
          value={
            closedWeekHours.weekStart === periodStartKey
              ? closedWeekHours.reg
              : ""
          }
          onChange={e =>
            setClosedWeekHoursValue(periodStartKey, e.target.value)
          }
        />
        <div className="help-text">
          Past 40 hours for the week counts as OT automatically.
        </div>
      </div>
    </div>
  );
})()}

                <div className="field-group">
                  <div className="form-label">{isCalendarCurrentMonth ? "Current Balance" : `Starting Balance — ${MONTH_NAMES[selectedMonth - 1]}`}</div>
                  {isCalendarCurrentMonth ? (
                    <>
                      <EditableCell
                        type="number"
                        className="form-input is-big"
                        placeholder="check your bank app, enter it here"
                        value={budget.current_balance || ""}
                        onChange={v => updateBudget("current_balance", parseFloat(v) || 0)}
                      />
                      <div className="help-text">
                        The calendar's running balance starts from this number. Update it whenever you check your real balance for the most accurate picture — it won't drift correct on its own. Syncs across devices now.
                      </div>
                    </>
                  ) : (
                    <>
                      <input
                        type="number"
                        className="form-input is-big"
                        placeholder="not set yet — enter a projected balance when you get closer"
                        value={monthBalances[calendarMonthKey] || ""}
                        onChange={e => setMonthBalance(selectedMonth, selectedYear, e.target.value)}
                      />
                      <div className="help-text">
                        Each future month starts blank — it doesn't inherit today's balance or any other month's number. Enter a projected starting balance for {MONTH_NAMES[selectedMonth - 1]} once you have a sense of it.
                      </div>
                    </>
                  )}
                </div>

                <div className="field-grid">
                  <div>
                    <div className="form-label">Tax Withholding (%)</div>
                    <EditableCell type="number" className="form-input" value={budget.tax_rate ?? ""} placeholder="set in Budget Calculator" onChange={v => updateBudget("tax_rate", parseFloat(v) || 0)} />
                    {budgetSaveError && <div className="help-text is-danger"><Icon name="lightning" size={12} /> {budgetSaveError}</div>}
                  </div>

                  <div>
                    <div className="form-label">Hourly Wage</div>
                    <EditableCell type="number" className="form-input" value={budget.hourly_wage || ""} placeholder="set in Budget Calculator" onChange={v => updateBudget("hourly_wage", parseFloat(v) || 0)} />
                    {budgetSaveError && <div className="help-text is-danger"><Icon name="lightning" size={12} /> {budgetSaveError}</div>}
                  </div>
                  <div>
                    <div className="form-label">OT Wage</div>
                    <input type="number" className="form-input" value={otWageOverride} placeholder={budget.hourly_wage > 0 ? `${(budget.hourly_wage * 1.5).toFixed(2)} (1.5x)` : "e.g. 29.25"} onChange={e => updateOtWageOverride(e.target.value)} />
                  </div>
                  <div className="grid-note">
                    <div className="help-text">leave blank to auto-use 1.5x your hourly wage</div>
                  </div>
                </div>

                <div className="field-grid">
                  <div>
                    <div className="form-label">Net-to-Gross Ratio</div>
                    <EditableCell type="number" className="form-input" value={budget.net_to_gross_ratio || ""} placeholder="e.g. 0.77" onChange={v => updateBudget("net_to_gross_ratio", parseFloat(v) || 0)} />
                    <div className="help-text">
                      Previous paycheck's post-tax ÷ pre-tax earnings, from your pay portal. Update it each payday.
                    </div>
                  </div>
                  <div>
                    <div className="form-label">Flat Deductions ($)</div>
                    <EditableCell type="number" className="form-input" value={budget.flat_deductions_prev || ""} placeholder="e.g. 62.84" onChange={v => updateBudget("flat_deductions_prev", parseFloat(v) || 0)} />
                    <div className="help-text">
                      Flat deductions from your previous paycheck — for most people this is just the health premium.
                    </div>
                  </div>
                </div>

                <details className="fold">
                  <summary className="fold-summary">Not sure what % to enter for tax withholding?</summary>
                  <div className="fold-body">
                    Easiest way: grab a recent pay stub and find the line(s) for federal tax, state tax, Social Security, Medicare, and any benefits/401k deductions. Add those dollar amounts together, divide by your gross pay for that same period, and multiply by 100 — that's your real total withholding rate (not just tax).
                    <br /><br />
                    No pay stub handy? Most hourly W-2 workers land somewhere around 15–25% for tax alone, often more once benefits are included. 20% is a reasonable tax-only starting guess.
                    <br /><br />
                    For a precise number, the IRS has a free calculator that walks you through it: <a href="https://www.irs.gov/individuals/tax-withholding-estimator" target="_blank" rel="noopener noreferrer">irs.gov/individuals/tax-withholding-estimator</a>
                  </div>
                </details>

                {budget.hourly_wage > 0 && (
                  <div className="sub-card">
                    <div className="section-label">My Regular Shift</div>
                    <div className="time-range">
                      <input
                        type="time"
                        className="form-input time"
                        aria-label="Regular shift start"
                        value={regStart}
                        onChange={e => setRegStart(e.target.value)}
                      />
                      <span className="inline-label">to</span>
                      <input
                        type="time"
                        className="form-input time"
                        aria-label="Regular shift end"
                        value={regEnd}
                        onChange={e => setRegEnd(e.target.value)}
                      />
                    </div>
                    <div className="dow-picker">
                      {["S", "M", "T", "W", "T", "F", "S"].map((label, d) => {
                        const on = regDays.includes(d);
                        return (
                          <button
                            key={d}
                            type="button"
                            aria-pressed={on}
                            className={`dow-btn${on ? " is-on" : ""}`}
                            onClick={() => setRegDays(prev => on ? prev.filter(x => x !== d) : [...prev, d])}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="add-row">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={applyRegularShift}
                        disabled={timeToMin(regStart) === null || timeToMin(regEnd) === null || regDays.length === 0}
                      >
                        Fill my calendar
                      </button>
                      {shiftHours({ start: regStart, end: regEnd }) !== "" && (
                        <span className="inline-label">
                          {shiftHours({ start: regStart, end: regEnd })}h paid per shift
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {budget.hourly_wage <= 0 ? (
                  <p className="hint-text">Enter your hourly wage above to see your calendar.</p>
                ) : (
                  moneyCalendarWeekChunks.map(({ title, rows }, chunkIdx) => {
                    const weekKey = rows[0].key;
                    const isOpen = weekOpen[weekKey] ?? chunkIdx === 0;

                    // Week roll-up for the collapsed header. "vs plan" only counts days
                    // you edited that also have a weekly template to compare against.
                    const round1 = (n: number) => Math.round(n * 10) / 10;
                    const weekHours = rows.reduce((s, r) => s + effectiveHours(r.key, r.date.getDay()), 0);
                    const weekOt = rows.reduce((s, r) => s + (payHours.otByDay[r.key] || 0), 0);
                    const hourDelta = rows.reduce((s, r) => {
                      const dow = r.date.getDay();
                      if (dailyHours[r.key] === undefined || recurringHours[dow] === undefined) return s;
                      return s + effectiveHours(r.key, dow) - plannedHours(dow);
                    }, 0);
                    const weekBills = rows.reduce((s, r) => s + r.billsToday.reduce((a, b) => a + b.amount, 0), 0);
                    const hasPayday = rows.some(r => r.releasedToday > 0.005);
                    const endBal = rows[rows.length - 1].balance;
                    const lowBal = Math.min(...rows.map(r => r.balance));

                    const summaryParts: string[] = [`${round1(weekHours)}h`];
                    if (weekOt > 0.05) summaryParts.push(`${round1(weekOt)}h OT`);
                    if (Math.abs(hourDelta) >= 0.05) summaryParts.push(`${hourDelta > 0 ? "+" : "−"}${round1(Math.abs(hourDelta))}h vs plan`);
                    if (weekBills > 0) summaryParts.push(`${fmt(weekBills)} bills`);
                    if (hasPayday) summaryParts.push("payday catch-up");

                    return (
                    <div key={weekKey} className="week-block">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        className={`week-head${isOpen ? " is-open" : ""}`}
                        onClick={() => setWeekOpen(prev => ({ ...prev, [weekKey]: !isOpen }))}
                      >
                        <div className="row-text">
                          <div className="week-title">{title}</div>
                          <div className="row-meta">{summaryParts.join(" · ")}</div>
                        </div>
                        <div className="week-end">
                          <div className={`week-total${endBal < 0 ? " is-neg" : ""}`}>{fmt(endBal)}</div>
                          {lowBal < 0 && (
                            <div className="week-low">
                              <Icon name="lightning" size={11} /> low {fmt(lowBal)}
                            </div>
                          )}
                        </div>
                        <Icon name={isOpen ? "icon-chevronup" : "icon-chevrondown"} size={18} />
                      </button>

                      {isOpen && (
                      <div className="day-list">
                        {rows.map(row => {
                          const isToday = row.key === dateKey(new Date());
                          const dow = row.date.getDay();
                          const isEdited = dailyHours[row.key] !== undefined;
                          const dayOt = payHours.otByDay[row.key] || 0;
                          const planTotal = plannedHours(dow);
                          // Today's card goes away once its shift is over.
                          if (isToday && isShiftOver(row.key, dow) && editingDay !== row.key && revealedDay !== row.key) {
                            return (
                              <div key={row.key} id={`money-day-${row.key}`} className="day-done">
                                <span>Today's shift is done</span>
                                <button type="button" className="day-chip" onClick={() => setRevealedDay(row.key)}>Edit</button>
                              </div>
                            );
                          }
                          const shift: Shift = dailyShifts[row.key] ?? recurringShifts[dow] ?? { start: "", end: "" };
                          const dayHrs = effectiveHours(row.key, dow);
                          return (
                            <div
                              key={row.key}
                              id={`money-day-${row.key}`}
                              className={`day-card${isToday ? " is-today" : ""}`}
                              onFocus={() => setEditingDay(row.key)}
                              onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setEditingDay(null); }}
                            >
                              <div className="day-top">
                                <div className="day-date">
                                  {row.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                                  {isToday && <span className="day-today-tag">TODAY</span>}
                                </div>
                                <div className={`day-balance${row.balance < 0 ? " is-neg" : ""}`}>
                                  {fmt(row.balance)}
                                </div>
                              </div>

                              {row.billsToday.length > 0 && (
                                <div className="day-bills">
                                  {row.billsToday.map(b => (
                                    <div key={b.id} className="day-bill">
                                      <span><Icon name="house" size={14} /> {b.name}</span>
                                      <strong>-{fmt(b.amount)}</strong>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="time-range">
                                <span className="day-mini">Shift</span>
                                <input
                                  type="time"
                                  className="form-input time"
                                  aria-label="Shift start"
                                  value={shift.start}
                                  onChange={e => setDayShift(row.key, dow, "start", e.target.value)}
                                />
                                <span className="day-mini">to</span>
                                <input
                                  type="time"
                                  className="form-input time"
                                  aria-label="Shift end"
                                  value={shift.end}
                                  onChange={e => setDayShift(row.key, dow, "end", e.target.value)}
                                />
                              </div>

                              {(dayHrs > 0 || dayOt > 0.004 || row.hoursToday > 0) && (
                                <div className="day-figures">
                                  {dayHrs > 0 && <span className="day-mini">{round2(dayHrs)}h</span>}
                                  {dayOt > 0.004 && <span className="day-ot">{round2(dayOt)}h OT</span>}
                                  {row.hoursToday > 0 && <span className="day-pay">+{fmt(row.availableToday)}</span>}
                                </div>
                              )}

                              {/* One-tap shift fixes — no typing needed for a shift that ran short or long */}
                              <div className="day-chips">
                                {isEdited && (
                                  <button
                                    type="button"
                                    className="day-chip is-accent"
                                    onClick={() => resetDayHours(row.key)}
                                  >
                                    As planned
                                  </button>
                                )}
                                {SHIFT_CHIPS.map(c => (
                                  <button
                                    key={c.id}
                                    type="button"
                                    className="day-chip"
                                    onClick={() => applyShiftChip(row.key, dow, c.id)}
                                  >
                                    {c.label}
                                  </button>
                                ))}
                                {isEdited && planTotal > 0 && (
                                  <span className="day-note">plan was {Math.round(planTotal * 10) / 10}h</span>
                                )}
                              </div>

                              <label className="day-check">
                                <input
                                  type="checkbox"
                                  checked={recurringHours[dow] !== undefined}
                                  onChange={e => toggleRecurringWeekday(dow, row.key, e.target.checked)}
                                />
                                <span className="day-note">
                                  Recurring every {row.date.toLocaleDateString(undefined, { weekday: "long" })}
                                </span>
                              </label>

                              {row.hoursToday > 0 && (
                                <div className="day-note">
                                  {Math.round(row.eligiblePct * 100)}% of period pool available
                                  {row.heldInPool > 0.005 && ` · ${fmt(row.heldInPool)} still held this period`}
                                  {row.withdrawnBeforeToday > 0.005 && (
                                    <div>
                                      {fmt(row.ceilingToday)} ceiling · {fmt(row.withdrawnBeforeToday)} already pulled
                                    </div>
                                  )}
                                </div>
                              )}

                              {row.releasedToday > 0.005 && (
                                <div className="day-line is-gold">
                                  <Icon name="money-bag" size={14} /> +{fmt(row.releasedToday)} payday catch-up
                                </div>
                              )}

                              {/* Extra funds / expenses tucked away so each day reads shorter */}
                              <details className="day-fold">
                                <summary>Extra funds / expenses</summary>

                                <div className="day-fold-field">
                                  <span className="day-mini">Expected Extra Funds</span>
                                  <input
                                    type="number"
                                    className="form-input"
                                    placeholder="0"
                                    value={extraFunds[row.key] || ""}
                                    onChange={e =>
                                      setExtraFunds(prev => ({
                                        ...prev,
                                        [row.key]: e.target.value,
                                      }))
                                    }
                                  />
                                </div>

                                <div className="day-fold-field">
                                  <span className="day-mini">Expected Purchase / Expense</span>
                                  <input
                                    type="number"
                                    className="form-input"
                                    placeholder="0"
                                    value={extraExpenses[row.key] || ""}
                                    onChange={e =>
                                      setExtraExpenses(prev => ({
                                        ...prev,
                                        [row.key]: e.target.value,
                                      }))
                                    }
                                  />
                                </div>
                              </details>

                              {row.extraToday > 0 && (
                                <div className="day-line is-gold">
                                  +{fmt(row.extraToday)} expected
                                </div>
                              )}

                              {row.extraExpenseToday > 0 && (
                                <div className="day-line is-danger">
                                  -{fmt(row.extraExpenseToday)} expected
                                </div>
                              )}

                            </div>
                          );
                        })}
                      </div>
                      )}
                    </div>
                    );
                  })
                )}
              </div>
            </div>
  </>
)}


        {view === "bills" && (
          <>
            <div className="add-row">
              <button
                onClick={() => { setBillsTab("month"); setShowBillForm(false); }}
                className={billsTab === "month" ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
              >
                This Month
              </button>
              <button
                onClick={() => { setBillsTab("recurring"); setShowBillForm(false); }}
                className={billsTab === "recurring" ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
              >
                Recurring
              </button>
            </div>

            {billsTab === "month" && (
              <>
            <div className="scroll-chips">
              {availableMonths.map(({ month, year, label }) => (
                <button
                  key={`${month}-${year}`}
                  onClick={() => { setSelectedMonth(month); setSelectedYear(year); }}
                  className={selectedMonth === month && selectedYear === year ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="stat-row">
              {[
                { label: "Total", val: fmt(totalMonthlyBills), tone: "" },
                { label: "Paid", val: fmt(paidTotal), tone: " is-green" },
                { label: "Unpaid", val: fmt(unpaidTotal), tone: " is-pink" },
              ].map(({ label, val, tone }) => (
                <div key={label} className="stat-tile">
                  <div className="stat-label">{label}</div>
                  <div className={`stat-value${tone}`}>{val}</div>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="card-body">
                <div className="section-head">
                  <div className="section-label">{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</div>
                  <button className="btn btn-primary btn-sm" onClick={() => openBillForm(false)}>+ One-time Bill</button>
                </div>

                <p className="hint-text">
                  Edits here only change this month. To change a bill for every month, use the Recurring tab.
                </p>
                {showBillForm && renderBillForm()}

                {monthBills.length === 0 ? (
                  <div className="empty-block">
                    <img src={emptyWallet} alt="" />
                    No bills this month — add one in the Recurring tab.
                  </div>
                ) : (
                  <div className="row-list">
                    {monthBills.map(b => (
                      <div key={b.paymentId ?? `${b.id}-fallback`} className={`bill-row${b.late ? " is-late" : b.paid ? " is-paid" : ""}`}>
                        <button
                          className="row-check"
                          onClick={() => togglePaid(b)}
                          aria-label={b.paid ? "Mark not paid" : "Mark paid"}
                        >
                          <CheckMark completed={b.paid} size={24} />
                        </button>

                        <div className="bill-main">
                          <EditableCell value={b.name} onChange={v => updateMonthBill(b, "name", v)} type="text" className="cell-input is-bold" />
                          <div className="bill-sub">
                            <span className="inline-label">Due day</span>
                            <div className="mini-field">
                              <EditableCell value={b.due_day} onChange={v => updateMonthBill(b, "due_day", parseInt(v) || 1)} />
                            </div>
                            {b.paid
                              ? <span className="badge badge-green">PAID</span>
                              : b.late ? <span className="badge badge-late">LATE</span>
                              : b.days === 0 ? <span className="badge badge-lavender">DUE TODAY</span>
                              : b.days <= 3 ? <span className="badge badge-lavender">DUE SOON</span>
                              : <span className="badge badge-pink">{b.days}d away</span>}
                          </div>
                          {b.recurring && b.frequency_unit === "week" && (
                            <div className="row-meta">{frequencyLabel(b.frequency_unit, b.frequency_interval)}</div>
                          )}
                        </div>

                        <div className="bill-amount">
                          <span className="inline-label">$</span>
                          <EditableCell value={b.amount} onChange={v => updateMonthBill(b, "amount", parseFloat(v) || 0)} />
                        </div>

                        {!b.recurring && (
                          <button className="row-icon-btn" onClick={() => removeBill(b.id)} aria-label="Delete bill">
                            <Icon name="icon-trash2" size={22} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
              </>
            )}

            {billsTab === "recurring" && (
              <div className="card">
                <div className="card-body">
                  <div className="section-head">
                    <div className="section-label">Recurring Bills</div>
                    <button className="btn btn-primary btn-sm" onClick={() => openBillForm(true)}>+ Add Recurring Bill</button>
                  </div>
                  <p className="hint-text">
                    Change a bill here and it updates every unpaid month from this month on. Months you already paid stay as they were.
                  </p>
                  {showBillForm && renderBillForm()}
                  {bills.filter(b => b.recurring).length === 0 ? (
                    <div className="empty-block">
                      <img src={emptyWallet} alt="" />
                      No recurring bills yet.
                    </div>
                  ) : (
                    bills.filter(b => b.recurring).map(b => (
                      <div key={b.id} className="recurring-item">
                        <div className="recurring-head">
                          <div className="row-text">
                            <EditableCell
                              value={b.name}
                              type="text"
                              onChange={v => { if (v.trim()) updateRecurringBill(b, { name: v.trim() }); }}
                              className="cell-input is-bold"
                            />
                          </div>
                          <button
                            className="row-icon-btn"
                            aria-label="Delete recurring bill"
                            onClick={() => { if (window.confirm(`Delete "${b.name}" from all months?`)) removeBill(b.id); }}
                          >
                            <Icon name="icon-trash2" size={22} />
                          </button>
                        </div>
                        <div className="field-grid">
                          <div>
                            <div className="form-label">Amount ($)</div>
                            <EditableCell
                              value={b.amount}
                              onChange={v => updateRecurringBill(b, { amount: parseFloat(v) || 0 })}
                            />
                          </div>
                          {b.frequency_unit === "week" ? (
                            <>
                              <div>
                                <div className="form-label">First due date</div>
                                <EditableCell
                                  value={b.anchor_date ?? ""}
                                  type="date"
                                  onChange={v => { if (v) updateRecurringBill(b, { anchor_date: v }); }}
                                />
                              </div>
                              <div>
                                <div className="form-label">Every how many weeks?</div>
                                <EditableCell
                                  value={b.frequency_interval ?? 1}
                                  onChange={v => updateRecurringBill(b, { frequency_interval: Math.max(1, parseInt(v) || 1) })}
                                />
                              </div>
                            </>
                          ) : (
                            <div>
                              <div className="form-label">Due day</div>
                              <EditableCell
                                value={b.due_day}
                                onChange={v => updateRecurringBill(b, { due_day: Math.min(31, Math.max(1, parseInt(v) || 1)) })}
                              />
                            </div>
                          )}
                        </div>
                        <div className="row-meta">{frequencyLabel(b.frequency_unit, b.frequency_interval)}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {view === "plan" && <PlanTab />}

        {view === "debts" && (
          <>

{/* SELECT DEBT PAYOFF STRATEGY */}

<div className="card">
  <div className="card-body">
    <div className="section-label">Debt Payoff Strategy</div>

    <label className="choice-row" onClick={() => setDebtStrategy("snowball")}>
      <Icon name={debtStrategy === "snowball" ? "heartfull" : "heartempty"} size={22} />
      <div>
        <div className="choice-title">Snowball</div>
        <div className="choice-sub">Pay the smallest balance first.</div>
      </div>
    </label>

    <label className="choice-row" onClick={() => setDebtStrategy("avalanche")}>
      <Icon name={debtStrategy === "avalanche" ? "heartfull" : "heartempty"} size={22} />
      <div>
        <div className="choice-title">Avalanche</div>
        <div className="choice-sub">Pay the highest APR first.</div>
      </div>
    </label>
  </div>
</div>

<StitchDivider />

{/* ACTIVE DEBTS */}

            <div className="card">
              <div className="card-body">
                <div className="section-head">
                  <div className="section-label">Active Debts</div>
                  <button className="btn btn-primary btn-sm" onClick={() => addDebt(false)}>
                    + Add
                  </button>
                </div>

                {activeDebts.length === 0 ? (
                  <EmptyState image={emptyWallet} message="No debts listed yet. Add one to start tracking." />
                ) : (
                  <div className="row-list">
                    {activeDebts.filter(d => !d.paid_off).map((d, i) => {
                      const origBal = d.original_balance || d.balance;
                      const paidPct = origBal > 0 ? Math.min(100, ((origBal - d.balance) / origBal) * 100) : 0;
                      return (
                        <div key={d.id} className="debt-row">
                          <button
                            className="row-check"
                            onClick={() => markDebtPaid(d.id, d.name)}
                            aria-label="Mark debt paid off"
                          >
                            <CheckMark completed={false} size={24} />
                          </button>

                          <div className="debt-main">
                            <div className="debt-top">
                              {i === 0
                                ? <span className="badge badge-pink">Target</span>
                                : <span className="debt-rank">#{i + 1}</span>}
                              <EditableCell value={d.name} onChange={v => updateDebt(d.id, "name", v)} type="text" className="cell-input is-bold" />
                            </div>

                            <div className="progress">
                              <div className="progress-fill is-green" style={{ width: `${paidPct}%` }} />
                            </div>
                            <div className="row-meta">{paidPct.toFixed(1)}% paid off</div>

                            <div className="debt-fields">
                              <div>
                                <div className="form-label">Balance</div>
                                <EditableCell value={d.balance} onChange={v => updateDebt(d.id, "balance", parseFloat(v) || 0)} />
                              </div>
                              <div>
                                <div className="form-label">APR %</div>
                                <EditableCell value={d.apr} onChange={v => updateDebt(d.id, "apr", parseFloat(v) || 0)} />
                              </div>
                              <div>
                                <div className="form-label">Min / mo</div>
                                <EditableCell value={d.min_payment} onChange={v => updateDebt(d.id, "min_payment", parseFloat(v) || 0)} />
                              </div>
                            </div>
                          </div>

                          <button className="row-icon-btn" onClick={() => removeDebt(d.id)} aria-label="Delete debt">
                            <Icon name="icon-trash2" size={22} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {activeDebts.filter(d => d.paid_off).length > 0 && (
              <div className="card">
                <div className="card-body">
                  <div className="section-head">
                    <div className="section-label"><Icon name="trophy" size={16} /> Paid Off</div>
                    <span className="goal-status is-done">Amazing work!</span>
                  </div>
                  <div className="row-list">
                    {activeDebts.filter(d => d.paid_off).map(d => (
                      <div key={d.id} className="row-item is-sage">
                        <button
                          className="row-check"
                          onClick={() => unmarkDebtPaid(d.id)}
                          aria-label="Mark debt not paid off"
                        >
                          <CheckMark completed={true} size={24} />
                        </button>
                        <div className="row-text">
                          <div className="row-title is-struck">{d.name}</div>
                        </div>
                        <span className="badge badge-green">PAID OFF</span>
                        <button className="row-icon-btn" onClick={() => removeDebt(d.id)} aria-label="Delete debt">
                          <Icon name="icon-trash2" size={22} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

{/* DEFERRED DEBTS */}

            <div className="card">
              <div className="card-body">
                <div className="section-head">
                  <div className="section-label">Deferred Debts</div>
                  <div className="add-row">
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowDeferred(v => !v)}>{showDeferred ? "Hide" : "Show"}</button>
                    <button className="btn btn-primary btn-sm" onClick={() => addDebt(true)}>+ Add</button>
                  </div>
                </div>
                {showDeferred && (
                  <div className="row-list">
                    {deferredDebts.map(d => (
                      <div key={d.id} className="debt-row">
                        <div className="debt-main">
                          <div className="debt-top">
                            <EditableCell value={d.name} onChange={v => updateDebt(d.id, "name", v)} type="text" className="cell-input is-bold" />
                          </div>
                          <div className="debt-fields is-two">
                            <div>
                              <div className="form-label">Balance</div>
                              <EditableCell value={d.balance} onChange={v => updateDebt(d.id, "balance", parseFloat(v) || 0)} />
                            </div>
                            <div>
                              <div className="form-label">APR %</div>
                              <EditableCell value={d.apr} onChange={v => updateDebt(d.id, "apr", parseFloat(v) || 0)} />
                            </div>
                          </div>
                          <div className="row-meta">Not targeted until active debts clear</div>
                          <div className="add-row">
                            <button className="btn btn-primary btn-sm" onClick={() => activateDebt(d.id)}>Activate</button>
                          </div>
                        </div>
                        <button className="row-icon-btn" onClick={() => removeDebt(d.id)} aria-label="Delete debt">
                          <Icon name="icon-trash2" size={22} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <StitchDivider />

{/* PAYOFF SCHEDULE */}

            <div className="section-label"><Icon name="clipboard-list" size={16} /> Payoff Schedule</div>
            {extraDebtPayment < 0 && (
              <div className="alert is-danger">
                <Icon name="lightning" size={13} /> Extra debt payment is negative — minimum payments exceed your budget!
              </div>
            )}

            <div className="card">
              <div className="card-body">
                <div className="section-head">
                  <div className="section-label">Month-by-Month Payoff</div>
                  <span className="badge badge-green">Done in {payoffMonth} months</span>
                </div>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Mo.</th>
                        {activeDebts.filter(d => !d.paid_off).map(d => (
                          <th key={d.id} className="num">{d.name}</th>
                        ))}
                        <th className="is-pink">Target</th>
                      </tr>
                    </thead>
                    <tbody>
                      {months.map((snap, mi) => (
                        <tr key={mi}>
                          <td className="is-muted">{snap.month}</td>
                          {activeDebts.filter(d => !d.paid_off).map(d => {
                            const bal = snap.balances[d.id] ?? 0;
                            const paid = bal < 0.01;
                            const isTgt = snap.target === d.name;
                            const origBal = d.original_balance || d.balance;
                            const paidPct = origBal > 0 ? Math.min(100, ((origBal - bal) / origBal) * 100) : 0;
                            return (
                              <td key={d.id} className={`num${paid ? " is-paid" : isTgt ? " is-target" : ""}`}>
                                <div>{paid ? <>PAID <Icon name="clipboard-check" size={12} /></> : fmt(bal)}</div>
                                {!paid && (
                                  <div className="mini-bar">
                                    <div className={isTgt ? "is-target" : ""} style={{ width: `${paidPct}%` }} />
                                  </div>
                                )}
                              </td>
                            );
                          })}
                          <td className="is-pink">{snap.target}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <StitchDivider />

            {/* DEFERRED LOANS (ACCRUING) */}

            {deferredDebts.length > 0 && (
              <div className="card">
                <div className="card-body">
                  <div className="section-head">
                    <div className="section-label">Deferred Loans (accruing)</div>
                    <span className="inline-label">At payoff: {fmt(finalDeferred)}</span>
                  </div>
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Mo.</th>
                          {deferredDebts.map(d => (
                            <th key={d.id} className="num">{d.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {months.filter((_, i) => i % 3 === 0 || i === months.length - 1).map((snap, mi) => (
                          <tr key={mi}>
                            <td className="is-muted">{snap.month}</td>
                            {deferredDebts.map(d => (
                              <td key={d.id} className="num">{fmt(snap.deferredBalances[d.id] ?? d.balance)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
