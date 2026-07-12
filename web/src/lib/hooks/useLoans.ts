import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { InstallmentSchedule, Loan } from '@/lib/types';
import { invalidateMoney, qk } from './keys';

export interface CreateLoanInput {
  debtorId: string;
  type?: 'REVOLVING' | 'INSTALLMENT';
  principalOriginal: number;
  interestRatePercent?: number;
  cycle: 'DAILY' | 'TEN_DAY';
  interestMode?: 'FLOATING' | 'FLAT';
  outstandingPrincipal?: number;
  arrears?: number;
  installmentCount?: number;
  installmentTotal?: number;
  note?: string;
}

export function useLoanSchedule(loanId: string, enabled = true) {
  return useQuery({
    queryKey: qk.schedule(loanId),
    queryFn: () => api<InstallmentSchedule>(`/loans/${loanId}/schedule`),
    enabled: enabled && !!loanId,
  });
}

export function useCreateLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLoanInput) =>
      api<Loan>('/loans', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => invalidateMoney(qc),
  });
}

export function useConvertDead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, installmentAmount }: { id: string; installmentAmount: number }) =>
      api<Loan>(`/loans/${id}/dead`, {
        method: 'POST',
        body: JSON.stringify({ installmentAmount }),
      }),
    onSuccess: () => invalidateMoney(qc),
  });
}

export interface EditLoanInput {
  interestRatePercent?: number;
  cycle?: 'DAILY' | 'TEN_DAY';
  note?: string;
}

export function useEditLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: EditLoanInput }) =>
      api<Loan>(`/loans/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => invalidateMoney(qc),
  });
}

export interface AdjustLoanInput {
  outstandingPrincipal?: number;
  arrears?: number;
  deadBalance?: number;
  reason: string;
}

export function useAdjustLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AdjustLoanInput }) =>
      api<Loan>(`/loans/${id}/adjust`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateMoney(qc),
  });
}

/** ปิดยอด / ตัดหนี้สูญ — endpoint เดียวกัน ต่างที่ path (close | write-off) */
export function useLoanAction(action: 'close' | 'write-off' | 'reopen') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api<Loan>(`/loans/${id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason || undefined }),
      }),
    onSuccess: () => invalidateMoney(qc),
  });
}

export function useDeleteLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/loans/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateMoney(qc),
  });
}
