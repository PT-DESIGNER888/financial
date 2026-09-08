import { LoanStatus, PaymentType, type LoanCycle } from '@/lib/types';
import type { RecordPaymentInput } from '@/lib/hooks/usePayments';

/** รายการยอดค้างของสัญญาหนึ่งก้อน ที่จะรับรวมทีเดียว */
export interface ArrearsReceiveItem {
  loanId: string;
  contractNumber: string | null;
  status: LoanStatus;
  amount: number;
  cycle?: LoanCycle;
}

/**
 * สร้าง payload รับเงินเฉพาะยอดค้าง
 *  - ยอดปกติ: ประเภท ARREARS — ไม่แตะดอกรอบนี้/เงินต้น
 *  - ผ่อนงวด: รับเป็นเงินผ่อนก้อนเดียว (API ไม่รับประเภท ARREARS กับยอดผ่อน)
 */
export function buildArrearsPayment(
  item: Pick<ArrearsReceiveItem, 'loanId' | 'status' | 'amount'>,
  paidDate: string,
): RecordPaymentInput {
  const amount = Math.max(0, item.amount);
  if (item.status === LoanStatus.INSTALLMENT) {
    return { loanId: item.loanId, amount, paidDate };
  }
  return {
    loanId: item.loanId,
    amount,
    paidDate,
    paymentType: PaymentType.ARREARS,
  };
}
