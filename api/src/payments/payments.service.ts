import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { todayStr } from '../common/date.util';
import { LoanStatus, PaymentType } from '../common/enums';
import { Loan } from '../entities/loan.entity';
import { Payment } from '../entities/payment.entity';
import { LoansService } from '../loans/loans.service';

export interface RecordPaymentInput {
  loanId: string;
  paidDate?: string;
  amount: number;
  /** ประเภทการรับชำระ: INTEREST = ชำระดอก (ห้ามแตะต้น), PRINCIPAL = ลดต้นอย่างเดียว,
   *  BOTH = ค้างเก่า → ดอก → ตัดต้น (ค่าเริ่มต้นเดิม) */
  paymentType?: PaymentType;
  /** ยอดดอกรอบนี้ที่ตกลงเก็บจริง — บันทึกลงรอบดอก (override ที่ระบบคำนวณ) */
  interestDueOverride?: number;
  /** ไม่ส่งมา = ให้ระบบจัดสรรเอง (ตามประเภทการรับชำระ) */
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

  /**
   * คำนวณการจัดสรรอัตโนมัติตามประเภทการรับชำระ
   *  - INTEREST: ค้างเก่า → ดอกรอบนี้ (เงินต้นคงเดิมเสมอ)
   *  - PRINCIPAL: ลดต้นอย่างเดียว
   *  - BOTH: ค้างเก่า → ดอกรอบนี้ → ตัดต้น (พฤติกรรมเดิม)
   * "ดอกรอบนี้" = รอบดอกที่กำลังเดิน (จ่ายได้ตลอดรอบ ไม่ต้องรอวันครบกำหนดพอดี)
   * interestDueOverride = ยอดดอกรอบนี้ที่ตกลงเก็บจริง (พรีวิวก่อนบันทึก)
   */
  async suggestAllocation(
    loanId: string,
    amount: number,
    paymentType: PaymentType = PaymentType.BOTH,
    interestDueOverride?: number,
  ) {
    const loan = await this.loansService.findOne(loanId);
    // ยอดหนี้สูญที่เก็บคืนได้ทีหลัง รับเป็นเงินก้อนเดียวเหมือนยอดตาย (หักยอดขาดทุนลง)
    const frozen =
      loan.status === LoanStatus.DEAD ||
      loan.status === LoanStatus.INSTALLMENT ||
      loan.status === LoanStatus.BAD_DEBT;
    if (frozen) {
      const principalBalance =
        loan.status === LoanStatus.BAD_DEBT
          ? this.loansService.lossOf(loan)
          : (loan.deadBalance ?? 0);
      const principalPaid = Math.min(amount, principalBalance);
      return {
        arrearsPaid: 0,
        interestPaid: 0,
        principalPaid,
        dueToday: 0,
        arrearsDue: 0,
        interestDue: 0,
        principalBalance,
        maxReceivable: principalBalance,
        remainingPrincipal: round2(principalBalance - principalPaid),
        cycle: null,
      };
    }
    const cur = this.loansService.currentCycleInfo(loan);
    const cycleDue =
      interestDueOverride !== undefined && cur
        ? round2(interestDueOverride)
        : (cur?.interestDue ?? 0);
    const interestRemaining = cur
      ? Math.max(0, round2(cycleDue - cur.interestPaid))
      : 0;
    const arrearsDue = loan.arrears;
    const principalBalance = loan.outstandingPrincipal;

    const canArrears = paymentType !== PaymentType.PRINCIPAL;
    const canInterest = paymentType !== PaymentType.PRINCIPAL;
    const canPrincipal = paymentType !== PaymentType.INTEREST;

    let rest = amount;
    const arrearsPaid = canArrears ? Math.min(rest, arrearsDue) : 0;
    rest = round2(rest - arrearsPaid);
    const interestPaid = canInterest ? Math.min(rest, interestRemaining) : 0;
    rest = round2(rest - interestPaid);
    const principalPaid = canPrincipal ? Math.min(rest, principalBalance) : 0;

    const maxReceivable = round2(
      (canArrears ? arrearsDue : 0) +
        (canInterest ? interestRemaining : 0) +
        (canPrincipal ? principalBalance : 0),
    );
    return {
      arrearsPaid,
      interestPaid,
      principalPaid,
      dueToday: cur && cur.dueDate === todayStr() ? cycleDue : 0,
      arrearsDue,
      interestDue: interestRemaining,
      principalBalance,
      maxReceivable,
      remainingPrincipal: round2(principalBalance - principalPaid),
      /** ข้อมูลรอบดอกที่กำลังเดิน — ให้หน้าเว็บโชว์/แก้ยอดดอกและวันครบกำหนด */
      cycle: cur
        ? {
            cycleId: cur.cycleId,
            dueDate: cur.dueDate,
            computedInterest: cur.computedInterest,
            interestOverride:
              interestDueOverride !== undefined
                ? round2(interestDueOverride)
                : cur.interestOverride,
            interestDue: cycleDue,
            interestPaid: cur.interestPaid,
          }
        : null,
    };
  }

  async record(input: RecordPaymentInput): Promise<Payment> {
    let loan = await this.loansService.findOne(input.loanId);
    if (loan.status === LoanStatus.CLOSED)
      throw new BadRequestException('ยอดนี้ปิดแล้ว');
    if (input.amount <= 0)
      throw new BadRequestException('จำนวนเงินต้องมากกว่า 0');

    // ตกลงลดดอกรอบนี้: บันทึกลงรอบดอกก่อน แล้วค่อยจัดสรร (ส่วนต่างไม่ค้างเป็นหนี้)
    if (
      input.interestDueOverride !== undefined &&
      loan.status === LoanStatus.ACTIVE
    ) {
      const cur = this.loansService.currentCycleInfo(loan);
      if (
        cur &&
        round2(input.interestDueOverride) !==
          (cur.interestOverride ?? cur.computedInterest)
      ) {
        await this.loansService.updateCycle(loan.id, cur.cycleId, {
          interestOverride: round2(input.interestDueOverride),
        });
        loan = await this.loansService.findOne(input.loanId);
      }
    }

    const paymentType = input.paymentType;
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
        throw new BadRequestException('ยอดจัดสรรรวมไม่เท่ากับจำนวนเงินที่รับ');
    } else {
      const s = await this.suggestAllocation(
        input.loanId,
        input.amount,
        paymentType ?? PaymentType.BOTH,
      );
      arrearsPaid = s.arrearsPaid;
      interestPaid = s.interestPaid;
      principalPaid = s.principalPaid;
      const sum = round2(arrearsPaid + interestPaid + principalPaid);
      if (sum < round2(input.amount))
        throw new BadRequestException(
          `จำนวนเงินเกินยอดที่รับได้ (รับได้สูงสุด ${sum})`,
        );
    }

    // กันเงินไหลผิดประเภท: เลือก "ชำระดอก" แล้วต้นต้องไม่ลด และกลับกัน
    if (paymentType === PaymentType.INTEREST && principalPaid > 0)
      throw new BadRequestException(
        'เลือก "ชำระดอก" ไว้ — ห้ามมียอดตัดเงินต้น (เงินต้นคงเดิม)',
      );
    if (
      paymentType === PaymentType.PRINCIPAL &&
      (arrearsPaid > 0 || interestPaid > 0)
    )
      throw new BadRequestException(
        'เลือก "ลดเงินต้น" ไว้ — ยอดทั้งหมดต้องเป็นตัดเงินต้น',
      );

    // เก็บคืนได้จากยอดที่ตัดหนี้สูญไปแล้ว — หักยอดขาดทุนลง ไม่ต้องเปิดยอดคืน
    const recovering = loan.status === LoanStatus.BAD_DEBT;
    const frozen =
      recovering ||
      loan.status === LoanStatus.DEAD ||
      loan.status === LoanStatus.INSTALLMENT;
    if (recovering) {
      if (arrearsPaid || interestPaid)
        throw new BadRequestException('ยอดหนี้สูญรับเป็นเงินคืนอย่างเดียว');
      const loss = this.loansService.lossOf(loan);
      if (principalPaid > loss)
        throw new BadRequestException('เกินยอดหนี้สูญคงเหลือ');
      this.loansService.setLoss(loan, round2(loss - principalPaid));
    } else if (frozen) {
      if (arrearsPaid || interestPaid)
        throw new BadRequestException(
          'ยอดตาย/ผ่อนงวดรับเป็นเงินผ่อนอย่างเดียว',
        );
      if (principalPaid > (loan.deadBalance ?? 0))
        throw new BadRequestException('เกินยอดผ่อนคงเหลือ');
      loan.deadBalance = round2((loan.deadBalance ?? 0) - principalPaid);
      // ผ่อนงวด: ให้ต้นคงเหลือสัมพันธ์กับยอดผ่อนที่เหลือ
      if (
        loan.status === LoanStatus.INSTALLMENT &&
        loan.installmentTotal &&
        loan.installmentTotal > 0
      ) {
        loan.outstandingPrincipal = round2(
          (loan.principalOriginal * (loan.deadBalance ?? 0)) /
            loan.installmentTotal,
        );
      }
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
      paymentType: frozen ? null : (paymentType ?? null),
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

    if (loan.status === LoanStatus.BAD_DEBT && payment.onDeadLoan) {
      // ลบรายการเก็บคืน — ยอดขาดทุนกลับไปเท่าเดิม
      this.loansService.setLoss(
        loan,
        round2(this.loansService.lossOf(loan) + payment.principalPaid),
      );
    } else if (payment.onDeadLoan) {
      loan.deadBalance = round2(
        (loan.deadBalance ?? 0) + payment.principalPaid,
      );
      if (
        loan.status === LoanStatus.INSTALLMENT &&
        loan.installmentTotal &&
        loan.installmentTotal > 0
      ) {
        loan.outstandingPrincipal = round2(
          (loan.principalOriginal * (loan.deadBalance ?? 0)) /
            loan.installmentTotal,
        );
      }
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
