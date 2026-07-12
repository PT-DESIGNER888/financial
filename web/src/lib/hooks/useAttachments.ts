import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, uploadForm } from '@/lib/api';
import type { Attachment } from '@/lib/types';
import { qk } from './keys';

export function useAttachments(debtorId: string) {
  return useQuery({
    queryKey: qk.attachments(debtorId),
    queryFn: () => api<Attachment[]>(`/debtors/${debtorId}/attachments`),
    enabled: !!debtorId,
  });
}

export function useStorageStatus() {
  return useQuery({
    queryKey: qk.storageStatus,
    queryFn: () => api<{ configured: boolean }>('/storage/status'),
  });
}

export function useUploadAttachment(debtorId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) =>
      uploadForm<Attachment>(`/debtors/${debtorId}/attachments`, form),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: qk.attachments(debtorId) }),
  });
}

export function useDeleteAttachment(debtorId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/attachments/${id}`, { method: 'DELETE' }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: qk.attachments(debtorId) }),
  });
}
