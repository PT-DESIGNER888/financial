import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { todayStr } from '../common/date.util';
import { Loan } from '../entities/loan.entity';
import { Payment } from '../entities/payment.entity';
import { LoansService } from '../loans/loans.service';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Loan) private loans: Repository<Loan>,
    @InjectRepository(Payment) private payments: Repository<Payment>,
    private loansService: LoansService,
  ) {}

  /** รายการเก็บประจำวัน: ทุกยอดที่ยังไม่ปิด พร้อมยอดที่ต้องเก็บวันนี้ */
  async today() {
    const today = todayStr();
    await this.loansService.accrueAllActive();
    const loans = await this.loans.find({
      where: { status: In(['ACTIVE', 'DEAD', 'INSTALLMENT']) },
      relations: { debtor: true },
    });
    const todayPayments = await this.payments.find({
      where: { paidDate: today, loanId: In(loans.map((l) => l.id)) },
    });
    const paidByLoan = new Map<string, number>();
    for (const p of todayPayments) {
      paidByLoan.set(p.loanId, (paidByLoan.get(p.loanId) ?? 0) + p.amount);
    }

    const items = loans.map((loan) => {
      const frozen =
        loan.status === 'DEAD' || loan.status === 'INSTALLMENT';
      let isDueToday = this.loansService.isDueOn(loan, today);
      const dueInterest =
        loan.status === 'ACTIVE' && isDueToday
          ? this.loansService.interestPerCycle(loan)
          : 0;
      let dueInstallment = 0;
      if (loan.status === 'DEAD' && isDueToday) {
        dueInstallment = Math.min(
          loan.installmentAmount ?? 0,
          loan.deadBalance ?? 0,
        );
      } else if (loan.status === 'INSTALLMENT') {
        // ผ่อนสินค้า: ยอดที่ถึงกำหนดถึงวันนี้ (รวมงวดค้างเก่า)
        const sch = this.loansService.buildInstallmentSchedule(loan, today);
        dueInstallment = sch?.dueNow ?? 0;
        isDueToday = dueInstallment > 0;
      }
      // ยอดตาย/ผ่อนสินค้า: ต้น/ค้างเดิมถูกตรึงเข้า deadBalance แล้ว ไม่นับซ้ำ
      const arrears = frozen ? 0 : loan.arrears;
      const paidToday = paidByLoan.get(loan.id) ?? 0;
      const dueTotal = dueInterest + dueInstallment + arrears;
      return {
        loanId: loan.id,
        debtorId: loan.debtorId,
        debtorName: loan.debtor.name,
        status: loan.status,
        cycle: loan.cycle,
        outstandingPrincipal: loan.outstandingPrincipal,
        arrears,
        deadBalance: loan.deadBalance,
        isDueToday,
        dueInterest,
        dueInstallment,
        paidToday,
        remainingToday: Math.max(0, dueTotal - paidToday),
      };
    });

    return {
      date: today,
      items: items
        .filter((i) => i.isDueToday || i.arrears > 0 || i.paidToday > 0)
        .sort((a, b) => b.remainingToday - a.remainingToday),
      allOpen: items.length,
    };
  }

  /** สรุปภาพรวมธุรกิจ */
  async summary() {
    await this.loansService.accrueAllActive();
    const loans = await this.loans.find();
    const pays = await this.payments.find();

    const active = loans.filter((l) => l.status === 'ACTIVE');
    const dead = loans.filter((l) => l.status === 'DEAD');
    const installment = loans.filter((l) => l.status === 'INSTALLMENT');
    const badDebtLoans = loans.filter((l) => l.status === 'BAD_DEBT');

    const interestCollected = pays.reduce(
      (s, p) => s + p.interestPaid + p.arrearsPaid,
      0,
    );
    // ยอดที่ตัดหนี้สูญ = ผลขาดทุน (ยอดตาย/ผ่อนสินค้าดู deadBalance, ยอดปกติดู ต้น+ค้าง)
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
        closedLoans: loans.filter((l) => l.status === 'CLOSED').length,
        badDebtLoans: badDebtLoans.length,
      },
    };
  }
}
