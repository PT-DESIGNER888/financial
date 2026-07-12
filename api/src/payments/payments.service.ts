import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { todayStr } from '../common/date.util';
import { Loan } from '../entities/loan.entity';
import { Payment } from '../entities/payment.entity';
import { LoansService } from '../loans/loans.service';

export interface RecordPaymentInput {
  loanId: string;
  paidDate?: string;
  amount: number;
  /** ไม่ส่งมา = ให้ระบบจัดสรรเอง (ค้างเก่า → ดอกวันนี้ → ตัดต้น) */
  arrearsPaid?: number;
  interestPaid?: number;
  principalPaid?: number;
  note?: string;
}

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment) private payments: Repository<Payment>,
    private loansService: LoansService,
  ) {}

  /** คำนวณการจัดสรรอัตโนมัติ: ค้างเก่า → ดอกวันนี้ → ตัดต้น */
  async suggestAllocation(loanId: string, amount: number) {
    const loan = await this.loansService.findOne(loanId);
    if (loan.status === 'DEAD' || loan.status === 'INSTALLMENT') {
      return { arrearsPaid: 0, interestPaid: 0, principalPaid: amount };
    }
    const today = todayStr();
    const dueToday = this.loansService.isDueOn(loan, today)
      ? this.loansService.interestPerCycle(loan)
      : 0;
    const paidTodayInterest = (loan.payments ?? [])
      .filter((p) => p.paidDate === today)
      .reduce((s, p) => s + p.interestPaid, 0);
    const interestRemaining = Math.max(0, dueToday - paidTodayInterest);

    let rest = amount;
    const arrearsPaid = Math.min(rest, loan.arrears);
    rest = round2(rest - arrearsPaid);
    const interestPaid = Math.min(rest, interestRemaining);
    rest = round2(rest - interestPaid);
    const principalPaid = Math.min(rest, loan.outstandingPrincipal);
    return { arrearsPaid, interestPaid, principalPaid, dueToday };
  }

  async record(input: RecordPaymentInput): Promise<Payment> {
    const loan = await this.loansService.findOne(input.loanId);
    if (loan.status === 'CLOSED')
      throw new BadRequestException('ยอดนี้ปิดแล้ว');
    if (loan.status === 'BAD_DEBT')
      throw new BadRequestException('ยอดนี้ตัดหนี้สูญแล้ว — เปิดยอดคืนก่อนจึงรับชำระได้');
    if (input.amount <= 0)
      throw new BadRequestException('จำนวนเงินต้องมากกว่า 0');

    const manual =
      input.arrearsPaid !== undefined ||
      input.interestPaid !== undefined ||
      input.principalPaid !== undefined;

    let arrearsPaid: number, interestPaid: number, principalPaid: number;
    if (manual) {
      arrearsPaid = input.arrearsPaid ?? 0;
      interestPaid = input.interestPaid ?? 0;
      principalPaid = input.principalPaid ?? 0;
      const sum = round2(arrearsPaid + interestPaid + principalPaid);
      if (sum !== round2(input.amount))
        throw new BadRequestException(
          'ยอดจัดสรรรวมไม่เท่ากับจำนวนเงินที่รับ',
        );
    } else {
      const s = await this.suggestAllocation(input.loanId, input.amount);
      arrearsPaid = s.arrearsPaid;
      interestPaid = s.interestPaid;
      principalPaid = s.principalPaid;
      const sum = round2(arrearsPaid + interestPaid + principalPaid);
      if (sum < round2(input.amount))
        throw new BadRequestException(
          `จำนวนเงินเกินยอดที่รับได้ (รับได้สูงสุด ${sum})`,
        );
    }

    const frozen = loan.status === 'DEAD' || loan.status === 'INSTALLMENT';
    if (frozen) {
      if (arrearsPaid || interestPaid)
        throw new BadRequestException('ยอดตาย/ผ่อนสินค้ารับเป็นเงินผ่อนอย่างเดียว');
      if (principalPaid > (loan.deadBalance ?? 0))
        throw new BadRequestException('เกินยอดผ่อนคงเหลือ');
      loan.deadBalance = round2((loan.deadBalance ?? 0) - principalPaid);
    } else {
      if (arrearsPaid > loan.arrears)
        throw new BadRequestException('หักค้างเก่าเกินยอดค้าง');
      if (principalPaid > loan.outstandingPrincipal)
        throw new BadRequestException('ตัดต้นเกินต้นคงเหลือ');
      loan.arrears = round2(loan.arrears - arrearsPaid);
      loan.outstandingPrincipal = round2(
        loan.outstandingPrincipal - principalPaid,
      );
    }

    const payment = this.payments.create({
      loan: { id: loan.id } as Loan,
      loanId: loan.id,
      paidDate: input.paidDate ?? todayStr(),
      amount: input.amount,
      arrearsPaid,
      interestPaid,
      principalPaid,
      onDeadLoan: frozen,
      note: input.note ?? null,
    });
    await this.payments.save(payment);
    await this.loansService.applyBalances(loan);
    return payment;
  }

  /** ลบรายการที่บันทึกผิด — คืนยอดกลับตามเดิม */
  async remove(id: string): Promise<void> {
    const payment = await this.payments.findOneBy({ id });
    if (!payment) throw new NotFoundException('ไม่พบรายการ');
    const loan = await this.loansService.findOne(payment.loanId);

    if (payment.onDeadLoan) {
      loan.deadBalance = round2(
        (loan.deadBalance ?? 0) + payment.principalPaid,
      );
    } else {
      loan.arrears = round2(loan.arrears + payment.arrearsPaid);
      loan.outstandingPrincipal = round2(
        loan.outstandingPrincipal + payment.principalPaid,
      );
    }
    await this.payments.delete(id);
    await this.loansService.applyBalances(loan); // เปิดยอดคืนถ้าจำเป็น
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
