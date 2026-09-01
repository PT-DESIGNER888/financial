import { todayISO } from './format';

/** วันที่ลูกค้าจ่ายค่าใช้งานระบบ (ค.ศ.) — เปลี่ยนที่นี่หรือใน .env เมื่อต่ออายุ */
export const LICENSE_START =
  process.env.NEXT_PUBLIC_LICENSE_START ?? '2026-07-16';

const LICENSE_YEARS = Number(process.env.NEXT_PUBLIC_LICENSE_YEARS ?? 1);

/** เหลือเท่านี้หรือน้อยกว่า → ขึ้นแดง + เด้งแจ้งเตือน */
export const LICENSE_WARN_DAYS = 7;

const NOTICE_KEY = 'money-license-notice';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** บวกปีแบบปฏิทิน — เดือนสั้นกว่าให้ใช้วันสุดท้ายของเดือน */
export function addYearsISO(dateStr: string, years: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const last = new Date(y + years, m, 0).getDate();
  const day = Math.min(d, last);
  return `${y + years}-${pad(m)}-${pad(day)}`;
}

export function diffCalendarDays(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000,
  );
}

export type LicenseStatus = {
  start: string;
  expires: string;
  daysLeft: number;
  /** เหลือไม่เกิน 7 วัน หรือหมดแล้ว */
  urgent: boolean;
  /** เลยวันหมดอายุแล้ว (daysLeft < 0) */
  expired: boolean;
};

export function getLicenseStatus(today: string = todayISO()): LicenseStatus {
  const expires = addYearsISO(LICENSE_START, LICENSE_YEARS);
  const daysLeft = diffCalendarDays(today, expires);
  const expired = daysLeft < 0;
  return {
    start: LICENSE_START,
    expires,
    daysLeft,
    urgent: expired || daysLeft <= LICENSE_WARN_DAYS,
    expired,
  };
}

export function licenseNoticeStorageKey(today: string): string {
  return `${NOTICE_KEY}:${today}`;
}

export function wasLicenseNoticeDismissed(today: string): boolean {
  try {
    return localStorage.getItem(licenseNoticeStorageKey(today)) === '1';
  } catch {
    return false;
  }
}

export function dismissLicenseNotice(today: string): void {
  try {
    localStorage.setItem(licenseNoticeStorageKey(today), '1');
  } catch {
    /* โหมดส่วนตัว / เต็มที่เก็บไม่ได้ — โชว์ใหม่รอบหน้าได้ */
  }
}
