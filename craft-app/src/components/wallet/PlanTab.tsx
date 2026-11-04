import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildBillsByDate,
  buildMoneyCalendarRows,
  dateKey,
  loadPayProjectionData,
  SAFE_TO_SPEND_BUFFER,
  SAFE_TO_SPEND_LOOKAHEAD_DAYS,
} from '../../lib/payProjection';

/* ------------------------------------------------------------------
   Plan tab: one calm page that answers
   1) How much can I safely set aside THIS WEEK?
   2) Where does THIS MONTH land after pay and bills?
   3) What does each week of the month look like?

   It runs the exact same projection as the Money Calendar and
   "Can I afford this?" (lib/payProjection.ts), so the numbers match.
------------------------------------------------------------------- */

type Loaded = Awaited<ReturnType<typeof loadPayProjectionData>>;
type Row = ReturnType<typeof buildMoneyCalendarRows>['rows'][number];

interface SplitPreset {
  id: string;
  label: string;
  debt: number;
  fun: number;
  save: number;
}

const SPLITS: SplitPreset[] = [
  { id: 'debt', label: 'Debt focus', debt: 0.7, fun: 0.2, save: 0.1 },
  { id: 'balanced', label: 'Balanced', debt: 0.5, fun: 0.3, save: 0.2 },
  { id: 'fun', label: 'Fun focus', debt: 0.3, fun: 0.5, save: 0.2 },
];

const LS_SPLIT = 'polly.plan.split';

function readLS(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLS(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage can be unavailable; the setting just won't persist */
  }
}

function fmt(n: number) {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString()}`;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

function shortDate(d: Date) {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function tierFor(safe: number): { label: string; color: string; bg: string } {
  if (safe <= 0) return { label: 'Tight', color: 'var(--danger)', bg: 'var(--danger-bg)' };
  if (safe < SAFE_TO_SPEND_BUFFER) return { label: 'OK', color: 'var(--gold-dark)', bg: 'var(--gold-light)' };
  return { label: 'Comfortable', color: 'var(--green-dark)', bg: 'var(--sage-light)' };
}

const labelStyle = { fontSize: 12, color: 'var(--ink-muted)' } as const;

function Line({
  label,
  value,
  sign,
  bold,
  muted,
}: {
  label: string;
  value: number;
  sign?: '+' | '-';
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        padding: '6px 0',
        fontSize: bold ? 15 : 13,
        fontWeight: bold ? 800 : 500,
        color: muted ? 'var(--ink-muted)' : undefined,
        borderTop: bold ? '1.5px solid var(--border, rgba(0,0,0,0.12))' : undefined,
      }}
    >
      <span>{label}</span>
      <span>
        {sign === '-' ? '−' : sign === '+' ? '+' : ''}
        {fmt(Math.abs(value))}
        {!sign && value < 0 ? ` (${fmt(value)})` : ''}
      </span>
    </div>
  );
}

export default function PlanTab() {
  const [data, setData] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showMath, setShowMath] = useState(false);
  const [splitId, setSplitId] = useState<string>(() => readLS(LS_SPLIT) || 'balanced');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await loadPayProjectionData());
    } catch (e) {
      console.error('PlanTab load failed:', e);
      setError('Could not load your numbers. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function pickSplit(id: string) {
    setSplitId(id);
    writeLS(LS_SPLIT, id);
  }

  const plan = useMemo(() => {
    if (!data) return null;

    const today = startOfDay(new Date());
    const todayKey = dateKey(today);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const daysLeftInMonth = Math.round((monthEnd.getTime() - today.getTime()) / 86400000);
    const windowDays = Math.max(daysLeftInMonth, SAFE_TO_SPEND_LOOKAHEAD_DAYS);

    const days: Date[] = [];
    for (let i = 0; i <= windowDays; i++) days.push(addDays(today, i));

    // Unpaid bills that were due earlier this month are overdue: they still
    // have to come out of your balance, so take them off the starting point.
    const wideDays: Date[] = [];
    for (let d = new Date(monthStart); d < today; d = addDays(d, 1)) wideDays.push(new Date(d));
    const pastMap = buildBillsByDate(data.bills, data.payments, [...wideDays, ...days]);
    const overdueBills = Object.entries(pastMap)
      .filter(([key]) => key < todayKey && key >= dateKey(monthStart))
      .flatMap(([key, list]) => list.map(b => ({ ...b, key })));
    const overdueTotal = overdueBills.reduce((s, b) => s + b.amount, 0);

    const billsMap = buildBillsByDate(data.bills, data.payments, days);
    const startBalance = data.currentBalance - overdueTotal;
    const { rows } = buildMoneyCalendarRows(data.inputs, days, startBalance, billsMap);

    const monthEndKey = dateKey(monthEnd);
    const monthRows = rows.filter(r => r.key <= monthEndKey);
    const incomeOf = (r: Row) => r.availableToday + r.releasedToday + r.extraToday;
    const outOf = (r: Row) => r.billsTotal + r.extraExpenseToday;

    // Lowest point over the lookahead window (same rule as Safe to Spend).
    const lookRows = rows.slice(0, SAFE_TO_SPEND_LOOKAHEAD_DAYS + 1);
    const low = lookRows.reduce((m, r) => (r.balance < m.balance ? r : m), lookRows[0]);

    const inHand = data.currentBalance - overdueTotal;
    const weekSafeRaw = Math.min(low.balance, inHand) - SAFE_TO_SPEND_BUFFER;

    const payIn = monthRows.reduce((s, r) => s + incomeOf(r), 0);
    const billsOut = monthRows.reduce((s, r) => s + r.billsTotal, 0);
    const otherOut = monthRows.reduce((s, r) => s + r.extraExpenseToday, 0);
    const monthEndBalance = monthRows[monthRows.length - 1].balance;
    const monthLanding = monthEndBalance - SAFE_TO_SPEND_BUFFER;

    // Paid vs still-to-pay bills this month, for the progress bar.
    const paidThisMonth = data.payments
      .filter(p => p.paid && p.month === today.getMonth() + 1 && p.year === today.getFullYear())
      .reduce((s, p) => {
        const bill = data.bills.find(b => b.id === p.bill_id);
        return s + (p.amount ?? bill?.amount ?? 0);
      }, 0);
    const stillToPay = billsOut + overdueTotal;
    const monthBillsTotal = paidThisMonth + stillToPay;
    const paidPct = monthBillsTotal > 0 ? Math.min(100, Math.round((paidThisMonth / monthBillsTotal) * 100)) : 0;

    // Sunday-start weeks, clipped to today..month end.
    const weeks: {
      start: Date;
      end: Date;
      income: number;
      out: number;
      endBalance: number;
      lowBalance: number;
    }[] = [];
    monthRows.forEach(r => {
      const weekStart = addDays(r.date, -r.date.getDay());
      const last = weeks[weeks.length - 1];
      if (last && dateKey(last.start) === dateKey(weekStart)) {
        last.end = r.date;
        last.income += incomeOf(r);
        last.out += outOf(r);
        last.endBalance = r.balance;
        last.lowBalance = Math.min(last.lowBalance, r.balance);
      } else {
        weeks.push({
          start: weekStart,
          end: r.date,
          income: incomeOf(r),
          out: outOf(r),
          endBalance: r.balance,
          lowBalance: r.balance,
        });
      }
    });

    const upcomingBills = lookRows.flatMap(r => r.billsToday.map(b => ({ ...b, date: r.date })));

    return {
      today,
      monthEnd,
      low,
      inHand,
      overdueBills,
      overdueTotal,
      weekSafeRaw,
      payIn,
      billsOut,
      otherOut,
      monthEndBalance,
      monthLanding,
      paidThisMonth,
      stillToPay,
      paidPct,
      weeks,
      upcomingBills,
    };
  }, [data]);

  if (loading && !data) {
    return (
      <div className="card">
        <div className="card-body" style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-muted)' }}>
          Crunching your numbers…
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="card">
        <div className="card-body" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 10 }}>{error || 'Nothing to show yet.'}</div>
          <button type="button" className="btn btn-primary btn-sm" onClick={load}>Try again</button>
        </div>
      </div>
    );
  }

  const split = SPLITS.find(s => s.id === splitId) ?? SPLITS[1];
  const weekSafe = Math.max(0, plan.weekSafeRaw);
  const short = plan.weekSafeRaw < 0 ? Math.abs(plan.weekSafeRaw) : 0;
  const tier = tierFor(plan.weekSafeRaw);
  const monthTier = tierFor(plan.monthLanding);
  const thisWeek = plan.weeks[0];

  return (
    <>
      {/* ---------- THIS WEEK ---------- */}
      <div className="card">
        <div className="card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div className="section-label">Safe to set aside this week</div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: 999,
                color: tier.color,
                background: tier.bg,
              }}
            >
              {tier.label}
            </span>
          </div>

          <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1.1, margin: '6px 0 2px', color: tier.color }}>
            {short > 0 ? `Short ${fmt(short)}` : fmt(weekSafe)}
          </div>
          <div style={labelStyle}>
            {thisWeek ? `${shortDate(thisWeek.start < plan.today ? plan.today : thisWeek.start)} – ${shortDate(addDays(thisWeek.start, 6))}` : ''}
            {' · '}keeps you above {fmt(SAFE_TO_SPEND_BUFFER)} through {shortDate(addDays(plan.today, SAFE_TO_SPEND_LOOKAHEAD_DAYS))}
          </div>

          {short === 0 && weekSafe > 0 && (
            <>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
                {SPLITS.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    className={`btn btn-sm ${s.id === split.id ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => pickSplit(s.id)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 }}>
                {[
                  { name: 'Debt', amount: weekSafe * split.debt, pct: split.debt },
                  { name: 'Fun', amount: weekSafe * split.fun, pct: split.fun },
                  { name: 'Savings', amount: weekSafe * split.save, pct: split.save },
                ].map(b => (
                  <div
                    key={b.name}
                    style={{ textAlign: 'center', padding: '10px 4px', borderRadius: 14, background: 'var(--sage-light)' }}
                  >
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{fmt(b.amount)}</div>
                    <div style={labelStyle}>
                      {b.name} · {Math.round(b.pct * 100)}%
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {short > 0 && (
            <div style={{ fontSize: 13, color: 'var(--danger)', marginTop: 10, fontWeight: 600 }}>
              Nothing is safe to set aside right now. Pay the bills coming up first, then check back.
            </div>
          )}

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ marginTop: 14 }}
            onClick={() => setShowMath(v => !v)}
          >
            {showMath ? 'Hide my math' : 'Show my math'}
          </button>

          {showMath && (
            <div style={{ marginTop: 10 }}>
              <Line label="Money in hand now" value={data!.currentBalance} />
              {plan.overdueTotal > 0 && <Line label="Overdue bills" value={plan.overdueTotal} sign="-" />}
              <Line
                label={`Lowest point coming (${shortDate(plan.low.date)})`}
                value={plan.low.balance}
              />
              <Line label="Safety buffer" value={SAFE_TO_SPEND_BUFFER} sign="-" />
              <Line label="Safe to set aside" value={plan.weekSafeRaw} bold />
              <div style={{ ...labelStyle, marginTop: 8 }}>
                We use the lower of your balance today and your lowest balance in the next {SAFE_TO_SPEND_LOOKAHEAD_DAYS} days,
                so rent a few weeks out is already counted.
              </div>
              {plan.upcomingBills.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div className="form-label" style={{ marginBottom: 4 }}>Bills in that window</div>
                  {plan.upcomingBills.map((b, i) => (
                    <div
                      key={`${b.id}-${i}`}
                      style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}
                    >
                      <span>{b.name} · {shortDate(b.date)}</span>
                      <span>{fmt(b.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ---------- THIS MONTH ---------- */}
      <div className="card">
        <div className="card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div className="section-label">
              {plan.today.toLocaleDateString(undefined, { month: 'long' })} at a glance
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: 999,
                color: monthTier.color,
                background: monthTier.bg,
              }}
            >
              {monthTier.label}
            </span>
          </div>

          <div style={{ marginTop: 8 }}>
            <Line label="In hand now" value={plan.inHand} />
            <Line label="Pay still coming" value={plan.payIn} sign="+" />
            <Line label="Bills still to pay" value={plan.billsOut + plan.overdueTotal} sign="-" />
            {plan.otherOut > 0 && <Line label="Other planned spending" value={plan.otherOut} sign="-" />}
            <Line label="Safety buffer" value={SAFE_TO_SPEND_BUFFER} sign="-" />
            <Line label={`Left to plan by ${shortDate(plan.monthEnd)}`} value={plan.monthLanding} bold />
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', ...labelStyle, marginBottom: 4 }}>
              <span>Bills paid this month</span>
              <span>
                {fmt(plan.paidThisMonth)} of {fmt(plan.paidThisMonth + plan.stillToPay)}
              </span>
            </div>
            <div style={{ height: 10, borderRadius: 999, background: 'var(--sage-light)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${plan.paidPct}%`,
                  height: '100%',
                  background: 'var(--green-dark)',
                  borderRadius: 999,
                  transition: 'width 0.3s',
                }}
              />
            </div>
          </div>

        </div>
      </div>

      {/* ---------- WEEK BY WEEK ---------- */}
      <div className="card">
        <div className="card-body">
          <div className="section-label">Week by week</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {plan.weeks.map((w, i) => {
              const t = tierFor(w.lowBalance - SAFE_TO_SPEND_BUFFER);
              const from = w.start < plan.today ? plan.today : w.start;
              return (
                <div
                  key={dateKey(w.start)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 14,
                    background: i === 0 ? 'var(--sage-light)' : undefined,
                    border: '1.5px solid var(--border, rgba(0,0,0,0.12))',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>
                      {i === 0 ? 'This week · ' : ''}
                      {shortDate(from)} – {shortDate(w.end)}
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 999,
                        color: t.color,
                        background: t.bg,
                      }}
                    >
                      {t.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 6 }}>
                    <span style={{ color: 'var(--green-dark)' }}>+{fmt(w.income)} in</span>
                    <span style={{ color: 'var(--danger)' }}>−{fmt(w.out)} out</span>
                    <span style={{ fontWeight: 700 }}>{fmt(w.endBalance)} end</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ ...labelStyle, marginTop: 10 }}>
            Week-by-week balances don't subtract the buffer; "Tight / OK / Comfortable" does include it.
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh numbers'}
        </button>
      </div>
    </>
  );
}
