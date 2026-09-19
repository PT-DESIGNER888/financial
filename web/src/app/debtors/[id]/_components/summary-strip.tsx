'use client';

import { baht } from '@/lib/format';
import type { DebtorFinancialSummary } from '@/lib/types';
import { SummaryChip } from './ui';

/** สรุปจากสัญญาและประวัติรับเงินจริงที่ API คำนวณให้ */
export function DebtorSummaryStrip({
  summary,
}: {
  summary: DebtorFinancialSummary;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <SummaryChip
        label="เงินต้นที่ปล่อยทั้งหมด"
        value={`฿${baht(summary.principalIssued)}`}
      />
      <SummaryChip
        label="เงินต้นคงเหลือ"
        value={`฿${baht(summary.remainingPrincipal)}`}
      />
      <SummaryChip
        label="ดอกที่รับจริงทั้งหมด"
        value={`฿${baht(summary.interestReceived)}`}
      />
      <SummaryChip
        label="ยอดค้างปัจจุบัน"
        value={`฿${baht(summary.currentOverdue)}`}
        danger={summary.currentOverdue > 0}
      />
    </div>
  );
}
