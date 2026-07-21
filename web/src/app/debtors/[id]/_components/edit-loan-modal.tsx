'use client';

import { useState } from 'react';
import { DatePicker } from '@/components/date-picker';
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
  const [dueDate, setDueDate] = useState(loan.principalDueDate ?? '');
  const [dueAmount, setDueAmount] = useState(
    loan.principalDueAmount != null ? String(loan.principalDueAmount) : '',
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
    const amount = dueAmount.trim() === '' ? undefined : parseFloat(dueAmount);
    if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) {
      setError('ยอดนัดคืนต้นต้องไม่ติดลบ');
      return;
    }
    try {
      await edit.mutateAsync({
        id: loan.id,
        input: {
          interestRatePercent: r,
          cycle,
          note,
          ...(dueDate === ''
            ? { clearPrincipalDue: true }
            : { principalDueDate: dueDate, principalDueAmount: amount }),
        },
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

      <Field
        label="นัดคืนต้น (ถ้ามี)"
        hint="ถึงวันนัดแล้วยอดนี้จะโผล่ในหน้าเก็บวันนี้ — ไม่ระบุยอด = ทั้งต้นคงเหลือ"
      >
        <div className="space-y-2">
          <DatePicker value={dueDate} onChange={setDueDate} />
          {dueDate !== '' && (
            <div className="flex items-center gap-2">
              <TextInput
                type="number"
                inputMode="decimal"
                align="right"
                placeholder="ยอดที่นัด (ไม่บังคับ)"
                value={dueAmount}
                onChange={(e) => setDueAmount(e.target.value)}
              />
              <button
                type="button"
                onClick={() => {
                  setDueDate('');
                  setDueAmount('');
                }}
                className="min-h-12 shrink-0 rounded-xl px-3 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                ล้างนัด
              </button>
            </div>
          )}
        </div>
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
