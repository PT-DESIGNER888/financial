import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { addDays, todayStr } from '../common/date.util';
import { LoanStatus } from '../common/enums';
import { Debtor } from '../entities/debtor.entity';
import { Loan } from '../entities/loan.entity';
import { LoanCycle } from '../entities/loan-cycle.entity';
import { Payment } from '../entities/payment.entity';
import { round2, splitInstallmentDue } from '../loans/installment-plan';
import { collectionInterestOnDay } from '../loans/interest-appointment';
// re-export ให้เทสเดิมที่ import จาก dashboard.service ใช้ได้ต่อ
export { splitInstallmentDue } from '../loans/installment-plan';
import { LoansService } from '../loans/loans.service';

/** รายการเก็บของยอดกู้หนึ่งก้อนในวันที่เลือก */
export interface DayLoanItem {
  loanId: string;
  contractNumber: string | null;
  status: LoanStatus;
  cycle: string;
  outstandingPrincipal: number;
  deadBalance: number | null;
  /** ยอดค้างสะสมที่ยังไม่พับเข้ายอดวันนี้ — วันนัดคืนต้นพับเข้า dueTotal แล้วเป็น 0 */
  arrears: number;
  dueInterest: number;
  duePrincipal: number;
  dueInstallment: number;
  dueTotal: number;
  paidToday: number;
  remainingToday: number;
  principalDueDate: string | null;
  interestDueDate: string | null;
  interestCycleCount: number | null;
  note: string | null;
}

/** ยอดรวมของลูกหนี้หนึ่งคนในวันที่เลือก (การ์ดหนึ่งใบ = ลูกหนี้หนึ่งคน) */
export interface DayDebtorGroup {
  debtorId: string;
  debtorName: string;
  phone: string | null;
  outstandingPrincipal: number;
  deadBalance: number;
  arrears: number;
  dueInterest: number;
  duePrincipal: number;
  dueInstallment: number;
  dueTotal: number;
  paidToday: number;
  remainingToday: number;
  items: DayLoanItem[];
}

/** แถวยอดค้าง/ยอดตายรายสัญญาในหน้ายอดค้าง */
export interface ArrearsRow {
  loanId: string;
  contractNumber: string | null;
  status: LoanStatus;
  amount: number;
  outstandingPrincipal: number;
  installmentAmount: number | null;
  principalDueDate: string | null;
  principalDueAmount: number | null;
  note: string | null;
}

/**
 * ยอดนัดคืนต้นที่ถึงกำหนดในวันนั้น (0 = ไม่มีนัดวันนี้ หรือไม่เหลือยอดแล้ว)
 * ใช้ได้ทั้งยอดปกติ (หักจากต้นคงเหลือ) และยอดตาย (หักจากยอดที่ตรึงไว้) —
 * ยอดตายที่ไม่มีงวดตายตัวอาศัยนัดคืนต้นนี่แหละเป็นตัวโผล่ในหน้าเก็บวันนี้
 */
export function appointmentDue(
  loan: Pick<
    Loan,
    | 'status'
    | 'outstandingPrincipal'
    | 'deadBalance'
    | 'deadDate'
    | 'installmentCount'
    | 'principalDueDate'
    | 'principalDueAmount'
  >,
  day: string,
): number {
  if (loan.principalDueDate !== day) return 0;
  // ปิดยอด/ตัดหนี้สูญแล้ว ไม่เหลืออะไรให้เก็บตามนัด
  if (loan.status === LoanStatus.CLOSED || loan.status === LoanStatus.BAD_DEBT)
    return 0;
  // ผ่อนงวดมีตารางงวดของตัวเองอยู่แล้ว ไม่ใช้นัดคืนต้น
  if (loan.status === LoanStatus.INSTALLMENT) return 0;
  // ยอดตายดูยอดที่ตรึงไว้ ไม่ใช่ต้นคงเหลือ (ต้นของยอดตายถูกแช่ไว้เฉยๆ ไม่ลดตามที่จ่าย)
  const balance = hasFrozenBalance(loan)
    ? (loan.deadBalance ?? 0)
    : loan.outstandingPrincipal;
  if (!(balance > 0)) return 0;
  return Math.min(loan.principalDueAmount ?? balance, balance);
}

/**
 * ยอดนี้ตรึงยอดคงเหลือไว้ก้อนเดียว (ยอดตาย/ผ่อนงวด) แทนที่จะแยกต้น/ค้าง
 * ดูจาก deadDate/installmentCount ไม่ใช่สถานะ เพราะสถานะเปลี่ยนเป็น CLOSED ได้
 * แต่ต้น/ค้างเดิมยังถูกแช่ค้างไว้ที่ค่าเก่า — อ่านผิดตัวแล้วยอดที่จ่ายจบไปแล้วจะเด้งกลับมา
 */
function hasFrozenBalance(
  loan: Pick<Loan, 'status' | 'deadDate' | 'installmentCount'>,
): boolean {
  return (
    loan.status === LoanStatus.DEAD ||
    loan.status === LoanStatus.INSTALLMENT ||
    loan.deadDate != null ||
    loan.installmentCount != null
  );
}

/**
 * วันนัดคืนต้นของยอดปกติ: รวมดอกค้างเก่าเข้ายอดที่ต้องเก็บวันนี้
 * ให้ขึ้นเป็นก้อนเดียวกับต้น (ลูกค้าเก็บต้น+ดอกค้างพร้อมกัน) — ยอดตาย/ผ่อนงวดไม่พับ
 */
export function foldedArrearsOnAppointment(input: {
  duePrincipal: number;
  frozen: boolean;
  arrears: number;
}): number {
  if (input.frozen || !(input.duePrincipal > 0)) return 0;
  return Math.max(0, input.arrears);
}

/**
 * ดอกที่ใช้โชว์/เก็บในวันที่เลือก
 * - วันนี้เป็นวันครบดอกรอบนี้ → ใช้ดอกรอบวันนี้
 * - วันนัดคืนต้นแต่ดอกรอบนี้ยังไม่ครบกำหนด → ดึงดอกรอบที่กำลังเดินมาเก็บพร้อมต้น
 *   (จ่ายได้ทั้งรอบอยู่แล้ว — หน้าเก็บต้องโชว์ยอดนี้ ไม่งั้นกดรับแล้วดอกถูกหักเงียบ)
 */
export function appointmentInterest(input: {
  duePrincipal: number;
  frozen: boolean;
  todayCycle: { interestDue: number; interestRemaining: number } | null;
  runningCycle: { interestDue: number; interestRemaining: number } | null;
}): { dueInterest: number; remainingInterest: number } {
  if (input.todayCycle) {
    return {
      dueInterest: input.todayCycle.interestDue,
      remainingInterest: input.todayCycle.interestRemaining,
    };
  }
  if (input.duePrincipal > 0 && !input.frozen && input.runningCycle) {
    return {
      dueInterest: input.runningCycle.interestDue,
      remainingInterest: input.runningCycle.interestRemaining,
    };
  }
  return { dueInterest: 0, remainingInterest: 0 };
}

/**
 * ยอดที่ยังต้องเก็บของวันนั้น หลังหักเงินที่รับมาแล้ว
 *
 * ผ่อนงวดต้องแยกออกมา เพราะ dueNow ของตารางผ่อนหักเงินที่จ่ายมาแล้ว "ทั้งหมด"
 * (รวมของวันนี้และที่จ่ายล่วงหน้า) ให้เรียบร้อยแล้ว — เอามาลบเงินของวันนี้ซ้ำอีก
 * จะกลายเป็น 0 ทั้งที่ยังเก็บไม่ครบ แล้วยอดจะหายไปจากรายการ "ยังไม่จ่าย"
 * ส่วนยอดตาย/นัดคืนต้นเป็นยอดที่ตกลงไว้ตายตัว ต้องหักเงินของวันนั้นเอง
 */
export function remainingBalanceOnDay(input: {
  status: LoanStatus;
  duePrincipal: number;
  dueInstallment: number;
  /** ผ่อนงวด: ยอดค้างสุทธิจากตารางผ่อน (หักที่จ่ายมาแล้วทั้งหมดให้แล้ว) */
  installmentDueNow: number;
  paidTowardBalance: number;
}): number {
  if (input.status === LoanStatus.INSTALLMENT) return input.installmentDueNow;
  return Math.max(
    0,
    round2(input.duePrincipal + input.dueInstallment - input.paidTowardBalance),
  );
}

/**
 * ยอดกู้นี้เข้าช่องไหนของหน้ายอดค้าง (null = ไม่เข้าหน้านี้)
 * - ยอดปกติ → ดอกที่ค้างสะสม
 * - ผ่อนงวด (จบต้นจบดอก) → เฉพาะ "งวดที่ค้าง" เท่านั้น ไม่ใช่ยอดตาย
 *   งวดที่ยังไม่ถึงกำหนดเป็นแผนผ่อนปกติ ดูที่หน้าสัญญา/ลูกหนี้
 * - ยอดตาย → ยอดที่ตรึงไว้ทั้งก้อน
 */
export function arrearsBucket(
  loan: Pick<Loan, 'status' | 'arrears' | 'deadBalance'>,
  /** ผ่อนงวด: งวดที่ "เลยกำหนด" แล้วยังไม่จ่าย — งวดของวันนี้ยังไม่ถือว่าค้าง */
  installmentOverdue: number,
): { bucket: 'ARREARS' | 'DEAD'; amount: number } | null {
  if (loan.status === LoanStatus.ACTIVE)
    return loan.arrears > 0
      ? { bucket: 'ARREARS', amount: loan.arrears }
      : null;
  if (loan.status === LoanStatus.INSTALLMENT)
    return installmentOverdue > 0
      ? { bucket: 'ARREARS', amount: installmentOverdue }
      : null;
  if (loan.status === LoanStatus.DEAD && (loan.deadBalance ?? 0) > 0)
    return { bucket: 'DEAD', amount: loan.deadBalance ?? 0 };
  return null;
}

/** ยอดค้าง/ยอดตายรวมของลูกหนี้หนึ่งคน */
export interface ArrearsGroup {
  debtorId: string;
  debtorName: string;
  phone: string | null;
  total: number;
  rows: ArrearsRow[];
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Loan) private loans: Repository<Loan>,
    @InjectRepository(Payment) private payments: Repository<Payment>,
    @InjectRepository(Debtor) private debtors: Repository<Debtor>,
    @InjectRepository(LoanCycle) private cycles: Repository<LoanCycle>,
    private loansService: LoansService,
  ) {}

  /**
   * ยอดกู้ที่เกี่ยวข้องกับวันที่เลือก = ยอดที่ยังเปิดอยู่ + ยอดที่ปิด/ตัดหนี้สูญไปแล้ว
   * แต่มีเงินเข้าในวันนั้น (ลูกหนี้ปิดยอดวันนี้ต้องยังนับเป็นเงินที่เก็บได้วันนี้)
   *
   * โหลด debtor กับ loan ก่อน แล้ว batch โหลด payments/cycles เฉพาะช่วงที่ dayItem ใช้
   * (ไม่ดึงประวัติทั้งตาราง) — debtorId = จำกัดเฉพาะลูกหนี้คนเดียว (หน้าบิล)
   */
  private async loansForDay(day: string, debtorId?: string): Promise<Loan[]> {
    const openPromise = this.loans.find({
      where: {
        status: In([
          LoanStatus.ACTIVE,
          LoanStatus.DEAD,
          LoanStatus.INSTALLMENT,
        ]),
        ...(debtorId ? { debtorId } : {}),
      },
      relations: { debtor: true },
      relationLoadStrategy: 'query',
    });

    // หา loanId ที่มีเงินเข้าวันนี้ แต่ไม่อยู่ใน open (ปิด/หนี้สูญแล้ว)
    const paidLoanIdsPromise: Promise<string[]> = debtorId
      ? this.payments
          .createQueryBuilder('p')
          .select('DISTINCT p.loanId', 'loanId')
          .innerJoin('p.loan', 'l')
          .where('p.paidDate = :day', { day })
          .andWhere('l.debtorId = :debtorId', { debtorId })
          .getRawMany<{ loanId: string }>()
          .then((rows) => rows.map((r) => r.loanId))
      : this.payments
          .find({
            where: { paidDate: day },
            select: { loanId: true, id: true },
          })
          .then((rows) => rows.map((p) => p.loanId));

    const [open, paidLoanIds] = await Promise.all([
      openPromise,
      paidLoanIdsPromise,
    ]);
    const openIds = new Set(open.map((l) => l.id));

    const settledIds = [
      ...new Set(paidLoanIds.filter((id) => !openIds.has(id))),
    ];
    let settled: Loan[] = [];
    if (settledIds.length > 0) {
      settled = await this.loans.find({
        where: { id: In(settledIds) },
        relations: { debtor: true },
        relationLoadStrategy: 'query',
      });
    }
    const loans = [...open, ...settled];
    await this.attachDayRelations(loans, day);
    return loans;
  }

  /**
   * แปะ payments/cycles ที่ dayItem + cycleStatusOn / currentCycleInfo / นัดดอก ต้องใช้
   * — payments ของวันนั้นทุกยอด + ช่วงรอบดอกของ ACTIVE
   * — cycles ที่ยังไม่สะสม + รอบสะสมล่าสุดต่อสัญญา + รอบของวันนั้น
   */
  private async attachDayRelations(loans: Loan[], day: string): Promise<void> {
    if (loans.length === 0) return;
    const ids = loans.map((l) => l.id);
    const activeIds = loans
      .filter((l) => l.status === LoanStatus.ACTIVE)
      .map((l) => l.id);

    // เพดานวัน = วันดู หรือวันนัดดอกที่ไกลกว่า (นัดคลุมหลายรอบ)
    let ceil = day;
    for (const l of loans) {
      if (l.interestDueDate && l.interestDueDate > ceil)
        ceil = l.interestDueDate;
    }

    // คิวรีอิสระชุดแรกยิงพร้อมกัน ลดเวลารอฐานข้อมูลระยะไกล
    const lastAccruedPromise =
      activeIds.length > 0
        ? this.cycles
            .createQueryBuilder('c')
            .select('c.loanId', 'loanId')
            .addSelect('MAX(c.dueDate)', 'dueDate')
            .where('c.loanId IN (:...ids)', { ids: activeIds })
            .andWhere('c.accrued = :accrued', { accrued: true })
            .groupBy('c.loanId')
            .getRawMany<{ loanId: string; dueDate: string }>()
        : Promise.resolve([] as { loanId: string; dueDate: string }[]);
    // วันย้อนหลังต้องมีรอบก่อนหน้าของ "วันนั้น" เพื่อแบ่งหน้าต่างการจ่ายถูกต้อง
    // ไม่ใช่ใช้รอบสะสมล่าสุด ณ วันนี้ ซึ่งอาจอยู่หลังวันที่กำลังเปิดดู
    const previousDuePromise =
      activeIds.length > 0
        ? this.cycles
            .createQueryBuilder('c')
            .select('c.loanId', 'loanId')
            .addSelect('MAX(c.dueDate)', 'dueDate')
            .where('c.loanId IN (:...ids)', { ids: activeIds })
            .andWhere('c.dueDate < :day', { day })
            .groupBy('c.loanId')
            .getRawMany<{ loanId: string; dueDate: string }>()
        : Promise.resolve([] as { loanId: string; dueDate: string }[]);
    const dayPaysPromise = this.payments.find({
      where: { loanId: In(ids), paidDate: day },
    });
    const pendingOrDayPromise =
      activeIds.length > 0
        ? this.cycles
            .createQueryBuilder('c')
            .where('c.loanId IN (:...ids)', { ids: activeIds })
            .andWhere('(c.accrued = :no OR c.dueDate = :day)', {
              no: false,
              day,
            })
            .getMany()
        : Promise.resolve([] as LoanCycle[]);

    const [lastAccruedRaw, previousDueRaw, dayPays, pendingOrDay] =
      await Promise.all([
        lastAccruedPromise,
        previousDuePromise,
        dayPaysPromise,
        pendingOrDayPromise,
      ]);
    const lastAccruedDue = new Map(
      lastAccruedRaw.map((r) => [r.loanId, r.dueDate]),
    );
    const previousDue = new Map(
      previousDueRaw.map((r) => [r.loanId, r.dueDate]),
    );

    let paymentFloor = day;
    for (const l of loans) {
      if (l.status !== LoanStatus.ACTIVE) continue;
      const candidates = [
        lastAccruedDue.get(l.id),
        previousDue.get(l.id),
        addDays(l.startDate, -1),
      ].filter((d): d is string => Boolean(d));
      const ws = candidates.reduce((min, d) => (d < min ? d : min));
      if (ws < paymentFloor) paymentFloor = ws;
    }

    // คิวรีชุดที่สองพึ่งค่ารอบล่าสุด แต่ไม่พึ่งกันเอง จึงยิงพร้อมกันได้
    const windowPaysPromise =
      activeIds.length > 0 && paymentFloor <= ceil
        ? this.payments
            .createQueryBuilder('p')
            .where('p.loanId IN (:...ids)', { ids: activeIds })
            .andWhere('p.paidDate > :floor', { floor: paymentFloor })
            .andWhere('p.paidDate <= :ceil', { ceil })
            .andWhere('p.onDeadLoan = :dead', { dead: false })
            .getMany()
        : Promise.resolve([] as Payment[]);

    const contextDueList = [
      ...lastAccruedDue.entries(),
      ...previousDue.entries(),
    ].filter(
      ([loanId, dueDate], index, rows) =>
        rows.findIndex(([l, d]) => l === loanId && d === dueDate) === index,
    );
    const contextRowsPromise =
      activeIds.length > 0 && contextDueList.length > 0
        ? this.cycles
            .createQueryBuilder('c')
            .where('c.loanId IN (:...ids)', { ids: activeIds })
            .andWhere(
              contextDueList
                .map((_, i) => `(c.loanId = :lid${i} AND c.dueDate = :ld${i})`)
                .join(' OR '),
              Object.fromEntries(
                contextDueList.flatMap(([lid, d], i) => [
                  [`lid${i}`, lid],
                  [`ld${i}`, d],
                ]),
              ),
            )
            .getMany()
        : Promise.resolve([] as LoanCycle[]);

    const [windowPays, contextRows] = await Promise.all([
      windowPaysPromise,
      contextRowsPromise,
    ]);

    const paysByLoan = new Map<string, Payment[]>();
    const pushPay = (p: Payment) => {
      const arr = paysByLoan.get(p.loanId) ?? [];
      if (!arr.some((x) => x.id === p.id)) arr.push(p);
      paysByLoan.set(p.loanId, arr);
    };
    for (const p of dayPays) pushPay(p);
    for (const p of windowPays) pushPay(p);

    // cycles: ยังไม่สะสมทั้งก้อน + รอบของวันนั้น + รอบอ้างอิงก่อนหน้า
    const cyclesByLoan = new Map<string, LoanCycle[]>();
    if (activeIds.length > 0) {
      const pushCycle = (c: LoanCycle) => {
        const arr = cyclesByLoan.get(c.loanId) ?? [];
        if (!arr.some((x) => x.id === c.id)) arr.push(c);
        cyclesByLoan.set(c.loanId, arr);
      };
      for (const c of pendingOrDay) pushCycle(c);
      for (const c of contextRows) pushCycle(c);
    }

    for (const loan of loans) {
      loan.payments = paysByLoan.get(loan.id) ?? [];
      loan.cycles = cyclesByLoan.get(loan.id) ?? [];
    }
  }

  /** ยอดที่ต้องเก็บของยอดกู้หนึ่งก้อนในวันที่เลือก (ยอดค้างแยกออก ไม่รวมใน dueTotal) */
  private dayItem(loan: Loan, day: string): DayLoanItem {
    // ดูจากชนิดยอด ไม่ใช่สถานะ — ยอดตายที่ปิดไปแล้วยังต้องอ่าน deadBalance อยู่
    const frozen = hasFrozenBalance(loan);

    const duePrincipal = appointmentDue(loan, day);

    const weekly = appointmentInterest({
      duePrincipal,
      frozen,
      todayCycle: this.loansService.cycleStatusOn(loan, day),
      runningCycle: this.loansService.currentCycleInfo(loan, day),
    });
    const appt = frozen
      ? null
      : this.loansService.interestAppointmentQuote(loan);
    const { dueInterest, remainingInterest } = collectionInterestOnDay({
      interestDueDate: loan.interestDueDate,
      day,
      isCycleDue: !!this.loansService.cycleStatusOn(loan, day),
      agreedDue: appt?.agreedAmount ?? 0,
      agreedRemaining: appt?.remaining ?? 0,
      weeklyDue: weekly.dueInterest,
      weeklyRemaining: weekly.remainingInterest,
    });

    // ยอดตาย/ผ่อนงวดที่ถึงกำหนดวันนี้
    // มีนัดคืนต้นวันเดียวกัน = ยึดตามที่นัด (นัดคือข้อตกลงเฉพาะวันนั้น ไม่บวกซ้ำกับงวด)
    let dueInstallment = 0;
    let installmentDueNow = 0;
    let installmentArrears = 0;
    if (frozen && duePrincipal > 0) {
      dueInstallment = 0;
    } else if (loan.status === LoanStatus.DEAD) {
      if (this.loansService.isDueOn(loan, day)) {
        dueInstallment = Math.min(
          loan.installmentAmount ?? 0,
          loan.deadBalance ?? 0,
        );
      }
    } else if (loan.status === LoanStatus.INSTALLMENT) {
      const sch = this.loansService.buildInstallmentSchedule(loan, day);
      const split = splitInstallmentDue(sch?.rows ?? [], day);
      installmentArrears = split.overdue;
      installmentDueNow = split.dueToday;
      // ยอดเต็มของวัน = งวดที่ครบกำหนดวันนั้น (ไม่รวมงวดค้างเก่า)
      // ต้องใช้ยอดเต็ม ไม่ใช่ยอดสุทธิ ไม่งั้นงวดที่จ่ายล่วงหน้ามาแล้วจะหาย
      // จากหน้าเก็บวันนี้ทั้งที่ถึงกำหนดวันนั้น
      dueInstallment = split.scheduledToday;
    }

    // ยอดตาย/ผ่อนงวดรับเป็นเงินก้อนเดียว (onDeadLoan) ยอดปกติดูเฉพาะส่วนที่ตัดต้น
    const paidTowardBalance = (loan.payments ?? [])
      .filter((p) => p.paidDate === day && p.onDeadLoan === frozen)
      .reduce((s, p) => s + (frozen ? p.amount : p.principalPaid), 0);
    const remainingBalanceDue = remainingBalanceOnDay({
      status: loan.status,
      duePrincipal,
      dueInstallment,
      installmentDueNow,
      paidTowardBalance,
    });

    const paidToday = round2(
      (loan.payments ?? [])
        .filter((p) => p.paidDate === day)
        .reduce((s, p) => s + p.amount, 0),
    );

    const foldedArrears = foldedArrearsOnAppointment({
      duePrincipal,
      frozen,
      arrears: loan.arrears,
    });
    const arrearsPaidToday = round2(
      (loan.payments ?? [])
        .filter((p) => p.paidDate === day && !p.onDeadLoan)
        .reduce((s, p) => s + p.arrearsPaid, 0),
    );
    const remainingFoldedArrears = Math.max(
      0,
      round2(foldedArrears - arrearsPaidToday),
    );
    // ผ่อนงวด: งวดที่เลยกำหนดแล้วยังไม่จ่าย (แยกจากงวดของวันนี้)
    // ยอดตาย: ต้น/ค้างเดิมถูกตรึงเข้า deadBalance แล้ว ไม่นับซ้ำ
    // วันนัดคืนต้น: พับดอกค้างเข้ายอดวันนี้แล้ว ไม่โชว์ซ้ำที่แบนเนอร์ค้างเก่า
    const bannerArrears =
      loan.status === LoanStatus.INSTALLMENT
        ? installmentArrears
        : loan.status === LoanStatus.DEAD
          ? 0
          : foldedArrears > 0
            ? 0
            : loan.arrears;

    return {
      loanId: loan.id,
      contractNumber: loan.contractNumber,
      status: loan.status,
      cycle: loan.cycle,
      outstandingPrincipal: loan.outstandingPrincipal,
      deadBalance: loan.deadBalance,
      arrears: bannerArrears,
      dueInterest,
      duePrincipal,
      dueInstallment,
      dueTotal: round2(
        dueInterest + duePrincipal + dueInstallment + foldedArrears,
      ),
      paidToday,
      remainingToday: round2(
        remainingInterest + remainingBalanceDue + remainingFoldedArrears,
      ),
      principalDueDate: loan.principalDueDate,
      interestDueDate: loan.interestDueDate,
      interestCycleCount: appt?.cycles.length ?? null,
      note: loan.note,
    };
  }

  /** จัดกลุ่มรายการเก็บของวันที่เลือกตามลูกหนี้ — หนึ่งคนเห็นยอดรวมทีเดียว */
  private groupByDebtor(
    loans: Loan[],
    items: Map<string, DayLoanItem>,
  ): DayDebtorGroup[] {
    const groups = new Map<string, DayDebtorGroup>();
    for (const loan of loans) {
      const item = items.get(loan.id);
      if (!item) continue;
      let g = groups.get(loan.debtorId);
      if (!g) {
        g = {
          debtorId: loan.debtorId,
          debtorName: loan.debtor?.name ?? '',
          phone: loan.debtor?.phone ?? null,
          outstandingPrincipal: 0,
          deadBalance: 0,
          arrears: 0,
          dueInterest: 0,
          duePrincipal: 0,
          dueInstallment: 0,
          dueTotal: 0,
          paidToday: 0,
          remainingToday: 0,
          items: [],
        };
        groups.set(loan.debtorId, g);
      }
      const frozen =
        loan.status === LoanStatus.DEAD ||
        loan.status === LoanStatus.INSTALLMENT;
      g.outstandingPrincipal = round2(
        g.outstandingPrincipal + (frozen ? 0 : item.outstandingPrincipal),
      );
      g.deadBalance = round2(
        g.deadBalance + (frozen ? (item.deadBalance ?? 0) : 0),
      );
      g.arrears = round2(g.arrears + item.arrears);
      g.dueInterest = round2(g.dueInterest + item.dueInterest);
      g.duePrincipal = round2(g.duePrincipal + item.duePrincipal);
      g.dueInstallment = round2(g.dueInstallment + item.dueInstallment);
      g.dueTotal = round2(g.dueTotal + item.dueTotal);
      g.paidToday = round2(g.paidToday + item.paidToday);
      g.remainingToday = round2(g.remainingToday + item.remainingToday);
      g.items.push(item);
    }
    return [...groups.values()];
  }

  /**
   * รายการเก็บของวันที่เลือก จัดกลุ่มตามลูกหนี้
   * - ยอดค้างสะสมโดยทั่วไปไม่รวมใน "ต้องเก็บวันนี้" (ดูแยกที่หน้ายอดค้าง)
   *   ยกเว้นวันนัดคืนต้นของยอดปกติ — พับดอกค้าง + ดอกรอบที่กำลังเดิน เข้ายอดวันนี้ให้เก็บเป็นก้อนเดียวกับต้น
   * - เลือกวันล่วงหน้า/ย้อนหลังได้ เพื่อดูว่าวันจันทร์/อังคาร… มีใครต้องส่งบ้าง
   */
  async today(date?: string) {
    const day = date ?? todayStr();
    await this.loansService.accrueAllActive();
    const loans = await this.loansForDay(day);

    const items = new Map<string, DayLoanItem>();
    for (const loan of loans) {
      const item = this.dayItem(loan, day);
      // เข้าหน้านี้เมื่อมียอดถึงกำหนดวันนั้น หรือมีเงินเข้าแล้ววันนั้น
      if (item.dueTotal > 0 || item.paidToday > 0) items.set(loan.id, item);
    }

    const debtors = this.groupByDebtor(loans, items).sort(
      (a, b) => b.remainingToday - a.remainingToday || b.dueTotal - a.dueTotal,
    );
    const sum = (pick: (g: DayDebtorGroup) => number) =>
      round2(debtors.reduce((s, g) => s + pick(g), 0));

    return {
      date: day,
      isToday: day === todayStr(),
      debtors,
      totals: {
        dueTotal: sum((g) => g.dueTotal),
        paidToday: sum((g) => g.paidToday),
        remainingToday: sum((g) => g.remainingToday),
        arrears: sum((g) => g.arrears),
        debtorCount: debtors.length,
        unpaidCount: debtors.filter((g) => g.remainingToday > 0).length,
        paidCount: debtors.filter((g) => g.remainingToday <= 0).length,
      },
      allOpen: loans.filter((l) => l.status !== LoanStatus.CLOSED).length,
    };
  }

  /** บิลของลูกหนี้หนึ่งคนในวันที่เลือก — สำหรับแคปส่งให้ลูกหนี้ */
  async bill(debtorId: string, date?: string) {
    const day = date ?? todayStr();
    const debtor = await this.debtors.findOne({ where: { id: debtorId } });
    if (!debtor) throw new NotFoundException('ไม่พบลูกหนี้');
    await this.loansService.accrueAllActive();

    const loans = await this.loansForDay(day, debtorId);
    const items = new Map<string, DayLoanItem>();
    for (const loan of loans) items.set(loan.id, this.dayItem(loan, day));
    const group = this.groupByDebtor(loans, items)[0] ?? null;

    // ยอดค้าง/ยอดตายทั้งหมดของลูกหนี้ (แจ้งท้ายบิล) — รวมยอดที่ไม่ได้ถึงกำหนดวันนี้
    const all = await this.loans.find({
      where: {
        debtorId,
        status: In([
          LoanStatus.ACTIVE,
          LoanStatus.DEAD,
          LoanStatus.INSTALLMENT,
        ]),
      },
    });
    const arrearsTotal = round2(
      all
        .filter((l) => l.status === LoanStatus.ACTIVE)
        .reduce((s, l) => s + l.arrears, 0),
    );
    const installmentLoans = all.filter(
      (l) => l.status === LoanStatus.INSTALLMENT,
    );
    const installmentBalance = round2(
      installmentLoans.reduce((s, l) => s + (l.deadBalance ?? 0), 0),
    );
    // งวดผ่อนที่เลยกำหนดแล้ว — เป็นส่วนหนึ่งของยอดผ่อนคงเหลือ ไม่บวกซ้ำในยอดรวม
    const installmentOverdue = round2(
      installmentLoans.reduce((s, l) => {
        const sch = this.loansService.buildInstallmentSchedule(l, day);
        return s + splitInstallmentDue(sch?.rows ?? [], day).overdue;
      }, 0),
    );
    const deadTotal = round2(
      all
        .filter((l) => l.status === LoanStatus.DEAD)
        .reduce((s, l) => s + (l.deadBalance ?? 0), 0),
    );
    const principalTotal = round2(
      all
        .filter((l) => l.status === LoanStatus.ACTIVE)
        .reduce((s, l) => s + l.outstandingPrincipal, 0),
    );

    return {
      date: day,
      debtorId,
      debtorName: debtor.name,
      phone: debtor.phone,
      items: group?.items ?? [],
      dueInterest: group?.dueInterest ?? 0,
      duePrincipal: group?.duePrincipal ?? 0,
      dueInstallment: group?.dueInstallment ?? 0,
      dueTotal: group?.dueTotal ?? 0,
      paidToday: group?.paidToday ?? 0,
      remainingToday: group?.remainingToday ?? 0,
      outstandingPrincipal: principalTotal,
      arrearsTotal,
      installmentBalance,
      /** ส่วนของยอดผ่อนคงเหลือที่เลยกำหนดแล้ว (อยู่ใน installmentBalance แล้ว) */
      installmentOverdue,
      deadTotal,
      /** ยอดคงเหลือทั้งหมดที่ลูกหนี้ยังติดอยู่ (ไม่มีส่วนไหนนับซ้ำ) */
      balanceTotal: round2(
        principalTotal + arrearsTotal + installmentBalance + deadTotal,
      ),
    };
  }

  /**
   * หน้ายอดค้าง — แยกจากหน้าเก็บวันนี้
   * แบ่งสองส่วน: ค้างจ่าย (ดอกที่ถึงกำหนดแล้วไม่ได้จ่าย + งวดผ่อนค้าง)
   * และยอดตาย (ตรึงยอดไว้ ทยอยคืนแบบไม่มีกำหนดตายตัว)
   */
  async arrears() {
    await this.loansService.accrueAllActive();
    const today = todayStr();
    const loans = await this.loans.find({
      where: {
        status: In([
          LoanStatus.ACTIVE,
          LoanStatus.DEAD,
          LoanStatus.INSTALLMENT,
        ]),
      },
      relations: { debtor: true },
      relationLoadStrategy: 'query',
    });

    const collect = (
      picked: { loan: Loan; amount: number }[],
    ): ArrearsGroup[] => {
      const groups = new Map<string, ArrearsGroup>();
      for (const { loan, amount } of picked) {
        let g = groups.get(loan.debtorId);
        if (!g) {
          g = {
            debtorId: loan.debtorId,
            debtorName: loan.debtor?.name ?? '',
            phone: loan.debtor?.phone ?? null,
            total: 0,
            rows: [],
          };
          groups.set(loan.debtorId, g);
        }
        g.total = round2(g.total + amount);
        g.rows.push({
          loanId: loan.id,
          contractNumber: loan.contractNumber,
          status: loan.status,
          amount,
          outstandingPrincipal: loan.outstandingPrincipal,
          installmentAmount: loan.installmentAmount,
          principalDueDate: loan.principalDueDate,
          principalDueAmount: loan.principalDueAmount,
          note: loan.note,
        });
      }
      return [...groups.values()].sort((a, b) => b.total - a.total);
    };

    const overdue: { loan: Loan; amount: number }[] = [];
    const dead: { loan: Loan; amount: number }[] = [];
    for (const loan of loans) {
      // เฉพาะงวดที่เลยกำหนดแล้ว — งวดของวันนี้ไปโผล่ที่หน้าเก็บวันนี้แทน
      const installmentOverdue =
        loan.status === LoanStatus.INSTALLMENT
          ? splitInstallmentDue(
              this.loansService.buildInstallmentSchedule(loan, today)?.rows ??
                [],
              today,
            ).overdue
          : 0;
      const slot = arrearsBucket(loan, installmentOverdue);
      if (!slot) continue;
      (slot.bucket === 'DEAD' ? dead : overdue).push({
        loan,
        amount: slot.amount,
      });
    }

    const overdueGroups = collect(overdue);
    const deadGroups = collect(dead);
    const sumOf = (gs: ArrearsGroup[]) =>
      round2(gs.reduce((s, g) => s + g.total, 0));

    return {
      arrears: {
        debtors: overdueGroups,
        total: sumOf(overdueGroups),
        debtorCount: overdueGroups.length,
      },
      dead: {
        debtors: deadGroups,
        total: sumOf(deadGroups),
        debtorCount: deadGroups.length,
      },
      grandTotal: round2(sumOf(overdueGroups) + sumOf(deadGroups)),
    };
  }

  /** สรุปภาพรวมธุรกิจ */
  async summary() {
    await this.loansService.accrueAllActive();
    const loans = await this.loans.find({
      select: {
        id: true,
        status: true,
        principalOriginal: true,
        outstandingPrincipal: true,
        arrears: true,
        deadBalance: true,
        deadDate: true,
        installmentCount: true,
      },
    });
    const payAgg = await this.payments
      .createQueryBuilder('p')
      .select(
        'COALESCE(SUM(p.interestPaid + p.arrearsPaid), 0)',
        'interestCollected',
      )
      .addSelect('COALESCE(SUM(p.principalPaid), 0)', 'principalCollected')
      .getRawOne<{
        interestCollected: string;
        principalCollected: string;
      }>();

    const active = loans.filter((l) => l.status === LoanStatus.ACTIVE);
    const dead = loans.filter((l) => l.status === LoanStatus.DEAD);
    const installment = loans.filter(
      (l) => l.status === LoanStatus.INSTALLMENT,
    );
    const badDebtLoans = loans.filter((l) => l.status === LoanStatus.BAD_DEBT);

    const interestCollected =
      parseFloat(String(payAgg?.interestCollected ?? 0)) || 0;
    // ยอดที่ตัดหนี้สูญ = ผลขาดทุนที่ยังเก็บไม่ได้ (หักส่วนที่เก็บคืนได้ทีหลังแล้ว)
    const badDebt = round2(
      badDebtLoans.reduce((s, l) => s + this.loansService.lossOf(l), 0),
    );
    // เงินที่เก็บคืนได้จากยอดที่ตัดหนี้สูญไปแล้ว — ทำให้ขาดทุนจริงน้อยกว่าที่ตัดไว้
    // ใช้ onDeadLoan ของ BAD_DEBT เท่านั้น — คำนวณจาก payments ของ bad debt ids
    const badDebtIds = new Set(badDebtLoans.map((l) => l.id));
    let badDebtRecovered = 0;
    if (badDebtIds.size > 0) {
      const recovered = await this.payments
        .createQueryBuilder('p')
        .select('COALESCE(SUM(p.amount), 0)', 'total')
        .where('p.onDeadLoan = true')
        .andWhere('p.loanId IN (:...ids)', { ids: [...badDebtIds] })
        .getRawOne<{ total: string }>();
      badDebtRecovered = round2(parseFloat(String(recovered?.total ?? 0)) || 0);
    }

    return {
      totalPrincipalReleased: loans.reduce(
        (s, l) => s + l.principalOriginal,
        0,
      ),
      outstandingPrincipal: active.reduce(
        (s, l) => s + l.outstandingPrincipal,
        0,
      ),
      totalArrears: active.reduce((s, l) => s + l.arrears, 0),
      deadBalance: dead.reduce((s, l) => s + (l.deadBalance ?? 0), 0),
      installmentBalance: installment.reduce(
        (s, l) => s + (l.deadBalance ?? 0),
        0,
      ),
      badDebt,
      badDebtRecovered,
      interestCollected,
      principalCollected:
        parseFloat(String(payAgg?.principalCollected ?? 0)) || 0,
      // กำไรสุทธิ = ดอก+ค้างที่เก็บได้ − หนี้สูญ
      netProfit: interestCollected - badDebt,
      counts: {
        activeLoans: active.length,
        deadLoans: dead.length,
        installmentLoans: installment.length,
        closedLoans: loans.filter((l) => l.status === LoanStatus.CLOSED).length,
        badDebtLoans: badDebtLoans.length,
      },
    };
  }
}
