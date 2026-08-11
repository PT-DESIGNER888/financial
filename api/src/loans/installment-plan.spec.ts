import { LoanCycle } from '../common/enums';
import {
  buildInstallmentPlan,
  cycleLabelTh,
  defaultFirstDue,
  dueDateAt,
  round2,
} from './installment-plan';

const sumScheduled = (rows: { scheduled: number }[]) =>
  round2(rows.reduce((s, r) => s + r.scheduled, 0));

describe('installment-plan helpers', () => {
  describe('round2', () => {
    it('ปัดเป็นทศนิยม 2 ตำแหน่ง', () => {
      expect(round2(10 / 3)).toBe(3.33);
      expect(round2(2.345)).toBe(2.35);
      expect(round2(1200)).toBe(1200);
    });
  });

  describe('dueDateAt', () => {
    it('รายเดือน = บวกเดือน (ตรึงปลายเดือน)', () => {
      expect(dueDateAt('2024-01-31', LoanCycle.MONTHLY, 2)).toBe('2024-02-29');
    });
    it('รายสัปดาห์ = บวก 7 วันต่อรอบ', () => {
      expect(dueDateAt('2024-01-01', LoanCycle.WEEKLY, 3)).toBe('2024-01-15');
    });
    it('ราย 10 วัน', () => {
      expect(dueDateAt('2024-01-01', LoanCycle.TEN_DAY, 2)).toBe('2024-01-11');
    });
    it('งวดแรก (k=1) = วันครบกำหนดแรกเสมอ', () => {
      expect(dueDateAt('2024-06-10', LoanCycle.DAILY, 1)).toBe('2024-06-10');
    });
  });

  describe('defaultFirstDue', () => {
    it('รายเดือน = วันเปิดยอด + 1 เดือน', () => {
      expect(defaultFirstDue('2024-01-15', LoanCycle.MONTHLY)).toBe(
        '2024-02-15',
      );
    });
    it('รายวัน = วันเปิดยอด + 1 วัน', () => {
      expect(defaultFirstDue('2024-01-01', LoanCycle.DAILY)).toBe('2024-01-02');
    });
    it('รายสัปดาห์ = วันเปิดยอด + 7 วัน', () => {
      expect(defaultFirstDue('2024-01-01', LoanCycle.WEEKLY)).toBe(
        '2024-01-08',
      );
    });
  });

  describe('cycleLabelTh', () => {
    it('แปลงเป็นป้ายภาษาไทย', () => {
      expect(cycleLabelTh(LoanCycle.DAILY)).toBe('รายวัน');
      expect(cycleLabelTh(LoanCycle.MONTHLY)).toBe('รายเดือน');
    });
  });
});

describe('buildInstallmentPlan (ดอกคงที่ / flat)', () => {
  it('หารงวดเท่ากันเมื่อไม่ปัด', () => {
    const plan = buildInstallmentPlan({
      principalOriginal: 10000,
      installmentCount: 10,
      cycle: LoanCycle.MONTHLY,
      startDate: '2024-01-01',
      totalInterest: 2000,
      fee: 0,
    });
    expect(plan.installmentTotal).toBe(12000);
    expect(plan.installmentAmount).toBe(1200);
    expect(plan.rows).toHaveLength(10);
    expect(plan.rows.every((r) => r.scheduled === 1200)).toBe(true);
    expect(plan.rows.every((r) => r.principal === null)).toBe(true);
    expect(sumScheduled(plan.rows)).toBe(12000);
    expect(plan.firstDueDate).toBe('2024-02-01');
    expect(plan.lastDueDate).toBe('2024-11-01');
  });

  it('ปัดยอดต่องวด → เศษไปงวดสุดท้าย ผลรวมยังตรง', () => {
    const plan = buildInstallmentPlan({
      principalOriginal: 10000,
      installmentCount: 3,
      cycle: LoanCycle.DAILY,
      startDate: '2024-01-01',
      totalInterest: 0,
      roundInstallments: true,
    });
    expect(plan.rows.map((r) => r.scheduled)).toEqual([3333, 3333, 3334]);
    expect(sumScheduled(plan.rows)).toBe(10000);
  });

  // เคสจากหน้ารียอด: ต้น 1,400 ผ่อน 13 งวด
  it('กรอกงวดละ 150 × 13 งวด → ทุกงวด 150 พอดี ไม่มีเศษ', () => {
    const per = 150;
    const count = 13;
    const principal = 1400;
    const plan = buildInstallmentPlan({
      principalOriginal: principal,
      installmentCount: count,
      cycle: LoanCycle.DAILY,
      startDate: '2026-08-10',
      // งวดละ × จำนวนงวด แปลงกลับเป็นดอกรวม
      totalInterest: per * count - principal,
      roundInstallments: true,
    });
    expect(plan.installmentTotal).toBe(1950);
    expect(plan.installmentAmount).toBe(150);
    expect(plan.rows.every((r) => r.scheduled === 150)).toBe(true);
    expect(sumScheduled(plan.rows)).toBe(1950);
  });

  it('ดอกรวม 600 + ปัดบาทเต็ม → 153 × 12 งวด งวดสุดท้าย 164', () => {
    const plan = buildInstallmentPlan({
      principalOriginal: 1400,
      installmentCount: 13,
      cycle: LoanCycle.DAILY,
      startDate: '2026-08-10',
      totalInterest: 600,
      roundInstallments: true,
    });
    expect(plan.installmentAmount).toBe(153);
    expect(plan.rows[12].scheduled).toBe(164);
    expect(sumScheduled(plan.rows)).toBe(2000);
  });

  it('ค่าธรรมเนียมถูกรวมในยอดรวมสัญญา', () => {
    const plan = buildInstallmentPlan({
      principalOriginal: 1000,
      installmentCount: 2,
      cycle: LoanCycle.WEEKLY,
      startDate: '2024-01-01',
      totalInterest: 0,
      fee: 100,
    });
    expect(plan.installmentTotal).toBe(1100);
    expect(sumScheduled(plan.rows)).toBe(1100);
  });
});

describe('buildInstallmentPlan (ลดต้นลดดอก / amortized)', () => {
  it('ต้นเท่ากันทุกงวด ดอก 0 เมื่อ rate = 0', () => {
    const plan = buildInstallmentPlan({
      principalOriginal: 12000,
      installmentCount: 12,
      cycle: LoanCycle.DAILY,
      startDate: '2024-01-01',
      amortized: true,
      interestRatePercent: 0,
    });
    expect(plan.interestTotal).toBe(0);
    expect(plan.installmentTotal).toBe(12000);
    expect(plan.rows.every((r) => r.principal === 1000)).toBe(true);
    expect(plan.firstDueDate).toBe('2024-01-02');
    expect(plan.lastDueDate).toBe('2024-01-13');
    expect(sumScheduled(plan.rows)).toBe(12000);
  });

  it('ดอกคิดจากต้นคงเหลือลดลงทุกงวด', () => {
    const plan = buildInstallmentPlan({
      principalOriginal: 10000,
      installmentCount: 2,
      cycle: LoanCycle.MONTHLY,
      startDate: '2024-01-01',
      amortized: true,
      interestRatePercent: 5,
    });
    expect(plan.rows[0]).toMatchObject({ principal: 5000, interest: 500 });
    expect(plan.rows[1]).toMatchObject({ principal: 5000, interest: 250 });
    expect(plan.interestTotal).toBe(750);
    expect(plan.installmentTotal).toBe(10750);
    expect(sumScheduled(plan.rows)).toBe(10750);
  });

  it('ค่าธรรมเนียมบวกที่งวดแรก แต่ installmentAmount ไม่รวม fee', () => {
    const plan = buildInstallmentPlan({
      principalOriginal: 10000,
      installmentCount: 2,
      cycle: LoanCycle.MONTHLY,
      startDate: '2024-01-01',
      amortized: true,
      interestRatePercent: 0,
      fee: 200,
    });
    expect(plan.rows[0].scheduled).toBe(5200);
    expect(plan.rows[1].scheduled).toBe(5000);
    expect(plan.installmentAmount).toBe(5000);
    expect(sumScheduled(plan.rows)).toBe(10200);
  });
});
