import type { QueryClient } from '@tanstack/react-query';

/**
 * query key กลางของทั้งแอป — อ้างที่นี่ที่เดียว กันพิมพ์ key ผิด
 * (react-query invalidate แบบ prefix: invalidate ['debtor'] จะล้าง ['debtor', id] ทุกตัว)
 */
export const qk = {
  today: (date?: string) => ['dashboard', 'today', date ?? ''] as const,
  arrears: ['dashboard', 'arrears'] as const,
  bill: (debtorId: string, date: string) =>
    ['dashboard', 'bill', debtorId, date] as const,
  summary: ['dashboard', 'summary'] as const,
  debtors: ['debtors'] as const,
  debtor: (id: string) => ['debtor', id] as const,
  loans: ['loan', 'list'] as const,
  schedule: (id: string) => ['loan', id, 'schedule'] as const,
  activities: (loanId: string) => ['activities', loanId] as const,
  financeCash: ['finance', 'cash'] as const,
  financeCashTx: ['finance', 'cashtx'] as const,
  financeTrend: ['finance', 'trend'] as const,
  financeMonthly: (month: string) => ['finance', 'monthly', month] as const,
  attachments: (debtorId: string) => ['attachments', debtorId] as const,
  storageStatus: ['storage', 'status'] as const,
  notifyConfig: ['notify', 'config'] as const,
  overdue: ['notify', 'overdue'] as const,
};

/**
 * หลังรับเงิน / ลบรายการจ่าย / ชำระล่วงหน้า —
 * รีเฟรชเฉพาะหน้าที่ยอดเงินเปลี่ยนทันที ไม่บังคับดึง finance ทั้งก้อน
 * (finance ถูก mark stale — refetch เมื่อเปิดหน้าการเงิน)
 */
export function invalidateAfterPayment(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: ['dashboard'] });
  void qc.invalidateQueries({ queryKey: ['loan'] });
  void qc.invalidateQueries({ queryKey: ['debtor'] });
  void qc.invalidateQueries({ queryKey: qk.debtors });
  void qc.invalidateQueries({ queryKey: ['activities'] });
  void qc.invalidateQueries({ queryKey: ['payments'] });
  void qc.invalidateQueries({ queryKey: ['finance'], refetchType: 'none' });
}

/**
 * โครงสร้างสัญญา/ลูกหนี้เปลี่ยน (เปิดยอด ปิด รียอด ตัดสูญ ลบ) —
 * ต้องรีเฟรชภาพรวมรวมถึงการเงิน
 */
export function invalidateMoney(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: ['debtors'] });
  void qc.invalidateQueries({ queryKey: ['debtor'] });
  void qc.invalidateQueries({ queryKey: ['loan'] });
  void qc.invalidateQueries({ queryKey: ['dashboard'] });
  void qc.invalidateQueries({ queryKey: ['finance'] });
  void qc.invalidateQueries({ queryKey: ['activities'] });
  void qc.invalidateQueries({ queryKey: ['payments'] });
}
