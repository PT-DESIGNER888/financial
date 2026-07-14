import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityService } from '../activity/activity.service';
import { addDays, addMonths, diffDays, todayStr } from '../common/date.util';
import { Loan, LoanCycle } from '../entities/loan.entity';

/** จำนวนวันต่อรอบ (MONTHLY ใช้เลขเดือนแทน — ดู dueDateAt) */
const cycleStep: Record<Exclude<LoanCycle, 'MONTHLY'>, number> = {
  DAILY: 1,
  WEEKLY: 7,
  TEN_DAY: 10,
};

/** วันครบกำหนดงวดที่ k (k เริ่ม 1) นับจากวันครบกำหนดงวดแรก */
function dueDateAt(firstDue: string, cycle: LoanCycle, k: number): string {
  if (cycle === 'MONTHLY') return addMonths(firstDue, k - 1);
  return addDays(firstDue, (k - 1) * cycleStep[cycle]);
}

/** วันครบกำหนดงวดแรกอัตโนมัติ = วันเปิดยอด + 1 รอบ */
function defaultFirstDue(startDate: string, cycle: LoanCycle): string {
  if (cycle === 'MONTHLY') return addMonths(startDate, 1);
  return addDays(startDate, cycleStep[cycle]);
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

@Injectable()
export class LoansService {
  constructor(
    @InjectRepository(Loan) private loans: Repository<Loan>,
    private activity: ActivityService,
  ) {}

  /** ดอกต่อรอบ (ปัดเป็นบาทเต็ม)
   *  FLOATING = จากต้นคงเหลือ (ลดเมื่อตัดต้น), FLAT = จากต้นเดิมคงที่ */
  interestPerCycle(loan: Loan): number {
    const base =
      loan.interestMode === 'FLAT'
        ? loan.principalOriginal
        : loan.outstandingPrincipal;
    return Math.round((base * loan.interestRatePercent) / 100);
  }

  /** วันที่ d เป็นวันครบกำหนดของยอดนี้ไหม */
  isDueOn(loan: Loan, d: string): boolean {
    if (loan.status === 'CLOSED' || loan.status === 'BAD_DEBT') return false;
    if (loan.status === 'DEAD') {
      if (!loan.deadDate) return false;
      const diff = diffDays(loan.deadDate, d);
      return diff > 0 && diff % 10 === 0;
    }
    if (loan.status === 'INSTALLMENT') {
      const n = loan.installmentCount ?? 0;
      const firstDue =
        loan.firstDueDate ?? defaultFirstDue(loan.startDate, loan.cycle);
      for (let k = 1; k <= n; k++) {
        const c = diffDays(dueDateAt(firstDue, loan.cycle, k), d);
        if (c === 0) return true;
        if (c < 0) return false; // งวดถัดๆ ไปยิ่งไกลกว่า d — เลิกหา
      }
      return false;
    }
    const diff = diffDays(loan.startDate, d);
    if (diff <= 0) return false;
    return loan.cycle === 'DAILY' ? true : diff % 10 === 0;
  }

  /** ยอดผ่อนงวดใช่ไหม (ตรวจจาก installmentCount ที่ตั้งไว้ตอนเปิดยอด — คงอยู่แม้ปิด) */
  isInstallment(loan: Loan): boolean {
    return loan.installmentCount != null;
  }

  /**
   * ตารางผ่อน (amortization schedule) ของยอดผ่อนงวด
   * แต่ละงวดเท่ากัน (งวดสุดท้ายซับเศษ), จัดสรรเงินที่ผ่อนมาแล้วแบบไล่งวด
   * เพื่อบอกงวดที่จ่ายแล้ว/ค้าง และยอดที่ถึงกำหนด ณ วันนี้ (รวมงวดค้าง)
   */
  buildInstallmentSchedule(loan: Loan, asOf: string = todayStr()) {
    if (loan.installmentCount == null || loan.installmentTotal == null) {
      return null;
    }
    const n = loan.installmentCount;
    const total = loan.installmentTotal;
    const remaining = loan.deadBalance ?? 0;
    const paidTotal = Math.max(0, round2(total - remaining));

    // แผนต่องวด: ลดต้นลดดอกสร้างใหม่จากเงื่อนไข (deterministic), ดอกคงที่ใช้งวดที่ตรึงไว้
    let planRows: PlanRow[];
    if (loan.amortized) {
      planRows = buildInstallmentPlan({
        principalOriginal: loan.principalOriginal,
        installmentCount: n,
        cycle: loan.cycle,
        startDate: loan.startDate,
        firstDueDate: loan.firstDueDate,
        amortized: true,
        interestRatePercent: loan.interestRatePercent,
        fee: loan.fee,
        roundInstallments: loan.roundInstallments,
      }).rows;
    } else {
      const firstDue =
        loan.firstDueDate ?? defaultFirstDue(loan.startDate, loan.cycle);
      const per = loan.installmentAmount ?? round2(total / n);
      planRows = Array.from({ length: n }, (_, i) => {
        const k = i + 1;
        return {
          n: k,
          dueDate: dueDateAt(firstDue, loan.cycle, k),
          principal: null,
          interest: null,
          scheduled: k === n ? round2(total - per * (n - 1)) : per,
        };
      });
    }

    let remainPaid = paidTotal;
    let scheduledDueByAsOf = 0;
    const rows = planRows.map((r) => {
      const applied = Math.min(remainPaid, r.scheduled);
      remainPaid = round2(remainPaid - applied);
      const isPast = diffDays(r.dueDate, asOf) >= 0;
      if (isPast) scheduledDueByAsOf = round2(scheduledDueByAsOf + r.scheduled);
      let status: 'PAID' | 'PARTIAL' | 'DUE' | 'PENDING';
      if (applied >= r.scheduled - 0.001) status = 'PAID';
      else if (applied > 0) status = 'PARTIAL';
      else status = isPast ? 'DUE' : 'PENDING';
      return { ...r, paid: round2(applied), status };
    });

    const paidCount = rows.filter((r) => r.status === 'PAID').length;
    // ยอดที่ควรจ่ายถึงวันนี้ − ที่จ่ายมาแล้ว (รวมงวดค้างเก่า) ไม่เกินยอดคงเหลือ
    const dueNow = Math.max(
      0,
      round2(Math.min(scheduledDueByAsOf - paidTotal, remaining)),
    );
    const next = rows.find((r) => r.status !== 'PAID');
    return {
      installmentTotal: total,
      installmentCount: n,
      installmentAmount: loan.installmentAmount ?? round2(total / n),
      remaining: round2(remaining),
      paidTotal,
      paidCount,
      remainingCount: n - paidCount,
      dueNow,
      nextDueDate: next?.dueDate ?? null,
      rows,
    };
  }

  async getSchedule(id: string) {
    const loan = await this.findOne(id);
    const schedule = this.buildInstallmentSchedule(loan);
    if (!schedule)
      throw new BadRequestException('ยอดนี้ไม่ใช่ยอดผ่อนงวด');
    return schedule;
  }

  /**
   * สะสมดอกที่ถึงกำหนดแล้วยังไม่จ่ายเข้ายอดค้าง ถึง "เมื่อวาน"
   * (ดอกของวันนี้แสดงแยกเป็น "ดอกวันนี้" จนกว่าจะข้ามวัน)
   * ใช้ update() เจาะจงฟิลด์ — ห้าม save ทั้ง entity เพราะ relation ที่โหลดค้าง
   * อาจทำให้ TypeORM เขียนทับ FK ของ payments
   */
  async accrue(loan: Loan): Promise<Loan> {
    if (loan.status !== 'ACTIVE') return loan;
    const yesterday = addDays(todayStr(), -1);
    if (diffDays(loan.accruedThrough, yesterday) <= 0) return loan;

    let d = addDays(loan.accruedThrough, 1);
    let added = 0;
    while (diffDays(d, yesterday) >= 0) {
      if (this.isDueOn(loan, d)) added += this.interestPerCycle(loan);
      d = addDays(d, 1);
    }
    loan.accruedThrough = yesterday;
    loan.arrears = round2(loan.arrears + added);
    await this.loans.update(loan.id, {
      accruedThrough: loan.accruedThrough,
      arrears: loan.arrears,
    });
    return loan;
  }

  async accrueAllActive(): Promise<Loan[]> {
    const active = await this.loans.find({
      where: { status: 'ACTIVE' },
      relations: { debtor: true },
    });
    return Promise.all(active.map((l) => this.accrue(l)));
  }

  /** เลขที่สัญญาถัดไป: L-<ปี พ.ศ. ของวันเปิดยอด>-<ลำดับ 4 หลัก รันต่อปี> */
  private async nextContractNumber(startDate: string): Promise<string> {
    const beYear = parseInt(startDate.slice(0, 4), 10) + 543;
    const prefix = `L-${beYear}-`;
    const rows = await this.loans
      .createQueryBuilder('l')
      .select('l.contractNumber', 'cn')
      .where('l.contractNumber LIKE :p', { p: `${prefix}%` })
      .getRawMany<{ cn: string }>();
    const max = rows.reduce((m, r) => {
      const n = parseInt(r.cn.slice(prefix.length), 10);
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
    return `${prefix}${String(max + 1).padStart(4, '0')}`;
  }

  /** รายการสัญญาทั้งหมด พร้อมยอดสรุปต่อสัญญา (หน้า "สัญญาเงินกู้") */
  async findAll() {
    const loans = await this.loans.find({
      relations: { debtor: true, payments: true },
      order: { createdAt: 'DESC' },
    });
    const accrued = await Promise.all(loans.map((l) => this.accrue(l)));
    return accrued.map((l) => this.toListItem(l));
  }

  private toListItem(loan: Loan) {
    const payments = loan.payments ?? [];
    const paidTotal = round2(payments.reduce((s, p) => s + p.amount, 0));
    const frozen = loan.deadDate != null || this.isInstallment(loan);
    const remaining =
      loan.status === 'CLOSED'
        ? 0
        : frozen
          ? (loan.deadBalance ?? 0)
          : round2(loan.outstandingPrincipal + loan.arrears);

    const today = todayStr();
    let overdue = false;
    let nextDueDate: string | null = null;
    if (loan.status === 'INSTALLMENT') {
      const s = this.buildInstallmentSchedule(loan);
      overdue = (s?.dueNow ?? 0) > 0;
      nextDueDate = s?.nextDueDate ?? null;
    } else if (loan.status === 'ACTIVE' || loan.status === 'DEAD') {
      if (loan.status === 'ACTIVE') {
        overdue = loan.arrears > 0;
      } else if (loan.deadDate && loan.installmentAmount) {
        // ยอดตาย: ค้างถ้าผ่อนมาน้อยกว่างวดที่ครบกำหนดแล้ว (ทุก 10 วันนับจากวันแปลง)
        const cyclesDue = Math.floor(diffDays(loan.deadDate, today) / 10);
        const paidDead = payments
          .filter((p) => p.onDeadLoan)
          .reduce((s, p) => s + p.amount, 0);
        const expected = Math.min(
          cyclesDue * loan.installmentAmount,
          round2(paidDead + remaining),
        );
        overdue = remaining > 0 && paidDead < expected;
      }
      for (let i = 1; i <= 10; i++) {
        const d = addDays(today, i);
        if (this.isDueOn(loan, d)) {
          nextDueDate = d;
          break;
        }
      }
    }

    return {
      id: loan.id,
      contractNumber: loan.contractNumber,
      debtorId: loan.debtorId,
      debtorName: loan.debtor?.name ?? '',
      status: loan.status,
      cycle: loan.cycle,
      interestMode: loan.interestMode,
      isInstallment: this.isInstallment(loan),
      amortized: loan.amortized,
      interestRatePercent: loan.interestRatePercent,
      principalOriginal: loan.principalOriginal,
      outstandingPrincipal: loan.outstandingPrincipal,
      arrears: loan.arrears,
      paidTotal,
      remaining: round2(remaining),
      totalDue: round2(paidTotal + remaining),
      nextDueDate,
      overdue,
      startDate: loan.startDate,
      note: loan.note,
    };
  }

  async findOne(id: string): Promise<Loan> {
    const loan = await this.loans.findOne({
      where: { id },
      relations: { debtor: true, payments: true },
      order: { payments: { paidDate: 'DESC', createdAt: 'DESC' } },
    });
    if (!loan) throw new NotFoundException('ไม่พบยอดกู้');
    return this.accrue(loan);
  }

  async create(input: {
    debtorId: string;
    type?: 'REVOLVING' | 'INSTALLMENT';
    principalOriginal: number;
    outstandingPrincipal?: number;
    arrears?: number;
    interestRatePercent?: number;
    cycle: LoanCycle;
    interestMode?: 'FLOATING' | 'FLAT';
    installmentCount?: number;
    totalInterest?: number;
    installmentTotal?: number;
    amortized?: boolean;
    fee?: number;
    firstDueDate?: string;
    roundInstallments?: boolean;
    startDate?: string;
    note?: string;
  }): Promise<Loan> {
    // ยอดผ่อนงวด: กำหนดยอดเต็ม (ต้น+ดอกรวม) แล้วหารเป็น N งวดเท่ากันตั้งแต่ต้น
    if (input.type === 'INSTALLMENT') {
      return this.createInstallment(input);
    }
    if (input.cycle !== 'DAILY' && input.cycle !== 'TEN_DAY')
      throw new BadRequestException(
        'ยอดดอกลอย/คงที่รองรับรอบรายวันหรือ 10 วันเท่านั้น',
      );
    if (!input.interestRatePercent || input.interestRatePercent <= 0)
      throw new BadRequestException('อัตราดอกต้องมากกว่า 0');
    // ยอดเก่าที่เดินอยู่แล้ว: เริ่มเก็บต่อ "วันนี้" เลย (startDate = เมื่อวาน)
    // ยอดใหม่: กู้วันนี้ เริ่มส่งพรุ่งนี้ (startDate = วันนี้)
    const isLegacy =
      input.outstandingPrincipal !== undefined || input.arrears !== undefined;
    const startDate =
      input.startDate ?? (isLegacy ? addDays(todayStr(), -1) : todayStr());
    // ไม่ accrue ย้อนหลังก่อนวันขึ้นระบบ — ยอดค้างเก่ากรอกมาเองแล้ว
    const yesterday = addDays(todayStr(), -1);
    const accruedThrough =
      diffDays(startDate, yesterday) > 0 ? yesterday : startDate;
    const loan = this.loans.create({
      debtorId: input.debtorId,
      contractNumber: await this.nextContractNumber(startDate),
      principalOriginal: input.principalOriginal,
      outstandingPrincipal:
        input.outstandingPrincipal ?? input.principalOriginal,
      arrears: input.arrears ?? 0,
      interestRatePercent: input.interestRatePercent,
      cycle: input.cycle,
      interestMode: input.interestMode ?? 'FLOATING',
      startDate,
      accruedThrough,
      status: 'ACTIVE',
      note: input.note ?? null,
      // ยอดเก่า (legacy) ปล่อยไปก่อนขึ้นระบบ ไม่หักเงินสดในมือซ้ำ
      fromCapital: !isLegacy,
    });
    return this.loans.save(loan);
  }

  /** ตรวจ + สร้างแผนผ่อนจาก input (ใช้ทั้ง preview และเปิดยอดจริง) */
  private planFromInput(input: {
    principalOriginal: number;
    installmentCount?: number;
    totalInterest?: number;
    installmentTotal?: number;
    amortized?: boolean;
    interestRatePercent?: number;
    fee?: number;
    firstDueDate?: string;
    roundInstallments?: boolean;
    cycle: LoanCycle;
    startDate?: string;
  }): { plan: InstallmentPlan; startDate: string } {
    const count = input.installmentCount ?? 0;
    if (!Number.isInteger(count) || count < 1)
      throw new BadRequestException('จำนวนงวดต้องเป็นจำนวนเต็มตั้งแต่ 1 งวด');
    if (input.principalOriginal <= 0)
      throw new BadRequestException('เงินต้นต้องมากกว่า 0');
    const startDate = input.startDate ?? todayStr();
    if (input.firstDueDate && diffDays(startDate, input.firstDueDate) <= 0)
      throw new BadRequestException('วันเริ่มชำระต้องอยู่หลังวันปล่อยกู้');

    if (input.amortized) {
      if (!input.interestRatePercent || input.interestRatePercent <= 0)
        throw new BadRequestException('อัตราดอกต่องวดต้องมากกว่า 0');
    } else {
      // ดอกคงที่: รับเป็นยอดผ่อนรวม (ต้น+ดอก) แบบเดิม หรือดอกรวมตรงๆ
      const totalInterest =
        input.totalInterest ??
        (input.installmentTotal != null
          ? round2(input.installmentTotal - input.principalOriginal)
          : undefined);
      if (totalInterest === undefined || totalInterest < 0)
        throw new BadRequestException('กรอกดอกเบี้ยรวมทั้งสัญญา (0 ได้)');
      input = { ...input, totalInterest };
    }
    if ((input.fee ?? 0) < 0)
      throw new BadRequestException('ค่าธรรมเนียมต้องไม่ติดลบ');

    const plan = buildInstallmentPlan({
      principalOriginal: input.principalOriginal,
      installmentCount: count,
      cycle: input.cycle,
      startDate,
      firstDueDate: input.firstDueDate ?? null,
      amortized: input.amortized,
      totalInterest: input.totalInterest,
      interestRatePercent: input.interestRatePercent,
      fee: input.fee,
      roundInstallments: input.roundInstallments,
    });
    return { plan, startDate };
  }

  /** พรีวิวแผนผ่อนก่อนเปิดยอดจริง — คำนวณด้วยโค้ดเดียวกับตอนสร้าง ไม่บันทึกอะไร */
  preview(input: Parameters<LoansService['planFromInput']>[0]) {
    const { plan, startDate } = this.planFromInput(input);
    return { ...plan, startDate };
  }

  /** เปิดยอดผ่อน: ตรึงยอดเต็มตามแผน (ดอกคงที่งวดเท่ากัน / ลดต้นลดดอก) */
  private async createInstallment(input: {
    debtorId: string;
    principalOriginal: number;
    installmentCount?: number;
    totalInterest?: number;
    installmentTotal?: number;
    amortized?: boolean;
    interestRatePercent?: number;
    fee?: number;
    firstDueDate?: string;
    roundInstallments?: boolean;
    cycle: LoanCycle;
    startDate?: string;
    note?: string;
  }): Promise<Loan> {
    const { plan, startDate } = this.planFromInput(input);
    const loan = this.loans.create({
      debtorId: input.debtorId,
      contractNumber: await this.nextContractNumber(startDate),
      status: 'INSTALLMENT',
      cycle: input.cycle,
      interestMode: 'FLAT',
      amortized: input.amortized ?? false,
      principalOriginal: plan.principalOriginal,
      outstandingPrincipal: plan.principalOriginal,
      interestRatePercent: input.amortized
        ? (input.interestRatePercent ?? 0)
        : 0,
      arrears: 0,
      startDate,
      accruedThrough: startDate,
      firstDueDate: input.firstDueDate ?? null,
      installmentCount: plan.installmentCount,
      installmentTotal: plan.installmentTotal,
      installmentAmount: plan.installmentAmount,
      fee: plan.fee,
      roundInstallments: input.roundInstallments ?? false,
      deadBalance: plan.installmentTotal,
      note: input.note ?? null,
      fromCapital: true,
    });
    return this.loans.save(loan);
  }

  /** แปลงเป็นยอดตาย: หยุดดอก ตรึงยอด (ต้น+ค้าง) ตกลงงวดผ่อน/10วัน */
  async convertToDead(id: string, installmentAmount: number): Promise<Loan> {
    const loan = await this.findOne(id);
    if (loan.status !== 'ACTIVE')
      throw new BadRequestException('แปลงได้เฉพาะยอดปกติ');
    if (installmentAmount <= 0)
      throw new BadRequestException('งวดผ่อนต้องมากกว่า 0');
    loan.status = 'DEAD';
    loan.deadDate = todayStr();
    loan.deadBalance = round2(loan.outstandingPrincipal + loan.arrears);
    loan.installmentAmount = installmentAmount;
    await this.loans.update(loan.id, {
      status: loan.status,
      deadDate: loan.deadDate,
      deadBalance: loan.deadBalance,
      installmentAmount: loan.installmentAmount,
    });
    await this.activity.log({
      type: 'CONVERT_DEAD',
      loanId: loan.id,
      debtorId: loan.debtorId,
      debtorName: loan.debtor?.name ?? null,
      message: `แปลงเป็นยอดตาย (ตรึง ฿${loan.deadBalance}, ผ่อน ฿${installmentAmount}/10วัน)`,
      meta: { deadBalance: loan.deadBalance, installmentAmount },
    });
    return loan;
  }

  /** อัปเดตยอดเงินหลังรับชำระ/ลบรายการ แล้วปิด-เปิดยอดตามสถานะจริง */
  async applyBalances(loan: Loan): Promise<Loan> {
    // หนี้สูญ: ตรึงยอดไว้เป็นผลขาดทุน ไม่ auto ปิด/เปิดตามยอด
    if (loan.status === 'BAD_DEBT') {
      await this.loans.update(loan.id, {
        outstandingPrincipal: loan.outstandingPrincipal,
        arrears: loan.arrears,
        deadBalance: loan.deadBalance,
      });
      return loan;
    }
    // ยอดตาย/ผ่อนงวดดูแค่ deadBalance (ต้น/ค้างเดิมถูกตรึงไว้เฉยๆ)
    const frozen = loan.deadDate != null || this.isInstallment(loan);
    const settled = frozen
      ? (loan.deadBalance ?? 0) <= 0
      : loan.outstandingPrincipal <= 0 && loan.arrears <= 0;

    if (settled && loan.status !== 'CLOSED') {
      loan.status = 'CLOSED';
      loan.closedAt = todayStr();
    } else if (!settled && loan.status === 'CLOSED') {
      // ลบรายการจ่ายแล้วยอดกลับมามี — เปิดยอดคืน
      loan.status = this.isInstallment(loan)
        ? 'INSTALLMENT'
        : loan.deadDate
          ? 'DEAD'
          : 'ACTIVE';
      loan.closedAt = null;
    }

    await this.loans.update(loan.id, {
      outstandingPrincipal: loan.outstandingPrincipal,
      arrears: loan.arrears,
      deadBalance: loan.deadBalance,
      status: loan.status,
      closedAt: loan.closedAt,
    });
    return loan;
  }

  /** แก้เงื่อนไขยอดกู้: อัตราดอก / รอบเก็บ / หมายเหตุ */
  async editTerms(
    id: string,
    input: {
      interestRatePercent?: number;
      cycle?: 'DAILY' | 'TEN_DAY';
      note?: string | null;
    },
  ): Promise<Loan> {
    const loan = await this.findOne(id);
    const before = {
      interestRatePercent: loan.interestRatePercent,
      cycle: loan.cycle,
      note: loan.note,
    };
    const patch: Partial<Loan> = {};
    if (input.interestRatePercent !== undefined) {
      if (input.interestRatePercent <= 0)
        throw new BadRequestException('อัตราดอกต้องมากกว่า 0');
      patch.interestRatePercent = input.interestRatePercent;
    }
    if (input.cycle !== undefined) patch.cycle = input.cycle;
    if (input.note !== undefined) patch.note = input.note;
    await this.loans.update(id, patch);
    await this.activity.log({
      type: 'EDIT_LOAN',
      loanId: id,
      debtorId: loan.debtorId,
      debtorName: loan.debtor?.name ?? null,
      message: 'แก้เงื่อนไขยอดกู้',
      meta: { before, after: { ...before, ...patch } },
    });
    return this.findOne(id);
  }

  /** ปรับยอดด้วยมือ (แก้ยอดที่ผิด) — ต้องมีเหตุผล บันทึก log ก่อน/หลัง */
  async adjust(
    id: string,
    input: {
      outstandingPrincipal?: number;
      arrears?: number;
      deadBalance?: number;
      reason: string;
    },
  ): Promise<Loan> {
    const loan = await this.findOne(id);
    if (!input.reason?.trim())
      throw new BadRequestException('ต้องระบุเหตุผลการปรับยอด');
    const before = {
      outstandingPrincipal: loan.outstandingPrincipal,
      arrears: loan.arrears,
      deadBalance: loan.deadBalance,
    };
    if (loan.status === 'DEAD' || loan.status === 'INSTALLMENT') {
      if (input.deadBalance === undefined)
        throw new BadRequestException('ยอดตาย/ผ่อนงวดให้ปรับ deadBalance');
      if (input.deadBalance < 0)
        throw new BadRequestException('ยอดต้องไม่ติดลบ');
      loan.deadBalance = round2(input.deadBalance);
      // ผ่อนงวด: sync ต้นคงเหลือให้สัมพันธ์กับยอดผ่อนที่เหลือ
      if (
        loan.status === 'INSTALLMENT' &&
        loan.installmentTotal &&
        loan.installmentTotal > 0
      ) {
        loan.outstandingPrincipal = round2(
          (loan.principalOriginal * loan.deadBalance) / loan.installmentTotal,
        );
      } else if (input.outstandingPrincipal !== undefined) {
        if (input.outstandingPrincipal < 0)
          throw new BadRequestException('ต้นคงเหลือต้องไม่ติดลบ');
        loan.outstandingPrincipal = round2(input.outstandingPrincipal);
      }
    } else {
      if (input.outstandingPrincipal !== undefined) {
        if (input.outstandingPrincipal < 0)
          throw new BadRequestException('ต้นคงเหลือต้องไม่ติดลบ');
        loan.outstandingPrincipal = round2(input.outstandingPrincipal);
      }
      if (input.arrears !== undefined) {
        if (input.arrears < 0)
          throw new BadRequestException('ยอดค้างต้องไม่ติดลบ');
        loan.arrears = round2(input.arrears);
      }
    }
    await this.activity.log({
      type: 'ADJUST',
      loanId: id,
      debtorId: loan.debtorId,
      debtorName: loan.debtor?.name ?? null,
      message: 'ปรับยอดด้วยมือ',
      reason: input.reason,
      meta: {
        before,
        after: {
          outstandingPrincipal: loan.outstandingPrincipal,
          arrears: loan.arrears,
          deadBalance: loan.deadBalance,
        },
      },
    });
    return this.applyBalances(loan);
  }

  /** ปิดยอดเอง (ถือว่าจบ ไม่ว่ายอดเหลือหรือไม่) */
  async close(id: string, reason?: string): Promise<Loan> {
    const loan = await this.findOne(id);
    if (loan.status === 'CLOSED')
      throw new BadRequestException('ยอดนี้ปิดอยู่แล้ว');
    loan.status = 'CLOSED';
    loan.closedAt = todayStr();
    await this.loans.update(id, {
      status: loan.status,
      closedAt: loan.closedAt,
    });
    await this.activity.log({
      type: 'CLOSE',
      loanId: id,
      debtorId: loan.debtorId,
      debtorName: loan.debtor?.name ?? null,
      message: 'ปิดยอดเอง',
      reason: reason ?? null,
    });
    return loan;
  }

  /** ตัดหนี้สูญ: หยุดทุกอย่าง ตรึงยอดคงเหลือเป็นผลขาดทุน */
  async writeOff(id: string, reason?: string): Promise<Loan> {
    const loan = await this.findOne(id);
    if (loan.status === 'CLOSED' || loan.status === 'BAD_DEBT')
      throw new BadRequestException('ยอดนี้ปิด/ตัดหนี้สูญไปแล้ว');
    const loss =
      loan.status === 'DEAD' || loan.status === 'INSTALLMENT'
        ? (loan.deadBalance ?? 0)
        : round2(loan.outstandingPrincipal + loan.arrears);
    loan.status = 'BAD_DEBT';
    loan.closedAt = todayStr();
    await this.loans.update(id, {
      status: loan.status,
      closedAt: loan.closedAt,
    });
    await this.activity.log({
      type: 'WRITE_OFF',
      loanId: id,
      debtorId: loan.debtorId,
      debtorName: loan.debtor?.name ?? null,
      message: 'ตัดหนี้สูญ',
      reason: reason ?? null,
      amount: -loss,
    });
    return loan;
  }

  /** เปิดยอดคืน (ยกเลิกปิด/หนี้สูญ) — กลับมาเดินดอกจากวันนี้ */
  async reopen(id: string): Promise<Loan> {
    const loan = await this.findOne(id);
    if (
      loan.status === 'ACTIVE' ||
      loan.status === 'DEAD' ||
      loan.status === 'INSTALLMENT'
    )
      throw new BadRequestException('ยอดนี้เปิดอยู่แล้ว');
    // ผ่อนงวด: กลับสู่สถานะผ่อนต่อ ตรึงตารางผ่อนเดิมไว้
    if (this.isInstallment(loan)) {
      loan.status = 'INSTALLMENT';
      loan.closedAt = null;
      await this.loans.update(id, { status: loan.status, closedAt: null });
      await this.activity.log({
        type: 'REOPEN',
        loanId: id,
        debtorId: loan.debtorId,
        debtorName: loan.debtor?.name ?? null,
        message: 'เปิดยอดผ่อนงวดคืน',
      });
      return loan;
    }
    const yesterday = addDays(todayStr(), -1);
    loan.status = 'ACTIVE';
    loan.closedAt = null;
    loan.deadDate = null;
    loan.deadBalance = null;
    loan.installmentAmount = null;
    loan.accruedThrough = yesterday;
    await this.loans.update(id, {
      status: loan.status,
      closedAt: loan.closedAt,
      deadDate: loan.deadDate,
      deadBalance: loan.deadBalance,
      installmentAmount: loan.installmentAmount,
      accruedThrough: loan.accruedThrough,
    });
    await this.activity.log({
      type: 'REOPEN',
      loanId: id,
      debtorId: loan.debtorId,
      debtorName: loan.debtor?.name ?? null,
      message: 'เปิดยอดคืน',
    });
    return loan;
  }

  /** ลบยอดกู้ทิ้ง (พร้อมประวัติจ่าย) */
  async remove(id: string): Promise<void> {
    const loan = await this.findOne(id);
    await this.loans.delete(id);
    await this.activity.log({
      type: 'DELETE_LOAN',
      loanId: id,
      debtorId: loan.debtorId,
      debtorName: loan.debtor?.name ?? null,
      message: `ลบยอดกู้ (${cycleLabelTh(loan.cycle)} ดอก ${loan.interestRatePercent}%)`,
      meta: {
        principalOriginal: loan.principalOriginal,
        outstandingPrincipal: loan.outstandingPrincipal,
      },
    });
  }
}

function cycleLabelTh(c: LoanCycle): string {
  return {
    DAILY: 'รายวัน',
    WEEKLY: 'รายสัปดาห์',
    TEN_DAY: 'ราย 10 วัน',
    MONTHLY: 'รายเดือน',
  }[c];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
