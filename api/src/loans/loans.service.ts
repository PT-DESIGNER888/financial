import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityService } from '../activity/activity.service';
import { addDays, diffDays, todayStr } from '../common/date.util';
import { Loan } from '../entities/loan.entity';

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
      const step = loan.cycle === 'DAILY' ? 1 : 10;
      const diff = diffDays(loan.startDate, d);
      return (
        diff > 0 && diff % step === 0 && diff / step <= (loan.installmentCount ?? 0)
      );
    }
    const diff = diffDays(loan.startDate, d);
    if (diff <= 0) return false;
    return loan.cycle === 'DAILY' ? true : diff % 10 === 0;
  }

  /** ยอดผ่อนสินค้าใช่ไหม (ตรวจจาก installmentCount ที่ตั้งไว้ตอนเปิดยอด — คงอยู่แม้ปิด) */
  isInstallment(loan: Loan): boolean {
    return loan.installmentCount != null;
  }

  /**
   * ตารางผ่อน (amortization schedule) ของยอดผ่อนสินค้า
   * แต่ละงวดเท่ากัน (งวดสุดท้ายซับเศษ), จัดสรรเงินที่ผ่อนมาแล้วแบบไล่งวด
   * เพื่อบอกงวดที่จ่ายแล้ว/ค้าง และยอดที่ถึงกำหนด ณ วันนี้ (รวมงวดค้าง)
   */
  buildInstallmentSchedule(loan: Loan, asOf: string = todayStr()) {
    if (loan.installmentCount == null || loan.installmentTotal == null) {
      return null;
    }
    const step = loan.cycle === 'DAILY' ? 1 : 10;
    const n = loan.installmentCount;
    const per = loan.installmentAmount ?? round2(loan.installmentTotal / n);
    const remaining = loan.deadBalance ?? 0;
    const paidTotal = Math.max(0, round2(loan.installmentTotal - remaining));

    let remainPaid = paidTotal;
    let scheduledDueByAsOf = 0;
    const rows = [] as {
      n: number;
      dueDate: string;
      scheduled: number;
      paid: number;
      status: 'PAID' | 'PARTIAL' | 'DUE' | 'PENDING';
    }[];
    for (let k = 1; k <= n; k++) {
      const dueDate = addDays(loan.startDate, k * step);
      const scheduled =
        k === n ? round2(loan.installmentTotal - per * (n - 1)) : per;
      const applied = Math.min(remainPaid, scheduled);
      remainPaid = round2(remainPaid - applied);
      const isPast = diffDays(dueDate, asOf) >= 0;
      if (isPast) scheduledDueByAsOf = round2(scheduledDueByAsOf + scheduled);
      let status: 'PAID' | 'PARTIAL' | 'DUE' | 'PENDING';
      if (applied >= scheduled - 0.001) status = 'PAID';
      else if (applied > 0) status = 'PARTIAL';
      else status = isPast ? 'DUE' : 'PENDING';
      rows.push({ n: k, dueDate, scheduled, paid: round2(applied), status });
    }

    const paidCount = rows.filter((r) => r.status === 'PAID').length;
    // ยอดที่ควรจ่ายถึงวันนี้ − ที่จ่ายมาแล้ว (รวมงวดค้างเก่า) ไม่เกินยอดคงเหลือ
    const dueNow = Math.max(
      0,
      round2(Math.min(scheduledDueByAsOf - paidTotal, remaining)),
    );
    const next = rows.find((r) => r.status !== 'PAID');
    return {
      installmentTotal: loan.installmentTotal,
      installmentCount: n,
      installmentAmount: per,
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
      throw new BadRequestException('ยอดนี้ไม่ใช่ยอดผ่อนสินค้า');
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
    cycle: 'DAILY' | 'TEN_DAY';
    interestMode?: 'FLOATING' | 'FLAT';
    installmentCount?: number;
    installmentTotal?: number;
    startDate?: string;
    note?: string;
  }): Promise<Loan> {
    // ยอดผ่อนสินค้า: กำหนดยอดเต็ม (ต้น+ดอกรวม) แล้วหารเป็น N งวดเท่ากันตั้งแต่ต้น
    if (input.type === 'INSTALLMENT') {
      return this.createInstallment(input);
    }
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

  /** เปิดยอดผ่อนสินค้า: ตรึงยอดเต็มแล้วผ่อน N งวดเท่ากันตามรอบ */
  private async createInstallment(input: {
    debtorId: string;
    principalOriginal: number;
    installmentCount?: number;
    installmentTotal?: number;
    cycle: 'DAILY' | 'TEN_DAY';
    startDate?: string;
    note?: string;
  }): Promise<Loan> {
    const count = input.installmentCount ?? 0;
    const total = input.installmentTotal ?? 0;
    if (!Number.isInteger(count) || count < 1)
      throw new BadRequestException('จำนวนงวดต้องเป็นจำนวนเต็มตั้งแต่ 1 งวด');
    if (total <= 0) throw new BadRequestException('ยอดผ่อนรวมต้องมากกว่า 0');
    if (total < input.principalOriginal)
      throw new BadRequestException('ยอดผ่อนรวมต้องไม่น้อยกว่าเงินต้น');
    const startDate = input.startDate ?? todayStr();
    const per = round2(total / count);
    const loan = this.loans.create({
      debtorId: input.debtorId,
      status: 'INSTALLMENT',
      cycle: input.cycle,
      interestMode: 'FLAT',
      principalOriginal: input.principalOriginal,
      outstandingPrincipal: input.principalOriginal,
      interestRatePercent: 0,
      arrears: 0,
      startDate,
      accruedThrough: startDate,
      installmentCount: count,
      installmentTotal: round2(total),
      installmentAmount: per,
      deadBalance: round2(total),
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
    // ยอดตาย/ผ่อนสินค้าดูแค่ deadBalance (ต้น/ค้างเดิมถูกตรึงไว้เฉยๆ)
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
        throw new BadRequestException('ยอดตาย/ผ่อนสินค้าให้ปรับ deadBalance');
      if (input.deadBalance < 0)
        throw new BadRequestException('ยอดต้องไม่ติดลบ');
      loan.deadBalance = round2(input.deadBalance);
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
    // ผ่อนสินค้า: กลับสู่สถานะผ่อนต่อ ตรึงตารางผ่อนเดิมไว้
    if (this.isInstallment(loan)) {
      loan.status = 'INSTALLMENT';
      loan.closedAt = null;
      await this.loans.update(id, { status: loan.status, closedAt: null });
      await this.activity.log({
        type: 'REOPEN',
        loanId: id,
        debtorId: loan.debtorId,
        debtorName: loan.debtor?.name ?? null,
        message: 'เปิดยอดผ่อนสินค้าคืน',
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

function cycleLabelTh(c: 'DAILY' | 'TEN_DAY'): string {
  return c === 'DAILY' ? 'รายวัน' : 'ราย 10 วัน';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
