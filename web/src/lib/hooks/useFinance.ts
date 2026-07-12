import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  CashPosition,
  CashTx,
  CashTxType,
  MonthlyReport,
  TrendPoint,
} from '@/lib/types';
import { qk } from './keys';

export function useCashPosition() {
  return useQuery({
    queryKey: qk.financeCash,
    queryFn: () => api<CashPosition>('/finance/cash'),
  });
}

export function useCashTxList() {
  return useQuery({
    queryKey: qk.financeCashTx,
    queryFn: () => api<CashTx[]>('/finance/cashtx'),
  });
}

export function useTrend(days = 30) {
  return useQuery({
    queryKey: [...qk.financeTrend, days],
    queryFn: () => api<TrendPoint[]>(`/finance/trend?days=${days}`),
  });
}

export function useMonthly(month: string) {
  return useQuery({
    queryKey: qk.financeMonthly(month),
    queryFn: () => api<MonthlyReport>(`/finance/monthly?month=${month}`),
    enabled: !!month,
  });
}

export function useSetOpening() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { openingCash: number; openingDate?: string }) =>
      api('/finance/opening', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance'] }),
  });
}

export function useAddCashTx() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      type: CashTxType;
      amount: number;
      date?: string;
      note?: string;
    }) => api('/finance/cashtx', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance'] }),
  });
}

export function useDeleteCashTx() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/finance/cashtx/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance'] }),
  });
}
