'use client';

import { useState } from 'react';
import { DatePicker } from '@/components/date-picker';
import { Field, ModalButtons, TextInput } from '@/components/form';
import { baht } from '@/lib/format';
import { useUpdateCycle } from '@/lib/hooks/useLoans';
import { toast } from '@/lib/toast-store';
import type { CurrentCycle } from '@/lib/types';
import { ModalShell } from './ui';

export function EditCycleModal({
  loanId,
  cycle,
  onClose,
  onSaved,
}: {
  loanId: string;
  cycle: CurrentCycle;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [dueDate, setDueDate] = useState(cycle.dueDate);
  const [interest, setInterest] = useState(String(cycle.interestDue));
  const [error, setError] = useState('');
  const update = useUpdateCycle();

  const save = async () => {
    setError('');
    const n = parseFloat(interest);
    if (interest.trim() !== '' && (!Number.isFinite(n) || n < 0)) {
      setError('ยอดดอกต้องไม่ติดลบ');
      return;
    }
    const input: {
      dueDate?: string;
      interestOverride?: number;
      clearOverride?: boolean;
    } = {};
    if (dueDate !== cycle.dueDate) input.dueDate = dueDate;
    if (interest.trim() === '' || n === cycle.computedInterest) {
      // เท่ากับที่ระบบคำนวณ = ไม่ต้อง override (ดอกลดตามต้นอัตโนมัติต่อ)
      if (cycle.interestOverride != null) input.clearOverride = true;
    } else if (n !== (cycle.interestOverride ?? cycle.computedInterest)) {
      input.interestOverride = n;
    }
    if (Object.keys(input).length === 0) {
      onSaved();
      return;
    }
    try {
      await update.mutateAsync({ loanId, cycleId: cycle.cycleId, input });
      toast('บันทึกรอบดอกแล้ว');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    }
  };

  return (
    <ModalShell title="แก้รอบดอกรอบนี้" onClose={onClose}>
      <Field label="วันครบกำหนด">
        <DatePicker value={dueDate} onChange={setDueDate} />
      </Field>
      <Field label={`ยอดดอกที่ตกลงเก็บ (ระบบคำนวณ ฿${baht(cycle.computedInterest)})`}>
        <TextInput
          type="number"
          inputMode="decimal"
          align="right"
          value={interest}
          onChange={(e) => setInterest(e.target.value)}
        />
      </Field>
      <p className="text-xs text-gray-400 dark:text-gray-500">
        * แก้เฉพาะรอบนี้ — รอบถัดไปกลับไปคำนวณจากต้นคงเหลือตามปกติ
        ใส่เท่ากับที่ระบบคำนวณเพื่อยกเลิกยอดตกลงพิเศษ
      </p>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <ModalButtons onClose={onClose} onSave={save} saving={update.isPending} />
    </ModalShell>
  );
}
