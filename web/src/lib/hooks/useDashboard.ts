import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Summary, TodayItem } from '@/lib/types';
import { qk } from './keys';

export interface TodayData {
  date: string;
  items: TodayItem[];
  allOpen: number;
}

export function useToday() {
  return useQuery({
    queryKey: qk.today,
    queryFn: () => api<TodayData>('/dashboard/today'),
  });
}

export function useSummary() {
  return useQuery({
    queryKey: qk.summary,
    queryFn: () => api<Summary>('/dashboard/summary'),
  });
}
