import type { LoanCycle, LoanStatus } from './enums';

export function baht(n: number | null | undefined): string {
  if (n === null || n === undefined) return '-';
  return n.toLocaleString('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function thaiDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
}

// key ตาม enum กลาง — เพิ่มค่าใหม่ใน enums.ts แล้ว TypeScript จะบังคับให้เติม label ที่นี่
export const cycleLabel: Record<LoanCycle, string> = {
  DAILY: 'รายวัน',
  WEEKLY: 'รายสัปดาห์',
  TEN_DAY: 'ราย 10 วัน',
  MONTHLY: 'รายเดือน',
};

export const statusLabel: Record<LoanStatus, string> = {
  ACTIVE: 'ปกติ',
  DEAD: 'ยอดตาย',
  INSTALLMENT: 'ผ่อนเป็นงวด',
  CLOSED: 'ปิดแล้ว',
  BAD_DEBT: 'หนี้สูญ',
};

export function thaiDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
