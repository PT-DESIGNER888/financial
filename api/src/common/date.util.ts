const TZ = 'Asia/Bangkok';

/** วันนี้ตามเวลาไทย รูปแบบ YYYY-MM-DD */
export function todayStr(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** บวกเดือนแบบตรึงวันที่เดิม — ถ้าเดือนปลายทางสั้นกว่าให้ใช้วันสุดท้ายของเดือน (31 ม.ค. +1 → 28/29 ก.พ.) */
export function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  const t = new Date(Date.UTC(y, m - 1 + months, Math.min(d, lastDay)));
  return t.toISOString().slice(0, 10);
}

export function diffDays(fromStr: string, toStr: string): number {
  const [fy, fm, fd] = fromStr.split('-').map(Number);
  const [ty, tm, td] = toStr.split('-').map(Number);
  return Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000,
  );
}
