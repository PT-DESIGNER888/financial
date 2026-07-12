import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Activity } from '@/lib/types';
import { qk } from './keys';

/** ประวัติจัดการของยอดกู้ (โหลดเมื่อเปิดดูเท่านั้น — ส่ง enabled) */
export function useActivities(loanId: string, enabled: boolean, limit = 50) {
  return useQuery({
    queryKey: qk.activities(loanId),
    queryFn: () =>
      api<Activity[]>(`/activities?loanId=${loanId}&limit=${limit}`),
    enabled: enabled && !!loanId,
  });
}
