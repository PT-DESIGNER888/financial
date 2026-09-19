import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { addDays, todayStr } from '../common/date.util';
import { LoanCycle, LoanStatus, PaymentType } from '../common/enums';
import { Loan } from '../entities/loan.entity';
import { Payment } from '../entities/payment.entity';
import { cycleStep } from '../loans/installment-plan';
import { LoansService } from '../loans/loans.service';

export interface RecordPaymentInput {
  loanId: string;
  paidDate?: string;
  amount: number;
  /** ประเภทการรับชำระ: INTEREST = ชำระดอก (ห้ามแตะต้น), PRINCIPAL = ลดต้นอย่างเดียว,
   *  BOTH = ดอกรอบนี้ → ค้างเก่า → ตัดต้น */
  paymentType?: PaymentType;
  /** ยอดดอกรอบนี้ที่ตกลงเก็บจริง — บันทึกลงรอบดอก (override ที่ระบบคำนวณ) */
  interestDueOverride?: number;
  /** ไม่ส่งมา = ให้ระบบจัดสรรเอง (ตามประเภทการรับชำระ) */
  arrearsPaid?: number;
  interestPaid?: number;
  principalPaid?: number;
  note?: string;
}

export function payoffAmount(input: {
  interestRemaining: number;
  arrearsDue: number;
  principalBalance: number;
}): number {
  return round2(
    Math.max(0, input.interestRemaining) +
      Math.max(0, input.arrearsDue) +
      Math.max(0, input.principalBalance),
  );
}

/**
 * จัดสรรเงินที่รับมาเข้า ดอกรอบนี้ → ค้างเก่า → ตัดต้น
 *
 * ดอกรอบนี้ต้องมาก่อนค้างเก่าเสมอ ไม่งั้นเงินที่เก็บได้วันนี้จะถูกดูดไปหักค้างเก่า
 * ทั้งก้อน แล้วดอกของรอบนี้จะไปตกเป็นยอดค้างเพิ่มตอนจบรอบ — เก็บครบทุกวัน
 * แต่ยอดค้างกลับโตขึ้นเรื่อยๆ (ยอดค้างเก่า "รัน" ไปกับยอดที่ต้องเก็บวันนี้)
 * ส่วนที่เหลือจากดอกรอบนี้ค่อยไปหักค้างเก่า — จ่ายเกินมาก็ยังเคลียร์ของเก่าได้
 */
export function allocatePayment(input: {
  amount: number;
  paymentType: PaymentType;
  /** ดอกรอบที่กำลังเดินที่ยังไม่ได้จ่าย */
  interestRemaining: number;
  /** ยอดค้างสะสมจากรอบก่อนๆ */
  arrearsDue: number;
  principalBalance: number;
}) {
  const { amount, paymentType } = input;
  // ARREARS = เก็บเฉพาะยอดค้างเก่า (ไม่แตะดอกรอบนี้/เงินต้น)
  const canInterest =
    paymentType !== PaymentType.PRINCIPAL &&
    paymentType !== PaymentType.ARREARS;
  const canArrears = paymentType !== PaymentType.PRINCIPAL;
  const canPrincipal =
    paymentType !== PaymentType.INTEREST && paymentType !== PaymentType.ARREARS;

  let rest = amount;
  const interestPaid = canInterest
    ? Math.min(rest, input.interestRemaining)
    : 0;
  rest = round2(rest - interestPaid);
  const arrearsPaid = canArrears ? Math.min(rest, input.arrearsDue) : 0;
  rest = round2(rest - arrearsPaid);
  const principalPaid = canPrincipal
    ? Math.min(rest, input.principalBalance)
    : 0;

  return {
    interestPaid,
    arrearsPaid,
    principalPaid,
    maxReceivable: round2(
      (canInterest ? input.interestRemaining : 0) +
        (canArrears ? input.arrearsDue : 0) +
        (canPrincipal ? input.principalBalance : 0),
    ),
  };
}

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment) private payments: Repository<Payment>,
    private loansService: LoansService,
  ) {}

  /**
   * คำนวณการจัดสรรอัตโนมัติตามประเภทการรับชำระ
   *  - INTEREST: ดอกรอบนี้ → ค้างเก่า (เงินต้นคงเดิมเสมอ)
   *  - PRINCIPAL: ลดต้นอย่างเดียว
   *  - BOTH: ดอกรอบนี้ → ค้างเก่า → ตัดต้น
   * "ดอกรอบนี้" = รอบดอกที่กำลังเดิน (จ่ายได้ตลอดรอบ ไม่ต้องรอวันครบกำหนดพอดี)
   * interestDueOverride = ยอดดอกรอบนี้ที่ตกลงเก็บจริง (พรีวิวก่อนบันทึก)
   */
  async suggestAllocation(
    loanId: string,
    amount: number,
    paymentType: PaymentType = PaymentType.BOTH,
    interestDueOverride?: number,
    paidDate?: string,
  ) {
    const loan = await this.loansService.findOneForSuggest(loanId);
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
    const appt = this.loansService.interestAppointmentQuote(loan);
    const apptOpen =
      !!appt && !!loan.interestDueDate && loan.interestDueDate >= todayStr();
    const cycleDue = apptOpen
      ? interestDueOverride !== undefined
        ? round2(interestDueOverride)
        : appt.agreedAmount
      : interestDueOverride !== undefined && cur
        ? round2(interestDueOverride)
        : (cur?.interestDue ?? 0);
    // รับจากหน้าเก็บย้อนหลัง: รอบนั้นถูก accrue เป็นค้างไปแล้ว จึงต้องหัก arrears
    // ไม่ใช่ไปจ่ายดอกรอบปัจจุบันซ้ำ (paidDate ถูกส่งจากวันที่ผู้ใช้เลือกในหน้าเก็บ)
    const historicalCollection =
      !!paidDate && paidDate < todayStr() && loan.arrears > 0;
    const interestRemaining = historicalCollection
      ? 0
      : apptOpen
        ? Math.max(
            0,
            round2(
              (interestDueOverride !== undefined
                ? round2(interestDueOverride)
                : appt.agreedAmount) - appt.paid,
            ),
          )
        : cur
          ? Math.max(0, round2(cycleDue - cur.interestPaid))
          : 0;
    const arrearsDue = loan.arrears;
    const principalBalance = loan.outstandingPrincipal;

    const { arrearsPaid, interestPaid, principalPaid, maxReceivable } =
      allocatePayment({
        amount,
        paymentType,
        interestRemaining,
        arrearsDue,
        principalBalance,
      });
    return {
      arrearsPaid,
      interestPaid,
      principalPaid,
      dueToday:
        apptOpen && loan.interestDueDate === todayStr()
          ? cycleDue
          : !apptOpen && cur && cur.dueDate === todayStr()
            ? cycleDue
            : 0,
      arrearsDue,
      interestDue: interestRemaining,
      principalBalance,
      maxReceivable,
      remainingPrincipal: round2(principalBalance - principalPaid),
      /** ข้อมูลรอบดอกที่กำลังเดิน — นัดชำระดอกเปิดอยู่จะโชว์ก้อนนัด (ฟิลด์เดิม) */
      cycle: cur
        ? {
            cycleId: cur.cycleId,
            dueDate:
              apptOpen && loan.interestDueDate
                ? loan.interestDueDate
                : cur.dueDate,
            computedInterest: apptOpen
              ? appt.computedTotal
              : cur.computedInterest,
            interestOverride: apptOpen
              ? loan.interestDueAmount
              : interestDueOverride !== undefined
                ? round2(interestDueOverride)
                : cur.interestOverride,
            interestDue: cycleDue,
            interestPaid: apptOpen ? appt.paid : cur.interestPaid,
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

    // ตกลงลดดอก: นัดชำระดอกแก้ยอดก้อนนัด / ไม่มีนัดแก้รอบที่กำลังเดิน
    if (
      input.interestDueOverride !== undefined &&
      loan.status === LoanStatus.ACTIVE
    ) {
      const appt = this.loansService.interestAppointmentQuote(loan);
      const apptOpen =
        !!appt && !!loan.interestDueDate && loan.interestDueDate >= todayStr();
      if (apptOpen) {
        if (round2(input.interestDueOverride) !== appt.agreedAmount) {
          await this.loansService.editTerms(loan.id, {
            interestDueAmount: round2(input.interestDueOverride),
          });
          loan = await this.loansService.findOne(input.loanId);
        }
      } else {
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
        undefined,
        input.paidDate,
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
    if (
      paymentType === PaymentType.ARREARS &&
      (interestPaid > 0 || principalPaid > 0)
    )
      throw new BadRequestException(
        'เลือก "ชำระเฉพาะค้าง" ไว้ — ยอดทั้งหมดต้องเป็นยอดค้างเก่า',
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
    await this.loansService.applyBalances(
      loan,
      paymentType !== PaymentType.INTEREST,
    );
    if (!frozen && loan.status === LoanStatus.ACTIVE) {
      const fresh = await this.loansService.findOne(loan.id);
      const appt = this.loansService.interestAppointmentQuote(fresh);
      if (appt && appt.remaining <= 0 && fresh.interestDueDate) {
        const sorted = [...(fresh.cycles ?? [])].sort((a, b) =>
          a.dueDate.localeCompare(b.dueDate),
        );
        await this.loansService.settleInterestAppointment(
          fresh,
          sorted,
          fresh.payments ?? [],
        );
      }
    }
    return payment;
  }

  /** ยอดปิดสัญญาปกติที่เลือก — ดอกรอบปัจจุบันที่ยังขาด + ค้างเก่า + ต้นคงเหลือ */
  async payoffQuote(loanIds: string[]) {
    const ids = [...new Set(loanIds.filter(Boolean))];
    if (ids.length === 0)
      throw new BadRequestException('เลือกอย่างน้อย 1 สัญญา');

    const items = [];
    let debtorId: string | null = null;
    for (const id of ids) {
      const loan = await this.loansService.findOne(id);
      if (loan.status !== LoanStatus.ACTIVE)
        throw new BadRequestException(
          'รับปิดยอดได้เฉพาะสัญญาปกติที่ยังเปิดอยู่',
        );
      if (debtorId && loan.debtorId !== debtorId)
        throw new BadRequestException(
          'สัญญาที่เลือกต้องเป็นของลูกหนี้คนเดียวกัน',
        );
      debtorId = loan.debtorId;

      const allocation = await this.suggestAllocation(
        id,
        1e12,
        PaymentType.BOTH,
      );
      const interestRemaining = allocation.interestDue ?? 0;
      const arrearsDue = allocation.arrearsDue ?? 0;
      const principalBalance = allocation.principalBalance ?? 0;
      items.push({
        loanId: loan.id,
        contractNumber: loan.contractNumber,
        interestRemaining,
        arrearsDue,
        principalBalance,
        total: payoffAmount({
          interestRemaining,
          arrearsDue,
          principalBalance,
        }),
      });
    }

    return {
      debtorId,
      items,
      total: round2(items.reduce((sum, item) => sum + item.total, 0)),
    };
  }

  /** รับยอดปิดเต็มตามยอดล่าสุดของแต่ละสัญญา แล้วให้ applyBalances ปิดเฉพาะก้อนที่จ่ายครบ */
  async payoff(loanIds: string[], paidDate?: string) {
    const quote = await this.payoffQuote(loanIds);
    const payments: Payment[] = [];
    for (const item of quote.items) {
      if (item.total <= 0) continue;
      payments.push(
        await this.record({
          loanId: item.loanId,
          paidDate,
          amount: item.total,
          paymentType: PaymentType.BOTH,
          note: 'รับปิดยอด',
        }),
      );
    }
    return { ...quote, payments };
  }

  /**
   * พรีวิวชำระดอกล่วงหน้าหลายรอบ (รายวัน/ราย 7/10 วัน) — คำนวณว่าแต่ละรอบข้างหน้า
   * ต้องเก็บดอกวันไหนเท่าไหร่ รวมทั้งหมดเท่าไหร่ โดยยังไม่บันทึกอะไร
   */
  async prepayQuote(loanId: string, count: number) {
    const loan = await this.loansService.findOne(loanId);
    if (loan.status !== LoanStatus.ACTIVE || loan.cycle === LoanCycle.MONTHLY)
      throw new BadRequestException('ชำระล่วงหน้าได้เฉพาะยอดดอกลอย/คงที่');
    const n = Math.max(1, Math.floor(count));
    const step = cycleStep[loan.cycle];
    const cur = this.loansService.currentCycleInfo(loan);
    const startDue = cur?.dueDate ?? this.nextDueDate(loan);
    if (!startDue) throw new BadRequestException('ไม่พบรอบดอกที่จะชำระ');
    const perCycle = this.loansService.interestPerCycle(loan);
    const cycles: { dueDate: string; interest: number }[] = [];
    for (let i = 0; i < n; i++) {
      const d = addDays(startDue, i * step);
      const st = this.loansService.cycleStatusOn(loan, d);
      const interest = st ? st.interestRemaining : perCycle;
      if (interest > 0) cycles.push({ dueDate: d, interest });
    }
    return {
      count: cycles.length,
      total: round2(cycles.reduce((s, c) => s + c.interest, 0)),
      perCycle,
      cycles,
    };
  }

  /**
   * ชำระดอกล่วงหน้าหลายรอบในครั้งเดียว — บันทึกเป็นการจ่ายดอก 1 รายการต่อรอบ
   * ลงวันครบกำหนดของรอบนั้น ให้ตกในหน้าต่างรอบพอดี (ตัดยอดตรงตามวันของแต่ละรอบ)
   * เงินต้น/ยอดค้างไม่ถูกแตะ — เป็นการส่งดอกรอบข้างหน้าไว้ล่วงหน้าล้วนๆ
   */
  async prepayCycles(loanId: string, count: number): Promise<Payment[]> {
    const quote = await this.prepayQuote(loanId, count);
    if (quote.cycles.length === 0)
      throw new BadRequestException('ไม่มีรอบดอกที่ต้องชำระล่วงหน้า');
    const out: Payment[] = [];
    for (const c of quote.cycles) {
      out.push(
        await this.record({
          loanId,
          paidDate: c.dueDate,
          amount: c.interest,
          paymentType: PaymentType.INTEREST,
          interestPaid: c.interest,
          arrearsPaid: 0,
          principalPaid: 0,
          note: 'ชำระดอกล่วงหน้า',
        }),
      );
    }
    return out;
  }

  /** วันครบกำหนดรอบถัดไป (สำรองเมื่อไม่มีรอบที่กำลังเดิน) */
  private nextDueDate(loan: Loan): string | null {
    const today = todayStr();
    for (let i = 0; i <= 370; i++) {
      const d = addDays(today, i);
      if (this.loansService.isDueOn(loan, d)) return d;
    }
    return null;
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
