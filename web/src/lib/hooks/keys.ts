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
 * ล้าง cache ทุกอย่างที่ยอดเงินกระทบ — ใช้หลัง mutation ที่เปลี่ยนยอด
 * (รับเงิน/ตัดต้น/ปรับยอด/ปิด/หนี้สูญ/เปิดคืน/เปิดยอด/ลบ)
 */
export function invalidateMoney(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ['debtors'] });
  qc.invalidateQueries({ queryKey: ['debtor'] });
  qc.invalidateQueries({ queryKey: ['loan'] });
  qc.invalidateQueries({ queryKey: ['dashboard'] });
  qc.invalidateQueries({ queryKey: ['finance'] });
  qc.invalidateQueries({ queryKey: ['activities'] });
}
