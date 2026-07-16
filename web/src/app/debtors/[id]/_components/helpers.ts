import type { Debtor, EmergencyContact } from '@/lib/types';

/** รวมผู้ติดต่อฉุกเฉิน — รองรับข้อมูลเก่า (relative/guarantor) ให้กลายเป็นรายการเดียว */
export function resolveContacts(debtor: Debtor): EmergencyContact[] {
  if (debtor.emergencyContacts?.length) return debtor.emergencyContacts;
  const out: EmergencyContact[] = [];
  if (debtor.relativeName || debtor.relativePhone) {
    out.push({
      name: debtor.relativeName ?? '',
      phone: debtor.relativePhone ?? undefined,
      note: 'ญาติ',
    });
  }
  if (debtor.guarantorName || debtor.guarantorPhone) {
    out.push({
      name: debtor.guarantorName ?? '',
      phone: debtor.guarantorPhone ?? undefined,
      note: 'ผู้ค้ำ',
    });
  }
  return out;
}

/** ชื่อที่แสดงจากลิงก์ Facebook (fallback = ชื่อลูกหนี้) */
export function facebookDisplayName(url: string, fallback: string): string {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, '');
    const last = path.split('/').filter(Boolean).pop();
    if (last && last !== 'profile.php') return decodeURIComponent(last);
  } catch {
    /* ignore */
  }
  return fallback;
}
