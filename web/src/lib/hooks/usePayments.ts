import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CurrentCycle, Payment, PaymentType } from '@/lib/types';
import { invalidateMoney } from './keys';

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
    staleTime: 0,
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
    onSuccess: () => invalidateMoney(qc),
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/payments/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateMoney(qc),
  });
}
