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

export const cycleLabel = { DAILY: 'รายวัน', TEN_DAY: 'ราย 10 วัน' } as const;

export const statusLabel = {
  ACTIVE: 'ปกติ',
  DEAD: 'ยอดตาย',
  INSTALLMENT: 'ผ่อนสินค้า',
  CLOSED: 'ปิดแล้ว',
  BAD_DEBT: 'หนี้สูญ',
} as const;

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
