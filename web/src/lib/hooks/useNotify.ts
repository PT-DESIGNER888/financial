import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { NotifyConfig, OverdueItem } from '@/lib/types';
import { qk } from './keys';

export function useNotifyConfig() {
  return useQuery({
    queryKey: qk.notifyConfig,
    queryFn: () => api<NotifyConfig>('/notify/config'),
  });
}

export function useOverdue() {
  return useQuery({
    queryKey: qk.overdue,
    queryFn: () => api<OverdueItem[]>('/notify/overdue'),
  });
}

export function useSaveNotifyConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { token: string; targetId: string }) =>
      api('/notify/config', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.notifyConfig }),
  });
}

export function usePreviewDailySummary() {
  return useMutation({
    mutationFn: () =>
      api<{ message: string }>('/notify/daily-summary/preview'),
  });
}

export function useSendDailySummary() {
  return useMutation({
    mutationFn: () =>
      api<{ sent: boolean; reason?: string }>('/notify/daily-summary/send', {
        method: 'POST',
      }),
  });
}
