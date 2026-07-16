'use client';

import { useState } from 'react';
import { Field, ModalButtons, Segmented, TextInput } from '@/components/form';
import { useEditLoan } from '@/lib/hooks/useLoans';
import { LoanCycle } from '@/lib/types';
import type { Loan, RevolvingCycle } from '@/lib/types';
import { ModalShell } from './ui';

export function EditLoanModal({
  loan,
  onClose,
  onSaved,
}: {
  loan: Loan;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rate, setRate] = useState(String(loan.interestRatePercent));
  // แก้เงื่อนไขได้เฉพาะยอดดอกลอย/คงที่ (รายวัน / 7 วัน / 10 วัน)
  const [cycle, setCycle] = useState<RevolvingCycle>(
    loan.cycle === LoanCycle.MONTHLY ? LoanCycle.DAILY : loan.cycle,
  );
  const [note, setNote] = useState(loan.note ?? '');
  const [error, setError] = useState('');
  const edit = useEditLoan();

  const save = async () => {
    const r = parseFloat(rate);
    if (!r || r <= 0) {
      setError('อัตราดอกต้องมากกว่า 0');
      return;
    }
    try {
      await edit.mutateAsync({
        id: loan.id,
        input: { interestRatePercent: r, cycle, note },
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    }
  };

  return (
    <ModalShell title="แก้เงื่อนไขยอดกู้" onClose={onClose}>
      <Field label="ดอก %/รอบ">
        <TextInput
          type="number"
          step="0.001"
          inputMode="decimal"
          align="right"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
        />
      </Field>
      <Field label="รอบเก็บ">
        <Segmented
          value={cycle}
          onChange={(v) => setCycle(v)}
          options={[
            { value: LoanCycle.DAILY, label: 'รายวัน' },
            { value: LoanCycle.WEEKLY, label: 'ทุก 7 วัน' },
            { value: LoanCycle.TEN_DAY, label: 'ทุก 10 วัน' },
          ]}
        />
      </Field>
      <Field label="หมายเหตุ">
        <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <p className="text-xs text-gray-400">
        * แก้อัตราดอกมีผลกับรอบถัดไป ยอดค้างเดิมไม่เปลี่ยน
      </p>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <ModalButtons onClose={onClose} onSave={save} saving={edit.isPending} />
    </ModalShell>
  );
}
