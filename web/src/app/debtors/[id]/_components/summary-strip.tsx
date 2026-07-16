'use client';

import { baht, thaiDate } from '@/lib/format';
import { useAllLoans } from '@/lib/hooks/useLoans';
import { LoanStatus } from '@/lib/types';
import { SummaryChip } from './ui';

/** แถบสรุปรวมทุกสัญญาของลูกหนี้ — ใช้ข้อมูลคำนวณจาก GET /loans (ตัวเดียวกับหน้าสัญญาเงินกู้) */
export function DebtorSummaryStrip({ debtorId }: { debtorId: string }) {
  const { data: loans } = useAllLoans();
  if (!loans) return null;
  const mine = loans.filter((l) => l.debtorId === debtorId);
  const open = mine.filter(
    (l) =>
      l.status === LoanStatus.ACTIVE ||
      l.status === LoanStatus.DEAD ||
      l.status === LoanStatus.INSTALLMENT,
  );
  if (mine.length === 0) return null;
  const remaining = open.reduce((s, l) => s + l.remaining, 0);
  const arrears = open.reduce((s, l) => s + l.arrears, 0);
  const overdueCount = open.filter((l) => l.overdue).length;
  const nextDue = open
    .map((l) => l.nextDueDate)
    .filter((d): d is string => !!d)
    .sort()[0];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <SummaryChip
        label="สัญญาเปิดอยู่"
        value={`${open.length}/${mine.length}`}
      />
      <SummaryChip label="ยอดคงเหลือรวม" value={`฿${baht(remaining)}`} />
      <SummaryChip
        label="ดอกค้างรวม"
        value={`฿${baht(arrears)}`}
        danger={arrears > 0 || overdueCount > 0}
      />
      <SummaryChip
        label="เก็บครั้งถัดไป"
        value={nextDue ? thaiDate(nextDue) : '—'}
      />
    </div>
  );
}
