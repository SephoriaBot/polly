// money.ts
// Shared bill logic for TodaySnapshot, Reset My Life, etc.
//
// IMPORTANT:
// Wallet treats bill_payments.due_date as the canonical occurrence date.
// This file follows that same model instead of treating due_day as a
// month-independent date.
//
// Recurring bills:
//   - Each occurrence is represented by a bill_payments row.
//   - due_date is the actual occurrence date.
//   - payment name/amount/due_day overrides the bill defaults.
//   - paid is tracked per occurrence.
//
// One-off bills:
//   - The bills row itself provides the occurrence date.
//   - A matching bill_payments row is used for paid status, just like Wallet.

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

export function daySuffix(day: number): string {
  if (day % 10 === 1 && day !== 11) return 'st';
  if (day % 10 === 2 && day !== 12) return 'nd';
  if (day % 10 === 3 && day !== 13) return 'rd';
  return 'th';
}

/**
 * Convert a Date to the same local YYYY-MM-DD format Wallet uses.
 */
function isoDate(date: Date): string {
  return (
    `${date.getFullYear()}-` +
    `${String(date.getMonth() + 1).padStart(2, '0')}-` +
    `${String(date.getDate()).padStart(2, '0')}`
  );
}

/**
 * Parse a Wallet due_date without introducing UTC timezone shifts.
 *
 * Wallet itself uses:
 *   new Date(payment.due_date + "T00:00:00")
 *
 * so we do the same.
 */
function parseDueDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

/**
 * Return today's date at local midnight.
 */
function startOfToday(now = new Date()): Date {
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
}

/**
 * Build a YYYY-MM-DD date from a one-off bill's month/year/due_day.
 */
function oneOffDueDate(bill: BillRow): string | null {
  if (
    bill.bill_month == null ||
    bill.bill_year == null ||
    bill.due_day == null
  ) {
    return null;
  }

  return isoDate(
    new Date(
      bill.bill_year,
      bill.bill_month - 1,
      bill.due_day
    )
  );
}

/**
 * Get every unpaid bill occurrence that is either:
 *
 *   - overdue, or
 *   - due today, or
 *   - due in the future.
 *
 * In other words, this returns the actual unpaid occurrences from today
 * forward, plus overdue occurrences from the current month.
 *
 * The important difference from the old version is that this does NOT
 * collapse recurring bills down to one row per bill. A recurring bill
 * can have multiple actual occurrences, each with its own due_date.
 */
export async function getUnpaidBillsThisMonth(): Promise<EffectiveBill[]> {
  const now = new Date();
  const today = startOfToday(now);
  const todayKey = isoDate(today);

  const [billsRes, paymentsRes] = await Promise.all([
    supabase
      .from('bills')
      .select(
        'id,name,amount,due_day,recurring,bill_month,bill_year'
      )
      .order('due_day'),

    supabase
      .from('bill_payments')
      .select(
        'id,bill_id,month,year,paid,name,amount,due_day,due_date'
      ),
  ]);

  if (billsRes.error) {
    console.error(
      'getUnpaidBillsThisMonth bills query failed:',
      billsRes.error
    );
  }

  if (paymentsRes.error) {
    console.error(
      'getUnpaidBillsThisMonth payments query failed:',
      paymentsRes.error
    );
  }

  const bills = (billsRes.data ?? []) as BillRow[];
  const payments = (paymentsRes.data ?? []) as BillPaymentRow[];

  const billById = new Map<number, BillRow>();

  for (const bill of bills) {
    billById.set(bill.id, bill);
  }

  const result: EffectiveBill[] = [];

  // ------------------------------------------------------------
  // RECURRING BILL OCCURRENCES
  // ------------------------------------------------------------
  //
  // Wallet creates bill_payments rows for each occurrence and uses
  // payment.due_date as the canonical date.
  //
  // Therefore we iterate PAYMENT ROWS, not bills.
  //
  for (const payment of payments) {
    const bill = billById.get(payment.bill_id);

    if (!bill || !bill.recurring) continue;

    // Wallet's canonical occurrence date.
    //
    // If an older payment row somehow doesn't have due_date, fall back
    // to its month/year/due_day exactly the way Wallet does.
    let dueDate: string | null = payment.due_date ?? null;

    if (!dueDate) {
      const effectiveDueDay =
        payment.due_day ?? bill.due_day;

      if (
        effectiveDueDay != null &&
        payment.month != null &&
        payment.year != null
      ) {
        dueDate = isoDate(
          new Date(
            payment.year,
            payment.month - 1,
            effectiveDueDay
          )
        );
      }
    }

    if (!dueDate) continue;

    // Don't include future occurrences that somehow have an invalid
    // date before today.
    //
    // We DO keep today's date and overdue dates because those are still
    // unpaid bills that matter to Safe To Spend / Next Bill.
    if (dueDate < todayKey && payment.paid) {
      continue;
    }

    // Once an occurrence is paid, it should never be considered the
    // next bill.
    if (payment.paid) continue;

    result.push({
      id: bill.id,
      name: payment.name ?? bill.name,
      amount: payment.amount ?? bill.amount,
      due_day: payment.due_day ?? bill.due_day,
      due_date: dueDate,
      paid: false,
    });
  }

  // ------------------------------------------------------------
  // ONE-OFF BILLS
  // ------------------------------------------------------------
  //
  // Wallet uses the bills row for the actual one-off occurrence and
  // only checks bill_payments for its paid state.
  //
  for (const bill of bills) {
    if (bill.recurring) continue;

    const dueDate = oneOffDueDate(bill);

    if (!dueDate) continue;

    // Past one-off bills are stale according to Wallet's behavior.
    if (dueDate < todayKey) continue;

    const payment = payments.find(
      p =>
        p.bill_id === bill.id &&
        p.month === bill.bill_month &&
        p.year === bill.bill_year
    );

    if (payment?.paid) continue;

    result.push({
      id: bill.id,
      name: bill.name,
      amount: bill.amount,
      due_day: bill.due_day,
      due_date: dueDate,
      paid: false,
    });
  }

  // Sort by the ACTUAL calendar occurrence, not merely due_day.
  //
  // This is the critical fix:
  //
  //   Aug 28  <  Sep 28
  //
  // even though both have due_day === 28.
  result.sort((a, b) => {
    if (a.due_date < b.due_date) return -1;
    if (a.due_date > b.due_date) return 1;
    return a.id - b.id;
  });

  return result;
}

/**
 * Pick the next actual bill occurrence.
 *
 * Because EffectiveBill now contains due_date, we simply choose the
 * earliest unpaid occurrence.
 *
 * Overdue bills are intentionally considered first because they are
 * still unpaid and therefore are more urgent than a future bill.
 */
export function pickNextBill(
  unpaidBills: EffectiveBill[],
  now: Date
): EffectiveBill | null {
  if (unpaidBills.length === 0) return null;

  const todayKey = isoDate(startOfToday(now));

  // First: overdue or due today.
  const overdueOrToday = unpaidBills.find(
    bill => bill.due_date <= todayKey
  );

  if (overdueOrToday) {
    return overdueOrToday;
  }

  // Otherwise the list is already sorted chronologically.
  return unpaidBills[0];
}

export interface SafeToSpendResult {
  currentBalance: number;
  near5Total: number;
  buffer: number;
  safeToSpend: number;
  near5Bills: {
    name: string;
    amount: number;
    daysUntilDue: number;
  }[];
}

/**
 * Mirrors Wallet's Safe to Spend behavior:
 *
 *   current balance
 *   - bills due within 5 days
 *   - already-overdue bills
 *   - $50 buffer
 *
 * The major difference from the old helper is that "within 5 days"
 * is calculated from each bill's ACTUAL due_date.
 *
 * Therefore:
 *
 *   Aug 28 -> 1 day
 *   Sep 1  -> 5 days
 *   Sep 28 -> 32 days
 *
 * rather than comparing only the day-of-month.
 */
export async function getSafeToSpend(): Promise<SafeToSpendResult> {
  const now = new Date();
  const today = startOfToday(now);

  const [budgetRes, unpaidBills] = await Promise.all([
    supabase
      .from('budget')
      .select('current_balance')
      .eq('id', 1)
      .maybeSingle(),

    getUnpaidBillsThisMonth(),
  ]);

  if (budgetRes.error) {
    console.error(
      'getSafeToSpend budget query failed:',
      budgetRes.error
    );
  }

  const currentBalance =
    Number(budgetRes.data?.current_balance) || 0;

  const buffer = 50;

  const near5Bills = unpaidBills
    .map(bill => {
      const dueDate = parseDueDate(bill.due_date);

      const daysUntilDue = Math.ceil(
        (dueDate.getTime() - today.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      return {
        name: bill.name,
        amount: bill.amount ?? 0,
        daysUntilDue,
      };
    })
    .filter(bill => bill.daysUntilDue <= 5);

  const near5Total = near5Bills.reduce(
    (sum, bill) => sum + bill.amount,
    0
  );

  const safeToSpend = Math.max(
    0,
    currentBalance - near5Total - buffer
  );

  return {
    currentBalance,
    near5Total,
    buffer,
    safeToSpend,
    near5Bills,
  };
}