import { InterestMode, LoanCycle, LoanStatus } from '../common/enums';
import type { Loan } from '../entities/loan.entity';
import type { LoanCycle as CycleRow } from '../entities/loan-cycle.entity';
import type { Payment } from '../entities/payment.entity';
import { LoansService } from './loans.service';

/**
 * เทสเฉพาะตรรกะที่ไม่แตะฐานข้อมูล (isDueOn / cycleStatusOn)
 * — สร้าง service ด้วย repo ปลอมเพราะเมธอดเหล่านี้อ่านจาก entity ที่ส่งเข้ามาล้วนๆ
 */
const service = new LoansService(null as never, null as never, null as never);

const cycleRow = (dueDate: string, over: Partial<CycleRow> = {}): CycleRow =>
  ({
    id: `c-${dueDate}`,
    loanId: 'L1',
    dueDate,
    interestOverride: null,
    accrued: false,
    accruedAmount: null,
    ...over,
  }) as CycleRow;

const payment = (paidDate: string, interestPaid: number): Payment =>
  ({
    id: `p-${paidDate}-${interestPaid}`,
    loanId: 'L1',
    paidDate,
    amount: interestPaid,
    arrearsPaid: 0,
    interestPaid,
    principalPaid: 0,
    onDeadLoan: false,
  }) as Payment;

const activeLoan = (over: Partial<Loan> = {}): Loan =>
  ({
    id: 'L1',
    status: LoanStatus.ACTIVE,
    cycle: LoanCycle.WEEKLY,
    interestMode: InterestMode.FLOATING,
    principalOriginal: 10_000,
    outstandingPrincipal: 10_000,
    interestRatePercent: 10,
    arrears: 0,
    startDate: '2026-07-06',
    accruedThrough: '2026-07-06',
    deadDate: null,
    deadBalance: null,
    installmentAmount: null,
    installmentCount: null,
    cycles: [],
    payments: [],
    ...over,
  }) as Loan;

describe('LoansService ยอดหนี้สูญ (lossOf / setLoss)', () => {
  const writtenOff = (over: Partial<Loan> = {}) =>
    activeLoan({ status: LoanStatus.BAD_DEBT, ...over });

  it('ยอดปกติที่ตัดหนี้สูญ: ขาดทุน = ต้นคงเหลือ + ยอดค้าง', () => {
    const loan = writtenOff({ outstandingPrincipal: 3_600, arrears: 1_200 });
    expect(service.lossOf(loan)).toBe(4_800);
  });

  it('ยอดตายที่ตัดหนี้สูญ: ขาดทุน = ยอดตายที่ตรึงไว้', () => {
    const loan = writtenOff({
      deadDate: '2026-06-01',
      deadBalance: 4_800,
      outstandingPrincipal: 3_600,
      arrears: 1_200,
    });
    expect(service.lossOf(loan)).toBe(4_800);
  });

  it('แก้ยอดหนี้สูญของยอดตาย → เขียนลง deadBalance (เดิมแก้แล้วไม่ขยับ)', () => {
    const loan = writtenOff({ deadDate: '2026-06-01', deadBalance: 4_800 });
    service.setLoss(loan, 3_800);
    expect(loan.deadBalance).toBe(3_800);
    expect(service.lossOf(loan)).toBe(3_800);
  });

  it('ลดยอดหนี้สูญของยอดปกติ — หักยอดค้างเก่าก่อน แล้วค่อยลดต้น', () => {
    const loan = writtenOff({ outstandingPrincipal: 3_600, arrears: 1_200 });
    service.setLoss(loan, 3_800); // เก็บคืนได้ 1,000
    expect(loan.arrears).toBe(200);
    expect(loan.outstandingPrincipal).toBe(3_600);
    expect(service.lossOf(loan)).toBe(3_800);
  });

  it('ลดเกินยอดค้าง — ส่วนที่เหลือไปลดต้น', () => {
    const loan = writtenOff({ outstandingPrincipal: 3_600, arrears: 1_200 });
    service.setLoss(loan, 3_000);
    expect(loan.arrears).toBe(0);
    expect(loan.outstandingPrincipal).toBe(3_000);
  });

  it('เก็บคืนได้ครบ — ขาดทุนเหลือ 0 ไม่ติดลบ', () => {
    const loan = writtenOff({ outstandingPrincipal: 3_600, arrears: 1_200 });
    service.setLoss(loan, 0);
    expect(loan.arrears).toBe(0);
    expect(loan.outstandingPrincipal).toBe(0);
    expect(service.lossOf(loan)).toBe(0);
  });

  it('แก้ยอดขึ้น (คีย์ต่ำไปตอนแรก) — ส่วนเพิ่มไปเข้าต้น', () => {
    const loan = writtenOff({ outstandingPrincipal: 3_600, arrears: 1_200 });
    service.setLoss(loan, 5_000);
    expect(service.lossOf(loan)).toBe(5_000);
    expect(loan.arrears).toBe(1_200);
    expect(loan.outstandingPrincipal).toBe(3_800);
  });

  it('ลบรายการเก็บคืน — ยอดขาดทุนกลับมาเท่าเดิม', () => {
    const loan = writtenOff({ outstandingPrincipal: 3_600, arrears: 1_200 });
    service.setLoss(loan, service.lossOf(loan) - 1_000);
    service.setLoss(loan, service.lossOf(loan) + 1_000);
    expect(service.lossOf(loan)).toBe(4_800);
  });
});

describe('LoansService.isDueOn', () => {
  it('รายสัปดาห์ = วันเดิมของสัปดาห์ถัดไป (เปิดจันทร์ → ครบกำหนดทุกจันทร์)', () => {
    // 2026-07-06 = วันจันทร์
    const loan = activeLoan({ cycles: [cycleRow('2026-07-13')] });
    expect(service.isDueOn(loan, '2026-07-13')).toBe(true); // จันทร์ถัดไป
    expect(service.isDueOn(loan, '2026-07-14')).toBe(false); // อังคาร
  });

  it('ฉายรอบล่วงหน้าเกินแถวที่สร้างไว้ — ดูวันจันทร์อีก 3 สัปดาห์ข้างหน้าได้', () => {
    const loan = activeLoan({ cycles: [cycleRow('2026-07-13')] });
    expect(service.isDueOn(loan, '2026-08-03')).toBe(true); // +3 สัปดาห์
    expect(service.isDueOn(loan, '2026-08-04')).toBe(false);
  });

  it('เลื่อนวันครบกำหนดแล้ว รอบที่ฉายต่อยึดวันใหม่', () => {
    const loan = activeLoan({ cycles: [cycleRow('2026-07-15')] }); // เลื่อนไปพุธ
    expect(service.isDueOn(loan, '2026-07-22')).toBe(true); // พุธถัดไป
    expect(service.isDueOn(loan, '2026-07-20')).toBe(false);
  });

  it('ยอดเปิดใหม่: วันปล่อยกู้ = วันที่ 1 → งวดแรกครบกำหนดวันปล่อยเลย (รายวัน)', () => {
    // firstDueDate = วันปล่อยกู้, ยังไม่มีแถวรอบดอก (ใช้ fallback)
    const loan = activeLoan({
      cycle: LoanCycle.DAILY,
      startDate: '2026-07-06',
      firstDueDate: '2026-07-06',
      cycles: [],
    });
    expect(service.isDueOn(loan, '2026-07-06')).toBe(true); // วันปล่อยเลย
    expect(service.isDueOn(loan, '2026-07-07')).toBe(true); // วันถัดไปก็ครบ
  });

  it('ยอดเก่า (firstDueDate = null): งวดแรกยังเป็นวันเปิดยอด + 1 รอบ (ไม่ขยับ)', () => {
    const loan = activeLoan({
      cycle: LoanCycle.DAILY,
      startDate: '2026-07-06',
      firstDueDate: null,
      cycles: [],
    });
    expect(service.isDueOn(loan, '2026-07-06')).toBe(false); // วันปล่อยยังไม่เก็บ
    expect(service.isDueOn(loan, '2026-07-07')).toBe(true); // วันถัดไป
  });

  it('ยอดตายที่ไม่ได้ตกลงงวดตายตัว ไม่ถือว่าถึงกำหนดวันไหนเลย', () => {
    const loan = activeLoan({
      status: LoanStatus.DEAD,
      deadDate: '2026-07-01',
      deadBalance: 5_000,
      installmentAmount: null,
    });
    expect(service.isDueOn(loan, '2026-07-11')).toBe(false);
    expect(service.isDueOn(loan, '2026-07-21')).toBe(false);
  });

  it('ยอดตายที่ตกลงงวดไว้ ถึงกำหนดทุก 10 วันนับจากวันแปลง', () => {
    const loan = activeLoan({
      status: LoanStatus.DEAD,
      deadDate: '2026-07-01',
      deadBalance: 5_000,
      installmentAmount: 500,
    });
    expect(service.isDueOn(loan, '2026-07-11')).toBe(true);
    expect(service.isDueOn(loan, '2026-07-12')).toBe(false);
  });
});

describe('LoansService.cycleStatusOn', () => {
  it('ยังไม่จ่าย = เหลือเต็มจำนวน', () => {
    const loan = activeLoan({ cycles: [cycleRow('2026-07-13')] });
    expect(service.cycleStatusOn(loan, '2026-07-13')).toEqual({
      interestDue: 1_000,
      interestPaid: 0,
      interestRemaining: 1_000,
    });
  });

  it('แบ่งส่งเช้าครึ่งเย็นครึ่ง — รวมทุกครั้งที่จ่ายในรอบ', () => {
    const loan = activeLoan({
      cycles: [cycleRow('2026-07-13')],
      payments: [payment('2026-07-13', 400), payment('2026-07-13', 300)],
    });
    expect(service.cycleStatusOn(loan, '2026-07-13')?.interestRemaining).toBe(
      300,
    );
  });

  it('จ่ายล่วงหน้าก่อนถึงวันครบกำหนด นับเข้ารอบนั้น', () => {
    const loan = activeLoan({
      cycles: [cycleRow('2026-07-13')],
      payments: [payment('2026-07-10', 1_000)],
    });
    const s = service.cycleStatusOn(loan, '2026-07-13');
    expect(s?.interestPaid).toBe(1_000);
    expect(s?.interestRemaining).toBe(0);
  });

  it('เงินที่จ่ายไปในรอบก่อนหน้า ไม่ถูกนับซ้ำเข้ารอบนี้', () => {
    const loan = activeLoan({
      cycles: [
        cycleRow('2026-07-13', { accrued: true, accruedAmount: 0 }),
        cycleRow('2026-07-20'),
      ],
      payments: [payment('2026-07-13', 1_000)],
    });
    expect(service.cycleStatusOn(loan, '2026-07-20')?.interestPaid).toBe(0);
  });

  it('ยอดดอกที่ตกลงเก็บจริงชนะยอดที่ระบบคำนวณ', () => {
    const loan = activeLoan({
      cycles: [cycleRow('2026-07-13', { interestOverride: 600 })],
    });
    expect(service.cycleStatusOn(loan, '2026-07-13')?.interestDue).toBe(600);
  });

  it('วันที่ไม่ใช่วันครบกำหนด = null', () => {
    const loan = activeLoan({ cycles: [cycleRow('2026-07-13')] });
    expect(service.cycleStatusOn(loan, '2026-07-14')).toBeNull();
  });

  it('รอบล่วงหน้าที่ยังไม่ได้สร้างแถว คำนวณจากต้นคงเหลือปัจจุบัน', () => {
    const loan = activeLoan({
      cycles: [cycleRow('2026-07-13')],
      payments: [payment('2026-07-13', 1_000)],
    });
    const s = service.cycleStatusOn(loan, '2026-07-20');
    expect(s?.interestDue).toBe(1_000);
    expect(s?.interestPaid).toBe(0); // จ่ายวันที่ 13 อยู่นอกช่วง (13, 20]
  });
});
