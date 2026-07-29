import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityService } from '../activity/activity.service';
import { addDays, diffDays, todayStr } from '../common/date.util';
import {
  ActivityType,
  InterestMode,
  LoanKind,
  LoanStatus,
  RevolvingCycle,
} from '../common/enums';
import { Loan, LoanCycle } from '../entities/loan.entity';
import { LoanCycle as CycleRow } from '../entities/loan-cycle.entity';
import { Payment } from '../entities/payment.entity';
import {
  buildInstallmentPlan,
  cycleLabelTh,
  cycleStep,
  defaultFirstDue,
  dueDateAt,
  round2,
  splitInstallmentDue,
  type InstallmentPlan,
  type PlanRow,
} from './installment-plan';

@Injectable()
export class LoansService {
  constructor(
    @InjectRepository(Loan) private loans: Repository<Loan>,
    @InjectRepository(CycleRow) private cycleRows: Repository<CycleRow>,
    private activity: ActivityService,
  ) {}

  /** ดอกต่อรอบ (ปัดเป็นบาทเต็ม)
   *  FLOATING = จากต้นคงเหลือ (ลดเมื่อตัดต้น), FLAT = จากต้นเดิมคงที่ */
  interestPerCycle(loan: Loan): number {
    const base =
      loan.interestMode === InterestMode.FLAT
        ? loan.principalOriginal
        : loan.outstandingPrincipal;
    return Math.round((base * loan.interestRatePercent) / 100);
  }

  /** ดอกของรอบนั้น = ยอดที่ตกลงเก็บจริง (override) ถ้ามี ไม่งั้นคำนวณจากต้นคงเหลือล่าสุด */
  cycleInterest(loan: Loan, row: CycleRow): number {
    return row.interestOverride ?? this.interestPerCycle(loan);
  }

  /** ดอกที่ต้องเก็บของวันครบกำหนด d (ใช้ยอดตกลงจริงของรอบนั้นถ้ามี) */
  dueInterestOn(loan: Loan, d: string): number {
    const row = loan.cycles?.find((c) => c.dueDate === d);
    return row ? this.cycleInterest(loan, row) : this.interestPerCycle(loan);
  }

  /**
   * สร้างแถวรอบดอกให้ครบถึงวันนี้ + รอบถัดไปอีก 1 รอบ (เฉพาะยอดดอกลอย/คงที่ ACTIVE)
   * - ยอดเก่าที่ยังไม่มีแถว: ต่อจากสูตรเดิม (startDate + k×รอบ) โดยไม่สะสมย้อนซ้ำ
   *   (แถวที่วันครบกำหนด ≤ accruedThrough ถือว่าคิดเข้ายอดค้างแบบเดิมไปแล้ว)
   * - แถวใหม่ต่อจาก "วันครบกำหนดล่าสุด" เสมอ — เลื่อนวันแล้วรอบถัดๆ ไปขยับตาม
   */
  async ensureCycles(loan: Loan): Promise<CycleRow[]> {
    if (loan.status !== LoanStatus.ACTIVE || loan.cycle === LoanCycle.MONTHLY) {
      return loan.cycles ?? [];
    }
    const step = cycleStep[loan.cycle];
    const today = todayStr();
    let rows =
      loan.cycles ??
      (await this.cycleRows.find({
        where: { loanId: loan.id },
        order: { dueDate: 'ASC' },
      }));
    rows = [...rows].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    let anchor: string;
    if (rows.length > 0) {
      anchor = rows[rows.length - 1].dueDate;
    } else {
      // seed จากสูตรเดิม: วันครบกำหนดล่าสุดที่ ≤ accruedThrough
      const past = Math.max(0, diffDays(loan.startDate, loan.accruedThrough));
      anchor = addDays(loan.startDate, Math.floor(past / step) * step);
    }

    // เติมแถวจนวันครบกำหนดล่าสุดเลยวันนี้ไป 1 รอบ
    const fresh: CycleRow[] = [];
    let last = anchor;
    while (diffDays(last, today) >= 0) {
      last = addDays(last, step);
      fresh.push(
        this.cycleRows.create({
          loanId: loan.id,
          dueDate: last,
          interestOverride: null,
          // รอบที่ผ่านมาก่อนขึ้นระบบรอบดอก — เคยคิดเข้ายอดค้างแบบเดิมไปแล้ว
          accrued: diffDays(last, loan.accruedThrough) >= 0,
          accruedAmount: null,
        }),
      );
    }
    if (fresh.length > 0) {
      await this.cycleRows.save(fresh);
      rows = [...rows, ...fresh];
    }
    loan.cycles = rows;
    return rows;
  }

  /** วันที่ d เป็นวันครบกำหนดของยอดนี้ไหม
   *  ยอด ACTIVE ดูจากแถวรอบดอก (ถ้าโหลดมาแล้ว) — เลื่อนวันแล้วระบบยึดวันใหม่ */
  isDueOn(loan: Loan, d: string): boolean {
    if (
      loan.status === LoanStatus.CLOSED ||
      loan.status === LoanStatus.BAD_DEBT
    )
      return false;
    if (loan.status === LoanStatus.DEAD) {
      // ยอดตายที่ไม่ได้ตกลงงวดตายตัว — ทยอยคืนเมื่อไหร่ก็ได้ ไม่โผล่เป็นรายการวันนี้
      if (!loan.deadDate || !loan.installmentAmount) return false;
      const diff = diffDays(loan.deadDate, d);
      return diff > 0 && diff % 10 === 0;
    }
    if (loan.status === LoanStatus.INSTALLMENT) {
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
    if (loan.cycle === LoanCycle.MONTHLY) return false;
    if (loan.cycles?.length) {
      if (loan.cycles.some((c) => c.dueDate === d)) return true;
      // วันในอนาคตที่ยังไม่ได้ gen แถว (ดูล่วงหน้า) — ฉายต่อจากรอบสุดท้ายตามรอบเก็บ
      const last = loan.cycles.reduce(
        (m, c) => (c.dueDate > m ? c.dueDate : m),
        '',
      );
      const ahead = diffDays(last, d);
      return ahead > 0 && ahead % cycleStep[loan.cycle] === 0;
    }
    // fallback (ยังไม่โหลดแถวรอบดอก): สูตรเดิมตามรอบเก็บ
    const diff = diffDays(loan.startDate, d);
    if (diff <= 0) return false;
    return diff % cycleStep[loan.cycle] === 0;
  }

  /**
   * รอบดอกที่กำลังเดินอยู่ (แถวแรกที่ยังไม่สะสมและครบกำหนด ≥ วันนี้)
   * พร้อมยอดดอกรอบนี้ และดอกที่จ่ายมาแล้วภายในรอบ (ช่วงหลังรอบก่อนถึงวันครบกำหนด)
   */
  currentCycleInfo(loan: Loan, asOf: string = todayStr()) {
    if (loan.status !== LoanStatus.ACTIVE || !loan.cycles?.length) return null;
    const rows = [...loan.cycles].sort((a, b) =>
      a.dueDate.localeCompare(b.dueDate),
    );
    const idx = rows.findIndex(
      (r) => !r.accrued && diffDays(r.dueDate, asOf) <= 0,
    );
    if (idx === -1) return null;
    const row = rows[idx];
    // รอบแรกนับรวมวันเปิดยอดด้วย (window = หลังรอบก่อน ถึงวันครบกำหนด)
    const windowStart =
      idx > 0 ? rows[idx - 1].dueDate : addDays(loan.startDate, -1);
    const interestDue = this.cycleInterest(loan, row);
    const interestPaid = (loan.payments ?? [])
      .filter(
        (p) =>
          !p.onDeadLoan &&
          diffDays(windowStart, p.paidDate) > 0 &&
          diffDays(p.paidDate, row.dueDate) >= 0,
      )
      .reduce((s, p) => s + p.interestPaid, 0);
    return {
      cycleId: row.id,
      dueDate: row.dueDate,
      computedInterest: this.interestPerCycle(loan),
      interestOverride: row.interestOverride,
      interestDue,
      interestPaid: round2(interestPaid),
      interestRemaining: Math.max(0, round2(interestDue - interestPaid)),
    };
  }

  /**
   * สถานะดอกของรอบที่ครบกำหนด "วันที่ d" — ดอกที่ต้องเก็บ / จ่ายมาแล้วในรอบ / เหลืออีก
   * นับเงินที่จ่ายภายในช่วงรอบ (หลังรอบก่อนหน้า ถึงวันครบกำหนด) จึงรองรับทั้ง
   * จ่ายล่วงหน้าและแบ่งจ่ายหลายครั้งในรอบเดียว — null = วันนั้นไม่ใช่วันครบกำหนด
   */
  cycleStatusOn(loan: Loan, d: string) {
    if (loan.status !== LoanStatus.ACTIVE || loan.cycle === LoanCycle.MONTHLY)
      return null;
    const rows = [...(loan.cycles ?? [])].sort((a, b) =>
      a.dueDate.localeCompare(b.dueDate),
    );
    const idx = rows.findIndex((r) => r.dueDate === d);
    let interestDue: number;
    let windowStart: string;
    if (idx === -1) {
      // รอบในอนาคตที่ยังไม่ได้สร้างแถว (ดูล่วงหน้า) — ฉายจากรอบเก็บปัจจุบัน
      if (!this.isDueOn(loan, d)) return null;
      interestDue = this.interestPerCycle(loan);
      windowStart = addDays(d, -cycleStep[loan.cycle]);
    } else {
      interestDue = this.cycleInterest(loan, rows[idx]);
      windowStart =
        idx > 0 ? rows[idx - 1].dueDate : addDays(loan.startDate, -1);
    }
    const interestPaid = (loan.payments ?? [])
      .filter(
        (p) =>
          !p.onDeadLoan &&
          diffDays(windowStart, p.paidDate) > 0 &&
          diffDays(p.paidDate, d) >= 0,
      )
      .reduce((s, p) => s + p.interestPaid, 0);
    return {
      interestDue,
      interestPaid: round2(interestPaid),
      interestRemaining: Math.max(0, round2(interestDue - interestPaid)),
    };
  }

  /** ยอดผ่อนงวดใช่ไหม (ตรวจจาก installmentCount ที่ตั้งไว้ตอนเปิดยอด — คงอยู่แม้ปิด) */
  isInstallment(loan: Loan): boolean {
    return loan.installmentCount != null;
  }

  /** ยอดนี้ตรึงยอดคงเหลือไว้ก้อนเดียว (ยอดตาย/ผ่อนงวด) แทนที่จะแยกต้น/ค้าง */
  private isFrozenBalance(loan: Loan): boolean {
    return loan.deadDate != null || this.isInstallment(loan);
  }

  /**
   * ยอดคงเหลือที่ยังเก็บไม่ได้ของยอดกู้ — ใช้เป็น "ยอดหนี้สูญ" เมื่อสถานะ BAD_DEBT
   * ยอดตาย/ผ่อนงวดดู deadBalance ที่ตรึงไว้, ยอดปกติดู ต้นคงเหลือ + ยอดค้าง
   */
  lossOf(loan: Loan): number {
    return this.isFrozenBalance(loan)
      ? (loan.deadBalance ?? 0)
      : round2(loan.outstandingPrincipal + loan.arrears);
  }

  /**
   * ตั้งยอดคงเหลือของยอดหนี้สูญเป็นตัวเลขที่ต้องการ (แก้เอง / เก็บคืนได้บางส่วน)
   * เขียนลงฟิลด์ที่ระบบใช้คิดยอดขาดทุนให้อัตโนมัติ — ยอดปกติหักยอดค้างเก่าก่อน
   * ตามธรรมเนียมเดียวกับการรับชำระ แล้วค่อยลดต้น
   * หมายเหตุ: ไม่บันทึกลงฐานข้อมูลเอง — ให้ applyBalances เป็นคนเขียน
   */
  setLoss(loan: Loan, amount: number): void {
    const target = Math.max(0, round2(amount));
    if (this.isFrozenBalance(loan)) {
      loan.deadBalance = target;
      return;
    }
    const cut = round2(this.lossOf(loan) - target);
    if (cut < 0) {
      loan.outstandingPrincipal = round2(loan.outstandingPrincipal - cut);
      return;
    }
    const fromArrears = Math.min(loan.arrears, cut);
    loan.arrears = round2(loan.arrears - fromArrears);
    loan.outstandingPrincipal = Math.max(
      0,
      round2(loan.outstandingPrincipal - (cut - fromArrears)),
    );
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
    if (!schedule) throw new BadRequestException('ยอดนี้ไม่ใช่ยอดผ่อนงวด');
    return schedule;
  }

  /** รอบดอกของยอดดอกลอย/คงที่: รอบล่าสุดที่ผ่านมา + รอบที่กำลังเดิน/อนาคต */
  async getCycles(id: string) {
    const loan = await this.findOne(id); // accrue + gen รอบให้ครบก่อน
    if (this.isInstallment(loan) || loan.deadDate)
      throw new BadRequestException('ยอดนี้ไม่มีรอบดอก (ผ่อนงวด/ยอดตาย)');
    const rows = [...(loan.cycles ?? [])].sort((a, b) =>
      a.dueDate.localeCompare(b.dueDate),
    );
    const recentAccrued = rows.filter((r) => r.accrued).slice(-8);
    const pendingRows = rows.filter((r) => !r.accrued);
    return {
      current: this.currentCycleInfo(loan),
      rows: [...recentAccrued, ...pendingRows].map((r) => ({
        id: r.id,
        dueDate: r.dueDate,
        interest: this.cycleInterest(loan, r),
        computedInterest: this.interestPerCycle(loan),
        interestOverride: r.interestOverride,
        accrued: r.accrued,
        accruedAmount: r.accruedAmount,
      })),
    };
  }

  /** แก้รอบดอกรายรอบ: เลื่อนวันครบกำหนด / ตกลงเก็บดอกจริง (override ที่ระบบคำนวณ) */
  async updateCycle(
    loanId: string,
    cycleId: string,
    input: { dueDate?: string; interestOverride?: number | null },
  ) {
    const loan = await this.findOne(loanId);
    const rows = [...(loan.cycles ?? [])].sort((a, b) =>
      a.dueDate.localeCompare(b.dueDate),
    );
    const idx = rows.findIndex((r) => r.id === cycleId);
    if (idx === -1) throw new NotFoundException('ไม่พบรอบดอก');
    const row = rows[idx];
    if (row.accrued)
      throw new BadRequestException(
        'รอบนี้สะสมเข้ายอดค้างไปแล้ว — แก้ที่ยอดค้างด้วย "ปรับยอด" แทน',
      );

    const before = {
      dueDate: row.dueDate,
      interestOverride: row.interestOverride,
    };
    const patch: Partial<CycleRow> = {};
    if (input.dueDate !== undefined && input.dueDate !== row.dueDate) {
      if (diffDays(loan.accruedThrough, input.dueDate) <= 0)
        throw new BadRequestException('เลื่อนวันย้อนหลังไม่ได้');
      const prev = rows[idx - 1];
      if (prev && diffDays(prev.dueDate, input.dueDate) <= 0)
        throw new BadRequestException(
          `ต้องอยู่หลังรอบก่อนหน้า (${prev.dueDate})`,
        );
      const next = rows[idx + 1];
      if (next && diffDays(input.dueDate, next.dueDate) <= 0)
        throw new BadRequestException(`ต้องอยู่ก่อนรอบถัดไป (${next.dueDate})`);
      patch.dueDate = input.dueDate;
    }
    if (input.interestOverride !== undefined) {
      if (input.interestOverride !== null && input.interestOverride < 0)
        throw new BadRequestException('ยอดดอกต้องไม่ติดลบ');
      patch.interestOverride =
        input.interestOverride === null ? null : round2(input.interestOverride);
    }
    if (Object.keys(patch).length > 0) {
      await this.cycleRows.update(cycleId, patch);
      await this.activity.log({
        type: ActivityType.EDIT_CYCLE,
        loanId,
        debtorId: loan.debtorId,
        debtorName: loan.debtor?.name ?? null,
        message: [
          patch.dueDate
            ? `เลื่อนวันครบกำหนด ${before.dueDate} → ${patch.dueDate}`
            : '',
          patch.interestOverride !== undefined
            ? patch.interestOverride === null
              ? 'กลับไปใช้ดอกที่ระบบคำนวณ'
              : `ตกลงเก็บดอกรอบนี้ ฿${patch.interestOverride}`
            : '',
        ]
          .filter(Boolean)
          .join(' · '),
        meta: { before, after: { ...before, ...patch } },
      });
    }
    return this.getCycles(loanId);
  }

  /**
   * สะสมดอกของรอบที่เลยวันครบกำหนดแล้ว (ถึง "เมื่อวาน") เข้ายอดค้าง
   * โดยหักดอกที่จ่ายมาแล้วภายในรอบนั้นออกก่อน — จ่ายดอกครบในรอบ = ไม่มีค้าง
   * (ดอกของรอบที่ครบกำหนดวันนี้แสดงแยกเป็น "ดอกวันนี้" จนกว่าจะข้ามวัน)
   * ใช้ update() เจาะจงฟิลด์ — ห้าม save ทั้ง entity เพราะ relation ที่โหลดค้าง
   * อาจทำให้ TypeORM เขียนทับ FK ของ payments
   */
  async accrue(loan: Loan): Promise<Loan> {
    if (loan.status !== LoanStatus.ACTIVE) return loan;
    const rows = await this.ensureCycles(loan);
    const yesterday = addDays(todayStr(), -1);
    const sorted = [...rows].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    // แถวเก่าที่วันครบกำหนด ≤ accruedThrough (เช่น หลังเปิดยอดคืน) — ปิดทิ้ง ไม่คิดย้อน
    const stale = sorted.filter(
      (r) => !r.accrued && diffDays(r.dueDate, loan.accruedThrough) >= 0,
    );
    for (const row of stale) {
      row.accrued = true;
      await this.cycleRows.update(row.id, { accrued: true });
    }
    const pending = sorted.filter(
      (r) => !r.accrued && diffDays(r.dueDate, yesterday) >= 0,
    );
    if (pending.length === 0) {
      if (diffDays(loan.accruedThrough, yesterday) > 0) {
        loan.accruedThrough = yesterday;
        await this.loans.update(loan.id, { accruedThrough: yesterday });
      }
      return loan;
    }

    const payments =
      loan.payments ??
      (await this.loans.manager.find(Payment, {
        where: { loanId: loan.id },
      }));

    let added = 0;
    for (const row of pending) {
      const idx = sorted.indexOf(row);
      const windowStart =
        idx > 0 ? sorted[idx - 1].dueDate : addDays(loan.startDate, -1);
      const due = this.cycleInterest(loan, row);
      const paidInCycle = payments
        .filter(
          (p) =>
            !p.onDeadLoan &&
            diffDays(windowStart, p.paidDate) > 0 &&
            diffDays(p.paidDate, row.dueDate) >= 0,
        )
        .reduce((s, p) => s + p.interestPaid, 0);
      const unpaid = Math.max(0, round2(due - paidInCycle));
      row.accrued = true;
      row.accruedAmount = unpaid;
      added = round2(added + unpaid);
      await this.cycleRows.update(row.id, {
        accrued: true,
        accruedAmount: unpaid,
      });
    }
    loan.accruedThrough =
      diffDays(loan.accruedThrough, yesterday) > 0
        ? yesterday
        : loan.accruedThrough;
    loan.arrears = round2(loan.arrears + added);
    await this.loans.update(loan.id, {
      accruedThrough: loan.accruedThrough,
      arrears: loan.arrears,
    });
    return loan;
  }

  async accrueAllActive(): Promise<Loan[]> {
    const active = await this.loans.find({
      where: { status: LoanStatus.ACTIVE },
      relations: { debtor: true, payments: true, cycles: true },
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
      relations: { debtor: true, payments: true, cycles: true },
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
      loan.status === LoanStatus.CLOSED
        ? 0
        : frozen
          ? (loan.deadBalance ?? 0)
          : round2(loan.outstandingPrincipal + loan.arrears);

    const today = todayStr();
    let overdue = false;
    let nextDueDate: string | null = null;
    if (loan.status === LoanStatus.INSTALLMENT) {
      const s = this.buildInstallmentSchedule(loan);
      // ค้างเฉพาะงวดที่ "เลยกำหนด" แล้ว — งวดที่ครบกำหนดวันนี้ยังไม่ถือว่าค้าง
      overdue = splitInstallmentDue(s?.rows ?? [], today).overdue > 0;
      nextDueDate = s?.nextDueDate ?? null;
    } else if (
      loan.status === LoanStatus.ACTIVE ||
      loan.status === LoanStatus.DEAD
    ) {
      if (loan.status === LoanStatus.ACTIVE) {
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
      if (loan.status === LoanStatus.ACTIVE && loan.cycles?.length) {
        // รอบดอกถัดไปจากแถวจริง (รวมวันที่ถูกเลื่อน)
        nextDueDate =
          [...loan.cycles]
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
            .find((c) => !c.accrued && diffDays(c.dueDate, today) <= 0)
            ?.dueDate ?? null;
      } else {
        for (let i = 1; i <= 10; i++) {
          const d = addDays(today, i);
          if (this.isDueOn(loan, d)) {
            nextDueDate = d;
            break;
          }
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
      relations: { debtor: true, payments: true, cycles: true },
      order: {
        payments: { paidDate: 'DESC', createdAt: 'DESC' },
        cycles: { dueDate: 'ASC' },
      },
    });
    if (!loan) throw new NotFoundException('ไม่พบยอดกู้');
    return this.accrue(loan);
  }

  async create(input: {
    debtorId: string;
    type?: LoanKind;
    principalOriginal: number;
    outstandingPrincipal?: number;
    arrears?: number;
    interestRatePercent?: number;
    cycle: LoanCycle;
    interestMode?: InterestMode;
    installmentCount?: number;
    /** ยอดตายคีย์มือ: งวดผ่อนที่ตกลง (ไม่ระบุ = ไม่มีกำหนดตายตัว) */
    installmentAmount?: number;
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
    if (input.type === LoanKind.INSTALLMENT) {
      return this.createInstallment(input);
    }
    // ยอดตายคีย์มือ: ตรึงยอดที่กรอก ไม่คิดดอก
    if (input.type === LoanKind.DEAD) {
      return this.createDead(input);
    }
    if (
      input.cycle !== LoanCycle.DAILY &&
      input.cycle !== LoanCycle.WEEKLY &&
      input.cycle !== LoanCycle.TEN_DAY
    )
      throw new BadRequestException(
        'ยอดดอกลอย/คงที่รองรับรอบรายวัน ทุก 7 วัน หรือทุก 10 วัน',
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
      interestMode: input.interestMode ?? InterestMode.FLOATING,
      startDate,
      accruedThrough,
      status: LoanStatus.ACTIVE,
      note: input.note ?? null,
      // ยอดเก่า (legacy) ปล่อยไปก่อนขึ้นระบบ ไม่หักเงินสดในมือซ้ำ
      fromCapital: !isLegacy,
    });
    const saved = await this.loans.save(loan);
    // สร้างรอบดอกล่วงหน้า (วันครบกำหนดรอบแรก = วันเปิดยอด + 1 รอบ)
    await this.ensureCycles(saved);
    return saved;
  }

  /**
   * เปิดยอดตายตรงๆ (คีย์มือ) — ยอดที่กรอกคือยอดคงเหลือที่ตรึงไว้ ไม่คิดดอกเพิ่ม
   * installmentAmount ไม่บังคับ: ไม่ระบุ = ทยอยคืนเมื่อไหร่ก็ได้ ไม่มีกำหนดตายตัว
   */
  private async createDead(input: {
    debtorId: string;
    principalOriginal: number;
    installmentAmount?: number;
    startDate?: string;
    note?: string;
    fromCapital?: boolean;
  }): Promise<Loan> {
    if (input.principalOriginal <= 0)
      throw new BadRequestException('ยอดตายต้องมากกว่า 0');
    if (input.installmentAmount !== undefined && input.installmentAmount <= 0)
      throw new BadRequestException('งวดผ่อนต้องมากกว่า 0');
    const startDate = input.startDate ?? todayStr();
    const loan = this.loans.create({
      debtorId: input.debtorId,
      contractNumber: await this.nextContractNumber(startDate),
      status: LoanStatus.DEAD,
      cycle: LoanCycle.TEN_DAY,
      interestMode: InterestMode.FLAT,
      principalOriginal: input.principalOriginal,
      outstandingPrincipal: input.principalOriginal,
      interestRatePercent: 0,
      arrears: 0,
      startDate,
      accruedThrough: startDate,
      deadDate: startDate,
      deadBalance: input.principalOriginal,
      installmentAmount: input.installmentAmount ?? null,
      note: input.note ?? null,
      // ยอดตายคีย์มือ = ยอดเก่าที่ปล่อยไปก่อนแล้ว ไม่หักเงินสดในมือซ้ำ
      fromCapital: input.fromCapital ?? false,
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
      status: LoanStatus.INSTALLMENT,
      cycle: input.cycle,
      interestMode: InterestMode.FLAT,
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

  /**
   * แปลงเป็นยอดตาย: หยุดดอก ตรึงยอด (ต้น+ค้าง)
   * งวดผ่อนไม่บังคับ — ไม่ระบุ = ลูกหนี้ทยอยคืนเมื่อไหร่ก็ได้ ไม่มีกำหนดตายตัว
   */
  async convertToDead(id: string, installmentAmount?: number): Promise<Loan> {
    const loan = await this.findOne(id);
    if (loan.status !== LoanStatus.ACTIVE)
      throw new BadRequestException('แปลงได้เฉพาะยอดปกติ');
    if (installmentAmount !== undefined && installmentAmount <= 0)
      throw new BadRequestException('งวดผ่อนต้องมากกว่า 0');
    loan.status = LoanStatus.DEAD;
    loan.deadDate = todayStr();
    loan.deadBalance = round2(loan.outstandingPrincipal + loan.arrears);
    loan.installmentAmount = installmentAmount ?? null;
    await this.loans.update(loan.id, {
      status: loan.status,
      deadDate: loan.deadDate,
      deadBalance: loan.deadBalance,
      installmentAmount: loan.installmentAmount,
    });
    await this.activity.log({
      type: ActivityType.CONVERT_DEAD,
      loanId: loan.id,
      debtorId: loan.debtorId,
      debtorName: loan.debtor?.name ?? null,
      message: `แปลงเป็นยอดตาย (ตรึง ฿${loan.deadBalance}, ${
        installmentAmount
          ? `ผ่อน ฿${installmentAmount}/10วัน`
          : 'ทยอยคืนไม่มีกำหนด'
      })`,
      meta: {
        deadBalance: loan.deadBalance,
        installmentAmount: installmentAmount ?? null,
      },
    });
    return loan;
  }

  /** อัปเดตยอดเงินหลังรับชำระ/ลบรายการ แล้วปิด-เปิดยอดตามสถานะจริง */
  async applyBalances(loan: Loan): Promise<Loan> {
    // หนี้สูญ: ตรึงยอดไว้เป็นผลขาดทุน ไม่ auto ปิด/เปิดตามยอด
    if (loan.status === LoanStatus.BAD_DEBT) {
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

    if (settled && loan.status !== LoanStatus.CLOSED) {
      loan.status = LoanStatus.CLOSED;
      loan.closedAt = todayStr();
    } else if (!settled && loan.status === LoanStatus.CLOSED) {
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

  /**
   * แก้เงื่อนไขยอดกู้: อัตราดอก / รอบเก็บ / งวดผ่อน / นัดคืนต้น / หมายเหตุ
   * ยอดตายไม่มีดอกและไม่มีรอบเก็บ — ส่งมาแค่ที่เกี่ยวข้องได้ ไม่บังคับกรอกดอก
   */
  async editTerms(
    id: string,
    input: {
      interestRatePercent?: number;
      cycle?: RevolvingCycle;
      /** ยอดตาย: งวดผ่อน/10 วัน (null = ทยอยคืนเมื่อไหร่ก็ได้) */
      installmentAmount?: number | null;
      principalDueDate?: string | null;
      principalDueAmount?: number | null;
      note?: string | null;
    },
  ): Promise<Loan> {
    const loan = await this.findOne(id);
    const before = {
      interestRatePercent: loan.interestRatePercent,
      cycle: loan.cycle,
      installmentAmount: loan.installmentAmount,
      principalDueDate: loan.principalDueDate,
      principalDueAmount: loan.principalDueAmount,
      note: loan.note,
    };
    const patch: Partial<Loan> = {};
    if (input.interestRatePercent !== undefined) {
      if (loan.status === LoanStatus.DEAD)
        throw new BadRequestException('ยอดตายไม่คิดดอกเบี้ย');
      if (input.interestRatePercent <= 0)
        throw new BadRequestException('อัตราดอกต้องมากกว่า 0');
      patch.interestRatePercent = input.interestRatePercent;
    }
    if (input.cycle !== undefined) {
      if (loan.status === LoanStatus.DEAD)
        throw new BadRequestException('ยอดตายไม่มีรอบเก็บดอก');
      patch.cycle = input.cycle;
    }
    if (input.installmentAmount !== undefined) {
      if (loan.status !== LoanStatus.DEAD)
        throw new BadRequestException('แก้งวดผ่อนได้เฉพาะยอดตาย');
      if (input.installmentAmount !== null && input.installmentAmount <= 0)
        throw new BadRequestException('งวดผ่อนต้องมากกว่า 0');
      patch.installmentAmount = input.installmentAmount;
    }
    if (input.principalDueDate !== undefined)
      patch.principalDueDate = input.principalDueDate;
    if (input.principalDueAmount !== undefined) {
      if (input.principalDueAmount !== null && input.principalDueAmount < 0)
        throw new BadRequestException('ยอดนัดคืนต้นต้องไม่ติดลบ');
      patch.principalDueAmount =
        input.principalDueAmount === null
          ? null
          : round2(input.principalDueAmount);
    }
    if (input.note !== undefined) patch.note = input.note;
    await this.loans.update(id, patch);
    // เปลี่ยนรอบเก็บ: ลบรอบดอกที่ยังไม่สะสม แล้วให้ gen ใหม่ตามรอบใหม่
    if (input.cycle !== undefined && input.cycle !== before.cycle) {
      await this.cycleRows.delete({ loanId: id, accrued: false });
    }
    await this.activity.log({
      type: ActivityType.EDIT_LOAN,
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
      /** ยอดหนี้สูญ (สถานะ BAD_DEBT) — แก้ยอดขาดทุนตรงๆ */
      badDebtLoss?: number;
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
    if (loan.status === LoanStatus.BAD_DEBT) {
      if (input.badDebtLoss === undefined)
        throw new BadRequestException('ยอดหนี้สูญให้ปรับ badDebtLoss');
      if (input.badDebtLoss < 0)
        throw new BadRequestException('ยอดหนี้สูญต้องไม่ติดลบ');
      this.setLoss(loan, input.badDebtLoss);
    } else if (
      loan.status === LoanStatus.DEAD ||
      loan.status === LoanStatus.INSTALLMENT
    ) {
      if (input.deadBalance === undefined)
        throw new BadRequestException('ยอดตาย/ผ่อนงวดให้ปรับ deadBalance');
      if (input.deadBalance < 0)
        throw new BadRequestException('ยอดต้องไม่ติดลบ');
      loan.deadBalance = round2(input.deadBalance);
      // ผ่อนงวด: sync ต้นคงเหลือให้สัมพันธ์กับยอดผ่อนที่เหลือ
      if (
        loan.status === LoanStatus.INSTALLMENT &&
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
      type: ActivityType.ADJUST,
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
    if (loan.status === LoanStatus.CLOSED)
      throw new BadRequestException('ยอดนี้ปิดอยู่แล้ว');
    loan.status = LoanStatus.CLOSED;
    loan.closedAt = todayStr();
    await this.loans.update(id, {
      status: loan.status,
      closedAt: loan.closedAt,
    });
    await this.activity.log({
      type: ActivityType.CLOSE,
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
    if (
      loan.status === LoanStatus.CLOSED ||
      loan.status === LoanStatus.BAD_DEBT
    )
      throw new BadRequestException('ยอดนี้ปิด/ตัดหนี้สูญไปแล้ว');
    const loss = this.lossOf(loan);
    loan.status = LoanStatus.BAD_DEBT;
    loan.closedAt = todayStr();
    await this.loans.update(id, {
      status: loan.status,
      closedAt: loan.closedAt,
    });
    await this.activity.log({
      type: ActivityType.WRITE_OFF,
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
      loan.status === LoanStatus.ACTIVE ||
      loan.status === LoanStatus.DEAD ||
      loan.status === LoanStatus.INSTALLMENT
    )
      throw new BadRequestException('ยอดนี้เปิดอยู่แล้ว');
    // ผ่อนงวด: กลับสู่สถานะผ่อนต่อ ตรึงตารางผ่อนเดิมไว้
    if (this.isInstallment(loan)) {
      loan.status = LoanStatus.INSTALLMENT;
      loan.closedAt = null;
      await this.loans.update(id, { status: loan.status, closedAt: null });
      await this.activity.log({
        type: ActivityType.REOPEN,
        loanId: id,
        debtorId: loan.debtorId,
        debtorName: loan.debtor?.name ?? null,
        message: 'เปิดยอดผ่อนงวดคืน',
      });
      return loan;
    }
    const yesterday = addDays(todayStr(), -1);
    loan.status = LoanStatus.ACTIVE;
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
      type: ActivityType.REOPEN,
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
      type: ActivityType.DELETE_LOAN,
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
