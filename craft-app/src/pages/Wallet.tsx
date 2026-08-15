import { useState, useMemo, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { supabase } from '../lib/supabase';
import Icon from '../components/Icon';
import { useTheme } from '../context/ThemeContext';
import Lantern from "../components/Lantern";
import walletPouchImg from '../assets/illustrations/wallet_pouch.png';
import celebrationImg from '../assets/illustrations/celebration.png';
import emptyWallet from '../assets/icons/empty-wallet.png';
import EmptyState from '../components/EmptyState';

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
}

interface Bill {
  id: number;
  name: string;
  amount: number;
  due_day: number;
  recurring: boolean;
  frequency?: "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";
  frequency_start_date?: string;
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
  payment_date?: string;
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

type DebtStrategy = "snowball" | "avalanche";


interface MonthSnap {
  month: number;
  target: string;
  balances: Record<number, number>;
  deferredBalances: Record<number, number>;
  activeTotal: number;
  deferredTotal: number;
}

interface ListDef {
  id: number;
  name: string;
  created_at?: string;
}

interface ListItem {
  id: number;
  list_id: number;
  label: string;
  done: boolean;
  created_at?: string;
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

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
  const due = new Date(year, month - 1, dueDay + 1);
  return today >= due;
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

// ── EARLY PAY ELIGIBLE PERCENTAGE ──
// Employer presets for early-pay/advance-pay eligibility formulas. "Amazon"
// mirrors Amazon's real Anytime Pay math (garnishments, a 2% safety buffer
// that steps up to 8% past 55 hours in a week). "Custom" lets anyone using
// a different employer's early-pay program plug in their own numbers.
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

function eligiblePercent(preTaxEarnedSoFar: number, netToGrossRatio: number, flatDeductionsPrev: number, hoursSoFar: number, preset: EarlyPayPreset) {
  if (preTaxEarnedSoFar <= 0 || netToGrossRatio <= 0) return 0;
  const availableEarlyPay = preTaxEarnedSoFar * netToGrossRatio;
  const afterFlatDeductions = availableEarlyPay - flatDeductionsPrev;
  const afterGarnishments = afterFlatDeductions - preset.garnishments;
  const rawPct = afterGarnishments / preTaxEarnedSoFar;
  return Math.max(0, rawPct - getSafetyBuffer(hoursSoFar, preset));
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
  const { theme } = useTheme();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [debtStrategy, setDebtStrategy] =
  useState<DebtStrategy>("snowball");
const [budget, setBudget] = useState<Budget>({ take_home: 0, fixed_expenses: 0, hourly_wage: 0, current_balance: 0, net_to_gross_ratio: 0, flat_deductions_prev: 0 });
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<BillPayment[]>([]);
  const [nextId, setNextId] = useState(20);
  const [nextBillId, setNextBillId] = useState(10);
  const [view, setView] = useState<"home" | "calendar" | "bills" | "debts">("home");  const [showDeferred, setShowDeferred] = useState(false);
  const [, setLoading] = useState(true);
  const [savedMsg, setSavedMsg] = useState(false);
  const [anytimePay, setAnytimePay] = useState("");
  const [planNotes, setPlanNotes] = useState("");
  const [showBillForm, setShowBillForm] = useState(false);
  const [newBill, setNewBill] = useState({
  name: "",
  amount: "",
  due_day: "",
  recurring: true,
  frequency: "monthly" as "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly",
});
  const [showConfetti, setShowConfetti] = useState(false);
  const [celebration, setCelebration] = useState<{ title: string; subtitle: string }>({ title: "", subtitle: "" });

  const [lists, setLists] = useState<ListDef[]>([]);
  const [listItems, setListItems] = useState<ListItem[]>([]);
  const [activeListId, setActiveListId] = useState<number | null>(null);
  const [nextListId, setNextListId] = useState(1);
  const [nextListItemId, setNextListItemId] = useState(1);
  const [showNewListInput, setShowNewListInput] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newItemDrafts, setNewItemDrafts] = useState<Record<number, string>>({});
  const [taxRate, setTaxRate] = useState<number>(20);
  const [otWageOverride, setOtWageOverride] = useState<string>("");
  const [walletSettingsLoaded, setWalletSettingsLoaded] = useState(false);
  const [earlyPayPresetId, setEarlyPayPresetId] = useState<EarlyPayPresetId>("amazon");
  const [customEarlyPayPreset, setCustomEarlyPayPreset] = useState<EarlyPayPreset>(EARLY_PAY_PRESETS.custom);
  const earlyPayPreset: EarlyPayPreset = earlyPayPresetId === "custom" ? customEarlyPayPreset : EARLY_PAY_PRESETS[earlyPayPresetId];

  const walletSettingsSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!walletSettingsLoaded) return; // don't overwrite DB with defaults before initial load completes
    if (walletSettingsSaveTimer.current) clearTimeout(walletSettingsSaveTimer.current);
    walletSettingsSaveTimer.current = setTimeout(() => {
      supabase.from("wallet_settings").upsert({
        id: 1,
        tax_rate: taxRate,
        ot_wage_override: otWageOverride,
        early_pay_preset_id: earlyPayPresetId,
        custom_early_pay_preset: customEarlyPayPreset,
      }).then(({ error }) => {
        if (error) console.error("wallet_settings save failed:", error);
      });
    }, 800);
    return () => { if (walletSettingsSaveTimer.current) clearTimeout(walletSettingsSaveTimer.current); };
  }, [taxRate, otWageOverride, earlyPayPresetId, customEarlyPayPreset, walletSettingsLoaded]);


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
          { data: listData },
          { data: listItemData },
          { data: walletSettingsData },
          { data: dailyHoursData },
          { data: extraFundsData },
          { data: extraExpensesData },
          { data: payPeriodData },
        ] = await Promise.all([
          supabase.from("debts").select("*"),
          supabase.from("budget").select("*").eq("id", 1).maybeSingle(),
          supabase.from("bills").select("*").order("due_day"),
          supabase.from("bill_payments").select("*"),
          supabase.from("lists").select("*").order("created_at"),
          supabase.from("list_items").select("*").order("created_at"),
          supabase.from("wallet_settings").select("*").eq("id", 1).maybeSingle(),
          supabase.from("daily_hours_log").select("*"),
          supabase.from("extra_funds_log").select("*"),
          supabase.from("extra_expenses_log").select("*"),
          supabase.from("wallet_pay_period").select("*").eq("id", 1).maybeSingle(),
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
        if (listData) {
          setLists(listData);
          if (listData.length > 0) {
            setNextListId(Math.max(...listData.map((l: ListDef) => l.id)) + 1);
            setActiveListId(prev => prev ?? listData[0].id);
          }
        }
        if (listItemData) {
          setListItems(listItemData);
          if (listItemData.length > 0) setNextListItemId(Math.max(...listItemData.map((li: ListItem) => li.id)) + 1);
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
          setTaxRate(typeof walletSettingsData.tax_rate === "number" ? walletSettingsData.tax_rate : 20);
          setOtWageOverride(walletSettingsData.ot_wage_override || "");
          setEarlyPayPresetId(walletSettingsData.early_pay_preset_id === "custom" ? "custom" : "amazon");
          if (walletSettingsData.custom_early_pay_preset) {
            setCustomEarlyPayPreset({ ...EARLY_PAY_PRESETS.custom, ...walletSettingsData.custom_early_pay_preset });
          }
        }
        setWalletSettingsLoaded(true);

        if (dailyHoursData && dailyHoursData.length > 0) {
          const map: Record<string, { reg: string; ot: string }> = {};
          dailyHoursData.forEach((row: { date: string; reg: string; ot: string }) => {
            map[row.date] = { reg: row.reg || "", ot: row.ot || "" };
          });
          setDailyHours(map);
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
              reg: payPeriodData.prior_week_reg || "",
              ot: payPeriodData.prior_week_ot || "",
            });
          }
          if (payPeriodData.closed_week_start) {
            setClosedWeekHours({
              weekStart: payPeriodData.closed_week_start,
              reg: payPeriodData.closed_week_reg || "",
              ot: payPeriodData.closed_week_ot || "",
            });
          }
        }
      } catch (err) {
        console.error("Wallet loadData failed:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

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
  const activeList = lists.find(l => l.id === activeListId) || null;
  const activeListItems = useMemo(
    () => listItems.filter(li => li.list_id === activeListId).sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1)),
    [listItems, activeListId]
  );

  function dateKey(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

function getRecurringDates(
  bill: Bill,
  startDate: Date,
  endDate: Date
): Date[] {
  if (!bill.recurring) return [];

  const frequency = bill.frequency || "monthly";

  const anchor = bill.frequency_start_date
    ? new Date(`${bill.frequency_start_date}T00:00:00`)
    : new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        Math.min(
          bill.due_day,
          new Date(
            startDate.getFullYear(),
            startDate.getMonth() + 1,
            0
          ).getDate()
        )
      );

  const anchorDay = anchor.getDate();

  function makeMonthDate(monthOffset: number) {
    const totalMonths =
      anchor.getFullYear() * 12 +
      anchor.getMonth() +
      monthOffset;

    const year = Math.floor(totalMonths / 12);
    const month = totalMonths % 12;

    const lastDay = new Date(
      year,
      month + 1,
      0
    ).getDate();

    return new Date(
      year,
      month,
      Math.min(anchorDay, lastDay)
    );
  }

  const dates: Date[] = [];

  if (
    frequency === "monthly" ||
    frequency === "quarterly" ||
    frequency === "yearly"
  ) {
    const step =
      frequency === "monthly"
        ? 1
        : frequency === "quarterly"
        ? 3
        : 12;

    let monthOffset = 0;
    let current = makeMonthDate(monthOffset);

    while (current < startDate) {
      monthOffset += step;
      current = makeMonthDate(monthOffset);
    }

    while (current <= endDate) {
      if (current >= startDate) {
        dates.push(new Date(current));
      }

      monthOffset += step;
      current = makeMonthDate(monthOffset);
    }

    return dates;
  }
  
  const stepDays = frequency === "weekly" ? 7 : 14;

  let current = new Date(anchor);

  while (current < startDate) {
    current.setDate(current.getDate() + stepDays);
  }

  while (current <= endDate) {
    if (current >= startDate) {
      dates.push(new Date(current));
    }

    current.setDate(current.getDate() + stepDays);
  }

  return dates;
}

  function getPaymentForOccurrence(
  bill: Bill,
  occurrenceDate: string
) {
  const date = new Date(`${occurrenceDate}T00:00:00`);
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  // First: exact occurrence match.
  const exactPayment = payments.find(
    p =>
      p.bill_id === bill.id &&
      p.payment_date === occurrenceDate
  );

  if (exactPayment) {
    return exactPayment;
  }

  // For existing monthly records that predate payment_date,
  // only use the record belonging to this exact month/year.
  if (
    (bill.frequency || "monthly") === "monthly" ||
    !bill.recurring
  ) {
    return payments.find(
      p =>
        p.bill_id === bill.id &&
        p.month === month &&
        p.year === year &&
        !p.payment_date
    );
  }

  return undefined;
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

const billsByDate = useMemo(() => {
  const map: Record<
    string,
    {
      id: number;
      name: string;
      amount: number;
    }[]
  > = {};

  const allDays = [
    ...calendarWeeks.week1,
    ...calendarWeeks.week2,
  ];

  if (allDays.length === 0) return map;

  const startDate = allDays[0];
  const endDate = allDays[allDays.length - 1];

  bills.forEach(bill => {
    let occurrenceDates: Date[] = [];

    if (bill.recurring) {
      occurrenceDates = getRecurringDates(
        bill,
        startDate,
        endDate
      );
    } else if (bill.bill_month && bill.bill_year) {
      occurrenceDates = [
        new Date(
          bill.bill_year,
          bill.bill_month - 1,
          bill.due_day
        ),
      ];
    }

    occurrenceDates.forEach(occurrenceDate => {
      const occurrenceKey = dateKey(occurrenceDate);

      const payment = getPaymentForOccurrence(
        bill,
        occurrenceKey
      );

      if (payment?.paid) return;

      const name =
        payment?.name ?? bill.name;

      const amount =
        payment?.amount ?? bill.amount;

      if (!map[occurrenceKey]) {
        map[occurrenceKey] = [];
      }

      map[occurrenceKey].push({
        id: bill.id,
        name,
        amount,
      });
    });
  });

  return map;
}, [bills, payments, calendarWeeks]);

  const [dailyHours, setDailyHours] = useState<Record<string, { reg: string; ot: string }>>({});
  const dailyHoursSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!walletSettingsLoaded) return;
    if (dailyHoursSaveTimer.current) clearTimeout(dailyHoursSaveTimer.current);
    dailyHoursSaveTimer.current = setTimeout(() => {
      const rows = Object.entries(dailyHours).map(([date, v]) => ({ date, reg: v.reg || "", ot: v.ot || "" }));
      if (rows.length === 0) return;
      supabase.from("daily_hours_log").upsert(rows, { onConflict: "date" }).then(({ error }) => {
        if (error) console.error("daily_hours_log save failed:", error);
      });
    }, 800);
    return () => { if (dailyHoursSaveTimer.current) clearTimeout(dailyHoursSaveTimer.current); };
  }, [dailyHours, walletSettingsLoaded]);

  function setDailyHourField(key: string, field: "reg" | "ot", value: string) {
    setDailyHours(prev => ({ ...prev, [key]: { reg: prev[key]?.reg || "", ot: prev[key]?.ot || "", [field]: value } }));
  }

  function currentWeekStartKey() {
    const now = new Date();
    const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    return dateKey(sunday);
  }

  const [priorWeekHours, setPriorWeekHours] = useState<{ weekStart: string; reg: string; ot: string }>({
    weekStart: currentWeekStartKey(), reg: "", ot: "",
  });

  function setPriorWeekHourField(field: "reg" | "ot", value: string) {
    setPriorWeekHours(prev => ({ ...prev, weekStart: currentWeekStartKey(), [field]: value }));
  }

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
        closed_week_start: closedWeekHours.weekStart,
        closed_week_reg: closedWeekHours.reg,
        closed_week_ot: closedWeekHours.ot,
      }).then(({ error }) => {
        if (error) console.error("wallet_pay_period save failed:", error);
      });
    }, 800);
    return () => { if (payPeriodSaveTimer.current) clearTimeout(payPeriodSaveTimer.current); };
  }, [priorWeekHours, closedWeekHours, walletSettingsLoaded]);

  function setClosedWeekHourField(weekStart: string, field: "reg" | "ot", value: string) {
    setClosedWeekHours(prev => ({
      weekStart,
      reg: prev.weekStart === weekStart ? (field === "reg" ? value : prev.reg) : (field === "reg" ? value : ""),
      ot: prev.weekStart === weekStart ? (field === "ot" ? value : prev.ot) : (field === "ot" ? value : ""),
    }));
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

  const effectiveOtWage = parseFloat(otWageOverride) > 0 ? parseFloat(otWageOverride) : budget.hourly_wage * 1.5;
  const netHourlyWage = budget.hourly_wage > 0 ? budget.hourly_wage * (1 - taxRate / 100) : 0;
  const netOtWage = effectiveOtWage > 0 ? effectiveOtWage * (1 - taxRate / 100) : 0;

  function buildMoneyCalendarRows(allDays: Date[], startingBalance: number) {
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

  const firstSaturdayIdx = allDays.findIndex(d => d.getDay() === 6);
  const firstWednesdayIdx = allDays.findIndex(d => d.getDay() === 3);
  if (firstWednesdayIdx !== -1 && (firstSaturdayIdx === -1 || firstWednesdayIdx < firstSaturdayIdx)) {
    const firstWednesday = allDays[firstWednesdayIdx];
    const closingSaturday = new Date(firstWednesday);
    closingSaturday.setDate(closingSaturday.getDate() - 4);
    const periodStartSunday = new Date(closingSaturday);
    periodStartSunday.setDate(periodStartSunday.getDate() - 6);
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
    }
  }

  const rows = allDays.map(d => {
    const key = dateKey(d);
    const dow = d.getDay();

    if (dow === 0) {
      periodEarnedGross = 0;
      periodHoursSoFar = 0;
      periodWithdrawnGross = 0;
    }

    const extraToday = parseFloat(extraFunds[key]) || 0;
    const extraExpenseToday = parseFloat(extraExpenses[key]) || 0;
    const billsToday = billsByDate[key] || [];
    const billsTotal = billsToday.reduce((s, b) => s + b.amount, 0);

    const regHoursToday = parseFloat(dailyHours[key]?.reg) || 0;
    const otHoursToday = parseFloat(dailyHours[key]?.ot) || 0;
    const hoursToday = regHoursToday + otHoursToday;

    const fullEarnedToday =
      grossHourlyWage > 0
        ? regHoursToday * grossHourlyWage + otHoursToday * grossOtWage
        : 0;

    periodEarnedGross += fullEarnedToday;
    periodHoursSoFar += hoursToday;

    const eligiblePct = eligiblePercent(periodEarnedGross, budget.net_to_gross_ratio, budget.flat_deductions_prev, periodHoursSoFar, earlyPayPreset);
    const maxWithdrawableGrossSoFar = periodEarnedGross * eligiblePct;
    const withdrawnBeforeToday = periodWithdrawnGross;
    const availableToday = Math.max(0, maxWithdrawableGrossSoFar - periodWithdrawnGross);
    periodWithdrawnGross += availableToday;

        if (dow === 6) {
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


  const moneyCalendarResult = useMemo(
    () => buildMoneyCalendarRows([...calendarWeeks.week1, ...calendarWeeks.week2], budget.current_balance || 0),
    [calendarWeeks, billsByDate, dailyHours, extraFunds, extraExpenses, netHourlyWage, netOtWage, budget.current_balance, budget.net_to_gross_ratio, budget.flat_deductions_prev, priorWeekHours, closedWeekHours]
  );
  const week1Result = { rows: moneyCalendarResult.rows.slice(0, 7) };
  const week2Result = { rows: moneyCalendarResult.rows.slice(7, 14) };

 const monthBills = useMemo(() => {
  const monthStart = new Date(
    selectedYear,
    selectedMonth - 1,
    1
  );

  const monthEnd = new Date(
    selectedYear,
    selectedMonth,
    0
  );

  const rows: any[] = [];

  bills.forEach(bill => {
    let occurrenceDates: Date[] = [];

    if (bill.recurring) {
      occurrenceDates = getRecurringDates(
        bill,
        monthStart,
        monthEnd
      );
    } else if (
      bill.bill_month === selectedMonth &&
      bill.bill_year === selectedYear
    ) {
      occurrenceDates = [
        new Date(
          selectedYear,
          selectedMonth - 1,
          bill.due_day
        ),
      ];
    }

    occurrenceDates.forEach(occurrenceDate => {
      const occurrenceDateKey =
        dateKey(occurrenceDate);

      const payment =
        getPaymentForOccurrence(
          bill,
          occurrenceDateKey
        );

      const paid = payment?.paid ?? false;

      const name =
        payment?.name ?? bill.name;

      const amount =
        payment?.amount ?? bill.amount;

      const due_day =
        payment?.due_day ??
        occurrenceDate.getDate();

      rows.push({
        ...bill,
        name,
        amount,
        due_day,
        paid,
        late: isLate(
          due_day,
          selectedMonth,
          selectedYear,
          paid
        ),
        days: daysUntilDue(
          due_day,
          selectedMonth,
          selectedYear
        ),
        paymentId: payment?.id,
        occurrenceDate: occurrenceDateKey,
      });
    });
  });

  return rows.sort((a, b) => {
    if (a.due_day !== b.due_day) {
      return a.due_day - b.due_day;
    }

    return a.id - b.id;
  });
}, [
  bills,
  payments,
  selectedMonth,
  selectedYear,
]);

  const urgentBills = monthBills.filter(b => !b.paid && b.days <= 7 && b.days >= 0);
  const near3Bills = monthBills.filter(b => !b.paid && (b.late || (b.days <= 3 && b.days >= 0)));
  const near5Bills = monthBills.filter(b => !b.paid && (b.late || (b.days <= 5 && b.days >= 0)));
  const totalMonthlyBills = monthBills.reduce((s, b) => s + b.amount, 0);
  const paidTotal = monthBills.filter(b => b.paid).reduce((s, b) => s + b.amount, 0);
  const unpaidTotal = monthBills.filter(b => !b.paid).reduce((s, b) => s + b.amount, 0);

  const near5Total = near5Bills.reduce((s, b) => s + b.amount, 0);
  const SAFE_TO_SPEND_BUFFER = 50;
  const safeToSpend = Math.max(0, (budget.current_balance || 0) - near5Total - SAFE_TO_SPEND_BUFFER);

  function tierForDaySafe(amount: number): { label: string; color: string; bg: string } {
    if (amount <= 0) return { label: "Tight", color: "var(--danger)", bg: "var(--danger-bg)" };
    if (amount < SAFE_TO_SPEND_BUFFER) return { label: "OK", color: "var(--gold-dark)", bg: "var(--gold-light)" };
    return { label: "Comfortable", color: "var(--green-dark)", bg: "var(--sage-light)" };
  }

  const heatStripDays = useMemo(() => {
    const rows = moneyCalendarResult.rows;
    return rows.map((row, idx) => {
      // Look at bills landing in the next 4 days after this one (today's own bills
      // are already reflected in row.balance) so a day right before a bill hits
      // shows as tighter than the raw end-of-day balance alone would suggest.
      const lookahead = rows.slice(idx + 1, idx + 5);
      const upcomingBills = lookahead.reduce((s, r) => s + r.billsTotal, 0);
      const daySafe = row.balance - upcomingBills - SAFE_TO_SPEND_BUFFER;
      return { key: row.key, date: row.date, daySafe };
    });
  }, [moneyCalendarResult]);

  const pay = parseFloat(anytimePay) || 0;
  const inputAmount = pay;

  const urgentTotal = urgentBills.reduce((s, b) => s + b.amount, 0);
  const near3Total = near3Bills.reduce((s, b) => s + b.amount, 0);
  const isCrisis = near3Total >= 200 || near5Total >= 475;
  // near5 is a superset of near3, so it always covers whichever threshold tripped
  const crisisBills = near5Bills;
  const crisisTotal = near5Total;
  const billsRate = totalMonthlyBills / 30;

  const NEEDS_FLOOR = 25;

  let unifiedBills: number;
  let unifiedSnowball: number;
  let unifiedBuffer: number;
  let unifiedNeeds: number;
  let unifiedFun: number;

  if (isCrisis) {
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

    const needsFloor = Math.min(afterBills, NEEDS_FLOOR);
    const afterFloor = Math.max(0, afterBills - needsFloor);

    unifiedSnowball = extraDebtPayment > 0 ? Math.min(afterFloor * 0.25, extraDebtPayment / 30) : 0;
    const afterSnowball = Math.max(0, afterFloor - unifiedSnowball);
    unifiedBuffer = Math.min(22, afterSnowball);
    const afterBuffer = Math.max(0, afterSnowball - unifiedBuffer);

    const extraNeeds = Math.min(afterBuffer, afterBuffer * 0.65);
    unifiedNeeds = needsFloor + extraNeeds;
    unifiedFun = Math.max(0, afterBuffer - extraNeeds);
  }

  const allocations: { label: string; icon: IconName; amount: number; color: string; note: string; noteIcon?: IconName }[] = [
    {
      label: "Bills",
      icon: "house",
      amount: unifiedBills,
      color: "var(--pink-dark)",
      noteIcon: (isCrisis || urgentBills.length > 0) ? "lightning" as IconName : undefined,
      note: isCrisis
        ? `${crisisBills.length} bill(s) due in ≤5 days -- covered first`
        : urgentBills.length > 0 ? `${urgentBills.length} bill(s) due soon!` : "bills + debt minimums",
    },
    {
      label: "Snowball Extra",
      icon: "settings-gear",
      amount: unifiedSnowball,
      color: "var(--sky)",
      note: isCrisis ? "paused -- bills come first" : "extra toward target debt",
    },
    {
      label: "General Savings",
      icon: "piggy-bank",
      amount: unifiedBuffer,
      color: "var(--gold)",
      note: isCrisis ? "paused -- bills come first" : "$22/day until $650",
    },
    {
      label: "Needs (gas, groceries, needs list)",
      icon: "basket",
      amount: unifiedNeeds,
      color: "var(--green-dark)",
      note: isCrisis ? "protected floor, even in crisis mode" : "groceries + gas, one combined category",
    },
    {
      label: "Treats (wants list)",
      icon: "trophy",
      amount: unifiedFun,
      color: "var(--ink-soft)",
      note: isCrisis ? "zeroed until crisis bills are caught up" : "whimsy -- wants, not needs!",
    },
  ];

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

  async function togglePaid(
  bill: typeof monthBills[0]
) {
  const newPaid = !bill.paid;

  if (bill.paymentId) {
    const { error } = await supabase
      .from("bill_payments")
      .update({
        paid: newPaid,
        paid_at: newPaid
          ? new Date().toISOString()
          : null,
      })
      .eq("id", bill.paymentId);

    if (error) {
      console.error(
        "togglePaid update failed:",
        error
      );
      return;
    }

    setPayments(prev =>
      prev.map(p =>
        p.id === bill.paymentId
          ? {
              ...p,
              paid: newPaid,
              paid_at: newPaid
                ? new Date().toISOString()
                : undefined,
            }
          : p
      )
    );
  } else {
    const occurrenceDate = bill.occurrenceDate;

    const date = new Date(
      `${occurrenceDate}T00:00:00`
    );

    const newPayment: BillPayment = {
      bill_id: bill.id,
      month: date.getMonth() + 1,
      year: date.getFullYear(),
      paid: newPaid,
      paid_at: newPaid
        ? new Date().toISOString()
        : undefined,
      payment_date: occurrenceDate,
      name: bill.name,
      amount: bill.amount,
      due_day: bill.due_day,
    };

    const { data, error } = await supabase
      .from("bill_payments")
      .insert(newPayment)
      .select()
      .single();

    if (error) {
      console.error(
        "togglePaid insert failed:",
        error
      );
      return;
    }

    if (data) {
      setPayments(prev => [...prev, data]);
    }
  }

  if (newPaid) {
    setCelebration({
      title: "BILL PAID!",
      subtitle: bill.name,
    });

    setShowConfetti(true);

    setTimeout(
      () => setShowConfetti(false),
      3200
    );
  }
}

async function updateMonthBill(
  bill: typeof monthBills[0],
  field: "name" | "amount" | "due_day",
  value: string | number
) {
  if (bill.recurring) {
    if (bill.paymentId) {
      const { error } = await supabase
        .from("bill_payments")
        .update({
          [field]: value,
        })
        .eq("id", bill.paymentId);

      if (error) {
        console.error(
          "updateMonthBill failed:",
          error
        );
        return;
      }

      setPayments(prev =>
        prev.map(p =>
          p.id === bill.paymentId
            ? {
                ...p,
                [field]: value,
              }
            : p
        )
      );
    } else {
      const occurrenceDate =
        bill.occurrenceDate;

      const date = new Date(
        `${occurrenceDate}T00:00:00`
      );

      const newPayment: BillPayment = {
        bill_id: bill.id,
        month: date.getMonth() + 1,
        year: date.getFullYear(),
        paid: false,
        payment_date: occurrenceDate,
        name: bill.name,
        amount: bill.amount,
        due_day: bill.due_day,
        [field]: value,
      };

      const { data, error } = await supabase
        .from("bill_payments")
        .insert(newPayment)
        .select()
        .single();

      if (error) {
        console.error(
          "updateMonthBill insert failed:",
          error
        );
        return;
      }

      if (data) {
        setPayments(prev => [
          ...prev,
          data,
        ]);
      }
    }
  } else {
    const { error } = await supabase
      .from("bills")
      .update({
        [field]: value,
      })
      .eq("id", bill.id);

    if (error) {
      console.error(
        "updateMonthBill (bills) failed:",
        error
      );
      return;
    }

    setBills(prev =>
      prev.map(b =>
        b.id === bill.id
          ? {
              ...b,
              [field]: value,
            }
          : b
      )
    );
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

  async function addList() {
    const name = newListName.trim();
    if (!name) return;
    const list: ListDef = { id: nextListId, name };
    setLists(prev => [...prev, list]);
    setNextListId(n => n + 1);
    setActiveListId(list.id);
    setNewListName("");
    setShowNewListInput(false);
    const { data, error } = await supabase.from("lists").insert(list).select().single();
    if (error) console.error("addList failed:", error);
    else if (data) setLists(prev => prev.map(l => l.id === list.id ? data : l));
  }

  async function deleteList(id: number) {
    setLists(prev => prev.filter(l => l.id !== id));
    setListItems(prev => prev.filter(li => li.list_id !== id));
    if (activeListId === id) {
      const remaining = lists.filter(l => l.id !== id);
      setActiveListId(remaining.length > 0 ? remaining[0].id : null);
    }
    await supabase.from("list_items").delete().eq("list_id", id);
    await supabase.from("lists").delete().eq("id", id);
  }

  async function addListItem(listId: number) {
    const label = (newItemDrafts[listId] || "").trim();
    if (!label) return;
    const item: ListItem = { id: nextListItemId, list_id: listId, label, done: false };
    setListItems(prev => [...prev, item]);
    setNextListItemId(n => n + 1);
    setNewItemDrafts(prev => ({ ...prev, [listId]: "" }));
    const { data, error } = await supabase.from("list_items").insert(item).select().single();
    if (error) console.error("addListItem failed:", error);
    else if (data) setListItems(prev => prev.map(li => li.id === item.id ? data : li));
  }

  async function toggleListItem(item: ListItem) {
    const newDone = !item.done;
    setListItems(prev => prev.map(li => li.id === item.id ? { ...li, done: newDone } : li));
    await supabase.from("list_items").update({ done: newDone }).eq("id", item.id);
  }

  async function deleteListItem(id: number) {
    setListItems(prev => prev.filter(li => li.id !== id));
    await supabase.from("list_items").delete().eq("id", id);
  }

  async function addBill() {
  if (!newBill.name || !newBill.amount || !newBill.due_day) return;

  const dueDay = parseInt(newBill.due_day);

  const startDate = newBill.recurring
    ? `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(
        Math.min(dueDay, new Date(selectedYear, selectedMonth, 0).getDate())
      ).padStart(2, "0")}`
    : undefined;

  const bill: Bill = {
    id: nextBillId,
    name: newBill.name,
    amount: parseFloat(newBill.amount),
    due_day: dueDay,
    recurring: newBill.recurring,
    frequency: newBill.recurring ? newBill.frequency : "monthly",
    frequency_start_date: startDate,
    bill_month: newBill.recurring ? undefined : selectedMonth,
    bill_year: newBill.recurring ? undefined : selectedYear,
  };

  const { error } = await supabase
    .from("bills")
    .insert(bill);

  if (error) {
    console.error("addBill failed:", error);
    return;
  }

  setBills(prev =>
    [...prev, bill].sort((a, b) => a.due_day - b.due_day)
  );

  setNextBillId(n => n + 1);

  setNewBill({
    name: "",
    amount: "",
    due_day: "",
    recurring: true,
    frequency: "monthly",
  });

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
    setCelebration({ title: "DEBT PAID OFF!", subtitle: name });
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
    const colors = ["var(--pink-dark)","var(--green-dark)","var(--pink-light-solid)","var(--ink-soft)","var(--gold-light-solid)"];
    return (
      <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 9999, overflow: "hidden" }}>
        {Array.from({ length: 60 }).map((_, i) => (
          <div key={i} style={{ position: "absolute", left: `${Math.random() * 100}%`, top: "-10px", width: `${Math.random() * 8 + 4}px`, height: `${Math.random() * 8 + 4}px`, background: colors[Math.floor(Math.random() * colors.length)], borderRadius: Math.random() > 0.5 ? "50%" : "0", animation: `fall ${Math.random() * 2 + 2}s linear ${Math.random() * 2}s forwards` }} />
        ))}
        <style>{`@keyframes fall { to { transform: translateY(100vh) rotate(720deg); opacity: 0; } }`}</style>
        <div style={{ position: "absolute", top: "35%", left: "50%", transform: "translateX(-50%)", textAlign: "center", background: "var(--white)", border: "2px solid var(--border)", borderRadius: 32, padding: "24px 32px", minWidth: 220 }}>
          <img src={celebrationImg} alt="" style={{ width: 120 }} />
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--green-dark)", marginTop: 8 }}>{celebration.title}</div>
          <div style={{ fontSize: 16, color: "var(--pink-dark)", marginTop: 4 }}>{celebration.subtitle}</div>
          <div style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 8 }}>Keep going — you are crushing it!</div>
        </div>
      </div>
    );
  };

  const VIEW_TITLES: Record<typeof view, { text: string; icon?: IconName }> = {
  home: { text: "Wallet" },
  calendar: { text: "Money Calendar", icon: "calendar" },
  bills: { text: "Bills", icon: "house" },
  debts: { text: "Debts", icon: "calculator-hearts" },
};

  return (
    <div>
      {showConfetti && <Confetti />}

      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {view !== "home" && (
            <button className="btn btn-ghost btn-sm" onClick={() => setView("home")}>← Back</button>
          )}
          <h2>{VIEW_TITLES[view].icon && <Icon name={VIEW_TITLES[view].icon!} size={20} />} {VIEW_TITLES[view].text}</h2>
          <Lantern />
        </div>
        {savedMsg && <span className="badge badge-green">Saved!</span>}
      </div>

      <div className="page-body" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

    {/* CALENDAR, BILLS AND DEBTS BUTTONS */}

        {view === "home" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              
            <button
              onClick={() => setView("calendar")}
              style={{
                textAlign: "left",
                cursor: "pointer",
                fontFamily: "inherit",
                border: "1.5px dashed var(--border)",
                borderRadius: 18,
                background: "var(--white)",
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div style={{ fontSize: 24 }}>
                <Icon name="calendar" size={24} />
              </div>

              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)" }}>
                Money Calendar
              </div>

              <div style={{ fontSize: 11, color: "var(--ink-muted)" }}>
                14 day forecast
              </div>
            </button>

              <button
                onClick={() => setView("bills")}
                style={{
                  textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                  border: "1.5px dashed var(--border)", borderRadius: 18,
                  background: "var(--white)", padding: "14px 16px",
                  display: "flex", flexDirection: "column", gap: 6,
                }}
              >
                <div style={{ fontSize: 24, lineHeight: 1 }}><Icon name="house" size={24} /></div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)" }}>Bills</div>
                <div style={{ fontSize: 11, color: "var(--ink-muted)" }}>
                  {unpaidTotal > 0 ? `${fmt(unpaidTotal)} unpaid` : <>all paid up <Icon name="clipboard-check" size={12} /></>}
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
                <div style={{ fontSize: 24, lineHeight: 1 }}><Icon name="calculator-hearts" size={24} /></div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)" }}>Debts</div>
                <div style={{ fontSize: 11, color: "var(--ink-muted)" }}>
                  {activeDebts.filter(d => !d.paid_off).length} active · {payoffMonth}mo payoff
                </div>
              </button>
            </div>

            {/* SAFE TO SPEND */}

            <div className="card" style={{ borderColor: budget.current_balance ? (safeToSpend > 0 ? "var(--green-dark)" : "var(--danger)") : "var(--border)" }}>
              <div className="card-body">
                <div className="section-label">Safe to Spend Right Now</div>
                {budget.current_balance ? (
                  <>
                    <div style={{ fontSize: 32, fontWeight: 800, color: safeToSpend > 0 ? "var(--green-dark)" : "var(--danger)", marginTop: 4 }}>
                      {fmt(safeToSpend)}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink-muted)", marginBottom: 12 }}>
                      after bills due within 5 days (debt minimums included) and a {fmt(SAFE_TO_SPEND_BUFFER)} safety buffer
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--ink-soft)" }}>Current balance</span>
                        <span style={{ fontWeight: 700 }}>{fmt(budget.current_balance)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--ink-soft)" }}>− Bills due within 5 days</span>
                        <span style={{ fontWeight: 700, color: "var(--danger)" }}>−{fmt(near5Total)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--ink-soft)" }}>− Safety buffer</span>
                        <span style={{ fontWeight: 700, color: "var(--danger)" }}>−{fmt(SAFE_TO_SPEND_BUFFER)}</span>
                      </div>
                    </div>
                    {safeToSpend <= 0 && (
                      <div style={{ marginTop: 10, fontSize: 12, color: "var(--danger)", fontWeight: 600 }}>
                        Nothing free right now — committed money covers everything. Hold off on treats until this clears.
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                    Enter your current balance below (Money Calendar settings) to see this number.
                  </div>
                )}
              </div>
            </div>

            {/* EQUITY MODE CHECK / TODAYS PAYCHECK CALCULATOR */}

            {isCrisis && (
              <div style={{ background: "var(--danger-bg)", border: "1.5px solid var(--danger)", borderRadius: 16, padding: "12px 16px", fontSize: 13, color: "var(--danger)", fontWeight: 700 }}>
                Equity Mode Active — {near3Total >= 200 && `${fmt(near3Total)} due within 3 days`}{near3Total >= 200 && near5Total >= 475 && " and "}{near5Total >= 475 && `${fmt(near5Total)} due within 5 days`}. Fun money and general savings are zeroed until these are covered. Things you need are still protected.
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
                          <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 600 }}><Icon name={a.icon} size={14} /> {a.label}</div>
                          <div style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 2 }}>{a.noteIcon && <Icon name={a.noteIcon} size={12} />} {a.note}</div>
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

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
  <Icon name="pagedivider" size={85} />
</div>

            {/* ── LISTS ── */}
            <div className="card">
              <div className="card-body">
                <div className="section-header">
                  <div className="section-label" style={{ marginBottom: 0 }}><Icon name="clipboard-list" size={16} /> Lists</div>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowNewListInput(v => !v)}>+ New List</button>
                </div>
                {showNewListInput && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Groceries, Hardware Store..."
                      value={newListName}
                      onChange={e => setNewListName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") addList(); }}
                      autoFocus
                    />
                    <button className="btn btn-green btn-sm" onClick={addList}>Add</button>
                  </div>
                )}

                {lists.length === 0 ? (
                  <EmptyState image={emptyWallet} message="No lists yet. Create one to get started." />
                ) : (
                  <>
                    <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 8 }}>
                      {lists.map(l => (
                        <button
                          key={l.id}
                          onClick={() => setActiveListId(l.id)}
                          className={activeListId === l.id ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
                          style={{ whiteSpace: "nowrap" }}
                        >
                          {l.name}
                        </button>
                      ))}
                    </div>

                    {activeList && (
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{activeList.name}</div>
                          <button className="btn btn-ghost btn-sm" onClick={() => deleteList(activeList.id)}><Icon name="icon-trash2" size={13} /></button>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                          {activeListItems.map(item => (
                            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                              <button
                                onClick={() => toggleListItem(item)}
                                aria-label={item.done ? "Mark not done" : "Mark done"}
                                style={{
                                  width: 24, height: 24, flexShrink: 0,
                                  border: "none", background: "none", padding: 0,
                                  cursor: "pointer", display: "flex",
                                  alignItems: "center", justifyContent: "center",
                                }}
                              >
                                {item.done
                                  ? <Icon name={theme === 'light' ? 'full_sun' : 'full_moon'} size={17} style={{ color: "var(--pink-dark)" }} />
                                  : <Icon name={theme === 'light' ? 'empty_sun' : 'empty_moon'} size={17} style={{ color: "var(--border)" }} />
                                }
                              </button>
                              <div style={{ flex: 1, fontSize: 13, color: item.done ? "var(--ink-muted)" : "var(--ink)", textDecoration: item.done ? "line-through" : "none" }}>
                                {item.label}
                              </div>
                              <button className="btn btn-ghost btn-sm" onClick={() => deleteListItem(item.id)}><Icon name="icon-trash2" size={12} /></button>
                            </div>
                          ))}
                          {activeListItems.length === 0 && (
                            <div style={{ fontSize: 12, color: "var(--ink-muted)", padding: "8px 0" }}>Nothing on this list yet.</div>
                          )}
                        </div>

                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Add an item..."
                            value={newItemDrafts[activeList.id] || ""}
                            onChange={e => setNewItemDrafts(prev => ({ ...prev, [activeList.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === "Enter") addListItem(activeList.id); }}
                          />
                          <button className="btn btn-green btn-sm" onClick={() => addListItem(activeList.id)}>Add</button>
                        </div>
                      </div>
                    )}
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
            
                <div style={{ fontSize: 24, lineHeight: 1 }}><Icon name="calendar" size={24} /></div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)" }}>Money Calendar</div>
                <div style={{ fontSize: 11, color: "var(--pink-dark)", marginBottom: 14 }}>
                  Runs from today forward. Log the hours you're working (or plan to work) each day. Your early-pay eligible percentage comes from your last paycheck's net-to-gross ratio (post-tax ÷ pre-tax), applied against your cumulative pool for the week, minus that check's flat deductions and a growing safety buffer — whatever's unclaimed by Saturday night lands as a lump catch-up the following Wednesday.
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div className="form-label">Early Pay Formula</div>
                  <select
                    className="form-input"
                    value={earlyPayPresetId}
                    onChange={e => setEarlyPayPresetId(e.target.value as EarlyPayPresetId)}
                  >
                    {Object.values(EARLY_PAY_PRESETS).map(p => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: 10, color: "var(--ink-muted)", marginTop: 4 }}>
                    {earlyPayPresetId === "amazon"
                      ? "Mirrors Amazon's Anytime Pay math: a 2% safety buffer that steps up to 8% once you've logged 55+ hours in the week."
                      : "Set your own safety buffer and hours threshold below to match your employer's early-pay program."}
                  </div>
                  {earlyPayPresetId === "custom" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
                      <div>
                        <div className="form-label" style={{ fontSize: 10 }}>Safety Buffer (%)</div>
                        <input
                          type="number" className="form-input"
                          value={customEarlyPayPreset.safetyBufferNormal * 100}
                          onChange={e => setCustomEarlyPayPreset(prev => ({ ...prev, safetyBufferNormal: (parseFloat(e.target.value) || 0) / 100 }))}
                        />
                      </div>
                      <div>
                        <div className="form-label" style={{ fontSize: 10 }}>High-Hours Buffer (%)</div>
                        <input
                          type="number" className="form-input"
                          value={customEarlyPayPreset.safetyBufferHighHours * 100}
                          onChange={e => setCustomEarlyPayPreset(prev => ({ ...prev, safetyBufferHighHours: (parseFloat(e.target.value) || 0) / 100 }))}
                        />
                      </div>
                      <div>
                        <div className="form-label" style={{ fontSize: 10 }}>High-Hours Threshold</div>
                        <input
                          type="number" className="form-input"
                          value={customEarlyPayPreset.highHoursThreshold}
                          onChange={e => setCustomEarlyPayPreset(prev => ({ ...prev, highHoursThreshold: parseFloat(e.target.value) || 0 }))}
                        />
                      </div>
                      <div>
                        <div className="form-label" style={{ fontSize: 10 }}>Garnishments ($)</div>
                        <input
                          type="number" className="form-input"
                          value={customEarlyPayPreset.garnishments}
                          onChange={e => setCustomEarlyPayPreset(prev => ({ ...prev, garnishments: parseFloat(e.target.value) || 0 }))}
                        />
                      </div>
                    </div>
                  )}
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

                {(() => {
                  const allDays = [...calendarWeeks.week1, ...calendarWeeks.week2];
                  const firstSaturdayIdx = allDays.findIndex(d => d.getDay() === 6);
                  const firstWednesdayIdx = allDays.findIndex(d => d.getDay() === 3);
                  const needsClosedWeek =
                    firstWednesdayIdx !== -1 && (firstSaturdayIdx === -1 || firstWednesdayIdx < firstSaturdayIdx);
                  if (!needsClosedWeek) return null;

                  const firstWednesday = allDays[firstWednesdayIdx];
                  const closingSaturday = new Date(firstWednesday);
                  closingSaturday.setDate(closingSaturday.getDate() - 4);
                  const periodStartSunday = new Date(closingSaturday);
                  periodStartSunday.setDate(periodStartSunday.getDate() - 6);
                  const periodStartKey = dateKey(periodStartSunday);
                  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

                  return (
                    <div style={{
                      marginBottom: 14, padding: "10px 12px", borderRadius: "var(--radius-sm)",
                      background: "var(--blush)", border: "1px solid var(--pink-light)",
                    }}>
                      <div className="form-label" style={{ marginBottom: 4 }}>
                        Hours worked {fmt(periodStartSunday)}–{fmt(closingSaturday)}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--ink-muted)", marginBottom: 8 }}>
                        This week already closed out before the calendar's visible window, so it never had a row to log hours into. Enter it here and Wednesday {fmt(firstWednesday)} will show its release using the same math as everywhere else.
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div className="form-label" style={{ fontSize: 10 }}>Regular hrs</div>
                          <input
                            type="number" className="form-input" placeholder="0"
                            value={closedWeekHours.weekStart === periodStartKey ? closedWeekHours.reg : ""}
                            onChange={e => setClosedWeekHourField(periodStartKey, "reg", e.target.value)}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div className="form-label" style={{ fontSize: 10 }}>OT hrs</div>
                          <input
                            type="number" className="form-input" placeholder="0"
                            value={closedWeekHours.weekStart === periodStartKey ? closedWeekHours.ot : ""}
                            onChange={e => setClosedWeekHourField(periodStartKey, "ot", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}

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
                    <div className="form-label">Hourly Wage</div>
                    <EditableCell type="number" className="form-input" value={budget.hourly_wage || ""} placeholder="set in Budget Calculator" onChange={v => updateBudget("hourly_wage", parseFloat(v) || 0)} />
                    {budgetSaveError && <div style={{ fontSize: 10, color: "var(--danger)", marginTop: 4 }}><Icon name="lightning" size={12} /> {budgetSaveError}</div>}
                  </div>
                  <div>
                    <div className="form-label">OT Wage</div>
                    <input type="number" className="form-input" value={otWageOverride} placeholder={budget.hourly_wage > 0 ? `${(budget.hourly_wage * 1.5).toFixed(2)} (1.5x)` : "e.g. 29.25"} onChange={e => setOtWageOverride(e.target.value)} />
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end" }}>
                    <div style={{ fontSize: 10, color: "var(--ink-muted)" }}>leave blank to auto-use 1.5x your hourly wage</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <div className="form-label">Net-to-Gross Ratio</div>
                    <EditableCell type="number" className="form-input" value={budget.net_to_gross_ratio || ""} placeholder="e.g. 0.77" onChange={v => updateBudget("net_to_gross_ratio", parseFloat(v) || 0)} />
                    <div style={{ fontSize: 10, color: "var(--ink-muted)", marginTop: 4 }}>
                      {earlyPayPresetId === "amazon"
                        ? "From payroll.amazon.work: previous paycheck's post-tax ÷ pre-tax earnings. Update it each payday."
                        : "Previous paycheck's post-tax ÷ pre-tax earnings, from your pay portal. Update it each payday."}
                    </div>
                  </div>
                  <div>
                    <div className="form-label">Flat Deductions ($)</div>
                    <EditableCell type="number" className="form-input" value={budget.flat_deductions_prev || ""} placeholder="e.g. 62.84" onChange={v => updateBudget("flat_deductions_prev", parseFloat(v) || 0)} />
                    <div style={{ fontSize: 10, color: "var(--ink-muted)", marginTop: 4 }}>
                      {earlyPayPresetId === "amazon"
                        ? "Flat deductions from your previous paycheck (per the Amazon app) — for most people this is just the health premium."
                        : "Flat deductions from your previous paycheck — for most people this is just the health premium."}
                    </div>
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

                {budget.hourly_wage > 0 && heatStripDays.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div className="form-label" style={{ marginBottom: 6 }}>Safe-to-Spend at a Glance</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                      {heatStripDays.map(d => {
                        const tier = tierForDaySafe(d.daySafe);
                        const isToday = d.key === dateKey(new Date());
                        return (
                          <div
                            key={d.key}
                            onClick={() => {
                              document.getElementById(`money-day-${d.key}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                            }}
                            title={`${d.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${tier.label}`}
                            style={{
                              aspectRatio: "1",
                              borderRadius: 8,
                              background: tier.bg,
                              border: `1.5px solid ${isToday ? "var(--pink-dark)" : tier.color}`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 10,
                              fontWeight: 700,
                              color: tier.color,
                              cursor: "pointer",
                            }}
                          >
                            {d.date.getDate()}
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 9, color: "var(--ink-muted)" }}>
                      <span style={{ color: "var(--danger)" }}>■ Tight</span>
                      <span style={{ color: "var(--gold-dark)" }}>■ OK</span>
                      <span style={{ color: "var(--green-dark)" }}>■ Comfortable</span>
                    </div>
                  </div>
                )}

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
                            <div key={row.key} id={`money-day-${row.key}`} style={{ border: `1.5px solid ${isToday ? "var(--pink-dark)" : "var(--border)"}`, borderRadius: 14, padding: "10px 12px", background: isToday ? "var(--accent)" : "transparent" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>
                                  {row.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                                  {isToday && <span style={{ color: "var(--pink-dark)", marginLeft: 6, fontSize: 10 }}>TODAY</span>}
                                </div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: row.balance < 0 ? "var(--danger)" : (isToday ? "var(--pink-dark)" : "var(--green-dark)") }}>
                                  {fmt(row.balance)}
                                </div>
                              </div>

                              {row.billsToday.length > 0 && (
                                <div style={{ marginBottom: 6 }}>
                                  {row.billsToday.map(b => (
                                    <div key={b.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--pink-dark)" }}>
                                      <span><Icon name="house" size={14} /> {b.name}</span>
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
                                  <span style={{ fontSize: 11, color: isToday ? "var(--pink-dark)" : "var(--green-dark)", fontWeight: 700, whiteSpace: "nowrap" }}>+{fmt(row.availableToday)}</span>
                                )}
                              </div>

                              {row.hoursToday > 0 && (
                                <div style={{ fontSize: 9, color: "var(--ink-muted)", marginTop: 3 }}>
                                  {Math.round(row.eligiblePct * 100)}% of period pool available
                                  {row.heldInPool > 0.005 && ` · ${fmt(row.heldInPool)} still held this period`}
                                  {row.withdrawnBeforeToday > 0.005 && (
                                    <div style={{ marginTop: 1 }}>
                                      {fmt(row.ceilingToday)} ceiling · {fmt(row.withdrawnBeforeToday)} already pulled
                                    </div>
                                  )}
                                </div>
                              )}

                              {row.releasedToday > 0.005 && (
                                <div style={{ fontSize: 11, color: "var(--gold)", fontWeight: 700, marginTop: 4 }}>
                                  <Icon name="money-bag" size={14} /> +{fmt(row.releasedToday)} payday catch-up
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

                              <div style={{ marginTop: 8 }}>
                                <span style={{ fontSize: 10, color: "var(--ink-muted)" }}>
                                  Expected Purchase / Expense
                                </span>

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

                              {row.extraExpenseToday > 0 && (
                                <div
                                  style={{
                                    fontSize: 11,
                                    color: "var(--danger)",
                                    fontWeight: 700,
                                    marginTop: 4,
                                  }}
                                >
                                  -{fmt(row.extraExpenseToday)} expected
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
  </>
)}






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
                     <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
  <label style={{ fontSize: 13, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
    <input
      type="checkbox"
      checked={newBill.recurring}
      onChange={e =>
        setNewBill(p => ({
          ...p,
          recurring: e.target.checked,
        }))
      }
    />
    Recurring
  </label>

  {newBill.recurring && (
    <select
      className="form-input"
      value={newBill.frequency}
      onChange={e =>
        setNewBill(p => ({
          ...p,
          frequency: e.target.value as
            | "weekly"
            | "biweekly"
            | "monthly"
            | "quarterly"
            | "yearly",
        }))
      }
    >
      <option value="weekly">Weekly</option>
      <option value="biweekly">Every 2 Weeks</option>
      <option value="monthly">Monthly</option>
      <option value="quarterly">Every 3 Months</option>
      <option value="yearly">Yearly</option>
    </select>
  )}
</div>
                    </div>
                    <button className="btn btn-green" style={{ justifyContent: "center" }} onClick={addBill}>Save Bill</button>
                  </div>
                )}
                <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      {["", "Bill", "Amount", "Due", "Status", ""].map(h => (
                        <th key={h} style={{ fontSize: 10, color: "var(--ink-muted)", textTransform: "uppercase", padding: "8px 8px", textAlign: "left", borderBottom: "1.5px solid var(--border)", fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>

                    {monthBills.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--ink-muted)" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                          <img src={emptyWallet} alt="" style={{ width: 100 }} />
                          No bills yet — click + Add Bill to get started.
                        </div>
                      </td></tr>
                    ) : (
                  <tbody>
                    {monthBills.map((b, i) => (
                      <tr key={b.id} style={{ background: b.late ? "var(--danger-bg)" : b.paid ? "var(--sage-light)" : i % 2 === 0 ? "transparent" : "var(--accent)" }}>
                        <td style={{ padding: "9px 8px" }}>
                          <button
                            onClick={() => togglePaid(b)}
                            aria-label={b.paid ? "Mark not paid" : "Mark paid"}
                            style={{
                              width: 26, height: 26, flexShrink: 0,
                              border: "none", background: "none", padding: 0,
                              cursor: "pointer", display: "flex",
                              alignItems: "center", justifyContent: "center",
                            }}
                          >
                            {b.paid
                              ? <Icon name={theme === 'light' ? 'full_sun' : 'full_moon'} size={22} />
                              : <Icon name={theme === 'light' ? 'empty_sun' : 'empty_moon'} size={22} />
                            }
                          </button>
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
                            : b.days === 0 ? <span className="badge badge-lavender">DUE TODAY</span>
                            : b.days <= 3 ? <span className="badge badge-lavender">DUE SOON</span>
                            : <span className="badge badge-pink">{b.days}d away</span>}
                            </td>
                        <td style={{ padding: "9px 8px", textAlign: "center" }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => removeBill(b.id)}><Icon name="icon-trash2" size={13} /></button>
                        </td>
                      </tr>
                    ))}
                    
                  </tbody>
                )}
                </table>
                </div>
              </div>
            </div>
          </>
        )}

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
                    <div style={{ fontSize: 13, fontWeight: 700, color: extraDebtPayment >= 0 ? "var(--green-dark)" : "var(--danger)" }}>True Debt Payment Extra</div>
                    <div style={{ fontSize: 11, color: "var(--ink-muted)" }}>take-home ({fmt(budget.take_home)}) minus fixed expenses and {fmt(totalMins)} in minimums</div>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: extraDebtPayment >= 0 ? "var(--green-dark)" : "var(--danger)" }}>{fmt(extraDebtPayment)}</div>
                </div>
                {extraDebtPayment < 0 && (
                  <div style={{ marginTop: 10, fontSize: 12, color: "var(--danger)", fontWeight: 600 }}>
                    <Icon name="lightning" size={13} /> Minimums + fixed expenses exceed your take-home pay. Update your Budget Calculator on the home page.
                  </div>
                )}
              </div>
            </div>





           
<div className="card" style={{ marginBottom: 12 }}>
  <div className="card-body">
    <div style={{ fontWeight: 700, marginBottom: 10 }}>
      Select Debt Payoff Strategy
    </div>

        <label
      style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer" }}
      onClick={() => setDebtStrategy("snowball")}
    >
      <Icon name={debtStrategy === "snowball" ? "heartfull" : "heartempty"} size={18} />
      <div>
        Snowball
        <div style={{ fontSize: 12, opacity: .7 }}>
          Pay the smallest balance first.
        </div>
      </div>
    </label>


       <label
      style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
      onClick={() => setDebtStrategy("avalanche")}
    >
      <Icon name={debtStrategy === "avalanche" ? "heartfull" : "heartempty"} size={18} />
      <div>
        Avalanche
        <div style={{ fontSize: 12, opacity: .7 }}>
          Pay the highest APR first.
        </div>
      </div>
    </label>

  </div>
</div>
 <div className="card">
              <div className="card-body">
                <div className="section-header">

                  <div className="section-label">Active Debts</div>

                  <button className="btn btn-primary btn-sm" onClick={() => addDebt(false)}>
                    + Add
                  </button>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table className="table">
                    <thead>
                      <tr>
                        {["","#","Name","Balance","Progress","APR%","Min/Mo",""].map(h => (
                          <th key={h} style={{ fontSize: 10, color: "var(--ink-muted)", textTransform: "uppercase", padding: "8px", textAlign: "left", borderBottom: "1.5px solid var(--border)", fontWeight: 700 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>

                  {activeDebts.length === 0 ? (
  <tbody>
    <tr>
      <td colSpan={8} style={{ padding: 24, textAlign: "center" }}>
        <EmptyState image={emptyWallet} message="No debts listed yet. Add one to start tracking." />
      </td>
    </tr>
  </tbody>
) : (
                    <tbody>
                      {activeDebts.filter(d => !d.paid_off).map((d, i) => {
                        const origBal = d.original_balance || d.balance;
                        const paidPct = origBal > 0 ? Math.min(100, ((origBal - d.balance) / origBal) * 100) : 0;
                        return (
                          <tr key={d.id} style={{ background: i % 2 === 0 ? "transparent" : "var(--accent)" }}>
                            <td style={{ padding: "9px 8px" }}>
                              <button
                                onClick={() => markDebtPaid(d.id, d.name)}
                                aria-label="Mark debt paid off"
                                style={{
                                  width: 26, height: 26, flexShrink: 0,
                                  border: "none", background: "none", padding: 0,
                                  cursor: "pointer", display: "flex",
                                  alignItems: "center", justifyContent: "center",
                                }}
                              >
                                <Icon name={theme === 'light' ? 'empty_sun' : 'empty_moon'} size={22} />
            </button>
                            </td>
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
                              <button className="btn btn-ghost btn-sm" onClick={() => removeDebt(d.id)}><Icon name="icon-trash2" size={13} /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  )}
                  </table>
                </div>
              </div>
            </div>

            {activeDebts.filter(d => d.paid_off).length > 0 && (
              <div className="card" style={{ opacity: 0.9 }}>
                <div className="card-body">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div className="section-label" style={{ marginBottom: 0 }}><Icon name="trophy" size={16} /> Paid Off</div>
                    <span style={{ fontSize: 12, color: "var(--green-dark)", fontWeight: 600 }}>Amazing work!</span>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <tbody>
                      {activeDebts.filter(d => d.paid_off).map(d => (
                        <tr key={d.id} style={{ background: "var(--sage-light)" }}>
                          <td style={{ padding: "9px 8px", width: 36 }}>
                            <button
                              onClick={() => unmarkDebtPaid(d.id)}
                              aria-label="Mark debt not paid off"
                              style={{
                                width: 26, height: 26, flexShrink: 0,
                                border: "none", background: "none", padding: 0,
                                cursor: "pointer", display: "flex",
                                alignItems: "center", justifyContent: "center",
                              }}
                            >
                            <Icon name={theme === 'light' ? 'full_sun' : 'full_moon'} size={22} />
          </button>
                          </td>
                          <td style={{ padding: "9px 8px", textDecoration: "line-through", color: "var(--green-dark)", fontWeight: 700 }}>{d.name}</td>
                          <td style={{ padding: "9px 8px", color: "var(--green-dark)", fontWeight: 800 }}>$0.00</td>
                          <td style={{ padding: "9px 8px" }}><span className="badge badge-green">PAID OFF</span></td>
                          <td style={{ padding: "9px 8px", textAlign: "center" }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => removeDebt(d.id)}><Icon name="icon-trash2" size={13} /></button>
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
                            <td style={{ padding: "9px 8px", textAlign: "center" }}>
                              <button className="btn btn-ghost btn-sm" onClick={() => removeDebt(d.id)}><Icon name="icon-trash2" size={13} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>


            <div className="section-label" style={{ marginTop: 4 }}><Icon name="clipboard-list" size={16} /> Payoff Schedule</div>
            {extraDebtPayment < 0 && (
              <div style={{ background: "var(--danger-bg)", border: "1.5px solid var(--danger)", borderRadius: 16, padding: "12px 16px", fontSize: 13, color: "var(--danger)", fontWeight: 600 }}>
                <Icon name="lightning" size={13} /> Extra debt payment is negative — minimum payments exceed your budget!
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
                                <div>{paid ? <>PAID <Icon name="clipboard-check" size={12} /></> : fmt(bal)}</div>
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
