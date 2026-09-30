// money.ts
//
// Shared bill-occurrence logic used by TodaySnapshot, Reset My Life,
// "Can I afford this?", etc.
//
// IMPORTANT:
// This mirrors Wallet's bill logic:
//
//   • bills is the source of recurring bill definitions.
//   • bill_payments contains individual occurrences.
//   • bill_payments.due_date is the actual occurrence date when present.
//   • bill_payments.name / amount / due_day override the bill defaults.
//   • Monthly recurring bills get one occurrence per calendar month.
//   • Weekly recurring bills use anchor_date + frequency_interval.
//   • If a payment row has not been generated yet, monthly bills fall back
//     to the bill's own due_day exactly like Wallet.
//   • One-off bills use bill_month / bill_year / due_day.
//   • Paid occurrences are excluded.
//
// This means Next Bill and Safe To Spend operate on the same actual
// occurrences Wallet displays.

import { supabase } from './supabase';

export interface EffectiveBill {
  id: number;
  name: string;
  amount: number | null;
  due_day: number | null;
  due_date: string;
  paid: boolean;
}

interface BillRow {
  id: number;
  name: string;
  amount: number | null;
  due_day: number | null;
  recurring: boolean;

  bill_month: number | null;
  bill_year: number | null;

  frequency_unit?: string | null;
  frequency_interval?: number | null;
  anchor_date?: string | null;
}

interface BillPaymentRow {
  id?: number;
  bill_id: number;

  month: number;
  year: number;

  paid: boolean;

  name?: string | null;
  amount?: number | null;
  due_day?: number | null;
  due_date?: string | null;
}

/* ============================================================
   DATE HELPERS
   ============================================================ */

function isoDate(date: Date): string {
  return (
    `${date.getFullYear()}-` +
    `${String(date.getMonth() + 1).padStart(2, '0')}-` +
    `${String(date.getDate()).padStart(2, '0')}`
  );
}

function startOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
}

function parseLocalDate(dateString: string): Date {
  return new Date(`${dateString}T00:00:00`);
}

function daysBetween(from: Date, to: Date): number {
  const a = startOfDay(from).getTime();
  const b = startOfDay(to).getTime();

  return Math.round(
    (b - a) / (1000 * 60 * 60 * 24)
  );
}

export function daySuffix(day: number): string {
  if (day % 10 === 1 && day !== 11) return 'st';
  if (day % 10 === 2 && day !== 12) return 'nd';
  if (day % 10 === 3 && day !== 13) return 'rd';

  return 'th';
}

/* ============================================================
   WEEKLY OCCURRENCES
   ============================================================ */

/**
 * Mirrors Wallet's weekly recurrence concept:
 *
 * anchor_date = first occurrence
 * frequency_interval = number of weeks between occurrences
 */
function weeklyOccurrencesInRange(
  anchor: Date,
  interval: number,
  rangeStart: Date,
  rangeEnd: Date
): Date[] {
  const results: Date[] = [];

  const safeInterval =
    interval && interval > 0 ? interval : 1;

  const start = startOfDay(rangeStart);
  const end = startOfDay(rangeEnd);
  const anchorDay = startOfDay(anchor);

  if (anchorDay > end) {
    return results;
  }

  let current = new Date(anchorDay);

  // Jump forward close to the requested range instead of iterating
  // unnecessarily from the original anchor.
  if (current < start) {
    const diffDays = daysBetween(current, start);
    const weeksElapsed = Math.floor(
      diffDays / 7
    );

    const jumps =
      Math.floor(weeksElapsed / safeInterval);

    current = new Date(current);
    current.setDate(
      current.getDate() + jumps * safeInterval * 7
    );

    while (current < start) {
      current.setDate(
        current.getDate() + safeInterval * 7
      );
    }
  }

  while (current <= end) {
    results.push(new Date(current));

    current.setDate(
      current.getDate() + safeInterval * 7
    );
  }

  return results;
}

/* ============================================================
   MONTHLY FALLBACK
   ============================================================ */

/**
 * Wallet's monthly fallback:
 *
 * new Date(year, month - 1, bill.due_day)
 */
function monthlyFallbackDate(
  year: number,
  month: number,
  dueDay: number | null
): string | null {
  if (dueDay == null) return null;

  return isoDate(
    new Date(
      year,
      month - 1,
      dueDay
    )
  );
}

/* ============================================================
   PAYMENT OVERRIDE
   ============================================================ */

function effectivePayment(
  bill: BillRow,
  payment: BillPaymentRow
): EffectiveBill | null {
  let dueDate = payment.due_date ?? null;

  if (!dueDate) {
    const effectiveDueDay =
      payment.due_day ?? bill.due_day;

    dueDate = monthlyFallbackDate(
      payment.year,
      payment.month,
      effectiveDueDay
    );
  }

  if (!dueDate) return null;

  return {
    id: bill.id,
    name: payment.name ?? bill.name,
    amount: payment.amount ?? bill.amount,
    due_day:
      payment.due_day ??
      bill.due_day,
    due_date: dueDate,
    paid: payment.paid,
  };
}

/* ============================================================
   BUILD BILL OCCURRENCES
   ============================================================ */

/**
 * Builds the same kinds of bill occurrences Wallet displays.
 *
 * We intentionally build a window around today rather than only looking
 * at the current month's bill_payments. This is what allows:
 *
 *   Aug 27 -> Aug 28
 *   Aug 27 -> Aug 30
 *   Aug 27 -> Sep 1
 *
 * instead of accidentally jumping to September 28.
 */
async function getBillOccurrences(): Promise<EffectiveBill[]> {
  const now = new Date();
  const today = startOfDay(now);
  const todayKey = isoDate(today);

  const [billsRes, paymentsRes] = await Promise.all([
    supabase
      .from('bills')
      .select('*')
      .order('due_day'),

    supabase
      .from('bill_payments')
      .select('*'),
  ]);

  if (billsRes.error) {
    console.error(
      'money.ts bills query failed:',
      billsRes.error
    );
  }

  if (paymentsRes.error) {
    console.error(
      'money.ts bill_payments query failed:',
      paymentsRes.error
    );
  }

  const bills =
    (billsRes.data ?? []) as BillRow[];

  const payments =
    (paymentsRes.data ?? []) as BillPaymentRow[];

  const results: EffectiveBill[] = [];

  /*
   * Wallet currently generates payments from the current month through
   * the available-month window. For this shared helper, use a generous
   * three-month forward window so we always have enough actual
   * occurrences for "next bill" and Safe To Spend.
   */
  const rangeStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    1
  );

  const rangeEnd = new Date(
    today.getFullYear(),
    today.getMonth() + 4,
    0
  );

  /* ------------------------------------------------------------
     RECURRING BILLS
     ------------------------------------------------------------ */

  for (const bill of bills) {
    if (!bill.recurring) continue;

    /*
     * WEEKLY / INTERVAL-BASED RECURRING BILL
     *
     * Wallet generates actual payment rows using anchor_date and
     * frequency_interval.
     */
    if (
      bill.frequency_unit === 'week' &&
      bill.anchor_date
    ) {
      const anchor = parseLocalDate(
        bill.anchor_date
      );

      const interval =
        bill.frequency_interval &&
        bill.frequency_interval > 0
          ? bill.frequency_interval
          : 1;

      const occurrences =
        weeklyOccurrencesInRange(
          anchor,
          interval,
          rangeStart,
          rangeEnd
        );

      for (const occurrenceDate of occurrences) {
        const occurrenceKey =
          isoDate(occurrenceDate);

        /*
         * Find the actual Wallet payment row for THIS EXACT DATE.
         *
         * Do not use just bill_id.
         */
        const payment = payments.find(
          p =>
            p.bill_id === bill.id &&
            p.due_date === occurrenceKey
        );

        if (payment) {
          if (payment.paid) continue;

          const effective =
            effectivePayment(
              bill,
              payment
            );

          if (effective) {
            results.push(effective);
          }

          continue;
        }

        /*
         * Wallet's ensurePaymentsExist() creates this row.
         *
         * If TodaySnapshot runs before Wallet has created it,
         * synthesize the same occurrence temporarily.
         */
        results.push({
          id: bill.id,
          name: bill.name,
          amount: bill.amount,
          due_day:
            occurrenceDate.getDate(),
          due_date: occurrenceKey,
          paid: false,
        });
      }

      continue;
    }

    /*
     * MONTHLY RECURRING BILL
     *
     * Wallet creates one occurrence for each calendar month.
     */
    for (
      let cursor = new Date(rangeStart);
      cursor <= rangeEnd;
      cursor = new Date(
        cursor.getFullYear(),
        cursor.getMonth() + 1,
        1
      )
    ) {
      const year =
        cursor.getFullYear();

      const month =
        cursor.getMonth() + 1;

      /*
       * Wallet identifies monthly occurrences by:
       *
       * bill_id + month + year
       */
      const payment = payments.find(
        p =>
          p.bill_id === bill.id &&
          p.month === month &&
          p.year === year
      );

      if (payment) {
        if (payment.paid) continue;

        const effective =
          effectivePayment(
            bill,
            payment
          );

        if (effective) {
          results.push(effective);
        }

        continue;
      }

      /*
       * Exactly like Wallet's billsByDate fallback:
       *
       * If payment hasn't been generated yet, use bill.due_day.
       */
      const dueDate =
        monthlyFallbackDate(
          year,
          month,
          bill.due_day
        );

      if (!dueDate) continue;

      results.push({
        id: bill.id,
        name: bill.name,
        amount: bill.amount,
        due_day: bill.due_day,
        due_date: dueDate,
        paid: false,
      });
    }
  }

  /* ------------------------------------------------------------
     ONE-OFF BILLS
     ------------------------------------------------------------ */

  for (const bill of bills) {
    if (bill.recurring) continue;

    if (
      bill.bill_month == null ||
      bill.bill_year == null ||
      bill.due_day == null
    ) {
      continue;
    }

    const dueDate =
      monthlyFallbackDate(
        bill.bill_year,
        bill.bill_month,
        bill.due_day
      );

    if (!dueDate) continue;

    /*
     * Wallet removes stale one-off bills from bills itself.
     *
     * Still protect this helper from showing an old occurrence.
     */
    if (dueDate < todayKey) continue;

    const payment = payments.find(
      p =>
        p.bill_id === bill.id &&
        p.month === bill.bill_month &&
        p.year === bill.bill_year
    );

    if (payment?.paid) continue;

    results.push({
      id: bill.id,
      name: bill.name,
      amount: bill.amount,
      due_day: bill.due_day,
      due_date: dueDate,
      paid: false,
    });
  }

  /*
   * A payment and a fallback can theoretically describe the same
   * occurrence during the brief period before Wallet's state updates.
   *
   * Deduplicate by:
   *
   *   bill ID + actual due date
   */
  const unique = new Map<
    string,
    EffectiveBill
  >();

  for (const bill of results) {
    const key =
      `${bill.id}:${bill.due_date}`;

    const existing =
      unique.get(key);

    if (!existing) {
      unique.set(key, bill);
      continue;
    }

    /*
     * Prefer the payment-backed/effective version if it contains
     * more specific information.
     */
    if (
      bill.amount !== null ||
      bill.name !== existing.name
    ) {
      unique.set(key, bill);
    }
  }

  return Array.from(unique.values())
    .sort((a, b) => {
      if (a.due_date < b.due_date) return -1;
      if (a.due_date > b.due_date) return 1;

      return a.id - b.id;
    });
}

/* ============================================================
   PUBLIC: UNPAID BILLS
   ============================================================ */

/**
 * Kept under the original function name so existing imports do not
 * need to change.
 *
 * Despite the historical name, this now returns actual bill
 * occurrences, not merely one row per bill/month.
 */
export async function getUnpaidBillsThisMonth(): Promise<
  EffectiveBill[]
> {
  return getBillOccurrences();
}

/* ============================================================
   PUBLIC: NEXT BILL
   ============================================================ */

export function pickNextBill(
  unpaidBills: EffectiveBill[],
  now: Date
): EffectiveBill | null {
  if (unpaidBills.length === 0) {
    return null;
  }

  const todayKey =
    isoDate(startOfDay(now));

  /*
   * The array is already chronologically sorted.
   *
   * First occurrence on/after today wins.
   */
  const upcoming =
    unpaidBills.find(
      bill =>
        bill.due_date >= todayKey
    );

  if (upcoming) {
    return upcoming;
  }

  /*
   * If there are no future bills, return the earliest overdue bill.
   */
  return unpaidBills[0] ?? null;
}

/* ============================================================
   SAFE TO SPEND
   ============================================================ */

/**
 * Must stay in sync with SAFE_TO_SPEND_LOOKAHEAD_DAYS and
 * SAFE_TO_SPEND_BUFFER in pages/Wallet.tsx so the Wallet card and
 * "Can I afford this?" agree.
 */
export const SAFE_TO_SPEND_LOOKAHEAD_DAYS = 10;
export const SAFE_TO_SPEND_BUFFER = 50;

export interface SafeToSpendResult {
  currentBalance: number;
  /** Total of unpaid bills (overdue + due within the lookahead window). */
  upcomingTotal: number;
  buffer: number;
  /** Lowest projected balance in the window, minus the buffer (never below 0). */
  safeToSpend: number;
  /** How far below zero (after buffer) you'd land. 0 when not short. */
  shortfall: number;
  lookaheadDays: number;
  lowestBalance: number;
  lowestBalanceDate: string;

  upcomingBills: {
    name: string;
    amount: number;
    daysUntilDue: number;
  }[];
}

async function getLoggedExtras(
  from: string,
  to: string
): Promise<{
  funds: Record<string, number>;
  expenses: Record<string, number>;
}> {
  const [fundsRes, expensesRes] = await Promise.all([
    supabase
      .from('extra_funds_log')
      .select('date, amount')
      .gte('date', from)
      .lte('date', to),
    supabase
      .from('extra_expenses_log')
      .select('date, amount')
      .gte('date', from)
      .lte('date', to),
  ]);

  if (fundsRes.error) {
    console.error('money.ts extra_funds_log query failed:', fundsRes.error);
  }
  if (expensesRes.error) {
    console.error('money.ts extra_expenses_log query failed:', expensesRes.error);
  }

  const toMap = (rows: { date: string; amount: string | number | null }[] | null) => {
    const map: Record<string, number> = {};
    (rows ?? []).forEach(r => {
      map[r.date] = (map[r.date] ?? 0) + (parseFloat(String(r.amount ?? '')) || 0);
    });
    return map;
  };

  return {
    funds: toMap(fundsRes.data as any),
    expenses: toMap(expensesRes.data as any),
  };
}

/**
 * Same idea as the Safe to Spend card in Wallet: find the LOWEST balance
 * you're projected to hit over the next SAFE_TO_SPEND_LOOKAHEAD_DAYS days
 * (crossing month boundaries), then subtract the buffer.
 *
 * Uses the same actual bill occurrences as Next Bill, plus anything logged
 * in extra_funds_log / extra_expenses_log.
 *
 * NOTE: unlike the Wallet card, this does NOT project paycheck / Anytime
 * Pay income (that engine lives in Wallet). So it can only be equal to or
 * more cautious than the card, never more optimistic.
 */
export async function getSafeToSpend(): Promise<
  SafeToSpendResult
> {
  const now = new Date();
  const today = startOfDay(now);

  const windowEnd = new Date(today);
  windowEnd.setDate(
    windowEnd.getDate() + SAFE_TO_SPEND_LOOKAHEAD_DAYS
  );

  const [
    budgetRes,
    unpaidBills,
    extras,
  ] = await Promise.all([
    supabase
      .from('budget')
      .select('current_balance')
      .eq('id', 1)
      .maybeSingle(),

    getBillOccurrences(),

    getLoggedExtras(isoDate(today), isoDate(windowEnd)),
  ]);

  if (budgetRes.error) {
    console.error(
      'money.ts budget query failed:',
      budgetRes.error
    );
  }

  const currentBalance =
    Number(budgetRes.data?.current_balance) || 0;

  const buffer = SAFE_TO_SPEND_BUFFER;

  const upcomingBills = unpaidBills
    .map(bill => {
      const dueDate = parseLocalDate(bill.due_date);

      return {
        name: bill.name,
        amount: bill.amount ?? 0,
        daysUntilDue: daysBetween(today, dueDate),
        dueKey: bill.due_date,
      };
    })
    .filter(
      bill => bill.daysUntilDue <= SAFE_TO_SPEND_LOOKAHEAD_DAYS
    );

  const upcomingTotal = upcomingBills.reduce(
    (sum, bill) => sum + bill.amount,
    0
  );

  /*
   * Walk day by day. Overdue bills hit today (day 0). Start at the
   * current balance, same as the Wallet calendar's first row.
   */
  let running = currentBalance;
  let lowestBalance = Infinity;
  let lowestBalanceDate = isoDate(today);

  for (let i = 0; i <= SAFE_TO_SPEND_LOOKAHEAD_DAYS; i++) {
    const day = new Date(today);
    day.setDate(day.getDate() + i);
    const key = isoDate(day);

    const billsToday = upcomingBills
      .filter(b =>
        i === 0
          ? b.daysUntilDue <= 0
          : b.daysUntilDue === i
      )
      .reduce((sum, b) => sum + b.amount, 0);

    running +=
      (extras.funds[key] ?? 0) -
      (extras.expenses[key] ?? 0) -
      billsToday;

    if (running < lowestBalance) {
      lowestBalance = running;
      lowestBalanceDate = key;
    }
  }

  const raw = lowestBalance - buffer;

  return {
    currentBalance,
    upcomingTotal,
    buffer,
    safeToSpend: Math.max(0, raw),
    shortfall: raw < 0 ? Math.abs(raw) : 0,
    lookaheadDays: SAFE_TO_SPEND_LOOKAHEAD_DAYS,
    lowestBalance,
    lowestBalanceDate,
    upcomingBills: upcomingBills.map(
      ({ name, amount, daysUntilDue }) => ({
        name,
        amount,
        daysUntilDue,
      })
    ),
  };
}
