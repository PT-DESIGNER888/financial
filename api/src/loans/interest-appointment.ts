import { addDays, diffDays } from '../common/date.util';
import { round2 } from './installment-plan';

/** รอบที่นัดคลุม — ดอกเต็มของรอบกับส่วนที่ยังไม่จ่าย */
export type AppointmentCycle = {
  dueDate: string;
  interest: number;
  remaining: number;
};

export type InterestAppointmentQuote = {
  date: string;
  cycles: AppointmentCycle[];
  computedTotal: number;
  agreedAmount: number;
  paid: number;
  remaining: number;
};

export function isAppointmentOpen(
  interestDueDate: string | null | undefined,
  asOf: string,
): boolean {
  return !!interestDueDate && diffDays(asOf, interestDueDate) >= 0;
}

/** วันครบรอบดอกที่นัดคลุมอยู่ ต้องซ่อนจากหน้าเก็บวันนี้ */
export function hidesWeeklyDueOn(input: {
  interestDueDate: string | null | undefined;
  day: string;
  isCycleDue: boolean;
}): boolean {
  if (!input.interestDueDate || !input.isCycleDue) return false;
  if (input.day === input.interestDueDate) return false;
  return diffDays(input.day, input.interestDueDate) > 0;
}

/** ดอกที่จ่ายแล้วนับเข้าก้อนนัด (หลังรอบก่อนหน้า ถึงวันนัด รวมวันนัด) */
export function paidTowardAppointment(
  payments: {
    paidDate: string;
    interestPaid: number;
    onDeadLoan?: boolean;
  }[],
  windowStart: string,
  until: string,
): number {
  return round2(
    payments
      .filter(
        (p) =>
          !p.onDeadLoan &&
          diffDays(windowStart, p.paidDate) > 0 &&
          diffDays(p.paidDate, until) >= 0,
      )
      .reduce((s, p) => s + p.interestPaid, 0),
  );
}

export function projectCyclesUntil(input: {
  startDue: string;
  until: string;
  step: number;
  interestForDue: (dueDate: string) => { interest: number; remaining: number };
}): AppointmentCycle[] {
  if (diffDays(input.until, input.startDue) > 0) return [];
  const cycles: AppointmentCycle[] = [];
  let d = input.startDue;
  for (let i = 0; i < 60; i++) {
    if (diffDays(input.until, d) > 0) break;
    const info = input.interestForDue(d);
    cycles.push({
      dueDate: d,
      interest: info.interest,
      remaining: Math.max(0, round2(info.remaining)),
    });
    d = addDays(d, input.step);
  }
  return cycles;
}

export function quoteInterestAppointment(input: {
  date: string;
  startDue: string;
  step: number;
  windowStart: string;
  agreedAmount: number | null;
  payments: {
    paidDate: string;
    interestPaid: number;
    onDeadLoan?: boolean;
  }[];
  interestForDue: (dueDate: string) => { interest: number; remaining: number };
}): InterestAppointmentQuote {
  const cycles = projectCyclesUntil({
    startDue: input.startDue,
    until: input.date,
    step: input.step,
    interestForDue: input.interestForDue,
  });
  const computedTotal = round2(cycles.reduce((s, c) => s + c.remaining, 0));
  const paid = paidTowardAppointment(
    input.payments,
    input.windowStart,
    input.date,
  );
  const agreedAmount =
    input.agreedAmount != null ? round2(input.agreedAmount) : computedTotal;
  return {
    date: input.date,
    cycles,
    computedTotal,
    agreedAmount,
    paid,
    remaining: Math.max(0, round2(agreedAmount - paid)),
  };
}

/** กระจายยอดที่จ่ายแล้วเข้าแต่ละรอบตอนนัดจบ — ส่วนที่ขาดเข้ายอดค้างที่รอบสุดท้าย */
export function settleAppointmentGroup(input: {
  covered: { id: string; interest: number }[];
  groupDue: number;
  groupPaid: number;
}): { addedArrears: number; patches: { id: string; accruedAmount: number }[] } {
  const unpaid = Math.max(0, round2(input.groupDue - input.groupPaid));
  const patches = input.covered.map((c, i) => ({
    id: c.id,
    accruedAmount: i === input.covered.length - 1 ? unpaid : 0,
  }));
  return { addedArrears: unpaid, patches };
}

export function collectionInterestOnDay(input: {
  interestDueDate: string | null | undefined;
  day: string;
  isCycleDue: boolean;
  agreedDue: number;
  agreedRemaining: number;
  weeklyDue: number;
  weeklyRemaining: number;
}): { dueInterest: number; remainingInterest: number } {
  if (input.interestDueDate && input.day === input.interestDueDate) {
    return {
      dueInterest: input.agreedDue,
      remainingInterest: input.agreedRemaining,
    };
  }
  if (
    hidesWeeklyDueOn({
      interestDueDate: input.interestDueDate,
      day: input.day,
      isCycleDue: input.isCycleDue,
    })
  ) {
    return { dueInterest: 0, remainingInterest: 0 };
  }
  return {
    dueInterest: input.weeklyDue,
    remainingInterest: input.weeklyRemaining,
  };
}
