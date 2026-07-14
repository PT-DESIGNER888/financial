import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Debtor, EmergencyContact } from '@/lib/types';
import { invalidateMoney, qk } from './keys';

export function useDebtors() {
  return useQuery({
    queryKey: qk.debtors,
    queryFn: () => api<Debtor[]>('/debtors'),
  });
}

export function useDebtor(id: string) {
  return useQuery({
    queryKey: qk.debtor(id),
    queryFn: () => api<Debtor>(`/debtors/${id}`),
    enabled: !!id,
  });
}

export interface DebtorInput {
  name: string;
  phone?: string;
  facebookUrl?: string;
  lineId?: string;
  relativeName?: string;
  relativePhone?: string;
  note?: string;
  blacklisted?: boolean;
  creditNote?: string;
  guarantorName?: string;
  guarantorPhone?: string;
  emergencyContacts?: EmergencyContact[];
}

export function useCreateDebtor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DebtorInput) =>
      api<Debtor>('/debtors', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.debtors }),
  });
}

export function useUpdateDebtor(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DebtorInput) =>
      api<Debtor>(`/debtors/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.debtor(id) });
      qc.invalidateQueries({ queryKey: qk.debtors });
    },
  });
}

export function useDeleteDebtor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/debtors/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateMoney(qc),
  });
}
