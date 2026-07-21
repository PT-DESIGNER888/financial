import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { todayStr } from '../common/date.util';
import { LoanStatus } from '../common/enums';
import { Debtor } from '../entities/debtor.entity';
import { Loan } from '../entities/loan.entity';
import { Payment } from '../entities/payment.entity';
import { round2 } from '../loans/installment-plan';
import { LoansService } from '../loans/loans.service';

/** รายการเก็บของยอดกู้หนึ่งก้อนในวันที่เลือก */
export interface DayLoanItem {
  loanId: string;
  contractNumber: string | null;
  status: LoanStatus;
  cycle: string;
  outstandingPrincipal: number;
  deadBalance: number | null;
  /** ยอดค้างสะสม — แสดงเป็นข้อมูลประกอบ ไม่รวมในยอดที่ต้องเก็บวันนี้ */
  arrears: number;
  dueInterest: number;
  duePrincipal: number;
  dueInstallment: number;
  dueTotal: number;
  paidToday: number;
  remainingToday: number;
  principalDueDate: string | null;
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
    private loansService: LoansService,
  ) {}

  /**
   * ยอดกู้ที่เกี่ยวข้องกับวันที่เลือก = ยอดที่ยังเปิดอยู่ + ยอดที่ปิด/ตัดหนี้สูญไปแล้ว
   * แต่มีเงินเข้าในวันนั้น (ลูกหนี้ปิดยอดวันนี้ต้องยังนับเป็นเงินที่เก็บได้วันนี้)
   */
  private async loansForDay(day: string): Promise<Loan[]> {
    const open = await this.loans.find({
      where: {
        status: In([
          LoanStatus.ACTIVE,
          LoanStatus.DEAD,
          LoanStatus.INSTALLMENT,
        ]),
      },
      relations: { debtor: true, cycles: true, payments: true },
    });
    const openIds = new Set(open.map((l) => l.id));
    const paidThatDay = await this.payments.find({ where: { paidDate: day } });
    const settledIds = [
      ...new Set(
        paidThatDay.map((p) => p.loanId).filter((id) => !openIds.has(id)),
      ),
    ];
    if (settledIds.length === 0) return open;
    const settled = await this.loans.find({
      where: { id: In(settledIds) },
      relations: { debtor: true, cycles: true, payments: true },
    });
    return [...open, ...settled];
  }

  /** ยอดที่ต้องเก็บของยอดกู้หนึ่งก้อนในวันที่เลือก (ยอดค้างแยกออก ไม่รวมใน dueTotal) */
  private dayItem(loan: Loan, day: string): DayLoanItem {
    const frozen =
      loan.status === LoanStatus.DEAD || loan.status === LoanStatus.INSTALLMENT;

    // ดอกรอบที่ครบกำหนดวันนี้ — หักที่จ่ายมาแล้วในรอบ (จ่ายล่วงหน้า/แบ่งจ่าย)
    const cycle = this.loansService.cycleStatusOn(loan, day);
    const dueInterest = cycle?.interestDue ?? 0;
    const remainingInterest = cycle?.interestRemaining ?? 0;

    // นัดคืนต้น: ถึงวันนัดแล้วโชว์เป็นยอดที่ต้องรับ (ไม่ระบุยอด = ทั้งต้นคงเหลือ)
    let duePrincipal = 0;
    if (!frozen && loan.principalDueDate === day) {
      duePrincipal = Math.min(
        loan.principalDueAmount ?? loan.outstandingPrincipal,
        loan.outstandingPrincipal,
      );
    }
    const principalPaidThatDay = (loan.payments ?? [])
      .filter((p) => p.paidDate === day && !p.onDeadLoan)
      .reduce((s, p) => s + p.principalPaid, 0);
    const remainingPrincipal = Math.max(
      0,
      round2(duePrincipal - principalPaidThatDay),
    );

    // ยอดตาย/ผ่อนงวดที่ถึงกำหนดวันนี้
    let dueInstallment = 0;
    if (loan.status === LoanStatus.DEAD) {
      if (this.loansService.isDueOn(loan, day)) {
        dueInstallment = Math.min(
          loan.installmentAmount ?? 0,
          loan.deadBalance ?? 0,
        );
      }
    } else if (loan.status === LoanStatus.INSTALLMENT) {
      dueInstallment =
        this.loansService.buildInstallmentSchedule(loan, day)?.dueNow ?? 0;
    }
    const deadPaidThatDay = (loan.payments ?? [])
      .filter((p) => p.paidDate === day && p.onDeadLoan)
      .reduce((s, p) => s + p.amount, 0);
    const remainingInstallment = Math.max(
      0,
      round2(dueInstallment - deadPaidThatDay),
    );

    const paidToday = round2(
      (loan.payments ?? [])
        .filter((p) => p.paidDate === day)
        .reduce((s, p) => s + p.amount, 0),
    );

    return {
      loanId: loan.id,
      contractNumber: loan.contractNumber,
      status: loan.status,
      cycle: loan.cycle,
      outstandingPrincipal: loan.outstandingPrincipal,
      deadBalance: loan.deadBalance,
      // ยอดตาย/ผ่อนงวด: ต้น/ค้างเดิมถูกตรึงเข้า deadBalance แล้ว ไม่นับซ้ำ
      arrears: frozen ? 0 : loan.arrears,
      dueInterest,
      duePrincipal,
      dueInstallment,
      dueTotal: round2(dueInterest + duePrincipal + dueInstallment),
      paidToday,
      remainingToday: round2(
        remainingInterest + remainingPrincipal + remainingInstallment,
      ),
      principalDueDate: loan.principalDueDate,
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
   * - ยอดค้างสะสมไม่รวมใน "ต้องเก็บวันนี้" (ดูแยกที่หน้ายอดค้าง) แต่โชว์เป็นข้อมูลประกอบ
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

    const loans = (await this.loansForDay(day)).filter(
      (l) => l.debtorId === debtorId,
    );
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
    const deadTotal = round2(
      all
        .filter((l) => l.status !== LoanStatus.ACTIVE)
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
      deadTotal,
      /** ยอดคงเหลือทั้งหมดที่ลูกหนี้ยังติดอยู่ */
      balanceTotal: round2(principalTotal + arrearsTotal + deadTotal),
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
      if (loan.status === LoanStatus.ACTIVE) {
        if (loan.arrears > 0) overdue.push({ loan, amount: loan.arrears });
      } else if (loan.status === LoanStatus.INSTALLMENT) {
        const dueNow =
          this.loansService.buildInstallmentSchedule(loan, today)?.dueNow ?? 0;
        if (dueNow > 0) overdue.push({ loan, amount: dueNow });
        if ((loan.deadBalance ?? 0) > 0)
          dead.push({ loan, amount: loan.deadBalance ?? 0 });
      } else if ((loan.deadBalance ?? 0) > 0) {
        dead.push({ loan, amount: loan.deadBalance ?? 0 });
      }
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
    const loans = await this.loans.find();
    const pays = await this.payments.find();

    const active = loans.filter((l) => l.status === LoanStatus.ACTIVE);
    const dead = loans.filter((l) => l.status === LoanStatus.DEAD);
    const installment = loans.filter(
      (l) => l.status === LoanStatus.INSTALLMENT,
    );
    const badDebtLoans = loans.filter((l) => l.status === LoanStatus.BAD_DEBT);

    const interestCollected = pays.reduce(
      (s, p) => s + p.interestPaid + p.arrearsPaid,
      0,
    );
    // ยอดที่ตัดหนี้สูญ = ผลขาดทุน (ยอดตาย/ผ่อนงวดดู deadBalance, ยอดปกติดู ต้น+ค้าง)
    const badDebt = badDebtLoans.reduce(
      (s, l) =>
        s +
        (l.deadDate != null || l.installmentCount != null
          ? (l.deadBalance ?? 0)
          : l.outstandingPrincipal + l.arrears),
      0,
    );

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
      interestCollected,
      principalCollected: pays.reduce((s, p) => s + p.principalPaid, 0),
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
