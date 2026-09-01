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

/** "16 กรกฎาคม 2569" — ใช้กับวันสำคัญที่ต้องอ่านปีเต็ม */
export function thaiDateFull(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const pad = (n: number) => String(n).padStart(2, '0');

/** วันนี้ตามเครื่อง รูปแบบ YYYY-MM-DD (ตรงกับที่ API ใช้) */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDaysISO(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = new Date(y, m - 1, d + days);
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

/** 0 = อาทิตย์ … 6 = เสาร์ */
export function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

/** ชื่อวันแบบสั้น (จ, อ, พ…) เรียงตาม index ของ Date.getDay() */
export const WEEKDAY_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
export const WEEKDAY_FULL = [
  'อาทิตย์',
  'จันทร์',
  'อังคาร',
  'พุธ',
  'พฤหัสบดี',
  'ศุกร์',
  'เสาร์',
];

/** วันจันทร์ของสัปดาห์ที่ dateStr อยู่ (สัปดาห์เริ่มวันจันทร์) */
export function mondayOf(dateStr: string): string {
  const wd = weekdayOf(dateStr);
  return addDaysISO(dateStr, wd === 0 ? -6 : 1 - wd);
}

/** "วันจันทร์ 21 ก.ค. 69" — ใช้เป็นหัวข้อของวันที่เลือก */
export function thaiDateLong(dateStr: string): string {
  return `วัน${WEEKDAY_FULL[weekdayOf(dateStr)]} ${thaiDate(dateStr)}`;
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
