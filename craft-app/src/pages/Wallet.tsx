import { useState, useMemo, useEffect } from "react";
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

interface SavedInstead {
  id?: number;
  amount: number;
  item_name: string;
  saved_at?: string;
}

interface MonthSnap {
  month: number;
  target: string;
  balances: Record<number, number>;
  deferredBalances: Record<number, number>;
  activeTotal: number;
  deferredTotal: number;
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

function EditableCell({ value, onChange, type = "number" }: { value: string | number; onChange: (v: string) => void; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1.5px dashed var(--border)", color: "var(--ink)", fontSize: 13, padding: "2px 4px", outline: "none", fontFamily: "inherit" }}
    />
  );
}

export default function Wallet() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [budget, setBudget] = useState<Budget>({ take_home: 0, fixed_expenses: 0, hourly_wage: 0 });
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<BillPayment[]>([]);
  const [savedInstead, setSavedInstead] = useState<SavedInstead[]>([]);
  const [nextId, setNextId] = useState(20);
  const [nextBillId, setNextBillId] = useState(10);
  const [tab, setTab] = useState("planner");
  const [showDeferred, setShowDeferred] = useState(false);
  const [, setLoading] = useState(true);
  const [savedMsg, setSavedMsg] = useState(false);
  const [anytimePay, setAnytimePay] = useState("");
  const [weeklyPay, setWeeklyPay] = useState("");
  const [planNotes, setPlanNotes] = useState("");
  const [showBillForm, setShowBillForm] = useState(false);
  const [newBill, setNewBill] = useState({ name: "", amount: "", due_day: "", recurring: true });
  const [streakCount, setStreakCount] = useState<number>(() => {
    const s = localStorage.getItem("streak_count"); return s ? parseInt(s) : 0;
  });
  const [lastCheckIn, setLastCheckIn] = useState<string>(() => localStorage.getItem("last_checkin") || "");
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [showCalculator, setShowCalculator] = useState(false);
  const [milestones, setMilestones] = useState<string[]>(() => {
    const s = localStorage.getItem("milestones"); return s ? JSON.parse(s) : [];
  });
  const [bufferBalance, setBufferBalance] = useState<number>(() => {
    const saved = localStorage.getItem("buffer_balance");
    return saved ? parseFloat(saved) : 0;
  });
  const [showConfetti, setShowConfetti] = useState(false);
  const [paidOffDebt, setPaidOffDebt] = useState<string>("");
  const [wizardCost, setWizardCost] = useState("");
  const [wizardDebtId, setWizardDebtId] = useState<number | null>(null);
  const [wizardResult, setWizardResult] = useState<{ days: number; payments: number } | null>(null);
  const [showSavedHistory, setShowSavedHistory] = useState(false);

  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());

  const availableMonths = useMemo(() => {
    const months = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      months.push({ month: d.getMonth() + 1, year: d.getFullYear(), label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` });
    }
    return months;
  }, []);

  useEffect(() => { localStorage.setItem("buffer_balance", bufferBalance.toString()); }, [bufferBalance]);
  useEffect(() => { localStorage.setItem("streak_count", streakCount.toString()); }, [streakCount]);
  useEffect(() => { localStorage.setItem("milestones", JSON.stringify(milestones)); }, [milestones]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [
          { data: debtData },
          { data: budgetData },
          { data: billData },
          { data: paymentData },
          { data: savedData },
        ] = await Promise.all([
          supabase.from("debts").select("*"),
          supabase.from("budget").select("*").eq("id", 1).maybeSingle(),
          supabase.from("bills").select("*").order("due_day"),
          supabase.from("bill_payments").select("*"),
          supabase.from("saved_instead").select("*").order("saved_at", { ascending: false }),
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
        if (billData) {
          setBills(billData);
          if (billData.length > 0) setNextBillId(Math.max(...billData.map((b: Bill) => b.id)) + 1);
        }
        if (paymentData) setPayments(paymentData);
        if (savedData) setSavedInstead(savedData);
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
            const newPayment: BillPayment = { bill_id: bill.id, month, year, paid: false };
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

  const monthBills = useMemo(() => {
    const filtered = bills.filter(bill => {
      if (bill.recurring) return true;
      return bill.bill_month === selectedMonth && bill.bill_year === selectedYear;
    });
    return filtered.map(bill => {
      const payment = payments.find(p => p.bill_id === bill.id && p.month === selectedMonth && p.year === selectedYear);
      const paid = payment?.paid ?? false;
      const late = isLate(bill.due_day, selectedMonth, selectedYear, paid);
      const days = daysUntilDue(bill.due_day, selectedMonth, selectedYear);
      return { ...bill, paid, late, days, paymentId: payment?.id };
    });
  }, [bills, payments, selectedMonth, selectedYear]);

  const urgentBills = monthBills.filter(b => !b.paid && b.days <= 7 && b.days >= 0);
  const crisisBills = monthBills.filter(b => !b.paid && (b.late || (b.days <= 3 && b.days >= 0)));
  const totalMonthlyBills = bills.reduce((s, b) => s + b.amount, 0);
  const paidTotal = monthBills.filter(b => b.paid).reduce((s, b) => s + b.amount, 0);
  const unpaidTotal = monthBills.filter(b => !b.paid).reduce((s, b) => s + b.amount, 0);
  const totalSavedInstead = savedInstead.reduce((s, i) => s + i.amount, 0);

  const pay = parseFloat(anytimePay) || 0;
  const isWeeklyMode = bufferBalance >= 650;
  const weekPay = parseFloat(weeklyPay) || 0;
  const inputAmount = isWeeklyMode ? weekPay : pay;

  const urgentTotal = urgentBills.reduce((s, b) => s + b.amount, 0);
  const crisisTotal = crisisBills.reduce((s, b) => s + b.amount, 0);
  const isCrisis = crisisTotal > 0;
  const billsRate = totalMonthlyBills / (isWeeklyMode ? 4.33 : 30);

   const NEEDS_FLOOR = isWeeklyMode ? 105 : 25;

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

    unifiedSnowball = snowballExtra > 0 ? Math.min(afterFloor * 0.25, isWeeklyMode ? snowballExtra / 4.33 : snowballExtra / 30) : 0;
    const afterSnowball = Math.max(0, afterFloor - unifiedSnowball);
    unifiedBuffer = isWeeklyMode ? 0 : Math.min(22, afterSnowball);
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
      color: "#6BBFD4",
      note: isCrisis ? "paused -- bills come first" : "extra toward target debt",
    },
    ...(isWeeklyMode ? [] : [{
      label: "🏦 General Savings",
      amount: unifiedBuffer,
      color: "#C4933F",
      note: isCrisis ? "paused -- bills come first" : "$22/day until $650",
    }]),
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

  async function saveLog() {
    const amount = isWeeklyMode ? weekPay : pay;
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
    isWeeklyMode ? setWeeklyPay("") : setAnytimePay("");
    setPlanNotes("");
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
    setBudget(prev => ({ ...prev, [field]: val }));
    await supabase.from("budget").update({ [field]: val }).eq("id", 1);
  }

  function checkStreak() {
    const today = todayStr();
    if (lastCheckIn === today) return;
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split("T")[0];
    const newStreak = lastCheckIn === yStr ? streakCount + 1 : 1;
    setStreakCount(newStreak);
    setLastCheckIn(today);
    localStorage.setItem("last_checkin", today);
    checkMilestones(newStreak);
  }

  function breakStreak() {
    setStreakCount(0);
    setLastCheckIn(todayStr());
    localStorage.setItem("streak_count", "0");
    localStorage.setItem("last_checkin", todayStr());
  }

  function checkMilestones(streak?: number) {
    const newMilestones = [...milestones];
    const total = debts.filter(d => !d.deferred && !d.paid_off).reduce((s, d) => s + d.balance, 0);
    const toAdd: string[] = [];
    if (total < 5000 && !newMilestones.includes("under5k")) toAdd.push("under5k");
    if (total < 3000 && !newMilestones.includes("under3k")) toAdd.push("under3k");
    if (total < 1000 && !newMilestones.includes("under1k")) toAdd.push("under1k");
    if (total === 0 && !newMilestones.includes("zero")) toAdd.push("zero");
    if (bufferBalance >= 650 && !newMilestones.includes("buffer")) toAdd.push("buffer");
    if ((streak || streakCount) >= 7 && !newMilestones.includes("streak7")) toAdd.push("streak7");
    if ((streak || streakCount) >= 30 && !newMilestones.includes("streak30")) toAdd.push("streak30");
    if (toAdd.length > 0) {
      const updated = [...newMilestones, ...toAdd];
      setMilestones(updated);
      localStorage.setItem("milestones", JSON.stringify(updated));
    }
  }

  function runWizard() {
    const cost = parseFloat(wizardCost);
    if (!cost || !wizardDebtId) return;
    const debt = debts.find(d => d.id === wizardDebtId);
    if (!debt) return;
    const dailySnowball = snowballExtra / 30;
    const daysDelayed = dailySnowball > 0 ? Math.ceil(cost / dailySnowball) : 0;
    const paymentsEquiv = debt.min_payment > 0 ? parseFloat((cost / debt.min_payment).toFixed(1)) : 0;
    setWizardResult({ days: daysDelayed, payments: paymentsEquiv });
  }

  async function saveToBank() {
    const cost = parseFloat(wizardCost);
    const debt = debts.find(d => d.id === wizardDebtId);
    if (!cost) return;
    const entry: SavedInstead = {
      amount: cost,
      item_name: debt ? `Skipped purchase (vs ${debt.name})` : "Skipped purchase",
    };
    const { data } = await supabase.from("saved_instead").insert(entry).select().single();
    if (data) setSavedInstead(prev => [data, ...prev]);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
    setWizardCost("");
    setWizardDebtId(null);
    setWizardResult(null);
  }

  const MILESTONE_DEFS: Record<string, { emoji: string; label: string; desc: string }> = {
    under5k: { emoji: "🌸", label: "Under $5,000!", desc: "Active debt below $5k" },
    under3k: { emoji: "🍓", label: "Under $3,000!", desc: "Active debt below $3k" },
    under1k: { emoji: "✨", label: "Under $1,000!", desc: "Almost there!" },
    zero:    { emoji: "🎊", label: "DEBT FREE!", desc: "All active debts paid off!" },
    buffer:  { emoji: "🏦", label: "Savings Goal!", desc: "$650 general savings reached" },
    streak7: { emoji: "🔥", label: "7 Day Streak!", desc: "7 days no unplanned spending" },
    streak30:{ emoji: "💎", label: "30 Day Streak!", desc: "30 days no unplanned spending" },
  };

  const payoffMonth = months.length;
  const finalDeferred = months.length > 0
    ? Object.values(months[months.length - 1].deferredBalances).reduce((s, v) => s + v, 0)
    : deferredDebts.reduce((s, d) => s + d.balance, 0);

  const TABS = ["planner","wizard","bills","debts","budget","schedule"];
  const TAB_LABELS: Record<string, string> = {
    planner: "📅 Check-ins", wizard: "🧙 Daddy Wizard", bills: "🏠 Bills",
    debts: "🍓 Debts", budget: "💰 Budget", schedule: "📋 Payoff Schedule",
  };

  const Confetti = () => {
    const colors = ["var(--pink-dark)","var(--green)","var(--pink-light)","var(--ink-soft)","#FEFBE8"];
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

  return (
    <div>
      {showConfetti && <Confetti />}

      {/* ── HEADER ── */}
      <div className="page-header">
        <div>
          <h2>Welcome to Your Piggybank</h2>
        </div>
        {savedMsg && <span className="badge badge-green">Saved!</span>}
      </div>

              {/* ── STAT CARDS ── */}
      <div className="page-body" style={{ display: "flex", flexDirection: "column", gap: 20 }}>


        {/* ── MOTIVATIONAL STRIP ── */}
<div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
  {[
    { icon: "💵", label: "Saved-Not-Spent Streak", val: `${streakCount} days`, color: "var(--pink-dark)" },
    { icon: "🏦", label: "General Savings", val: `${fmt(bufferBalance)} / $650`, color: bufferBalance >= 650 ? "var(--green-dark)" : "var(--ink-soft)" },
    { icon: "⛓️‍💥", label: "Payoff", val: `${payoffMonth} months`, color: "var(--green-dark)" },
  ].map(({ icon, label, val, color }) => (
    <div key={label} className="card" style={{ flexShrink: 0, cursor: "default" }}>
      <div className="card-body" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <div>
          <div className="section-label" style={{ marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: 14, fontWeight: 800, color }}>{val}</div>
        </div>
      </div>
    </div>
  ))}

  {milestones.slice(-2).map(m => (
    <div key={m} className="card" style={{ flexShrink: 0, cursor: "default" }}>
      <div className="card-body" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 20 }}>{MILESTONE_DEFS[m]?.emoji}</span>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--pink-dark)" }}>
          {MILESTONE_DEFS[m]?.label}
        </div>
      </div>
    </div>
  ))}
</div>

        {/* ── TABS ── */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={tab === t ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* ── PLANNER TAB ── */}
        {tab === "planner" && (
          <>
            {isCrisis && (
              <div style={{ background: "#FDE8E8", border: "1.5px solid #C0404A", borderRadius: 16, padding: "12px 16px", fontSize: 13, color: "#C0404A", fontWeight: 700 }}>
                🚨 Equity Mode Active — {crisisBills.length} bill(s) late or due within 3 days ({fmt(crisisTotal)} total). Fun money and general savings are zeroed until these are covered. Groceries & gas are still protected.
              </div>
            )}

            {!isCrisis && urgentBills.length > 0 && (
              <div style={{ background: "#FDE8E8", border: "1.5px solid #C0404A", borderRadius: 16, padding: "12px 16px", fontSize: 13, color: "#C0404A", fontWeight: 600 }}>
                ⚠️ Bills due within 7 days: {urgentBills.map(b => `${b.name} (${fmt(b.amount)}) in ${b.days}d`).join(" · ")}
              </div>
            )}

            <div className="card">
              <div className="card-body">
                <div className="section-label">{isWeeklyMode ? "This Week's Paycheck" : "Today's Paycheck"}</div>
                <input
                  type="number"
                  className="form-input"
                  placeholder={isWeeklyMode ? "e.g. 900" : "e.g. 120"}
                  value={isWeeklyMode ? weeklyPay : anytimePay}
                  onChange={e => isWeeklyMode ? setWeeklyPay(e.target.value) : setAnytimePay(e.target.value)}
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
                        Save {isWeeklyMode ? "Weekly" : "Daily"} Plan
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div className="section-label" style={{ marginBottom: 0 }}>Purchase Reality Check</div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowCalculator(v => !v)}>{showCalculator ? "Hide" : "Show"}</button>
                </div>
                {showCalculator && (
                  <>
                    <input type="number" className="form-input" placeholder="e.g. 45.00" value={purchaseAmount} onChange={e => setPurchaseAmount(e.target.value)} style={{ marginBottom: 12 }} />
                    {parseFloat(purchaseAmount) > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {hoursOfWork(parseFloat(purchaseAmount), budget.hourly_wage) && (
                          <div style={{ background: "var(--blush)", borderRadius: 16, padding: 14 }}>
                            <div style={{ fontSize: 12, color: "var(--ink-muted)", marginBottom: 4 }}>That purchase costs you:</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--pink-dark)" }}>{hoursOfWork(parseFloat(purchaseAmount), budget.hourly_wage)} hours of work</div>
                            <div style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 2 }}>at {fmt(budget.hourly_wage)}/hr</div>
                          </div>
                        )}
                        <div style={{ background: "var(--green-light)", borderRadius: 16, padding: 14 }}>
                          <div style={{ fontSize: 12, color: "var(--green-dark)", marginBottom: 4 }}>If saved toward debt instead:</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--green-dark)" }}>
                            Saves ~{snowballExtra > 0 ? Math.ceil(parseFloat(purchaseAmount) / (snowballExtra / 30)) : "?"} days off your payoff
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div className="section-label" style={{ marginBottom: 0 }}>No-Spend Streak</div>
                  <span style={{ fontSize: 20, fontWeight: 800, color: "var(--pink-dark)" }}>{streakCount} days 🔥</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className={`btn btn-sm ${lastCheckIn === todayStr() ? "btn-ghost" : "btn-primary"}`} style={{ flex: 1, justifyContent: "center" }} onClick={checkStreak} disabled={lastCheckIn === todayStr()}>
                    {lastCheckIn === todayStr() ? "✓ Checked In" : "No Spend Today"}
                  </button>
                  <button className="btn btn-danger btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={breakStreak}>
                    I Bought Something
                  </button>
                </div>
                {streakCount >= 7 && <div style={{ marginTop: 10, textAlign: "center", fontSize: 12, color: "var(--green-dark)", fontWeight: 700 }}>On fire! {streakCount} days strong! 🔥</div>}
              </div>
            </div>

            {milestones.length > 0 && (
              <div className="card">
                <div className="card-body">
                  <div className="section-label">Milestones Earned</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
                    {milestones.map(m => (
                      <div key={m} style={{ background: "var(--blush)", border: "1.5px solid var(--border)", borderRadius: 16, padding: "10px 14px", textAlign: "center" }}>
                        <div style={{ fontSize: 24 }}>{MILESTONE_DEFS[m]?.emoji}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--pink-dark)", marginTop: 4 }}>{MILESTONE_DEFS[m]?.label}</div>
                        <div style={{ fontSize: 10, color: "var(--ink-muted)" }}>{MILESTONE_DEFS[m]?.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── WIZARD TAB ── */}
        {tab === "wizard" && (
          <>
            <div className="card">
              <div className="card-body">
                <div className="section-label">🧙 Can I Buy This?</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "var(--ink-muted)", marginBottom: 6 }}>How much does it cost?</div>
                    <input type="number" className="form-input" placeholder="e.g. 49.99" value={wizardCost} onChange={e => { setWizardCost(e.target.value); setWizardResult(null); }} style={{ fontSize: 20, fontWeight: 700 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "var(--ink-muted)", marginBottom: 6 }}>Which debt are you targeting?</div>
                    <select className="form-select" value={wizardDebtId ?? ""} onChange={e => { setWizardDebtId(Number(e.target.value)); setWizardResult(null); }}>
                      <option value="">-- Select a debt --</option>
                      {activeDebts.filter(d => !d.paid_off).map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({fmt(d.balance)})</option>
                      ))}
                    </select>
                  </div>
                  <button className="btn btn-primary" style={{ justifyContent: "center" }} onClick={runWizard}>Ask the Wizard ✨</button>
                </div>

                {wizardResult && parseFloat(wizardCost) > 0 && (
                  <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ background: "var(--blush)", borderRadius: 16, padding: 14 }}>
                      <div style={{ fontSize: 11, color: "var(--ink-muted)", marginBottom: 4 }}>Payoff delay</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: "var(--pink-dark)" }}>+{wizardResult.days} days</div>
                    </div>
                    {wizardResult.payments > 0 && (
                      <div style={{ background: "#FEFBE8", borderRadius: 16, padding: 14 }}>
                        <div style={{ fontSize: 11, color: "var(--ink-muted)", marginBottom: 4 }}>Equivalent minimum payments</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "#8B6000" }}>{wizardResult.payments}x payments</div>
                        <div style={{ fontSize: 11, color: "var(--ink-muted)" }}>on {debts.find(d => d.id === wizardDebtId)?.name}</div>
                      </div>
                    )}
                    {hoursOfWork(parseFloat(wizardCost), budget.hourly_wage) && (
                      <div style={{ background: "var(--green-light)", borderRadius: 16, padding: 14 }}>
                        <div style={{ fontSize: 11, color: "var(--ink-muted)", marginBottom: 4 }}>Work hours cost</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--green-dark)" }}>{hoursOfWork(parseFloat(wizardCost), budget.hourly_wage)} hrs</div>
                      </div>
                    )}
                    <button className="btn btn-green" style={{ justifyContent: "center" }} onClick={saveToBank}>
                      I Skipped It — Save {fmt(parseFloat(wizardCost))} to My Bank
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div className="section-label" style={{ marginBottom: 0 }}>💸 Saved Instead Bank</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--green-dark)" }}>{fmt(totalSavedInstead)}</div>
                </div>
                <div style={{ background: "var(--green-light)", borderRadius: 12, padding: "10px 14px", fontSize: 12, color: "var(--green-dark)", marginBottom: 10 }}>
                  Every dollar here is a dollar you chose NOT to spend. That's real discipline.
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowSavedHistory(v => !v)}>
                  {showSavedHistory ? "Hide History" : "Show History"}
                </button>
                {showSavedHistory && (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 10 }}>
                    <thead>
                      <tr>
                        {["Date","Amount","Item"].map(h => (
                          <th key={h} style={{ fontSize: 10, color: "var(--ink-muted)", textTransform: "uppercase", padding: "8px", textAlign: "left", borderBottom: "1.5px solid var(--border)", fontWeight: 700 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {savedInstead.map((entry, i) => (
                        <tr key={entry.id} style={{ background: i % 2 === 0 ? "transparent" : "var(--blush)" }}>
                          <td style={{ padding: "8px", color: "var(--ink-muted)" }}>{entry.saved_at?.split("T")[0]}</td>
                          <td style={{ padding: "8px", color: "var(--green-dark)", fontWeight: 800 }}>{fmt(entry.amount)}</td>
                          <td style={{ padding: "8px", color: "var(--ink)" }}>{entry.item_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── BILLS TAB ── */}
        {tab === "bills" && (
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
                  <div style={{ background: "var(--blush)", borderRadius: 16, padding: 14, marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
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
                      <tr key={b.id} style={{ background: b.late ? "#FDE8E8" : b.paid ? "var(--green-light)" : i % 2 === 0 ? "transparent" : "var(--blush)" }}>
                        <td style={{ padding: "9px 8px" }}>
                          <input type="checkbox" checked={b.paid} onChange={() => togglePaid(b)} style={{ width: 16, height: 16, cursor: "pointer", accentColor: "var(--green-dark)" }} />
                        </td>
                        <td style={{ padding: "9px 8px", textDecoration: b.paid ? "line-through" : "none", color: b.paid ? "var(--ink-muted)" : "var(--ink)", fontWeight: 600 }}>{b.name}</td>
                        <td style={{ padding: "9px 8px", color: b.paid ? "var(--ink-muted)" : "var(--pink-dark)", fontWeight: 700, textDecoration: b.paid ? "line-through" : "none" }}>{fmt(b.amount)}</td>
                        <td style={{ padding: "9px 8px", color: "var(--ink-muted)" }}>{MONTH_NAMES[selectedMonth - 1].slice(0, 3)} {b.due_day}</td>
                        <td style={{ padding: "9px 8px" }}>
                          {b.paid
                            ? <span className="badge badge-green">PAID</span>
                            : b.late ? <span className="badge" style={{ background: "#FDE8E8", color: "#C0404A" }}>LATE</span>
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

        {/* ── DEBTS TAB ── */}
        {tab === "debts" && (
          <>
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
                          <tr key={d.id} style={{ background: i % 2 === 0 ? "transparent" : "var(--blush)" }}>
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
                        <tr key={d.id} style={{ background: "var(--green-light)" }}>
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
                          <tr key={d.id} style={{ background: i % 2 === 0 ? "transparent" : "var(--blush)" }}>
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
          </>
        )}

        {/* ── BUDGET TAB ── */}
        {tab === "budget" && (
          <>
            <div className="card">
              <div className="card-body">
                <div className="section-label">Monthly Budget</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {[
                    { label: "Monthly Take-Home (est.)", val: budget.take_home, field: "take_home" as keyof Budget, note: "after taxes + benefits + 401K" },
                    { label: "Fixed Expenses", val: budget.fixed_expenses, field: "fixed_expenses" as keyof Budget, note: "rent + transport + bills + groceries" },
                    { label: "Hourly Wage", val: budget.hourly_wage, field: "hourly_wage" as keyof Budget, note: "used for work-hours calculations" },
                  ].map(({ label, val, field, note }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                      <div>
                        <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 600 }}>{label}</div>
                        <div style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 2 }}>{note}</div>
                      </div>
                      <input type="number" className="form-input" value={val} onChange={e => updateBudget(field, parseFloat(e.target.value) || 0)} style={{ width: 100, textAlign: "right" }} />
                    </div>
                  ))}
                  {[
                    { label: "Debt Minimums (auto)", val: fmt(totalMins) },
                    { label: "Total Outflow", val: fmt(budget.fixed_expenses + totalMins) },
                  ].map(({ label, val }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", background: "var(--blush)", margin: "0 -18px", padding: "12px 18px" }}>
                      <span style={{ fontSize: 13, color: "var(--ink)" }}>{label}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{val}</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", marginTop: 4 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--green-dark)" }}>True Snowball Extra</div>
                      <div style={{ fontSize: 11, color: "var(--ink-muted)" }}>thrown at target debt each month</div>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: snowballExtra >= 0 ? "var(--green-dark)" : "#C0404A" }}>{fmt(snowballExtra)}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <div className="section-label">🏦 General Savings</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, marginTop: 8 }}>
                  <span style={{ fontSize: 13, color: "var(--ink)" }}>Current Balance</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: "var(--ink-soft)" }}>{fmt(bufferBalance)} / $650.00</span>
                </div>
                <div style={{ height: 14, background: "var(--border)", borderRadius: 99, overflow: "hidden", marginBottom: 10 }}>
                  <div style={{ height: "100%", width: `${Math.min((bufferBalance / 650) * 100, 100)}%`, background: bufferBalance >= 650 ? "var(--green-dark)" : "var(--pink-dark)", borderRadius: 99, transition: "width 0.3s" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                  <span style={{ fontSize: 11, color: "var(--ink-muted)" }}>{Math.round((bufferBalance / 650) * 100)}% complete</span>
                  <span style={{ fontSize: 11, color: bufferBalance >= 650 ? "var(--green-dark)" : "var(--ink-muted)", fontWeight: 600 }}>
                    {bufferBalance >= 650 ? "GOAL REACHED! 🎉" : `$${(650 - bufferBalance).toFixed(2)} to go`}
                  </span>
                </div>
                <input type="number" className="form-input" placeholder="Update balance..." onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) { setBufferBalance(v); e.target.value = ""; }}} />
                <div style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 6 }}>Enter your current savings balance to update</div>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <div className="section-label">Savings & Deductions</div>
                {[
                  { label: "401K Contributions", val: "~$200/mo", color: "var(--green-dark)", note: "auto-deducted before you see it" },
                  { label: "General Savings Goal", val: "$650", color: "var(--ink-soft)", note: "5-week build — $110/wk — $22/day" },
                  { label: "Daily Savings Set-Aside", val: "$22/day", color: "var(--ink-soft)", note: "pull $22 less per day to fund general savings" },
                ].map(({ label, val, color, note }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                    <div>
                      <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 600 }}>{label}</div>
                      <div style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 2 }}>{note}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

                {/* ── SCHEDULE TAB ── */}
        {tab === "schedule" && (
          <>
            {snowballExtra < 0 && (
              <div style={{ background: "#FDE8E8", border: "1.5px solid #C0404A", borderRadius: 16, padding: "12px 16px", fontSize: 13, color: "#C0404A", fontWeight: 600 }}>
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
                        <tr key={mi} style={{ background: mi % 2 === 0 ? "transparent" : "var(--blush)" }}>
                          <td style={{ padding: "8px", color: "var(--ink-muted)", fontWeight: 700 }}>{snap.month}</td>
                          {activeDebts.filter(d => !d.paid_off).map(d => {
                            const bal = snap.balances[d.id] ?? 0;
                            const paid = bal < 0.01;
                            const isTgt = snap.target === d.name;
                            const origBal = d.original_balance || d.balance;
                            const paidPct = origBal > 0 ? Math.min(100, ((origBal - bal) / origBal) * 100) : 0;
                            return (
                              <td key={d.id} style={{ padding: "8px", background: paid ? "var(--green-light)" : isTgt ? "var(--blush)" : "transparent", color: paid ? "var(--green-dark)" : isTgt ? "var(--pink-dark)" : "var(--ink-muted)", fontWeight: isTgt ? 700 : 400, textAlign: "right" }}>
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
                          <tr key={mi} style={{ background: mi % 2 === 0 ? "transparent" : "var(--blush)" }}>
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
