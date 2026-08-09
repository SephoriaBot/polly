// money.ts
// Shared "what's the next bill I owe" logic. Mirrors Wallet's own
// effectiveDueDay rule: a recurring bill's due day/amount/name can be
// overridden for a specific month via bill_payments; that override always
// wins over the bill's default. Used by TodaySnapshot and Reset My Life so
// neither ever shows a due date Wallet itself wouldn't show.

import { supabase } from './supabase';

export interface EffectiveBill {
  id: number;
  name: string;
  amount: number | null;
  due_day: number | null;
  paid: boolean;
}

export function daySuffix(day: number): string {
  if (day % 10 === 1 && day !== 11) return 'st';
  if (day % 10 === 2 && day !== 12) return 'nd';
  if (day % 10 === 3 && day !== 13) return 'rd';
  return 'th';
}

export async function getUnpaidBillsThisMonth(): Promise<EffectiveBill[]> {
  const now = new Date();
  const [billsRes, paymentsRes] = await Promise.all([
    supabase.from('bills').select('id,name,amount,due_day,recurring,bill_month,bill_year').order('due_day'),
    supabase.from('bill_payments').select('bill_id,month,year,paid,name,amount,due_day').eq('month', now.getMonth() + 1).eq('year', now.getFullYear()),
  ]);

  const payments = paymentsRes.data ?? [];

  // Same staleness rule Wallet uses: a one-off bill from a past month is
  // done and gone, only recurring bills or the current/future one-offs count.
  const isPastMonth = (m: number | null | undefined, y: number | null | undefined) =>
    y != null && m != null && (y < now.getFullYear() || (y === now.getFullYear() && m < now.getMonth() + 1));
  const activeBills = (billsRes.data ?? []).filter(b => b.recurring || !isPastMonth(b.bill_month, b.bill_year));

  const withEffectiveFields: EffectiveBill[] = activeBills.map(b => {
    const payment = payments.find(p => p.bill_id === b.id);
    const useOverride = b.recurring && !!payment;
    return {
      id: b.id,
      name: useOverride ? (payment!.name ?? b.name) : b.name,
      amount: useOverride ? (payment!.amount ?? b.amount) : b.amount,
      due_day: useOverride ? (payment!.due_day ?? b.due_day) : b.due_day,
      paid: payment?.paid ?? false,
    };
  });

  return withEffectiveFields
    .filter(b => !b.paid)
    .sort((a, b) => (a.due_day ?? 0) - (b.due_day ?? 0));
}

// Prefer the next bill that hasn't hit its due day yet; fall back to the
// earliest unpaid one this month (i.e. already overdue) if none.
export function pickNextBill(unpaidBills: EffectiveBill[], now: Date): EffectiveBill | null {
  const currentDay = now.getDate();
  return unpaidBills.find(b => (b.due_day ?? 0) >= currentDay) ?? unpaidBills[0] ?? null;
}
