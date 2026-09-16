import { invalidateAfterPayment } from './keys';
import type { CurrentCycle, Payment, PaymentType } from '@/lib/types';
import { api } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface Allocation {
  arrearsPaid: number;
  interestPaid: number;
  principalPaid: number;
  dueToday?: number;
  arrearsDue?: number;
  interestDue?: number;
  principalBalance?: number;
  maxReceivable?: number;
  remainingPrincipal?: number;
  /** รอบดอกที่กำลังเดิน — null = ยอดตาย/ผ่อนงวด หรือไม่มีรอบ */
  cycle?: CurrentCycle | null;
}

/** ขอการจัดสรรเงินอัตโนมัติตามประเภทการชำระ — ยิงใหม่เมื่อ amount/type/ดอกที่แก้ เปลี่ยน */
export function useSuggestAllocation(
  loanId: string,
  amount: number,
  enabled: boolean,
  paymentType: PaymentType = 'BOTH',
  interestDue?: number,
) {
  return useQuery({
    queryKey: ['payments', 'suggest', loanId, amount, paymentType, interestDue],
    queryFn: () =>
      api<Allocation>(
        `/payments/suggest?loanId=${loanId}&amount=${amount}&type=${paymentType}` +
          (interestDue !== undefined ? `&interestDue=${interestDue}` : ''),
      ),
    enabled: enabled && amount > 0,
    staleTime: 10_000,
    placeholderData: (prev) => prev,
  });
}

export interface RecordPaymentInput {
  loanId: string;
  amount: number;
  paidDate?: string;
  paymentType?: PaymentType;
  /** ยอดดอกรอบนี้ที่ตกลงเก็บจริง — บันทึกลงรอบดอกพร้อมการรับเงิน */
  interestDueOverride?: number;
  arrearsPaid?: number;
  interestPaid?: number;
  principalPaid?: number;
  note?: string;
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordPaymentInput) =>
      api<Payment>('/payments', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateAfterPayment(qc),
  });
}

/** พรีวิวชำระดอกล่วงหน้า N รอบ (รายวัน/ราย 7/10 วัน) */
export interface PrepayQuote {
  count: number;
  total: number;
  perCycle: number;
  cycles: { dueDate: string; interest: number }[];
}

export function usePrepayQuote(loanId: string, count: number, enabled: boolean) {
  return useQuery({
    queryKey: ['payments', 'prepay-quote', loanId, count],
    queryFn: () =>
      api<PrepayQuote>(
        `/payments/prepay-quote?loanId=${loanId}&count=${count}`,
      ),
    enabled: enabled && count > 0,
    staleTime: 0,
  });
}

/** ชำระดอกล่วงหน้า N รอบในครั้งเดียว */
export function usePrepayCycles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { loanId: string; count: number }) =>
      api<Payment[]>('/payments/prepay', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateAfterPayment(qc),
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/payments/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateAfterPayment(qc),
  });
}
