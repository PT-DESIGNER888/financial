import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  ArrearsData,
  BillData,
  Summary,
  TodayDebtor,
} from '@/lib/types';
import { qk } from './keys';

export interface TodayData {
  date: string;
  isToday: boolean;
  debtors: TodayDebtor[];
  totals: {
    dueTotal: number;
    paidToday: number;
    remainingToday: number;
    arrears: number;
    debtorCount: number;
    unpaidCount: number;
    paidCount: number;
  };
  allOpen: number;
}

/** รายการเก็บของวันที่เลือก — ไม่ส่ง date = วันนี้ */
export function useToday(date?: string) {
  return useQuery({
    queryKey: qk.today(date),
    queryFn: () =>
      api<TodayData>(`/dashboard/today${date ? `?date=${date}` : ''}`),
  });
}

/** ยอดค้าง + ยอดตาย (แยกจากหน้าเก็บวันนี้) */
export function useArrears() {
  return useQuery({
    queryKey: qk.arrears,
    queryFn: () => api<ArrearsData>('/dashboard/arrears'),
  });
}

/** บิลของลูกหนี้ในวันที่เลือก */
export function useBill(debtorId: string, date: string) {
  return useQuery({
    queryKey: qk.bill(debtorId, date),
    queryFn: () => api<BillData>(`/dashboard/bill/${debtorId}?date=${date}`),
    enabled: Boolean(debtorId && date),
  });
}

export function useSummary() {
  return useQuery({
    queryKey: qk.summary,
    queryFn: () => api<Summary>('/dashboard/summary'),
  });
}
