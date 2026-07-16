import { useState, useMemo, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { supabase } from '../lib/supabase';

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
}

interface Bill {
  id: number;
  name: string;
  amount: number;
  due_day: number;
  recurring: boolean;
  bill_month?: number;
  bill_year?: number;
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
}

interface DailyLog {
  id?: number;
  date: string;
  anytime_pay_amount: number;
  bills_allocation: number;
  buffer_allocation: number;
  minimums_allocation: number;
  spending_allocation: number;
  snowball_allocation: number;
  notes: string;
}

interface MonthSnap {
  month: number;
  target: string;
  balances: Record<number, number>;
  deferredBalances: Record<number, number>;
  activeTotal: number;
  deferredTotal: number;
}

interface PlannerItem {
  id: string;
  type: "need" | "want";
  label: string;
  done: boolean;
  created_at: string;
}

const DEFAULT_DEBTS: Debt[] = [
  { id: 1, name: "Amir",             balance: 225.00,   original_balance: 225.00,   apr: 0,    min_payment: 0,   deferred: false },
  { id: 2, name: "Midland (Ulta)",   balance: 713.57,   original_balance: 713.57,   apr: 0,    min_payment: 20,  deferred: false },
  { id: 3, name: "Cap One Secured",  balance: 655.66,   original_balance: 655.66,   apr: 20,   min_payment: 214, deferred: false },
  { id: 4, name: "Elan / Atl Union", balance: 946.96,   original_balance: 946.96,   apr: 0,    min_payment: 28,  deferred: false },
  { id: 5, name: "Discover-Cap One", balance: 1470.62,  original_balance: 1470.62,  apr: 22,   min_payment: 120, deferred: false },
  { id: 6, name: "Apple-Halstead",   balance: 1659.71,  original_balance: 1659.71,  apr: 18,   min_payment: 0,   deferred: false },
  { id: 7, name: "Nelnet AA",        balance: 3594.07,  original_balance: 3594.07,  apr: 2.75, min_payment: 0,   deferred: true  },
  { id: 8, name: "Nelnet AB",        balance: 9142.30,  original_balance: 9142.30,  apr: 2.75, min_payment: 0,   deferred: true  },
  { id: 9, name: "College Ave",      balance: 13700.24, original_balance: 13700.24, apr: 9.99, min_payment: 0,   deferred: true  },
];

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function runSnowball(debts: Debt[], takeHome: number, fixedExpenses: number) {
  const active = debts
    .filter(d => !d.deferred && !d.paid_off && d.balance > 0)
    .map(d => ({ ...d, balance: Number(d.balance) || 0 }))
    .sort((a, b) => a.balance - b.balance);
  const deferred = debts
    .filter(d => d.deferred)
    .map(d => ({ ...d, balance: Number(d.balance) || 0 }));
  const totalMins = active.reduce((s, d) => s + (Number(d.min_payment) || 0), 0);
  const snowballExtra = takeHome - fixedExpenses - totalMins;
  const months: MonthSnap[] = [];
  let state = active.map(d => ({ ...d }));
  let defState = deferred.map(d => ({ ...d }));
  for (let m = 1; m <= 120; m++) {
    const remaining = state.filter(d => d.balance > 0.01);
    if (remaining.length === 0) break;
    const target = remaining.reduce((a, b) => a.balance < b.balance ? a : b);
    const otherMins = remaining.filter(d => d.id !== target.id).reduce((s, d) => s + (Number(d.min_payment) || 0), 0);
    const extraForTarget = snowballExtra - otherMins;
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
  return { months, snowballExtra, totalMins };
}

function fmt(n: number) {
  if (n == null || isNaN(n)) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function pct(n: number, total: number) {
  if (!total) return "0%";
  return Math.round((n / total) * 100) + "%";
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function isLate(dueDay: number, month: number, year: number, paid: boolean) {
  if (paid) return false;
  const today = new Date();
  const due = new Date(year, month - 1, dueDay);
  return today > due;
}

function daysUntilDue(dueDay: number, month: number, year: number) {
  const today = new Date();
  const due = new Date(year, month - 1, dueDay);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function hoursOfWork(amount: number, wage: number) {
  if (!wage || wage <= 0) return null;
  return (amount / wage).toFixed(1);
}

// ── ANYTIME PAY RAMP ──
// Anytime Pay availability isn't a flat percentage — it climbs through the
// work week. Week runs Sunday(0) → Saturday(6); ramps linearly from 40% on
// Sunday to 70% by Saturday. The percentage applies against the CUMULATIVE
// pool of earnings since Sunday, not each day's earnings in isolation.
// Whatever's still unwithdrawn when Saturday closes becomes a single lump
// "payday catch-up" that lands the following Wednesday.
const ANYTIME_PAY_START_PCT = 0.50;
const ANYTIME_PAY_CAP_PCT = 0.70;

function rampPercentForDate(d: Date) {
  const dow = d.getDay(); // 0 = Sun ... 6 = Sat
  return ANYTIME_PAY_START_PCT + (ANYTIME_PAY_CAP_PCT - ANYTIME_PAY_START_PCT) * (dow / 6);
}

// Past a certain point in the week, availability stops climbing with the
// day-of-week ramp and instead drops to a flat, lower percentage — meant to
// model pulling back once you're deep into overtime territory for the week.
const ANYTIME_PAY_OVERTIME_THRESHOLD_HOURS = 55;
const ANYTIME_PAY_OVERTIME_CAP_PCT = 0.60;

function effectiveRampPct(d: Date, cumulativeHoursThroughDay: number) {
  if (cumulativeHoursThroughDay > ANYTIME_PAY_OVERTIME_THRESHOLD_HOURS) {
    return ANYTIME_PAY_OVERTIME_CAP_PCT;
  }
  return rampPercentForDate(d);
}

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

  // Safety net: if this field unmounts (e.g. the user navigates to a different
  // page) before blur ever fires, still save whatever was last typed.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      commit();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const defaultStyle: CSSProperties = className
    ? {}
    : { width: "100%", background: "transparent", border: "none", borderBottom: "1.5px dashed var(--border)", color: "var(--ink)", fontSize: 13, padding: "2px 4px", outline: "none", fontFamily: "inherit" };

  return (
    <input
      type={type}
      className={className}
      placeholder={placeholder}
      value={draft}
      onChange={e => {
        setDraft(e.target.value);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(commit, 600);
      }}
      onBlur={() => { if (timerRef.current) clearTimeout(timerRef.current); commit(); }}
      onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      style={{ ...defaultStyle, ...style }}
    />
  );
}

export default function Wallet() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [budget, setBudget] = useState<Budget>({ take_home: 0, fixed_expenses: 0, hourly_wage: 0, current_balance: 0 });
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<BillPayment[]>([]);
  const [nextId, setNextId] = useState(20);
  const [nextBillId, setNextBillId] = useState(10);
  const [view, setView] = useState<"home" | "bills" | "debts">("home");
  const [showDeferred, setShowDeferred] = useState(false);
  const [, setLoading] = useState(true);
  const [savedMsg, setSavedMsg] = useState(false);
  const [anytimePay, setAnytimePay] = useState("");
  const [planNotes, setPlanNotes] = useState("");
  const [showBillForm, setShowBillForm] = useState(false);
  const [newBill, setNewBill] = useState({ name: "", amount: "", due_day: "", recurring: true });
  const [showConfetti, setShowConfetti] = useState(false);
  const [paidOffDebt, setPaidOffDebt] = useState<string>("");

  const [plannerItems, setPlannerItems] = useState<PlannerItem[]>([]);
  const [newNeed, setNewNeed] = useState("");
  const [newWant, setNewWant] = useState("");
  const [taxRate, setTaxRate] = useState<number>(() => {
    const s = localStorage.getItem("tax_withholding_rate");
    return s ? parseFloat(s) : 20;
  });
  const [otWageOverride, setOtWageOverride] = useState<string>(() => localStorage.getItem("ot_wage_override") || "");
  const [healthDeduction, setHealthDeduction] = useState<number>(() => {
  const s = localStorage.getItem("weekly_health_deduction");
  return s ? parseFloat(s) : 62.38;
});

  useEffect(() => { localStorage.setItem("tax_withholding_rate", taxRate.toString()); }, [taxRate]);
  useEffect(() => { localStorage.setItem("ot_wage_override", otWageOverride); }, [otWageOverride]);
  useEffect(() => { localStorage.setItem("weekly_health_deduction", healthDeduction.toString()); }, [healthDeduction]);


  // Budget calculator (landing page) — starts blank
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
          { data: plannerData },
        ] = await Promise.all([
          supabase.from("debts").select("*"),
          supabase.from("budget").select("*").eq("id", 1).maybeSingle(),
          supabase.from("bills").select("*").order("due_day"),
          supabase.from("bill_payments").select("*"),
          supabase.from("planner_items").select("*").order("created_at"),
        ]);

        if (debtData && debtData.length > 0) {
          const fixed = debtData.map((d: Debt) => ({ ...d, original_balance: d.original_balance || d.balance }));
          setDebts(fixed);
          setNextId(Math.max(...fixed.map((d: Debt) => d.id)) + 1);
          await processMonthlyMinimums(fixed);
        } else {
          await supabase.from("debts").insert(DEFAULT_DEBTS);
          setDebts(DEFAULT_DEBTS);
        }

        if (budgetData) setBudget(prev => ({ ...prev, ...budgetData }));
        if (plannerData) setPlannerItems(plannerData);

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
      for (const bill of recurringBills) {
        for (const { month, year } of availableMonths) {
          const exists = payments.some(p => p.bill_id === bill.id && p.month === month && p.year === year);
          if (!exists) {
            const newPayment: BillPayment = {
              bill_id: bill.id, month, year, paid: false,
              name: bill.name, amount: bill.amount, due_day: bill.due_day,
            };
            const { data } = await supabase.from("bill_payments").insert(newPayment).select().single();
            if (data) setPayments(prev => [...prev, data]);
          }
        }
      }
    }
    ensurePaymentsExist();
  }, [bills, availableMonths]);

  const { months, snowballExtra, totalMins } = useMemo(
    () => runSnowball(debts, budget.take_home, budget.fixed_expenses),
    [debts, budget]
  );

  const activeDebts = useMemo(() => debts.filter(d => !d.deferred).sort((a, b) => a.balance - b.balance), [debts]);
  const deferredDebts = debts.filter(d => d.deferred);
  const needs = plannerItems.filter(p => p.type === "need");
  const wants = plannerItems.filter(p => p.type === "want");

  // Bills due in the next 8 days, split into two 4-day stretches, regardless
  // ── MONEY CALENDAR ── real calendar dates (this week + next week, Sun–Sat)
  // showing bills due that day, hours logged that day, and a running balance.
  function dateKey(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  const calendarWeeks = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days: Date[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      days.push(d);
    }
    return { week1: days.slice(0, 7), week2: days.slice(7, 14) };
  }, []);

  // Map every UNPAID bill occurrence (respecting per-month edits) onto its exact
  // calendar date. Paid bills are excluded entirely — that money already left
  // your account and is already reflected in Current Balance, so showing (and
  // subtracting) it again here would double-count it.
  const billsByDate = useMemo(() => {
    const map: Record<string, { id: number; name: string; amount: number }[]> = {};
    const allDays = [...calendarWeeks.week1, ...calendarWeeks.week2];
    const monthsInView = new Set(allDays.map(d => `${d.getFullYear()}-${d.getMonth() + 1}`));
    bills.forEach(bill => {
      const candidates: { month: number; year: number }[] = [];
      if (bill.recurring) {
        monthsInView.forEach(key => {
          const [y, m] = key.split("-").map(Number);
          candidates.push({ month: m, year: y });
        });
      } else if (bill.bill_month && bill.bill_year) {
        candidates.push({ month: bill.bill_month, year: bill.bill_year });
      }
      candidates.forEach(({ month, year }) => {
        const payment = payments.find(p => p.bill_id === bill.id && p.month === month && p.year === year);
        const paid = payment?.paid ?? false;
        if (paid) return;
        const effectiveDueDay = bill.recurring ? (payment?.due_day ?? bill.due_day) : bill.due_day;
        const amount = bill.recurring ? (payment?.amount ?? bill.amount) : bill.amount;
        const name = bill.recurring ? (payment?.name ?? bill.name) : bill.name;
        const dueDate = new Date(year, month - 1, effectiveDueDay);
        const key = dateKey(dueDate);
        if (!map[key]) map[key] = [];
        map[key].push({ id: bill.id, name, amount });
      });
    });
    return map;
  }, [bills, payments, calendarWeeks]);

  const [dailyHours, setDailyHours] = useState<Record<string, { reg: string; ot: string }>>(() => {
    try { return JSON.parse(localStorage.getItem("daily_hours_log") || "{}"); } catch { return {}; }
  });
  useEffect(() => { localStorage.setItem("daily_hours_log", JSON.stringify(dailyHours)); }, [dailyHours]);

  function setDailyHourField(key: string, field: "reg" | "ot", value: string) {
    setDailyHours(prev => ({ ...prev, [key]: { reg: prev[key]?.reg || "", ot: prev[key]?.ot || "", [field]: value } }));
  }

  // ── Hours worked earlier in the current pay week, before "today" ──
  // The Money Calendar only shows/logs hours from today forward, so if
  // today isn't a Sunday, the pool for this first partial week would
  // otherwise miss whatever was already earned Sun–yesterday. This seeds
  // that gap. Keyed to the current week's Sunday so it auto-clears once a
  // new pay week starts instead of silently carrying stale hours forward.
  function currentWeekStartKey() {
    const now = new Date();
    const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    return dateKey(sunday);
  }

  const [priorWeekHours, setPriorWeekHours] = useState<{ weekStart: string; reg: string; ot: string }>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("prior_week_hours") || "null");
      if (stored && stored.weekStart === currentWeekStartKey()) return stored;
    } catch { /* fall through to blank */ }
    return { weekStart: currentWeekStartKey(), reg: "", ot: "" };
  });
  useEffect(() => { localStorage.setItem("prior_week_hours", JSON.stringify(priorWeekHours)); }, [priorWeekHours]);

  function setPriorWeekHourField(field: "reg" | "ot", value: string) {
    setPriorWeekHours(prev => ({ ...prev, weekStart: currentWeekStartKey(), [field]: value }));
  }

  const [extraFunds, setExtraFunds] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem("extra_funds_log") || "{}");
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem("extra_funds_log", JSON.stringify(extraFunds));
  }, [extraFunds]);

  const effectiveOtWage = parseFloat(otWageOverride) > 0 ? parseFloat(otWageOverride) : budget.hourly_wage * 1.5;
  const netHourlyWage = budget.hourly_wage > 0 ? budget.hourly_wage * (1 - taxRate / 100) : 0;
  const netOtWage = effectiveOtWage > 0 ? effectiveOtWage * (1 - taxRate / 100) : 0;

  // Build the 14-day Money Calendar. Anytime Pay ramp: each day's withdrawable
  // amount is (today's ramp %) × (cumulative pool earned since Sunday) minus
  // whatever's already been withdrawn from that pool this week. The pool
  // resets fresh every Sunday. Whatever's left unwithdrawn when Saturday
  // closes becomes a single lump "payday catch-up" released the following
  // Wednesday — a real 4-day lag, matching how the actual deposit works.
  // No lookback/replay of days before the visible window — this only uses
  // hours actually logged on the visible dates.
  function buildMoneyCalendarRows(allDays: Date[], startingBalance: number) {
  let runningBalance = startingBalance;

  let periodEarnedGross = 0;   // gross pool, untaxed, resets each Sunday
  let periodWithdrawnGross = 0; // gross cash advanced so far this period
  let periodHoursSoFar = 0;     // cumulative hours this week, drives the overtime ramp cap
  let pendingPayout = 0;        // net amount owed, released the following Wednesday

  const grossHourlyWage = budget.hourly_wage || 0;
  const grossOtWage = effectiveOtWage || 0;

  // If the visible window starts mid-week (today isn't Sunday), the pool
  // is missing whatever was earned Sun–yesterday since those days are never
  // shown/logged. Seed it here so the ramp is applied against the true
  // cumulative pool, not just what's been logged since today. This has to
  // seed BOTH the earned total and what would already have been withdrawn
  // against it (same "max withdrawn every day" assumption the rest of this
  // function uses) — seeding earned alone makes today think none of that
  // prior gross was ever claimed, and dumps the whole thing onto today.
  if (allDays.length && allDays[0].getDay() !== 0 && priorWeekHours.weekStart === currentWeekStartKey()) {
    const priorReg = parseFloat(priorWeekHours.reg) || 0;
    const priorOt = parseFloat(priorWeekHours.ot) || 0;
    const priorHours = priorReg + priorOt;
    const priorGross = priorReg * grossHourlyWage + priorOt * grossOtWage;

    const yesterday = new Date(allDays[0]);
    yesterday.setDate(yesterday.getDate() - 1);

    periodEarnedGross = priorGross;
    periodHoursSoFar = priorHours;
    periodWithdrawnGross = priorGross * effectiveRampPct(yesterday, priorHours);
  }

  const rows = allDays.map(d => {
    const key = dateKey(d);
    const dow = d.getDay(); // 0 Sun ... 6 Sat

    if (dow === 0) {
      periodEarnedGross = 0;
      periodWithdrawnGross = 0;
      periodHoursSoFar = 0;
    }

    const extraToday = parseFloat(extraFunds[key]) || 0;
    const billsToday = billsByDate[key] || [];
    const billsTotal = billsToday.reduce((s, b) => s + b.amount, 0);

    const regHoursToday = parseFloat(dailyHours[key]?.reg) || 0;
    const otHoursToday = parseFloat(dailyHours[key]?.ot) || 0;
    const hoursToday = regHoursToday + otHoursToday;

    // Gross earnings — no tax applied here. Tax only hits once, at payout.
    const fullEarnedToday =
      grossHourlyWage > 0
        ? regHoursToday * grossHourlyWage + otHoursToday * grossOtWage
        : 0;

    periodEarnedGross += fullEarnedToday;
    periodHoursSoFar += hoursToday;

    const rampPct = effectiveRampPct(d, periodHoursSoFar);
    const maxWithdrawableGrossSoFar = periodEarnedGross * rampPct;
    const availableToday = Math.max(0, maxWithdrawableGrossSoFar - periodWithdrawnGross);
    periodWithdrawnGross += availableToday;

    // Saturday closes the period: tax the FULL gross total once, then
    // subtract whatever gross cash was already advanced during the week.
        if (dow === 6) {
      const taxableGross = Math.max(0, periodEarnedGross - healthDeduction);
      const netOwedForPeriod = taxableGross * (1 - taxRate / 100);
      pendingPayout += Math.max(0, netOwedForPeriod - periodWithdrawnGross);
    }


    let releasedToday = 0;
    if (dow === 3 && pendingPayout > 0) {
      releasedToday = pendingPayout;
      pendingPayout = 0;
    }

    runningBalance += availableToday + releasedToday + extraToday - billsTotal;
    const heldInPool = Math.max(0, periodEarnedGross - periodWithdrawnGross);

    return {
      date: d, key, billsToday, billsTotal, regHoursToday, otHoursToday,
      hoursToday, earnedToday: fullEarnedToday, availableToday, releasedToday,
      rampPct, heldInPool, extraToday, balance: runningBalance,
    };
  });

  return { rows, endingBalance: runningBalance };
}


  const moneyCalendarResult = useMemo(
    () => buildMoneyCalendarRows([...calendarWeeks.week1, ...calendarWeeks.week2], budget.current_balance || 0),
    [calendarWeeks, billsByDate, dailyHours, extraFunds, netHourlyWage, netOtWage, budget.current_balance, priorWeekHours]
  );
  const week1Result = { rows: moneyCalendarResult.rows.slice(0, 7) };
  const week2Result = { rows: moneyCalendarResult.rows.slice(7, 14) };

  const monthBills = useMemo(() => {
    const filtered = bills.filter(bill => {
      if (bill.recurring) return true;
      return bill.bill_month === selectedMonth && bill.bill_year === selectedYear;
    });
    return filtered.map(bill => {
      const payment = payments.find(p => p.bill_id === bill.id && p.month === selectedMonth && p.year === selectedYear);
      const paid = payment?.paid ?? false;
      const name = bill.recurring ? (payment?.name ?? bill.name) : bill.name;
      const amount = bill.recurring ? (payment?.amount ?? bill.amount) : bill.amount;
      const due_day = bill.recurring ? (payment?.due_day ?? bill.due_day) : bill.due_day;
      const late = isLate(due_day, selectedMonth, selectedYear, paid);
      const days = daysUntilDue(due_day, selectedMonth, selectedYear);
      return { ...bill, name, amount, due_day, paid, late, days, paymentId: payment?.id };
    }).sort((a, b) => a.due_day - b.due_day);
  }, [bills, payments, selectedMonth, selectedYear]);

  const urgentBills = monthBills.filter(b => !b.paid && b.days <= 7 && b.days >= 0);
  const crisisBills = monthBills.filter(b => !b.paid && (b.late || (b.days <= 3 && b.days >= 0)));
  const totalMonthlyBills = monthBills.reduce((s, b) => s + b.amount, 0);
  const paidTotal = monthBills.filter(b => b.paid).reduce((s, b) => s + b.amount, 0);
  const unpaidTotal = monthBills.filter(b => !b.paid).reduce((s, b) => s + b.amount, 0);

  const pay = parseFloat(anytimePay) || 0;
  const inputAmount = pay;

  const urgentTotal = urgentBills.reduce((s, b) => s + b.amount, 0);
  const crisisTotal = crisisBills.reduce((s, b) => s + b.amount, 0);
  const isCrisis = crisisTotal > 0;
  const billsRate = totalMonthlyBills / 30;

  const NEEDS_FLOOR = 25;

  let unifiedBills: number;
  let unifiedSnowball: number;
  let unifiedBuffer: number;
  let unifiedNeeds: number;
  let unifiedFun: number;

  if (isCrisis) {
    // Groceries/gas floor is reserved FIRST, even in crisis — then bills get the rest
    unifiedNeeds = Math.min(inputAmount, NEEDS_FLOOR);
    const afterNeeds = Math.max(0, inputAmount - unifiedNeeds);
    unifiedBills = Math.min(afterNeeds, crisisTotal);
    const leftover = Math.max(0, afterNeeds - unifiedBills);
    unifiedBills += leftover;
    unifiedSnowball = 0;
    unifiedBuffer = 0;
    unifiedFun = 0;
  } else {
    unifiedBills = urgentBills.length > 0 ? Math.min(inputAmount * 0.45, urgentTotal) : Math.min(inputAmount * 0.40, billsRate * 1.2);
    const afterBills = Math.max(0, inputAmount - unifiedBills);

    // Reserve the floor before snowball/buffer get a chance to eat into it
    const needsFloor = Math.min(afterBills, NEEDS_FLOOR);
    const afterFloor = Math.max(0, afterBills - needsFloor);

    unifiedSnowball = snowballExtra > 0 ? Math.min(afterFloor * 0.25, snowballExtra / 30) : 0;
    const afterSnowball = Math.max(0, afterFloor - unifiedSnowball);
    unifiedBuffer = Math.min(22, afterSnowball);
    const afterBuffer = Math.max(0, afterSnowball - unifiedBuffer);

    const extraNeeds = Math.min(afterBuffer, afterBuffer * 0.65);
    unifiedNeeds = needsFloor + extraNeeds;
    unifiedFun = Math.max(0, afterBuffer - extraNeeds);
  }

  const allocations = [
    {
      label: "🏠 Bills",
      amount: unifiedBills,
      color: "var(--pink-dark)",
      note: isCrisis
        ? `🚨 ${crisisBills.length} bill(s) late or due in ≤3 days -- covered first`
        : urgentBills.length > 0 ? `⚠ ${urgentBills.length} bill(s) due soon!` : "bills + debt minimums",
    },
    {
      label: "❄️ Snowball Extra",
      amount: unifiedSnowball,
      color: "var(--sky)",
      note: isCrisis ? "paused -- bills come first" : "extra toward target debt",
    },
    {
      label: "🏦 General Savings",
      amount: unifiedBuffer,
      color: "var(--gold)",
      note: isCrisis ? "paused -- bills come first" : "$22/day until $650",
    },
    {
      label: "🛒 Groceries & Gas",
      amount: unifiedNeeds,
      color: "var(--green-dark)",
      note: isCrisis ? "protected floor, even in crisis mode" : "groceries + gas, one combined category",
    },
    {
      label: "🎉 Treats",
      amount: unifiedFun,
      color: "var(--ink-soft)",
      note: isCrisis ? "zeroed until crisis bills are caught up" : "whimsy -- wants, not needs!",
    },
  ];

  // Budget calculator math (blank until the person fills it in)
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
      const newPayment: BillPayment = { bill_id: bill.id, month: selectedMonth, year: selectedYear, paid: newPaid };
      const { data } = await supabase.from("bill_payments").insert(newPayment).select().single();
      if (data) setPayments(prev => [...prev, data]);
    }
  }

  async function updateMonthBill(bill: typeof monthBills[0], field: "name" | "amount" | "due_day", value: string | number) {
    if (bill.recurring) {
      if (bill.paymentId) {
        const { error } = await supabase.from("bill_payments").update({ [field]: value }).eq("id", bill.paymentId);
        if (error) { console.error("updateMonthBill failed:", error); return; }
        setPayments(prev => prev.map(p => p.id === bill.paymentId ? { ...p, [field]: value } : p));
      } else {
        const newPayment: BillPayment = {
          bill_id: bill.id, month: selectedMonth, year: selectedYear, paid: false,
          name: bill.name, amount: bill.amount, due_day: bill.due_day,
          [field]: value,
        };
        const { data, error } = await supabase.from("bill_payments").insert(newPayment).select().single();
        if (error) { console.error("updateMonthBill insert failed:", error); return; }
        if (data) setPayments(prev => [...prev, data]);
      }
    } else {
      const { error } = await supabase.from("bills").update({ [field]: value }).eq("id", bill.id);
      if (error) { console.error("updateMonthBill (bills) failed:", error); return; }
      setBills(prev => prev.map(b => b.id === bill.id ? { ...b, [field]: value } : b));
    }
  }

  async function saveLog() {
    const amount = pay;
    if (!amount) return;
    const log: DailyLog = {
      date: todayStr(),
      anytime_pay_amount: amount,
      bills_allocation: unifiedBills,
      buffer_allocation: unifiedBuffer,
      minimums_allocation: 0,
      spending_allocation: unifiedNeeds + unifiedFun,
      snowball_allocation: unifiedSnowball,
      notes: planNotes,
    };
    await supabase.from("daily_log").insert(log).select().single();
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
    setAnytimePay("");
    setPlanNotes("");
  }

  async function saveBudgetCalc() {
    if (!calcHasInput) return;
    await updateBudget("hourly_wage", calcRegWageNum);
    await updateBudget("take_home", calcEstMonthlyTakeHome);
    setBudgetSavedMsg(true);
    setTimeout(() => setBudgetSavedMsg(false), 2000);
  }

  async function addPlannerItem(type: "need" | "want") {
    const label = (type === "need" ? newNeed : newWant).trim();
    if (!label) return;
    const { data } = await supabase
      .from("planner_items")
      .insert({ type, label, done: false })
      .select()
      .single();
    if (data) setPlannerItems(prev => [...prev, data]);
    if (type === "need") setNewNeed(""); else setNewWant("");
  }

  async function togglePlannerItem(item: PlannerItem) {
    const newDone = !item.done;
    await supabase.from("planner_items").update({ done: newDone }).eq("id", item.id);
    setPlannerItems(prev => prev.map(p => p.id === item.id ? { ...p, done: newDone } : p));
  }

  async function deletePlannerItem(id: string) {
    await supabase.from("planner_items").delete().eq("id", id);
    setPlannerItems(prev => prev.filter(p => p.id !== id));
  }

  async function addBill() {
    if (!newBill.name || !newBill.amount || !newBill.due_day) return;
    const bill: Bill = {
      id: nextBillId,
      name: newBill.name,
      amount: parseFloat(newBill.amount),
      due_day: parseInt(newBill.due_day),
      recurring: newBill.recurring,
      bill_month: newBill.recurring ? undefined : selectedMonth,
      bill_year: newBill.recurring ? undefined : selectedYear,
    };
    setBills(prev => [...prev, bill].sort((a, b) => a.due_day - b.due_day));
    setNextBillId(n => n + 1);
    await supabase.from("bills").insert(bill);
    setNewBill({ name: "", amount: "", due_day: "", recurring: true });
    setShowBillForm(false);
  }

  async function removeBill(id: number) {
    setBills(prev => prev.filter(b => b.id !== id));
    setPayments(prev => prev.filter(p => p.bill_id !== id));
    await supabase.from("bills").delete().eq("id", id);
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
    setPaidOffDebt(name);
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 4000);
  }

  async function unmarkDebtPaid(id: number) {
    setDebts(prev => prev.map(d => d.id === id ? { ...d, paid_off: false } : d));
    await supabase.from("debts").update({ paid_off: false }).eq("id", id);
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
    const colors = ["var(--pink-dark)","var(--green-dark)","var(--pink-light)","var(--ink-soft)","var(--gold-light)"];
    return (
      <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 9999, overflow: "hidden" }}>
        {Array.from({ length: 60 }).map((_, i) => (
          <div key={i} style={{ position: "absolute", left: `${Math.random() * 100}%`, top: "-10px", width: `${Math.random() * 8 + 4}px`, height: `${Math.random() * 8 + 4}px`, background: colors[Math.floor(Math.random() * colors.length)], borderRadius: Math.random() > 0.5 ? "50%" : "0", animation: `fall ${Math.random() * 2 + 2}s linear ${Math.random() * 2}s forwards` }} />
        ))}
        <style>{`@keyframes fall { to { transform: translateY(100vh) rotate(720deg); opacity: 0; } }`}</style>
        <div style={{ position: "absolute", top: "35%", left: "50%", transform: "translateX(-50%)", textAlign: "center", background: "var(--white)", border: "2px solid var(--border)", borderRadius: 32, padding: "24px 32px", minWidth: 220 }}>
          <div style={{ fontSize: 48 }}>🎉</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--green-dark)", marginTop: 8 }}>DEBT PAID OFF!</div>
          <div style={{ fontSize: 16, color: "var(--pink-dark)", marginTop: 4 }}>{paidOffDebt}</div>
          <div style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 8 }}>Keep going — you are crushing it!</div>
        </div>
      </div>
    );
  };

  const VIEW_TITLES: Record<typeof view, string> = {
    home: "Piggybank",
    bills: "🏠 Bills",
    debts: "💳 Debts",
  };

  return (
    <div>
      {showConfetti && <Confetti />}

      {/* ── HEADER ── */}
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {view !== "home" && (
            <button className="btn btn-ghost btn-sm" onClick={() => setView("home")}>← Back</button>
          )}
          <h2>{VIEW_TITLES[view]}</h2>
        </div>
        {savedMsg && <span className="badge badge-green">Saved!</span>}
      </div>

      <div className="page-body" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ══════════════════ HOME (LANDING) ══════════════════ */}
        {view === "home" && (
          <>
            {/* ── NAV CARDS ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button
                onClick={() => setView("bills")}
                style={{
                  textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                  border: "1.5px dashed var(--border)", borderRadius: 18,
                  background: "var(--white)", padding: "14px 16px",
                  display: "flex", flexDirection: "column", gap: 6,
                }}
              >
                <div style={{ fontSize: 24, lineHeight: 1 }}>🏠</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)" }}>Bills</div>
                <div style={{ fontSize: 11, color: "var(--ink-muted)" }}>
                  {unpaidTotal > 0 ? `${fmt(unpaidTotal)} unpaid` : "all paid up ✓"}
                </div>
              </button>
              <button
                onClick={() => setView("debts")}
                style={{
                  textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                  border: "1.5px dashed var(--border)", borderRadius: 18,
                  background: "var(--white)", padding: "14px 16px",
                  display: "flex", flexDirection: "column", gap: 6,
                }}
              >
                <div style={{ fontSize: 24, lineHeight: 1 }}>💳</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)" }}>Debts</div>
                <div style={{ fontSize: 11, color: "var(--ink-muted)" }}>
                  {activeDebts.filter(d => !d.paid_off).length} active · {payoffMonth}mo payoff
                </div>
              </button>
            </div>

            {/* ── MONEY CALENDAR ── */}
            <div className="card">
              <div className="card-body">
                <div className="section-label">📅 Money Calendar</div>
                <div style={{ fontSize: 11, color: "var(--ink-muted)", marginBottom: 14 }}>
                  Runs from today forward. Log the hours you're working (or plan to work) each day. Anytime Pay availability ramps from 40% on Sunday to 70% by Saturday, applied against your cumulative pool for the week — whatever's unclaimed by Saturday night lands as a lump catch-up the following Wednesday. Past {ANYTIME_PAY_OVERTIME_THRESHOLD_HOURS} hours in a week, the ramp stops climbing and drops to a flat {Math.round(ANYTIME_PAY_OVERTIME_CAP_PCT * 100)}% instead.
                </div>

                {new Date().getDay() !== 0 && (
                  <div style={{
                    marginBottom: 14, padding: "10px 12px", borderRadius: "var(--radius-sm)",
                    background: "var(--blush)", border: "1px solid var(--pink-light)",
                  }}>
                    <div className="form-label" style={{ marginBottom: 4 }}>
                      Hours already worked this week (Sun–yesterday)
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink-muted)", marginBottom: 8 }}>
                      The calendar below only starts from today, so this fills in the rest of the pool it can't see — otherwise this week's ramp % gets applied to a smaller pool than you've actually earned.
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div className="form-label" style={{ fontSize: 10 }}>Regular hrs</div>
                        <input
                          type="number" className="form-input" placeholder="0"
                          value={priorWeekHours.reg}
                          onChange={e => setPriorWeekHourField("reg", e.target.value)}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="form-label" style={{ fontSize: 10 }}>OT hrs</div>
                        <input
                          type="number" className="form-input" placeholder="0"
                          value={priorWeekHours.ot}
                          onChange={e => setPriorWeekHourField("ot", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: 14 }}>
                  <div className="form-label">Current Balance</div>
                  <EditableCell
                    type="number"
                    className="form-input"
                    placeholder="check your bank app, enter it here"
                    value={budget.current_balance || ""}
                    onChange={v => updateBudget("current_balance", parseFloat(v) || 0)}
                    style={{ fontSize: 18, fontWeight: 700 }}
                  />
                  <div style={{ fontSize: 10, color: "var(--ink-muted)", marginTop: 4 }}>
                    The calendar's running balance starts from this number. Update it whenever you check your real balance for the most accurate picture — it won't drift correct on its own. Syncs across devices now.
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <div className="form-label">Tax Withholding (%)</div>
                    <input type="number" className="form-input" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)} />
                  </div>

                                  <div>
                    <div className="form-label">Weekly Health Premium ($)</div>
                    <input type="number" className="form-input" value={healthDeduction} onChange={e => setHealthDeduction(parseFloat(e.target.value) || 0)} />
                  </div>


                  <div>
                    <div className="form-label">Hourly Wage</div>
                    <EditableCell type="number" className="form-input" value={budget.hourly_wage || ""} placeholder="set in Budget Calculator" onChange={v => updateBudget("hourly_wage", parseFloat(v) || 0)} />
                    {budgetSaveError && <div style={{ fontSize: 10, color: "var(--danger)", marginTop: 4 }}>⚠️ {budgetSaveError}</div>}
                  </div>
                  <div>
                    <div className="form-label">OT Wage</div>
                    <input type="number" className="form-input" value={otWageOverride} placeholder={budget.hourly_wage > 0 ? `${(budget.hourly_wage * 1.5).toFixed(2)} (1.5x)` : "e.g. 29.25"} onChange={e => setOtWageOverride(e.target.value)} />
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end" }}>
                    <div style={{ fontSize: 10, color: "var(--ink-muted)" }}>leave blank to auto-use 1.5x your hourly wage</div>
                  </div>
                </div>

                <details style={{ marginBottom: 16 }}>
                  <summary style={{ fontSize: 11, color: "var(--pink-dark)", fontWeight: 600, cursor: "pointer" }}>Not sure what % to enter for tax withholding?</summary>
                  <div style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 8, lineHeight: 1.6 }}>
                    Easiest way: grab a recent pay stub and find the line(s) for federal tax, state tax, Social Security, Medicare, and any benefits/401k deductions. Add those dollar amounts together, divide by your gross pay for that same period, and multiply by 100 — that's your real total withholding rate (not just tax).
                    <br /><br />
                    No pay stub handy? Most hourly W-2 workers land somewhere around 15–25% for tax alone, often more once benefits are included. 20% is a reasonable tax-only starting guess.
                    <br /><br />
                    For a precise number, the IRS has a free calculator that walks you through it: <a href="https://www.irs.gov/individuals/tax-withholding-estimator" target="_blank" rel="noopener noreferrer" style={{ color: "var(--pink-dark)" }}>irs.gov/individuals/tax-withholding-estimator</a>
                  </div>
                </details>

                {budget.hourly_wage <= 0 ? (
                  <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>Enter your hourly wage above to see your calendar.</div>
                ) : (
                  [{ title: "Next 7 Days", result: week1Result }, { title: "Following 7 Days", result: week2Result }].map(({ title, result }) => (
                    <div key={title} style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>{title}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {result.rows.map(row => {
                          const isToday = row.key === dateKey(new Date());
                          return (
                            <div key={row.key} style={{ border: `1.5px solid ${isToday ? "var(--pink-dark)" : "var(--border)"}`, borderRadius: 14, padding: "10px 12px", background: isToday ? "var(--accent)" : "transparent" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>
                                  {row.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                                  {isToday && <span style={{ color: "var(--pink-dark)", marginLeft: 6, fontSize: 10 }}>TODAY</span>}
                                </div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: row.balance < 0 ? "var(--danger)" : "var(--green-dark)" }}>
                                  {fmt(row.balance)}
                                </div>
                              </div>

                              {row.billsToday.length > 0 && (
                                <div style={{ marginBottom: 6 }}>
                                  {row.billsToday.map(b => (
                                    <div key={b.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--pink-dark)" }}>
                                      <span>🏠 {b.name}</span>
                                      <span style={{ fontWeight: 700 }}>-{fmt(b.amount)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: 10, color: "var(--ink-muted)", whiteSpace: "nowrap" }}>Reg</span>
                                <input
                                  type="number"
                                  className="form-input"
                                  placeholder="0"
                                  value={dailyHours[row.key]?.reg || ""}
                                  onChange={e => setDailyHourField(row.key, "reg", e.target.value)}
                                  style={{ flex: 1, fontSize: 12, padding: "4px 8px" }}
                                />
                                <span style={{ fontSize: 10, color: "var(--ink-muted)", whiteSpace: "nowrap" }}>OT</span>
                                <input
                                  type="number"
                                  className="form-input"
                                  placeholder="0"
                                  value={dailyHours[row.key]?.ot || ""}
                                  onChange={e => setDailyHourField(row.key, "ot", e.target.value)}
                                  style={{ flex: 1, fontSize: 12, padding: "4px 8px" }}
                                />

                                {row.hoursToday > 0 && (
                                  <span style={{ fontSize: 11, color: "var(--green-dark)", fontWeight: 700, whiteSpace: "nowrap" }}>+{fmt(row.availableToday)}</span>
                                )}
                              </div>

                              {row.hoursToday > 0 && (
                                <div style={{ fontSize: 9, color: "var(--ink-muted)", marginTop: 3 }}>
                                  {Math.round(row.rampPct * 100)}% of period pool available
                                  {row.heldInPool > 0.005 && ` · ${fmt(row.heldInPool)} still held this period`}
                                </div>
                              )}

                              {row.releasedToday > 0.005 && (
                                <div style={{ fontSize: 11, color: "var(--gold)", fontWeight: 700, marginTop: 4 }}>
                                  💰 +{fmt(row.releasedToday)} payday catch-up
                                </div>
                              )}

                              <div style={{ marginTop: 8 }}>
                                <span style={{ fontSize: 10, color: "var(--ink-muted)" }}>
                                  Expected Extra Funds
                                </span>

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

                              {row.extraToday > 0 && (
                                <div
                                  style={{
                                    fontSize: 11,
                                    color: "var(--gold)",
                                    fontWeight: 700,
                                    marginTop: 4,
                                  }}
                                >
                                  +{fmt(row.extraToday)} expected
                                </div>
                              )}

                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ── TODAY'S PAYCHECK CALCULATOR ── */}
            {isCrisis && (
              <div style={{ background: "var(--danger-bg)", border: "1.5px solid var(--danger)", borderRadius: 16, padding: "12px 16px", fontSize: 13, color: "var(--danger)", fontWeight: 700 }}>
                Equity Mode Active — {crisisBills.length} bill(s) late or due within 3 days ({fmt(crisisTotal)} total). Fun money and general savings are zeroed until these are covered. Things you need are still protected.
              </div>
            )}
            {!isCrisis && urgentBills.length > 0 && (
              <div style={{ background: "var(--danger-bg)", border: "1.5px solid var(--danger)", borderRadius: 16, padding: "12px 16px", fontSize: 13, color: "var(--danger)", fontWeight: 600 }}>
                Bills due within 7 days: {urgentBills.map(b => `${b.name} (${fmt(b.amount)}) in ${b.days}d`).join(" · ")}
              </div>
            )}

            <div className="card">
              <div className="card-body">
                <div className="section-label">Today's Paycheck</div>
                <input
                  type="number"
                  className="form-input"
                  placeholder="e.g. 120"
                  value={anytimePay}
                  onChange={e => setAnytimePay(e.target.value)}
                  style={{ fontSize: 22, fontWeight: 700, marginTop: 8, marginBottom: 6 }}
                />
                {inputAmount > 0 && hoursOfWork(inputAmount, budget.hourly_wage) && (
                  <div style={{ fontSize: 11, color: "var(--ink-muted)", marginBottom: 14 }}>
                    = {hoursOfWork(inputAmount, budget.hourly_wage)} hours of your life
                  </div>
                )}

                {inputAmount > 0 && (
                  <>
                    <div style={{ display: "flex", height: 12, borderRadius: 99, overflow: "hidden", marginBottom: 16, gap: 2 }}>
                      {allocations.map(a => (
                        <div key={a.label} style={{ width: pct(a.amount, inputAmount), background: a.color, transition: "width 0.3s" }} />
                      ))}
                    </div>
                    {allocations.map(a => (
                      <div key={a.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
                        <div>
                          <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 600 }}>{a.label}</div>
                          <div style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 2 }}>{a.note}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: a.color }}>{fmt(a.amount)}</div>
                          <div style={{ fontSize: 10, color: "var(--ink-muted)" }}>{pct(a.amount, inputAmount)}</div>
                        </div>
                      </div>
                    ))}
                    <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                      <input type="text" className="form-input" placeholder="Notes (optional)..." value={planNotes} onChange={e => setPlanNotes(e.target.value)} />
                      <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={saveLog}>
                        Save Plan
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
            </>
            )}


        {/* ══════════════════ BILLS VIEW ══════════════════ */}
        {view === "bills" && (
          <>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
              {availableMonths.map(({ month, year, label }) => (
                <button
                  key={`${month}-${year}`}
                  onClick={() => { setSelectedMonth(month); setSelectedYear(year); }}
                  className={selectedMonth === month && selectedYear === year ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
                  style={{ whiteSpace: "nowrap" }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {[
                { label: "Total", val: fmt(totalMonthlyBills), color: "var(--ink)" },
                { label: "Paid", val: fmt(paidTotal), color: "var(--green-dark)" },
                { label: "Unpaid", val: fmt(unpaidTotal), color: "var(--pink-dark)" },
              ].map(({ label, val, color }) => (
                <div key={label} className="card" style={{ cursor: "default" }}>
                  <div className="card-body" style={{ padding: "10px 12px" }}>
                    <div className="section-label" style={{ marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color }}>{val}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="card-body">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div className="section-label" style={{ marginBottom: 0 }}>{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</div>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowBillForm(v => !v)}>+ Add Bill</button>
                </div>

                <div style={{ fontSize: 11, color: "var(--ink-muted)", marginBottom: 12 }}>
                  💡 Tap any bill, amount, or due day to edit it — changes only apply to {MONTH_NAMES[selectedMonth - 1]}. Recurring bills still show up automatically in new months.
                </div>

                {showBillForm && (
                  <div style={{ background: "var(--accent)", borderRadius: 16, padding: 14, marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <div className="form-label">Bill Name</div>
                        <input className="form-input" type="text" placeholder="e.g. Rent" value={newBill.name} onChange={e => setNewBill(p => ({ ...p, name: e.target.value }))} />
                      </div>
                      <div>
                        <div className="form-label">Amount ($)</div>
                        <input className="form-input" type="number" placeholder="e.g. 1375" value={newBill.amount} onChange={e => setNewBill(p => ({ ...p, amount: e.target.value }))} />
                      </div>
                      <div>
                        <div className="form-label">Due Day</div>
                        <input className="form-input" type="number" placeholder="e.g. 1" value={newBill.due_day} onChange={e => setNewBill(p => ({ ...p, due_day: e.target.value }))} />
                      </div>
                      <div style={{ display: "flex", alignItems: "flex-end" }}>
                        <label style={{ fontSize: 13, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                          <input type="checkbox" checked={newBill.recurring} onChange={e => setNewBill(p => ({ ...p, recurring: e.target.checked }))} />
                          Recurring
                        </label>
                      </div>
                    </div>
                    <button className="btn btn-green" style={{ justifyContent: "center" }} onClick={addBill}>Save Bill</button>
                  </div>
                )}

                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      {["", "Bill", "Amount", "Due", "Status", ""].map(h => (
                        <th key={h} style={{ fontSize: 10, color: "var(--ink-muted)", textTransform: "uppercase", padding: "8px 8px", textAlign: "left", borderBottom: "1.5px solid var(--border)", fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthBills.map((b, i) => (
                      <tr key={b.id} style={{ background: b.late ? "var(--danger-bg)" : b.paid ? "var(--sage-light)" : i % 2 === 0 ? "transparent" : "var(--accent)" }}>
                        <td style={{ padding: "9px 8px" }}>
                          <input type="checkbox" checked={b.paid} onChange={() => togglePaid(b)} style={{ width: 16, height: 16, cursor: "pointer", accentColor: "var(--green-dark)" }} />
                        </td>
                        <td style={{ padding: "9px 8px", textDecoration: b.paid ? "line-through" : "none" }}>
                          <EditableCell value={b.name} onChange={v => updateMonthBill(b, "name", v)} type="text" style={{ color: b.paid ? "var(--ink-muted)" : "var(--ink)", fontWeight: 600 }} />
                        </td>
                        <td style={{ padding: "9px 8px", textDecoration: b.paid ? "line-through" : "none" }}>
                          <EditableCell value={b.amount} onChange={v => updateMonthBill(b, "amount", parseFloat(v) || 0)} style={{ color: b.paid ? "var(--ink-muted)" : "var(--pink-dark)", fontWeight: 700 }} />
                        </td>
                        <td style={{ padding: "9px 8px" }}>
                          <EditableCell value={b.due_day} onChange={v => updateMonthBill(b, "due_day", parseInt(v) || 1)} style={{ color: "var(--ink-muted)" }} />
                        </td>
                        <td style={{ padding: "9px 8px" }}>
                          {b.paid
                            ? <span className="badge badge-green">PAID</span>
                            : b.late ? <span className="badge" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>LATE</span>
                            : b.days <= 3 ? <span className="badge badge-lavender">DUE SOON</span>
                            : <span className="badge badge-pink">{b.days}d away</span>}
                        </td>
                        <td style={{ padding: "9px 8px" }}>
                          <button className="btn btn-danger btn-sm" onClick={() => removeBill(b.id)}>✕</button>
                        </td>
                      </tr>
                    ))}
                    {monthBills.length === 0 && (
                      <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--ink-muted)" }}>No bills yet — click + Add Bill to get started.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ══════════════════ DEBTS VIEW ══════════════════ */}
        {view === "debts" && (
          <>
            <div className="card">
              <div className="card-body">
                <div className="section-header">
                  <div className="section-label" style={{ marginBottom: 0 }}>Monthly Fixed Expenses</div>
                </div>
                <input
                  type="number"
                  className="form-input"
                  placeholder="e.g. 1800"
                  value={budget.fixed_expenses || ""}
                  onChange={e => updateBudget("fixed_expenses", parseFloat(e.target.value) || 0)}
                />
                <div style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 6 }}>rent + transport + non-debt bills — used to calculate your snowball extra</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: snowballExtra >= 0 ? "var(--green-dark)" : "var(--danger)" }}>True Snowball Extra</div>
                    <div style={{ fontSize: 11, color: "var(--ink-muted)" }}>take-home ({fmt(budget.take_home)}) minus fixed expenses and {fmt(totalMins)} in minimums</div>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: snowballExtra >= 0 ? "var(--green-dark)" : "var(--danger)" }}>{fmt(snowballExtra)}</div>
                </div>
                {snowballExtra < 0 && (
                  <div style={{ marginTop: 10, fontSize: 12, color: "var(--danger)", fontWeight: 600 }}>
                    ⚠️ Minimums + fixed expenses exceed your take-home pay. Update your Budget Calculator on the home page.
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <div className="section-header">
                  <div className="section-label">Active Debts — Snowball Order</div>
                  <button className="btn btn-primary btn-sm" onClick={() => addDebt(false)}>
                    + Add
                  </button>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table className="table">
                    <thead>
                      <tr>
                        {["#","Name","Balance","Progress","APR%","Min/Mo","",""].map(h => (
                          <th key={h} style={{ fontSize: 10, color: "var(--ink-muted)", textTransform: "uppercase", padding: "8px", textAlign: "left", borderBottom: "1.5px solid var(--border)", fontWeight: 700 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeDebts.filter(d => !d.paid_off).map((d, i) => {
                        const origBal = d.original_balance || d.balance;
                        const paidPct = origBal > 0 ? Math.min(100, ((origBal - d.balance) / origBal) * 100) : 0;
                        return (
                          <tr key={d.id} style={{ background: i % 2 === 0 ? "transparent" : "var(--accent)" }}>
                            <td style={{ padding: "9px 8px" }}>
                              {i === 0
                                ? <span className="badge badge-pink">Target</span>
                                : <span style={{ color: "var(--ink-muted)", fontWeight: 700 }}>{i + 1}</span>}
                            </td>
                            <td style={{ padding: "9px 8px" }}><EditableCell value={d.name} onChange={v => updateDebt(d.id, "name", v)} type="text" /></td>
                            <td style={{ padding: "9px 8px" }}><EditableCell value={d.balance} onChange={v => updateDebt(d.id, "balance", parseFloat(v) || 0)} /></td>
                            <td style={{ padding: "9px 8px", minWidth: 90 }}>
                              <div style={{ height: 6, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${paidPct}%`, background: "var(--green-dark)", borderRadius: 99 }} />
                              </div>
                              <div style={{ fontSize: 10, color: "var(--ink-muted)", marginTop: 3 }}>{paidPct.toFixed(1)}%</div>
                            </td>
                            <td style={{ padding: "9px 8px" }}><EditableCell value={d.apr} onChange={v => updateDebt(d.id, "apr", parseFloat(v) || 0)} /></td>
                            <td style={{ padding: "9px 8px" }}><EditableCell value={d.min_payment} onChange={v => updateDebt(d.id, "min_payment", parseFloat(v) || 0)} /></td>
                            <td style={{ padding: "9px 8px" }}>
                              <button className="btn btn-green btn-sm" onClick={() => markDebtPaid(d.id, d.name)}>Paid ✓</button>
                            </td>
                            <td style={{ padding: "9px 8px" }}>
                              <button className="btn btn-danger btn-sm" onClick={() => removeDebt(d.id)}>✕</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {activeDebts.filter(d => d.paid_off).length > 0 && (
              <div className="card" style={{ opacity: 0.9 }}>
                <div className="card-body">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div className="section-label" style={{ marginBottom: 0 }}>🎉 Paid Off</div>
                    <span style={{ fontSize: 12, color: "var(--green-dark)", fontWeight: 600 }}>Amazing work!</span>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <tbody>
                      {activeDebts.filter(d => d.paid_off).map(d => (
                        <tr key={d.id} style={{ background: "var(--sage-light)" }}>
                          <td style={{ padding: "9px 8px", textDecoration: "line-through", color: "var(--green-dark)", fontWeight: 700 }}>{d.name}</td>
                          <td style={{ padding: "9px 8px", color: "var(--green-dark)", fontWeight: 800 }}>$0.00</td>
                          <td style={{ padding: "9px 8px" }}><span className="badge badge-green">PAID OFF</span></td>
                          <td style={{ padding: "9px 8px", display: "flex", gap: 6 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => unmarkDebtPaid(d.id)}>Undo</button>
                            <button className="btn btn-danger btn-sm" onClick={() => removeDebt(d.id)}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="card" style={{ opacity: 0.85 }}>
              <div className="card-body">
                <div className="section-header">
                  <div className="section-label" style={{ marginBottom: 0 }}>Deferred Debts</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowDeferred(v => !v)}>{showDeferred ? "Hide" : "Show"}</button>
                    <button className="btn btn-primary btn-sm" onClick={() => addDebt(true)}>+ Add</button>
                  </div>
                </div>
                {showDeferred && (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr>
                          {["Name","Balance","APR%","Note",""].map(h => (
                            <th key={h} style={{ fontSize: 10, color: "var(--ink-muted)", textTransform: "uppercase", padding: "8px", textAlign: "left", borderBottom: "1.5px solid var(--border)", fontWeight: 700 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {deferredDebts.map((d, i) => (
                          <tr key={d.id} style={{ background: i % 2 === 0 ? "transparent" : "var(--accent)" }}>
                            <td style={{ padding: "9px 8px" }}><EditableCell value={d.name} onChange={v => updateDebt(d.id, "name", v)} type="text" /></td>
                            <td style={{ padding: "9px 8px" }}><EditableCell value={d.balance} onChange={v => updateDebt(d.id, "balance", parseFloat(v) || 0)} /></td>
                            <td style={{ padding: "9px 8px" }}><EditableCell value={d.apr} onChange={v => updateDebt(d.id, "apr", parseFloat(v) || 0)} /></td>
                            <td style={{ padding: "9px 8px", color: "var(--ink-muted)", fontSize: 11 }}>Not targeted until active debts clear</td>
                            <td style={{ padding: "9px 8px" }}><button className="btn btn-danger btn-sm" onClick={() => removeDebt(d.id)}>✕</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="section-label" style={{ marginTop: 4 }}>📋 Payoff Schedule</div>
            {snowballExtra < 0 && (
              <div style={{ background: "var(--danger-bg)", border: "1.5px solid var(--danger)", borderRadius: 16, padding: "12px 16px", fontSize: 13, color: "var(--danger)", fontWeight: 600 }}>
                ⚠️ Snowball extra is negative — minimums exceed your budget!
              </div>
            )}

            <div className="card">
              <div className="card-body">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div className="section-label" style={{ marginBottom: 0 }}>Month-by-Month Payoff</div>
                  <span className="badge badge-green">Done in {payoffMonth} months</span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ fontSize: 10, color: "var(--ink-muted)", textTransform: "uppercase", padding: "8px", textAlign: "left", borderBottom: "1.5px solid var(--border)", fontWeight: 700 }}>Mo.</th>
                        {activeDebts.filter(d => !d.paid_off).map(d => (
                          <th key={d.id} style={{ fontSize: 10, color: "var(--ink-muted)", textTransform: "uppercase", padding: "8px", textAlign: "right", borderBottom: "1.5px solid var(--border)", fontWeight: 700, minWidth: 90 }}>{d.name}</th>
                        ))}
                        <th style={{ fontSize: 10, color: "var(--pink-dark)", textTransform: "uppercase", padding: "8px", textAlign: "left", borderBottom: "1.5px solid var(--border)", fontWeight: 700 }}>Target</th>
                      </tr>
                    </thead>
                    <tbody>
                      {months.map((snap, mi) => (
                        <tr key={mi} style={{ background: mi % 2 === 0 ? "transparent" : "var(--accent)" }}>
                          <td style={{ padding: "8px", color: "var(--ink-muted)", fontWeight: 700 }}>{snap.month}</td>
                          {activeDebts.filter(d => !d.paid_off).map(d => {
                            const bal = snap.balances[d.id] ?? 0;
                            const paid = bal < 0.01;
                            const isTgt = snap.target === d.name;
                            const origBal = d.original_balance || d.balance;
                            const paidPct = origBal > 0 ? Math.min(100, ((origBal - bal) / origBal) * 100) : 0;
                            return (
                              <td key={d.id} style={{ padding: "8px", background: paid ? "var(--sage-light)" : isTgt ? "var(--accent)" : "transparent", color: paid ? "var(--green-dark)" : isTgt ? "var(--pink-dark)" : "var(--ink-muted)", fontWeight: isTgt ? 700 : 400, textAlign: "right" }}>
                                <div>{paid ? "PAID ✓" : fmt(bal)}</div>
                                {!paid && (
                                  <div style={{ height: 4, background: "var(--border)", borderRadius: 99, overflow: "hidden", marginTop: 3 }}>
                                    <div style={{ height: "100%", width: `${paidPct}%`, background: isTgt ? "var(--pink-dark)" : "var(--green-dark)", borderRadius: 99 }} />
                                  </div>
                                )}
                              </td>
                            );
                          })}
                          <td style={{ padding: "8px", color: "var(--pink-dark)", fontWeight: 700, fontSize: 11 }}>{snap.target}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {deferredDebts.length > 0 && (
              <div className="card">
                <div className="card-body">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div className="section-label" style={{ marginBottom: 0 }}>Deferred Loans (accruing)</div>
                    <span style={{ fontSize: 12, color: "var(--ink-soft)", fontWeight: 600 }}>At payoff: {fmt(finalDeferred)}</span>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th style={{ fontSize: 10, color: "var(--ink-muted)", textTransform: "uppercase", padding: "8px", textAlign: "left", borderBottom: "1.5px solid var(--border)", fontWeight: 700 }}>Mo.</th>
                          {deferredDebts.map(d => (
                            <th key={d.id} style={{ fontSize: 10, color: "var(--ink-muted)", textTransform: "uppercase", padding: "8px", textAlign: "right", borderBottom: "1.5px solid var(--border)", fontWeight: 700, minWidth: 110 }}>{d.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {months.filter((_, i) => i % 3 === 0 || i === months.length - 1).map((snap, mi) => (
                          <tr key={mi} style={{ background: mi % 2 === 0 ? "transparent" : "var(--accent)" }}>
                            <td style={{ padding: "8px", color: "var(--ink-muted)", fontWeight: 700 }}>{snap.month}</td>
                            {deferredDebts.map(d => (
                              <td key={d.id} style={{ padding: "8px", color: "var(--ink-soft)", textAlign: "right", fontWeight: 600 }}>{fmt(snap.deferredBalances[d.id] ?? d.balance)}</td>
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
