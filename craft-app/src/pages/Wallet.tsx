import { useState, useMemo, useEffect } from "react";

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

function EditableCell({ value, onChange, type = "number" }: { value: string | number; onChange: (v: string) => void; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1px dashed #FFB6C1", color: "#6B4C57", fontSize: 13, padding: "2px 4px", outline: "none", fontFamily: "inherit" }}
    />
  );
}

export default function Wallet() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [budget, setBudget] = useState<Budget>({ take_home: 3800, fixed_expenses: 2630 });
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<BillPayment[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [savedInstead, setSavedInstead] = useState<SavedInstead[]>([]);
  const [nextId, setNextId] = useState(20);
  const [nextBillId, setNextBillId] = useState(10);
  const [tab, setTab] = useState("planner");
  const [showDeferred, setShowDeferred] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savedMsg, setSavedMsg] = useState(false);
  const [anytimePay, setAnytimePay] = useState("");
  const [weeklyPay, setWeeklyPay] = useState("");
  const [planNotes, setPlanNotes] = useState("");
  const [showBillForm, setShowBillForm] = useState(false);
  const [newBill, setNewBill] = useState({ name: "", amount: "", due_day: "", recurring: true });
  const [showHistory, setShowHistory] = useState(false);
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

  // Daddy Wizard state
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
      const { data: debtData } = await supabase.from("debts").select("*");
      const { data: budgetData } = await supabase.from("budget").select("*").eq("id", 1).single();
      const { data: billData } = await supabase.from("bills").select("*").order("due_day");
      const { data: paymentData } = await supabase.from("bill_payments").select("*");
      const { data: logData } = await supabase.from("daily_log").select("*").order("date", { ascending: false }).limit(30);
      const { data: savedData } = await supabase.from("saved_instead").select("*").order("saved_at", { ascending: false });

      if (debtData && debtData.length > 0) {
        // Ensure original_balance is set for any debt that doesn't have it
        const fixed = debtData.map((d: Debt) => ({
          ...d,
          original_balance: d.original_balance || d.balance,
        }));
        setDebts(fixed);
        setNextId(Math.max(...fixed.map((d: Debt) => d.id)) + 1);
        // Process monthly minimums after loading
        await processMonthlyMinimums(fixed);
      } else {
        await supabase.from("debts").insert(DEFAULT_DEBTS);
        setDebts(DEFAULT_DEBTS);
      }
      if (budgetData) setBudget(budgetData);
      if (billData) {
        setBills(billData);
        if (billData.length > 0) setNextBillId(Math.max(...billData.map((b: Bill) => b.id)) + 1);
      }
      if (paymentData) setPayments(paymentData);
      if (logData) setDailyLogs(logData);
      if (savedData) setSavedInstead(savedData);
      setLoading(false);
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
  const totalMonthlyBills = bills.reduce((s, b) => s + b.amount, 0);
  const paidTotal = monthBills.filter(b => b.paid).reduce((s, b) => s + b.amount, 0);
  const unpaidTotal = monthBills.filter(b => !b.paid).reduce((s, b) => s + b.amount, 0);
  const totalSavedInstead = savedInstead.reduce((s, i) => s + i.amount, 0);

  const pay = parseFloat(anytimePay) || 0;
  const isWeeklyMode = bufferBalance >= 650;
  const weekPay = parseFloat(weeklyPay) || 0;
  const inputAmount = isWeeklyMode ? weekPay : pay;

  const urgentTotal = urgentBills.reduce((s, b) => s + b.amount, 0);
  const billsRate = totalMonthlyBills / (isWeeklyMode ? 4.33 : 30);
  const unifiedBills = urgentTotal > 0 ? Math.min(inputAmount * 0.45, urgentTotal) : Math.min(inputAmount * 0.40, billsRate * 1.2);
  const afterBills = Math.max(0, inputAmount - unifiedBills);
  const unifiedSnowball = snowballExtra > 0 ? Math.min(afterBills * 0.25, isWeeklyMode ? snowballExtra / 4.33 : snowballExtra / 30) : 0;
  const afterSnowball = Math.max(0, afterBills - unifiedSnowball);
  const unifiedBuffer = isWeeklyMode ? 0 : Math.min(22, afterSnowball);
  const afterBuffer = Math.max(0, afterSnowball - unifiedBuffer);
  const unifiedNeeds = afterBuffer * 0.65;
  const unifiedFun = afterBuffer * 0.35;

  const allocations = [
    { label: "🏠 Bills & Minimums", amount: unifiedBills, color: "#E85D75", note: urgentBills.length > 0 ? `⚠ ${urgentBills.length} bill(s) due soon!` : "bills + debt minimums" },
    { label: "❄️ Snowball Extra", amount: unifiedSnowball, color: "#8ECDF2", note: "extra toward target debt" },
    ...(isWeeklyMode ? [] : [{ label: "🏦 Buffer", amount: unifiedBuffer, color: "#FFB68A", note: "Robinhood -- $22/day until $650" }]),
    { label: "🛒 Needs", amount: unifiedNeeds, color: "#7ED9A8", note: "groceries, gas, essentials" },
    { label: "🎉 Fun Money", amount: unifiedFun, color: "#FF6FA0", note: "whimsy -- wants, not needs!" },
  ];

  async function processMonthlyMinimums(debtList: Debt[]) {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const updates: Promise<void>[] = [];
    const updatedDebts = debtList.map(debt => {
      if (debt.paid_off || debt.last_processed_month === currentMonth) return debt;
      const interest = debt.balance * (debt.apr / 100 / 12);
      const newBalance = Math.max(0, debt.balance + interest - debt.min_payment);
      updates.push(
        supabase.from("debts").update({ balance: newBalance, last_processed_month: currentMonth }).eq("id", debt.id).then(() => {})
      );
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
    const { data } = await supabase.from("daily_log").insert(log).select().single();
    if (data) setDailyLogs(prev => [data, ...prev]);
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

  // Daddy Wizard calculations
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
    buffer:  { emoji: "🏦", label: "Buffer Goal!", desc: "$650 Robinhood buffer reached" },
    streak7: { emoji: "🔥", label: "7 Day Streak!", desc: "7 days no unplanned spending" },
    streak30:{ emoji: "💎", label: "30 Day Streak!", desc: "30 days no unplanned spending" },
  };

  const totalDebt = debts.reduce((s, d) => s + (Number(d.balance) || 0), 0);
  const activeTotal = activeDebts.filter(d => !d.paid_off).reduce((s, d) => s + (Number(d.balance) || 0), 0);
  const payoffMonth = months.length;
  const finalDeferred = months.length > 0 ? Object.values(months[months.length - 1].deferredBalances).reduce((s, v) => s + v, 0) : deferredDebts.reduce((s, d) => s + d.balance, 0);

  const s = {
    app: { minHeight: "100vh", background: "#FFF8F3", fontFamily: "'Comic Sans MS', 'Segoe UI', sans-serif", color: "#6B4C57", paddingBottom: 60 } as React.CSSProperties,
    header: { background: "linear-gradient(135deg, #FFB6C1 0%, #FFC4D6 50%, #FFD4E5 100%)", borderBottom: "3px solid #FF8FAB", padding: "20px 20px 16px", borderRadius: "0 0 24px 24px" } as React.CSSProperties,
    statsRow: { display: "flex", gap: 10, padding: "14px 20px", flexWrap: "wrap" as const, background: "#FFF8F3" },
    stat: { flex: "1 1 120px", background: "#FFFFFF", border: "2px solid #FFD4E5", borderRadius: 16, padding: "10px 14px", boxShadow: "0 2px 8px rgba(255,182,193,0.25)" } as React.CSSProperties,
    tabs: { display: "flex", background: "#FFF8F3", borderBottom: "2px solid #FFD4E5", paddingLeft: 8, overflowX: "auto" as const, gap: 2 } as React.CSSProperties,
    content: { padding: "20px" } as React.CSSProperties,
    card: { background: "#FFFFFF", border: "2px solid #FFE0EB", borderRadius: 18, overflow: "hidden", marginBottom: 20, boxShadow: "0 3px 12px rgba(255,182,193,0.2)" } as React.CSSProperties,
    cardHead: { background: "linear-gradient(135deg, #FFE5EC, #FFF0F5)", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #FFE0EB" } as React.CSSProperties,
    table: { width: "100%", borderCollapse: "collapse" } as React.CSSProperties,
    th: { fontSize: 10, color: "#D4839B", textTransform: "uppercase" as const, padding: "8px 10px", textAlign: "left" as const, borderBottom: "2px solid #FFE0EB", background: "#FFF5F8", fontWeight: 700 },
    td: { padding: "9px 10px", fontSize: 12, borderBottom: "1px solid #FFEEF3", verticalAlign: "middle" as const, color: "#6B4C57" },
  };

  const btn = (color = "#FF8FAB") => ({ background: color, border: "none", borderRadius: 12, color: "#fff", fontSize: 12, fontWeight: 700, padding: "7px 14px", cursor: "pointer", boxShadow: `0 2px 6px ${color}66` } as React.CSSProperties);
  const btnSm = (color = "#D4A5C9") => ({ background: color, border: "none", borderRadius: 10, color: "#fff", fontSize: 11, padding: "4px 10px", cursor: "pointer", fontWeight: 600 } as React.CSSProperties);
  const tag = (color: string) => ({ display: "inline-block", background: color, borderRadius: 10, fontSize: 10, fontWeight: 700, padding: "3px 9px", color: "#fff" } as React.CSSProperties);
  const tabBtn = (active: boolean) => ({ padding: "12px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer", background: active ? "#FFFFFF" : "transparent", border: "none", borderRadius: active ? "14px 14px 0 0" : 0, color: active ? "#FF6B95" : "#D4A5C9", borderBottom: active ? "3px solid #FF8FAB" : "3px solid transparent", whiteSpace: "nowrap" as const, transition: "all 0.2s" } as React.CSSProperties);
  const inputStyle = { background: "#FFF8FB", border: "2px solid #FFD4E5", borderRadius: 10, color: "#6B4C57", fontSize: 13, padding: "6px 10px", width: 90, outline: "none", fontWeight: 600 } as React.CSSProperties;
  const inputFull = { ...inputStyle, width: "100%", boxSizing: "border-box" as const };

  const Confetti = () => {
    const colors = ["#C9A4F0","#7ED9A8","#FFB68A","#8ECDF2","#E85D75","#FFE0A3"];
    return (
      <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 9999, overflow: "hidden" }}>
        {Array.from({ length: 60 }).map((_, i) => (
          <div key={i} style={{ position: "absolute", left: `${Math.random() * 100}%`, top: "-10px", width: `${Math.random() * 8 + 4}px`, height: `${Math.random() * 8 + 4}px`, background: colors[Math.floor(Math.random() * colors.length)], borderRadius: Math.random() > 0.5 ? "50%" : "0", animation: `fall ${Math.random() * 2 + 2}s linear ${Math.random() * 2}s forwards` }} />
        ))}
        <style>{`@keyframes fall { to { transform: translateY(100vh) rotate(720deg); opacity: 0; } }`}</style>
        <div style={{ position: "absolute", top: "35%", left: "50%", transform: "translateX(-50%)", textAlign: "center", background: "#FFFFFF", border: "3px solid #FFB6C1", borderRadius: 20, padding: "24px 32px", minWidth: 220 }}>
          <div style={{ fontSize: 48 }}>🎉</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#7ED9A8", marginTop: 8 }}>DEBT PAID OFF!</div>
          <div style={{ fontSize: 16, color: "#C9A4F0", marginTop: 4 }}>{paidOffDebt}</div>
          <div style={{ fontSize: 13, color: "#C4A8B5", marginTop: 8 }}>Keep going -- you are crushing it!</div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div style={{ ...s.app, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🍓</div>
        <div style={{ color: "#D4A5C9", fontSize: 14, fontWeight: 700 }}>Loading your sweet tracker...</div>
      </div>
    </div>
  );

  return (
    <div style={s.app}>
      {showConfetti && <Confetti />}

      <div style={s.header}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#8B5A6B" }}>🍓 Strawberry Snowball Tracker</div>
            <div style={{ fontSize: 10, color: "#A6708A", marginTop: 2 }}>Syncs across all devices</div>
          </div>
          {savedMsg && <span style={{ fontSize: 11, color: "#7ED9A8" }}>Saved!</span>}
        </div>
      </div>

      <div style={s.statsRow}>
        {[
          { label: "Total Debt", val: fmt(totalDebt), color: "#6B4C57" },
          { label: "Active Debt", val: fmt(activeTotal), color: "#6B4C57" },
          { label: "Snowball Extra", val: fmt(snowballExtra), color: snowballExtra >= 0 ? "#7ED9A8" : "#E85D75" },
          { label: "Payoff", val: `${payoffMonth}mo`, color: "#7ED9A8" },
          { label: "Deferred @ Done", val: fmt(finalDeferred), color: "#FFB68A" },
        ].map(({ label, val, color }) => (
          <div key={label} style={s.stat}>
            <div style={{ fontSize: 9, color: "#D4A5C9", textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color, marginTop: 4 }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Motivational strip */}
      <div style={{ background: "#FFF0F5", borderBottom: "2px solid #FFD4E5", padding: "10px 20px", display: "flex", gap: 12, overflowX: "auto" as const, alignItems: "center" }}>
        {[
          { icon: "🔥", label: "No-Spend Streak", val: `${streakCount} ${streakCount === 1 ? "day" : "days"}`, color: "#E85D75" },
          { icon: "🏦", label: "Buffer", val: `${fmt(bufferBalance)} / $650`, color: bufferBalance >= 650 ? "#7ED9A8" : "#FFB68A" },
          { icon: "💸", label: "Saved Instead", val: fmt(totalSavedInstead), color: "#C9A4F0" },
          { icon: "🎯", label: "Payoff", val: `${payoffMonth} months`, color: "#C9A4F0" },
        ].map(({ icon, label, val, color }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, minWidth: "fit-content", background: "#FFFFFF", border: "2px solid #FFD4E5", borderRadius: 12, padding: "6px 12px" }}>
            <span style={{ fontSize: 16 }}>{icon}</span>
            <div>
              <div style={{ fontSize: 9, color: "#C4A8B5", textTransform: "uppercase" as const, fontWeight: 700 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color }}>{val}</div>
            </div>
          </div>
        ))}
        {milestones.slice(-2).map(m => (
          <div key={m} style={{ display: "flex", alignItems: "center", gap: 6, minWidth: "fit-content", background: "#FFF5F8", border: "2px solid #FFB6C1", borderRadius: 12, padding: "6px 12px" }}>
            <span style={{ fontSize: 16 }}>{MILESTONE_DEFS[m]?.emoji}</span>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#E85D75" }}>{MILESTONE_DEFS[m]?.label}</div>
          </div>
        ))}
      </div>

      <div style={s.tabs}>
        {["planner", "wizard", "bills", "debts", "budget", "schedule"].map(t => (
          <button key={t} style={tabBtn(tab === t)} onClick={() => setTab(t)}>
            {t === "planner" ? "📅 Planner" : t === "wizard" ? "🧙 Wizard" : t === "bills" ? "🏠 Bills" : t === "debts" ? "🍓 Debts" : t === "budget" ? "💰 Budget" : "📋 Schedule"}
          </button>
        ))}
      </div>

      <div style={s.content}>

        {/* ── PLANNER TAB ── */}
        {tab === "planner" && (
          <>
            {urgentBills.length > 0 && (
              <div style={{ background: "#FFE0E5", border: "2px solid #E85D75", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 12, color: "#8B5A6B" }}>
                Bills due within 7 days: {urgentBills.map(b => `${b.name} ($${b.amount}) in ${b.days} days`).join(" . ")}
              </div>
            )}
            <div style={{ background: isWeeklyMode ? "#E8F8EE" : "#FFF5F8", border: `2px solid ${isWeeklyMode ? "#7ED9A8" : "#FFB6C1"}`, borderRadius: 12, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: isWeeklyMode ? "#3D8B62" : "#A6708A", fontWeight: 600 }}>
              {isWeeklyMode ? "Buffer goal reached! Now in weekly paycheck mode." : "Daily Anytime Pay mode -- building your $650 buffer."}
            </div>

            <div style={s.card}>
              <div style={s.cardHead}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#D4839B", textTransform: "uppercase" as const }}>
                  {isWeeklyMode ? "This Week's Paycheck" : "Today's Anytime Pay"}
                </span>
                <span style={{ fontSize: 10, color: "#C4A8B5" }}>{new Date().toLocaleDateString()}</span>
              </div>
              <div style={{ padding: "16px" }}>
                <div style={{ fontSize: 12, color: "#6B4C57", marginBottom: 8 }}>
                  {isWeeklyMode ? "Enter your weekly take-home pay:" : "How much are you withdrawing today?"}
                </div>
                <input
                  type="number"
                  placeholder={isWeeklyMode ? "e.g. 900" : "e.g. 120"}
                  value={isWeeklyMode ? weeklyPay : anytimePay}
                  onChange={e => isWeeklyMode ? setWeeklyPay(e.target.value) : setAnytimePay(e.target.value)}
                  style={{ ...inputFull, fontSize: 20, padding: "10px 14px", fontWeight: 700 }}
                />
                {inputAmount > 0 && (
                  <div style={{ fontSize: 11, color: "#C4A8B5", marginTop: 6 }}>
                    = {(inputAmount / 20.50).toFixed(1)} hours of your life
                  </div>
                )}
              </div>
              {inputAmount > 0 && (
                <div style={{ padding: "0 16px 16px" }}>
                  <div style={{ display: "flex", height: 16, borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
                    {allocations.map(a => (
                      <div key={a.label} style={{ width: pct(a.amount, inputAmount), background: a.color, transition: "width 0.3s" }} />
                    ))}
                  </div>
                  {allocations.map(a => (
                    <div key={a.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #FFEEF3" }}>
                      <div>
                        <div style={{ fontSize: 13, color: "#6B4C57", fontWeight: 600 }}>{a.label}</div>
                        <div style={{ fontSize: 10, color: "#C4A8B5", marginTop: 2 }}>{a.note}</div>
                      </div>
                      <div style={{ textAlign: "right" as const }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: a.color }}>{fmt(a.amount)}</div>
                        <div style={{ fontSize: 10, color: "#C4A8B5" }}>{pct(a.amount, inputAmount)}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: 12 }}>
                    <input type="text" placeholder="Notes (optional)..." value={planNotes} onChange={e => setPlanNotes(e.target.value)} style={{ ...inputFull, marginBottom: 10 }} />
                    <button style={{ ...btn("#FF8FAB"), width: "100%", padding: "10px", fontSize: 14 }} onClick={saveLog}>
                      Save {isWeeklyMode ? "Weekly" : "Daily"} Plan
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={s.card}>
              <div style={s.cardHead}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#D4839B", textTransform: "uppercase" as const }}>Purchase Reality Check</span>
                <button style={btnSm()} onClick={() => setShowCalculator(v => !v)}>{showCalculator ? "Hide" : "Show"}</button>
              </div>
              {showCalculator && (
                <div style={{ padding: 16 }}>
                  <div style={{ fontSize: 12, color: "#6B4C57", marginBottom: 8 }}>How much does it cost?</div>
                  <input type="number" placeholder="e.g. 45.00" value={purchaseAmount} onChange={e => setPurchaseAmount(e.target.value)} style={{ ...inputFull, marginBottom: 12 }} />
                  {parseFloat(purchaseAmount) > 0 && (
                    <>
                      <div style={{ background: "#FFF5F8", borderRadius: 12, padding: 14, marginBottom: 10 }}>
                        <div style={{ fontSize: 13, color: "#A6708A", marginBottom: 6 }}>That purchase costs you:</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "#E85D75" }}>{(parseFloat(purchaseAmount) / 20.50).toFixed(1)} hours of work</div>
                        <div style={{ fontSize: 11, color: "#C4A8B5", marginTop: 4 }}>at $20.50/hr</div>
                      </div>
                      <div style={{ background: "#E8F8EE", borderRadius: 12, padding: 14 }}>
                        <div style={{ fontSize: 13, color: "#3D8B62", marginBottom: 4 }}>If saved toward debt instead:</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#3D8B62" }}>
                          Saves ~{snowballExtra > 0 ? Math.ceil(parseFloat(purchaseAmount) / (snowballExtra / 30)) : "?"} days off your payoff
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div style={s.card}>
              <div style={s.cardHead}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#D4839B", textTransform: "uppercase" as const }}>No-Spend Streak</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: "#E85D75" }}>{streakCount} days</span>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 12, color: "#6B4C57", marginBottom: 12 }}>Did you avoid unplanned spending today?</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ ...btn(lastCheckIn === todayStr() ? "#D4A5C9" : "#FF8FAB"), flex: 1, padding: "12px", fontSize: 14 }} onClick={checkStreak} disabled={lastCheckIn === todayStr()}>
                    {lastCheckIn === todayStr() ? "Checked In" : "No Spend Today"}
                  </button>
                  <button style={{ ...btn("#E85D75"), flex: 1, padding: "12px", fontSize: 14 }} onClick={breakStreak}>
                    I Bought Something
                  </button>
                </div>
                {streakCount >= 7 && <div style={{ marginTop: 10, textAlign: "center" as const, fontSize: 12, color: "#7ED9A8", fontWeight: 700 }}>On fire! {streakCount} days strong!</div>}
              </div>
            </div>

            {milestones.length > 0 && (
              <div style={s.card}>
                <div style={s.cardHead}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#D4839B", textTransform: "uppercase" as const }}>Milestones Earned</span>
                </div>
                <div style={{ padding: "8px 16px", display: "flex", flexWrap: "wrap" as const, gap: 10 }}>
                  {milestones.map(m => (
                    <div key={m} style={{ background: "#FFF5F8", border: "2px solid #FFD4E5", borderRadius: 12, padding: "8px 14px", textAlign: "center" as const }}>
                      <div style={{ fontSize: 24 }}>{MILESTONE_DEFS[m]?.emoji}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#E85D75", marginTop: 4 }}>{MILESTONE_DEFS[m]?.label}</div>
                      <div style={{ fontSize: 10, color: "#C4A8B5" }}>{MILESTONE_DEFS[m]?.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={s.card}>
              <div style={s.cardHead}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#D4839B", textTransform: "uppercase" as const }}>Recent History</span>
                <button style={btnSm()} onClick={() => setShowHistory(v => !v)}>{showHistory ? "Hide" : "Show"}</button>
              </div>
              {showHistory && (
                <div style={{ overflowX: "auto" }}>
                  <table style={s.table}>
                    <thead><tr>{["Date","Amount","Bills","Buffer","Spending","Snowball","Notes"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {dailyLogs.map((log, i) => (
                        <tr key={log.id} style={{ background: i % 2 === 0 ? "#FFFFFF" : "#FFF8FB" }}>
                          <td style={{ ...s.td, color: "#D4A5C9", fontWeight: 700 }}>{log.date}</td>
                          <td style={{ ...s.td, color: "#6B4C57", fontWeight: 700 }}>{fmt(log.anytime_pay_amount)}</td>
                          <td style={{ ...s.td, color: "#E85D75" }}>{fmt(log.bills_allocation)}</td>
                          <td style={{ ...s.td, color: "#FFB68A" }}>{fmt(log.buffer_allocation)}</td>
                          <td style={{ ...s.td, color: "#7ED9A8" }}>{fmt(log.spending_allocation)}</td>
                          <td style={{ ...s.td, color: "#8ECDF2" }}>{fmt(log.snowball_allocation)}</td>
                          <td style={{ ...s.td, color: "#C4A8B5", fontSize: 11 }}>{log.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── DADDY WIZARD TAB ── */}
        {tab === "wizard" && (
          <>
            <div style={s.card}>
              <div style={s.cardHead}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#D4839B", textTransform: "uppercase" as const }}>🧙 Can I Buy This?</span>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 12, color: "#6B4C57", marginBottom: 8 }}>How much does it cost?</div>
                <input
                  type="number"
                  placeholder="e.g. 49.99"
                  value={wizardCost}
                  onChange={e => { setWizardCost(e.target.value); setWizardResult(null); }}
                  style={{ ...inputFull, fontSize: 20, fontWeight: 700, marginBottom: 14 }}
                />
                <div style={{ fontSize: 12, color: "#6B4C57", marginBottom: 8 }}>Which debt are you paying off?</div>
                <select
                  value={wizardDebtId ?? ""}
                  onChange={e => { setWizardDebtId(Number(e.target.value)); setWizardResult(null); }}
                  style={{ ...inputFull, marginBottom: 14 }}
                >
                  <option value="">-- Select a debt --</option>
                  {activeDebts.filter(d => !d.paid_off).map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({fmt(d.balance)})</option>
                  ))}
                </select>
                <button style={{ ...btn("#C9A4F0"), width: "100%", padding: "12px", fontSize: 14 }} onClick={runWizard}>
                  Ask the Wizard
                </button>

                {wizardResult && parseFloat(wizardCost) > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ background: "#FFF5F8", borderRadius: 14, padding: 16, marginBottom: 10 }}>
                      <div style={{ fontSize: 13, color: "#A6708A", marginBottom: 8, fontWeight: 700 }}>The Wizard Says...</div>
                      <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
                        <div style={{ background: "#FFE0E5", borderRadius: 10, padding: "10px 14px" }}>
                          <div style={{ fontSize: 11, color: "#A6708A", marginBottom: 2 }}>Payoff delay</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: "#E85D75" }}>+{wizardResult.days} days</div>
                          <div style={{ fontSize: 11, color: "#C4A8B5" }}>This purchase would delay your payoff by {wizardResult.days} days</div>
                        </div>
                        {wizardResult.payments > 0 && (
                          <div style={{ background: "#FFF0D4", borderRadius: 10, padding: "10px 14px" }}>
                            <div style={{ fontSize: 11, color: "#A6708A", marginBottom: 2 }}>Minimum payments equivalent</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: "#FFB68A" }}>{wizardResult.payments}x payments</div>
                            <div style={{ fontSize: 11, color: "#C4A8B5" }}>
                              This equals {wizardResult.payments} minimum payments on {debts.find(d => d.id === wizardDebtId)?.name}
                            </div>
                          </div>
                        )}
                        <div style={{ background: "#E8F8EE", borderRadius: 10, padding: "10px 14px" }}>
                          <div style={{ fontSize: 11, color: "#3D8B62", marginBottom: 2 }}>Work hours cost</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: "#7ED9A8" }}>{(parseFloat(wizardCost) / 20.50).toFixed(1)} hrs</div>
                          <div style={{ fontSize: 11, color: "#C4A8B5" }}>at $20.50/hr</div>
                        </div>
                      </div>
                    </div>
                    <button style={{ ...btn("#7ED9A8"), width: "100%", padding: "12px", fontSize: 14 }} onClick={saveToBank}>
                      I Skipped It -- Save {fmt(parseFloat(wizardCost))} to My Bank
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div style={s.card}>
              <div style={s.cardHead}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#D4839B", textTransform: "uppercase" as const }}>Saved Instead Bank</span>
                <div style={{ textAlign: "right" as const }}>
                  <div style={{ fontSize: 9, color: "#C4A8B5", textTransform: "uppercase" as const }}>Total Saved</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#7ED9A8" }}>{fmt(totalSavedInstead)}</div>
                </div>
              </div>
              <div style={{ padding: "10px 16px 4px", background: "#E8F8EE" }}>
                <div style={{ fontSize: 12, color: "#3D8B62" }}>
                  Every dollar in this bank is a dollar you chose NOT to spend. That's real discipline.
                </div>
              </div>
              <div style={{ padding: "4px 16px" }}>
                <button style={{ ...btnSm(), marginTop: 8, marginBottom: 8 }} onClick={() => setShowSavedHistory(v => !v)}>
                  {showSavedHistory ? "Hide History" : "Show History"}
                </button>
                {showSavedHistory && (
                  <table style={s.table}>
                    <thead><tr>{["Date","Amount","Item"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {savedInstead.map((entry, i) => (
                        <tr key={entry.id} style={{ background: i % 2 === 0 ? "#FFFFFF" : "#FFF8FB" }}>
                          <td style={{ ...s.td, color: "#D4A5C9", fontWeight: 700 }}>{entry.saved_at?.split("T")[0]}</td>
                          <td style={{ ...s.td, color: "#7ED9A8", fontWeight: 800 }}>{fmt(entry.amount)}</td>
                          <td style={{ ...s.td, color: "#6B4C57" }}>{entry.item_name}</td>
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
            <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto" as const, paddingBottom: 4 }}>
              {availableMonths.map(({ month, year, label }) => (
                <button key={`${month}-${year}`} onClick={() => { setSelectedMonth(month); setSelectedYear(year); }}
                  style={{ ...btnSm(selectedMonth === month && selectedYear === year ? "#FF8FAB" : "#FFE0EB"), padding: "6px 12px", fontSize: 11, whiteSpace: "nowrap" as const, color: selectedMonth === month && selectedYear === year ? "#fff" : "#D4839B" }}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              {[
                { label: "Total", val: fmt(totalMonthlyBills), color: "#6B4C57" },
                { label: "Paid", val: fmt(paidTotal), color: "#7ED9A8" },
                { label: "Unpaid", val: fmt(unpaidTotal), color: "#E85D75" },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ flex: 1, background: "#FFF0F5", border: "2px solid #FFD4E5", borderRadius: 10, padding: "8px 12px", textAlign: "center" as const }}>
                  <div style={{ fontSize: 9, color: "#D4A5C9", textTransform: "uppercase" as const }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color, marginTop: 2 }}>{val}</div>
                </div>
              ))}
            </div>
            <div style={s.card}>
              <div style={s.cardHead}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#D4839B", textTransform: "uppercase" as const }}>
                  {MONTH_NAMES[selectedMonth - 1]} {selectedYear} Bills
                </span>
                <button style={btn()} onClick={() => setShowBillForm(v => !v)}>+ Add Bill</button>
              </div>
              {showBillForm && (
                <div style={{ padding: "16px", borderBottom: "1px solid #FFE0EB", background: "#FFF8F3" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 10, color: "#D4A5C9", marginBottom: 4 }}>BILL NAME</div>
                      <input type="text" placeholder="e.g. Rent" value={newBill.name} onChange={e => setNewBill(p => ({ ...p, name: e.target.value }))} style={inputFull} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#D4A5C9", marginBottom: 4 }}>AMOUNT ($)</div>
                      <input type="number" placeholder="e.g. 1375" value={newBill.amount} onChange={e => setNewBill(p => ({ ...p, amount: e.target.value }))} style={inputFull} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#D4A5C9", marginBottom: 4 }}>DUE DAY OF MONTH</div>
                      <input type="number" placeholder="e.g. 1" value={newBill.due_day} onChange={e => setNewBill(p => ({ ...p, due_day: e.target.value }))} style={inputFull} />
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-end" }}>
                      <label style={{ fontSize: 12, color: "#6B4C57", display: "flex", alignItems: "center", gap: 6 }}>
                        <input type="checkbox" checked={newBill.recurring} onChange={e => setNewBill(p => ({ ...p, recurring: e.target.checked }))} />
                        Recurring monthly
                      </label>
                    </div>
                  </div>
                  <button style={{ ...btn("#7ED9A8"), width: "100%" }} onClick={addBill}>Save Bill</button>
                </div>
              )}
              <table style={s.table}>
                <thead><tr>{["", "Bill", "Amount", "Due", "Status", ""].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {monthBills.map((b, i) => (
                    <tr key={b.id} style={{ background: b.late ? "#FFE0E5" : b.paid ? "#EAFBF1" : i % 2 === 0 ? "#FFFFFF" : "#FFF8FB" }}>
                      <td style={{ ...s.td, width: 36 }}>
                        <input type="checkbox" checked={b.paid} onChange={() => togglePaid(b)} style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#7ED9A8" }} />
                      </td>
                      <td style={{ ...s.td, textDecoration: b.paid ? "line-through" : "none", color: b.paid ? "#C4A8B5" : "#6B4C57", fontWeight: 600 }}>{b.name}</td>
                      <td style={{ ...s.td, textDecoration: b.paid ? "line-through" : "none", color: b.paid ? "#C4A8B5" : "#E85D75", fontWeight: 700 }}>{fmt(b.amount)}</td>
                      <td style={{ ...s.td, color: "#D4A5C9" }}>{MONTH_NAMES[selectedMonth - 1].slice(0, 3)} {b.due_day}</td>
                      <td style={s.td}>
                        {b.paid ? <span style={tag("#7ED9A8")}>PAID</span>
                          : b.late ? <span style={tag("#E85D75")}>LATE</span>
                          : b.days <= 3 ? <span style={tag("#FFB68A")}>DUE SOON</span>
                          : <span style={tag("#D4A5C9")}>{b.days}d away</span>}
                      </td>
                      <td style={s.td}><button style={btnSm("#E89BAA")} onClick={() => removeBill(b.id)}>x</button></td>
                    </tr>
                  ))}
                  {monthBills.length === 0 && (
                    <tr><td colSpan={6} style={{ ...s.td, textAlign: "center" as const, color: "#C4A8B5", padding: 24 }}>No bills yet. Click + Add Bill to get started.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── DEBTS TAB ── */}
        {tab === "debts" && (
          <>
            <div style={s.card}>
              <div style={s.cardHead}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#D4839B", textTransform: "uppercase" as const }}>Active Debts -- Snowball Order</span>
                <button style={btn()} onClick={() => addDebt(false)}>+ Add</button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={s.table}>
                  <thead><tr>{["#","Name","Balance","Progress","APR%","Min/Mo","Status","",""].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {activeDebts.filter(d => !d.paid_off).map((d, i) => {
                      const origBal = d.original_balance || d.balance;
                      const paidPct = origBal > 0 ? Math.min(100, ((origBal - d.balance) / origBal) * 100) : 0;
                      return (
                        <tr key={d.id} style={{ background: i % 2 === 0 ? "#FFFFFF" : "#FFF8FB" }}>
                          <td style={s.td}>{i === 0 ? <span style={tag("#FF8FAB")}>Target</span> : <span style={{ color: "#C4A8B5" }}>{i + 1}</span>}</td>
                          <td style={s.td}><EditableCell value={d.name} onChange={v => updateDebt(d.id, "name", v)} type="text" /></td>
                          <td style={s.td}><EditableCell value={d.balance} onChange={v => updateDebt(d.id, "balance", parseFloat(v) || 0)} /></td>
                          <td style={{ ...s.td, minWidth: 100 }}>
                            <div className="progress-bar" style={{ marginBottom: 3 }}>
                              <div className="progress-fill" style={{ width: `${paidPct}%` }} />
                            </div>
                            <div style={{ fontSize: 10, color: "#C4A8B5" }}>{paidPct.toFixed(1)}%</div>
                          </td>
                          <td style={s.td}><EditableCell value={d.apr} onChange={v => updateDebt(d.id, "apr", parseFloat(v) || 0)} /></td>
                          <td style={s.td}><EditableCell value={d.min_payment} onChange={v => updateDebt(d.id, "min_payment", parseFloat(v) || 0)} /></td>
                          <td style={s.td}>
                            {i === 0 ? <span style={tag("#7ED9A8")}>TARGET</span> : d.min_payment > 0 ? <span style={tag("#8ECDF2")}>Min</span> : <span style={tag("#D4A5C9")}>Waiting</span>}
                          </td>
                          <td style={s.td}><button style={{ ...btnSm("#7ED9A8"), fontSize: 10 }} onClick={() => markDebtPaid(d.id, d.name)}>Paid</button></td>
                          <td style={s.td}><button style={btnSm("#E89BAA")} onClick={() => removeDebt(d.id)}>x</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {activeDebts.filter(d => d.paid_off).length > 0 && (
              <div style={{ ...s.card, border: "2px solid #7ED9A8" }}>
                <div style={{ ...s.cardHead, background: "#E8F8EE" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#7ED9A8", textTransform: "uppercase" as const }}>Paid Off</span>
                  <span style={{ fontSize: 11, color: "#7ED9A8" }}>Amazing work!</span>
                </div>
                <table style={s.table}>
                  <tbody>
                    {activeDebts.filter(d => d.paid_off).map(d => (
                      <tr key={d.id} style={{ background: "#EAFBF1" }}>
                        <td style={{ ...s.td, textDecoration: "line-through", color: "#7ED9A8", fontWeight: 700 }}>{d.name}</td>
                        <td style={{ ...s.td, color: "#7ED9A8", fontWeight: 800 }}>$0.00</td>
                        <td style={s.td}><span style={tag("#7ED9A8")}>PAID OFF</span></td>
                        <td style={s.td}>
                          <button style={{ ...btnSm("#D4A5C9"), marginRight: 4 }} onClick={() => unmarkDebtPaid(d.id)}>Undo</button>
                          <button style={btnSm("#E89BAA")} onClick={() => removeDebt(d.id)}>x</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={s.card}>
              <div style={s.cardHead}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#FFB68A", textTransform: "uppercase" as const }}>Deferred Debts</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={btnSm()} onClick={() => setShowDeferred(v => !v)}>{showDeferred ? "Hide" : "Show"}</button>
                  <button style={btn()} onClick={() => addDebt(true)}>+ Add</button>
                </div>
              </div>
              {showDeferred && (
                <div style={{ overflowX: "auto" }}>
                  <table style={s.table}>
                    <thead><tr>{["Name","Balance","APR%","Note",""].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {deferredDebts.map((d, i) => (
                        <tr key={d.id} style={{ background: i % 2 === 0 ? "#FFFFFF" : "#FFF8FB" }}>
                          <td style={s.td}><EditableCell value={d.name} onChange={v => updateDebt(d.id, "name", v)} type="text" /></td>
                          <td style={s.td}><EditableCell value={d.balance} onChange={v => updateDebt(d.id, "balance", parseFloat(v) || 0)} /></td>
                          <td style={s.td}><EditableCell value={d.apr} onChange={v => updateDebt(d.id, "apr", parseFloat(v) || 0)} /></td>
                          <td style={{ ...s.td, color: "#FFB68A", fontSize: 11 }}>Not targeted until active debts clear</td>
                          <td style={s.td}><button style={btnSm("#E89BAA")} onClick={() => removeDebt(d.id)}>x</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── BUDGET TAB ── */}
        {tab === "budget" && (
          <>
            <div style={s.card}>
              <div style={s.cardHead}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#D4839B", textTransform: "uppercase" as const }}>Monthly Budget</span>
              </div>
              {[
                { label: "Monthly Take-Home (est.)", val: budget.take_home, field: "take_home" as keyof Budget, note: "~$3,800 conservative -- after taxes + benefits + 401K" },
                { label: "Fixed Expenses", val: budget.fixed_expenses, field: "fixed_expenses" as keyof Budget, note: "rent + transport + bills + groceries" },
              ].map(({ label, val, field, note }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #FFEEF3" }}>
                  <div>
                    <div style={{ fontSize: 13, color: "#6B4C57" }}>{label}</div>
                    {note && <div style={{ fontSize: 11, color: "#C4A8B5" }}>{note}</div>}
                  </div>
                  <input type="number" value={val} onChange={e => updateBudget(field, parseFloat(e.target.value) || 0)} style={inputStyle} />
                </div>
              ))}
              {[
                { label: "Debt Minimums (auto)", val: fmt(totalMins) },
                { label: "Total Outflow", val: fmt(budget.fixed_expenses + totalMins) },
              ].map(({ label, val }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #FFEEF3", background: "#FFF0F5" }}>
                  <span style={{ fontSize: 13, color: "#6B4C57" }}>{label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#6B4C57" }}>{val}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "#E8F8EE" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#3D8B62" }}>True Snowball Extra</div>
                  <div style={{ fontSize: 11, color: "#7ED9A8" }}>thrown at target debt each month</div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: snowballExtra >= 0 ? "#7ED9A8" : "#E85D75" }}>{fmt(snowballExtra)}</div>
              </div>
            </div>

            <div style={s.card}>
              <div style={s.cardHead}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#D4839B", textTransform: "uppercase" as const }}>Robinhood Buffer</span>
              </div>
              <div style={{ padding: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: "#6B4C57" }}>Current Balance</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: "#FFB68A" }}>{fmt(bufferBalance)} / $650.00</span>
                </div>
                <div className="progress-bar" style={{ height: 20, marginBottom: 12 }}>
                  <div className="progress-fill" style={{ width: `${Math.min((bufferBalance / 650) * 100, 100)}%`, background: bufferBalance >= 650 ? "#7ED9A8" : "linear-gradient(90deg, #FFB68A, #FFD4A3)" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontSize: 11, color: "#C4A8B5" }}>{Math.round((bufferBalance / 650) * 100)}% complete</span>
                  <span style={{ fontSize: 11, color: bufferBalance >= 650 ? "#7ED9A8" : "#C4A8B5" }}>
                    {bufferBalance >= 650 ? "GOAL REACHED!" : `$${(650 - bufferBalance).toFixed(2)} to go`}
                  </span>
                </div>
                <input type="number" placeholder="Update balance..." onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) { setBufferBalance(v); e.target.value = ""; }}} style={{ ...inputFull }} />
                <div style={{ fontSize: 10, color: "#C4A8B5", marginTop: 6 }}>Enter your current Robinhood cash balance to update</div>
              </div>
            </div>

            <div style={s.card}>
              <div style={s.cardHead}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#D4839B", textTransform: "uppercase" as const }}>Savings & Deductions</span>
              </div>
              {[
                { label: "401K Contributions", val: "~$200/mo", color: "#7ED9A8", note: "auto-deducted before you see it" },
                { label: "Buffer Goal (Robinhood)", val: "$650", color: "#FFB68A", note: "5-week build -- $110/wk -- $22/day less" },
                { label: "Daily Anytime Pay reduction", val: "$22/day", color: "#FFB68A", note: "pull $22 less per day to fund buffer" },
              ].map(({ label, val, color, note }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #FFEEF3" }}>
                  <div>
                    <div style={{ fontSize: 13, color: "#6B4C57" }}>{label}</div>
                    <div style={{ fontSize: 11, color: "#C4A8B5", marginTop: 2 }}>{note}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color }}>{val}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── SCHEDULE TAB ── */}
        {tab === "schedule" && (
          <>
            {snowballExtra < 0 && (
              <div style={{ background: "#FFE0E5", border: "2px solid #E85D75", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 12 }}>
                Snowball extra is negative -- minimums exceed your budget!
              </div>
            )}
            <div style={s.card}>
              <div style={s.cardHead}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#D4839B", textTransform: "uppercase" as const }}>Month-by-Month Payoff</span>
                <span style={{ fontSize: 11, color: "#7ED9A8", fontWeight: 700 }}>Done in {payoffMonth} months</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Mo.</th>
                      {activeDebts.filter(d => !d.paid_off).map(d => <th key={d.id} style={{ ...s.th, minWidth: 100 }}>{d.name}</th>)}
                      <th style={{ ...s.th, color: "#FFB68A" }}>Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {months.map((snap, mi) => (
                      <tr key={mi} style={{ background: mi % 2 === 0 ? "#FFFFFF" : "#FFF8FB" }}>
                        <td style={{ ...s.td, color: "#D4A5C9", fontWeight: 700 }}>{snap.month}</td>
                        {activeDebts.filter(d => !d.paid_off).map(d => {
                          const bal = snap.balances[d.id] ?? 0;
                          const paid = bal < 0.01;
                          const isTgt = snap.target === d.name;
                          const origBal = d.original_balance || d.balance;
                          const paidPct = origBal > 0 ? Math.min(100, ((origBal - bal) / origBal) * 100) : 0;
                          return (
                            <td key={d.id} style={{ ...s.td, background: paid ? "#EAFBF1" : isTgt ? "#F3E8FF" : "transparent", color: paid ? "#7ED9A8" : isTgt ? "#C9A4F0" : "#C4A8B5", fontWeight: isTgt ? 700 : 400, textAlign: "right" as const }}>
                              <div style={{ fontSize: 11 }}>{paid ? "PAID" : fmt(bal)}</div>
                              {!paid && (
                                <div className="progress-bar" style={{ marginTop: 3 }}>
                                  <div className="progress-fill" style={{ width: `${paidPct}%` }} />
                                </div>
                              )}
                            </td>
                          );
                        })}
                        <td style={{ ...s.td, color: "#C9A4F0", fontWeight: 700, fontSize: 11 }}>{snap.target}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {deferredDebts.length > 0 && (
              <div style={{ ...s.card, border: "2px solid #FFD4B8" }}>
                <div style={{ ...s.cardHead, background: "#FFF3E5" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#FFB68A", textTransform: "uppercase" as const }}>Deferred Loans (accruing)</span>
                  <span style={{ fontSize: 11, color: "#FFB68A" }}>At payoff: {fmt(finalDeferred)}</span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={s.table}>
                    <thead><tr><th style={s.th}>Mo.</th>{deferredDebts.map(d => <th key={d.id} style={{ ...s.th, minWidth: 110 }}>{d.name}</th>)}</tr></thead>
                    <tbody>
                      {months.filter((_, i) => i % 3 === 0 || i === months.length - 1).map((snap, mi) => (
                        <tr key={mi} style={{ background: mi % 2 === 0 ? "#FFFFFF" : "#FFF8FB" }}>
                          <td style={{ ...s.td, color: "#D4A5C9", fontWeight: 700 }}>{snap.month}</td>
                          {deferredDebts.map(d => (
                            <td key={d.id} style={{ ...s.td, color: "#FFB68A", textAlign: "right" as const }}>{fmt(snap.deferredBalances[d.id] ?? d.balance)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
