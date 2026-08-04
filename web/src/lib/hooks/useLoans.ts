import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  InstallmentPlanPreview,
  InstallmentSchedule,
  Loan,
  LoanCycle,
  LoanCyclesInfo,
  LoanListItem,
} from '@/lib/types';
import { invalidateMoney, qk } from './keys';

/** สัญญาทั้งหมดพร้อมยอดสรุป — หน้า "สัญญาเงินกู้" */
export function useAllLoans() {
  return useQuery({
    queryKey: qk.loans,
    queryFn: () => api<LoanListItem[]>('/loans'),
  });
}

export interface CreateLoanInput {
  debtorId: string;
  type?: 'REVOLVING' | 'INSTALLMENT' | 'DEAD';
  principalOriginal: number;
  interestRatePercent?: number;
  cycle: LoanCycle;
  interestMode?: 'FLOATING' | 'FLAT';
  outstandingPrincipal?: number;
  arrears?: number;
  installmentCount?: number;
  /** ยอดตายคีย์มือ: งวดที่ตกลงผ่อน (ไม่ส่ง = ไม่มีกำหนดตายตัว) */
  installmentAmount?: number;
  totalInterest?: number;
  /** ยอดผ่อนรวม (ต้น+ดอก) — ทางเลือกแทน totalInterest */
  installmentTotal?: number;
  amortized?: boolean;
  fee?: number;
  firstDueDate?: string;
  roundInstallments?: boolean;
  startDate?: string;
  note?: string;
}

export interface PreviewLoanInput {
  principalOriginal: number;
  installmentCount: number;
  cycle: LoanCycle;
  amortized?: boolean;
  totalInterest?: number;
  interestRatePercent?: number;
  fee?: number;
  startDate?: string;
  firstDueDate?: string;
  roundInstallments?: boolean;
}

/** พรีวิวตารางงวด — คำนวณฝั่ง API ด้วยโค้ดเดียวกับตอนเปิดยอดจริง */
export function useLoanPreview(input: PreviewLoanInput | null) {
  return useQuery({
    queryKey: ['loan', 'preview', input],
    queryFn: () =>
      api<InstallmentPlanPreview>('/loans/preview', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    enabled: !!input,
    placeholderData: (prev) => prev,
  });
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
    mutationFn: ({
      id,
      installmentAmount,
    }: {
      id: string;
      /** ไม่ส่ง = ทยอยคืนเมื่อไหร่ก็ได้ ไม่มีกำหนดตายตัว */
      installmentAmount?: number;
    }) =>
      api<Loan>(`/loans/${id}/dead`, {
        method: 'POST',
        body: JSON.stringify({ installmentAmount }),
      }),
    onSuccess: () => invalidateMoney(qc),
  });
}

/** รอบดอกของยอดดอกลอย/คงที่ — รอบล่าสุด + รอบที่กำลังเดิน */
export function useLoanCycles(loanId: string, enabled = true) {
  return useQuery({
    queryKey: ['loan', loanId, 'cycles'],
    queryFn: () => api<LoanCyclesInfo>(`/loans/${loanId}/cycles`),
    enabled: enabled && !!loanId,
  });
}

export interface EditCycleInput {
  dueDate?: string;
  interestOverride?: number;
  /** true = กลับไปใช้ดอกที่ระบบคำนวณ */
  clearOverride?: boolean;
}

/** เลื่อนวันครบกำหนด / ตกลงเก็บดอกจริง ของรอบดอกรายรอบ */
export function useUpdateCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      loanId,
      cycleId,
      input,
    }: {
      loanId: string;
      cycleId: string;
      input: EditCycleInput;
    }) =>
      api<LoanCyclesInfo>(`/loans/${loanId}/cycles/${cycleId}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      invalidateMoney(qc);
      qc.invalidateQueries({ queryKey: ['payments'] });
    },
  });
}

export interface EditLoanInput {
  interestRatePercent?: number;
  cycle?: 'DAILY' | 'WEEKLY' | 'TEN_DAY';
  /** ยอดตาย: งวดผ่อน/10 วัน */
  installmentAmount?: number;
  /** true = ยอดตายนี้ไม่มีกำหนดงวด ทยอยคืนเมื่อไหร่ก็ได้ */
  clearInstallment?: boolean;
  /** นัดคืนต้น: วันที่ลูกหนี้ตกลงจะเอาเงินก้อนมาตัดต้น */
  principalDueDate?: string;
  principalDueAmount?: number;
  /** true = ล้างนัดคืนต้นทิ้ง */
  clearPrincipalDue?: boolean;
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
  /** ยอดหนี้สูญ (สถานะ BAD_DEBT) — แก้ยอดขาดทุนตรงๆ */
  badDebtLoss?: number;
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

/** พรีวิวรียอด: ยอดเหลือเดิม + เงินสดที่ต้องจ่ายเพิ่มเมื่อต้นใหม่ = newPrincipal */
export interface RefinanceQuote {
  oldLoanId: string;
  oldContractNumber: string | null;
  remaining: number;
  newPrincipal: number;
  netCash: number;
}

export function useRefinanceQuote(
  loanId: string,
  newPrincipal: number,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['loan', loanId, 'refinance-quote', newPrincipal],
    queryFn: () =>
      api<RefinanceQuote>(
        `/loans/${loanId}/refinance-quote?newPrincipal=${newPrincipal}`,
      ),
    enabled: enabled && !!loanId,
    staleTime: 0,
  });
}

/** รียอด: ปิดสัญญาเดิม เปิดสัญญาใหม่ยกยอดเหลือมา (debtorId ยึดจากสัญญาเดิม) */
export function useRefinance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateLoanInput }) =>
      api<Loan>(`/loans/${id}/refinance`, {
        method: 'POST',
        body: JSON.stringify(input),
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
