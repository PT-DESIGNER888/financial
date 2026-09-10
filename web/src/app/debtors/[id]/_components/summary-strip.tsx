'use client';

import { baht, thaiDate, todayISO } from '@/lib/format';
import { LoanStatus, type Loan } from '@/lib/types';
import { SummaryChip } from './ui';

function remainingOf(loan: Loan): number {
  if (
    loan.status === LoanStatus.CLOSED ||
    loan.status === LoanStatus.BAD_DEBT
  )
    return 0;
  if (
    loan.status === LoanStatus.DEAD ||
    loan.status === LoanStatus.INSTALLMENT
  )
    return loan.deadBalance ?? 0;
  return loan.outstandingPrincipal + loan.arrears;
}

/** แถบสรุปรวมทุกสัญญาของลูกหนี้ — ใช้ยอดจากหน้าลูกหนี้ ไม่ดึงสัญญาทั้งระบบซ้ำ */
export function DebtorSummaryStrip({ loans }: { loans: Loan[] }) {
  const today = todayISO();
  const open = loans.filter(
    (l) =>
      l.status === LoanStatus.ACTIVE ||
      l.status === LoanStatus.DEAD ||
      l.status === LoanStatus.INSTALLMENT,
  );
  if (loans.length === 0) return null;
  const remaining = open.reduce((s, l) => s + remainingOf(l), 0);
  const arrears = open.reduce((s, l) => s + l.arrears, 0);
  const overdueCount = open.filter((l) => l.arrears > 0).length;
  const nextDue = open
    .flatMap((l) => [l.interestDueDate, l.principalDueDate])
    .filter((d): d is string => !!d && d >= today)
    .sort()[0];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <SummaryChip
        label="สัญญาเปิดอยู่"
        value={`${open.length}/${loans.length}`}
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
