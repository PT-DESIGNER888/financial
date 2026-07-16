import { addDays, addMonths } from '../common/date.util';
import { LoanCycle } from '../entities/loan.entity';

/**
 * ตรรกะการคำนวณแผนผ่อน (pure functions) — แยกออกจาก LoansService
 * เพื่อให้ทดสอบได้ง่ายและลดขนาดไฟล์ service
 */

/** จำนวนวันต่อรอบ (MONTHLY ใช้เลขเดือนแทน — ดู dueDateAt) */
export const cycleStep: Record<Exclude<LoanCycle, 'MONTHLY'>, number> = {
  DAILY: 1,
  WEEKLY: 7,
  TEN_DAY: 10,
};

/** วันครบกำหนดงวดที่ k (k เริ่ม 1) นับจากวันครบกำหนดงวดแรก */
export function dueDateAt(
  firstDue: string,
  cycle: LoanCycle,
  k: number,
): string {
  if (cycle === LoanCycle.MONTHLY) return addMonths(firstDue, k - 1);
  return addDays(firstDue, (k - 1) * cycleStep[cycle]);
}

/** วันครบกำหนดงวดแรกอัตโนมัติ = วันเปิดยอด + 1 รอบ */
export function defaultFirstDue(startDate: string, cycle: LoanCycle): string {
  if (cycle === LoanCycle.MONTHLY) return addMonths(startDate, 1);
  return addDays(startDate, cycleStep[cycle]);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function cycleLabelTh(c: LoanCycle): string {
  return {
    DAILY: 'รายวัน',
    WEEKLY: 'รายสัปดาห์',
    TEN_DAY: 'ราย 10 วัน',
    MONTHLY: 'รายเดือน',
  }[c];
}

export interface InstallmentPlanInput {
  principalOriginal: number;
  installmentCount: number;
  cycle: LoanCycle;
  startDate: string;
  firstDueDate?: string | null;
  /** true = ลดต้นลดดอก (ดอกจากต้นคงเหลือต่องวด), false = ดอกคงที่หารงวดเท่ากัน */
  amortized?: boolean;
  /** flat: ดอกรวมทั้งสัญญา (บาท) */
  totalInterest?: number;
  /** amortized: % ดอกต่องวด คิดจากต้นคงเหลือ */
  interestRatePercent?: number;
  fee?: number;
  roundInstallments?: boolean;
}

export interface PlanRow {
  n: number;
  dueDate: string;
  /** แยกต้น/ดอกเฉพาะลดต้นลดดอก (flat = null) */
  principal: number | null;
  interest: number | null;
  scheduled: number;
}

export interface InstallmentPlan {
  rows: PlanRow[];
  principalOriginal: number;
  interestTotal: number;
  fee: number;
  installmentTotal: number;
  installmentCount: number;
  /** งวดปกติ (flat = ทุกงวดเท่ากัน, amortized = งวดแรกไม่รวมค่าธรรมเนียม) */
  installmentAmount: number;
  firstDueDate: string;
  lastDueDate: string;
}

/**
 * สร้างแผนผ่อนทั้งสัญญา — ใช้ทั้งตอน preview และตอนเปิดยอดจริง
 * เศษจากการหาร/ปัดถูกซับที่งวดสุดท้ายเสมอ เพื่อให้ผลรวมตรงกับยอดเต็ม
 */
export function buildInstallmentPlan(
  input: InstallmentPlanInput,
): InstallmentPlan {
  const n = input.installmentCount;
  const principal = round2(input.principalOriginal);
  const fee = round2(input.fee ?? 0);
  const firstDue =
    input.firstDueDate ?? defaultFirstDue(input.startDate, input.cycle);
  const rows: PlanRow[] = [];

  if (input.amortized) {
    // ลดต้นลดดอก: ต้นเท่ากันทุกงวด ดอกคิดจากต้นคงเหลือ (ปัดดอกเป็นบาทเต็มตามธรรมเนียมเดิม)
    const rate = input.interestRatePercent ?? 0;
    const perPrincipal = input.roundInstallments
      ? Math.floor(principal / n)
      : round2(principal / n);
    let outstanding = principal;
    let interestTotal = 0;
    for (let k = 1; k <= n; k++) {
      const p = k === n ? round2(outstanding) : perPrincipal;
      const i = Math.round((outstanding * rate) / 100);
      interestTotal = round2(interestTotal + i);
      rows.push({
        n: k,
        dueDate: dueDateAt(firstDue, input.cycle, k),
        principal: p,
        interest: i,
        scheduled: round2(p + i + (k === 1 ? fee : 0)),
      });
      outstanding = round2(outstanding - p);
    }
    const installmentTotal = round2(principal + interestTotal + fee);
    return {
      rows,
      principalOriginal: principal,
      interestTotal,
      fee,
      installmentTotal,
      installmentCount: n,
      installmentAmount: round2(rows[0].scheduled - fee),
      firstDueDate: firstDue,
      lastDueDate: rows[n - 1].dueDate,
    };
  }

  // ดอกคงที่: ต้น + ดอกรวม + ค่าธรรมเนียม หารงวดเท่ากัน งวดสุดท้ายซับเศษ
  const interestTotal = round2(input.totalInterest ?? 0);
  const installmentTotal = round2(principal + interestTotal + fee);
  const per = input.roundInstallments
    ? Math.floor(installmentTotal / n)
    : round2(installmentTotal / n);
  for (let k = 1; k <= n; k++) {
    rows.push({
      n: k,
      dueDate: dueDateAt(firstDue, input.cycle, k),
      principal: null,
      interest: null,
      scheduled: k === n ? round2(installmentTotal - per * (n - 1)) : per,
    });
  }
  return {
    rows,
    principalOriginal: principal,
    interestTotal,
    fee,
    installmentTotal,
    installmentCount: n,
    installmentAmount: per,
    firstDueDate: firstDue,
    lastDueDate: rows[n - 1].dueDate,
  };
}
