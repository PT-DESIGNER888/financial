import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Payment } from '@/lib/types';
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
}

/** ขอการจัดสรรเงินอัตโนมัติ (ค้าง→ดอก→ต้น) — ยิงใหม่เมื่อ amount เปลี่ยน */
export function useSuggestAllocation(
  loanId: string,
  amount: number,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['payments', 'suggest', loanId, amount],
    queryFn: () =>
      api<Allocation>(`/payments/suggest?loanId=${loanId}&amount=${amount}`),
    enabled: enabled && amount > 0,
    staleTime: 0,
  });
}

export interface RecordPaymentInput {
  loanId: string;
  amount: number;
  paidDate?: string;
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
