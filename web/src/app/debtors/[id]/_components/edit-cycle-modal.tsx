'use client';

import { useMemo, useState } from 'react';
import { DatePicker } from '@/components/date-picker';
import { Field, ModalButtons, TextInput } from '@/components/form';
import { addDaysISO, baht, thaiDate } from '@/lib/format';
import {
  crossesNextRound,
  cycleStepOf,
  previewCyclesUntil,
} from '@/lib/interest-appointment';
import { useEditLoan, useUpdateCycle } from '@/lib/hooks/useLoans';
import { toast } from '@/lib/toast-store';
import type { CurrentCycle, LoanCycle } from '@/lib/types';
import { ModalShell } from './ui';

export function EditCycleModal({
  loanId,
  cycle,
  loanCycle,
  interestDueDate,
  interestDueAmount,
  onClose,
  onSaved,
}: {
  loanId: string;
  cycle: CurrentCycle;
  loanCycle: LoanCycle;
  interestDueDate: string | null;
  interestDueAmount: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const hadAppointment = !!interestDueDate;
  const [dueDate, setDueDate] = useState(interestDueDate ?? cycle.dueDate);
  const [interest, setInterest] = useState(() =>
    interestDueDate
      ? String(interestDueAmount ?? cycle.interestDue)
      : String(cycle.interestDue),
  );
  const [error, setError] = useState('');
  const update = useUpdateCycle();
  const editLoan = useEditLoan();

  const step = cycleStepOf(loanCycle);
  const firstRemaining = Math.max(
    0,
    cycle.interestDue - (cycle.interestPaid ?? 0),
  );
  const lump = useMemo(() => {
    if (!step || !crossesNextRound(dueDate, cycle.dueDate, loanCycle))
      return null;
    const rows = previewCyclesUntil({
      startDue: cycle.dueDate,
      until: dueDate,
      step,
      firstRemaining,
      perCycle: cycle.computedInterest,
    });
    const total = rows.reduce((s, r) => s + r.remaining, 0);
    return { rows, total };
  }, [dueDate, cycle.dueDate, cycle.computedInterest, firstRemaining, loanCycle, step]);

  const computed = lump?.total ?? cycle.computedInterest;

  const setDate = (d: string) => {
    setDueDate(d);
    setError('');
    const nextLump =
      step && crossesNextRound(d, cycle.dueDate, loanCycle)
        ? previewCyclesUntil({
            startDue: cycle.dueDate,
            until: d,
            step,
            firstRemaining,
            perCycle: cycle.computedInterest,
          }).reduce((s, r) => s + r.remaining, 0)
        : cycle.computedInterest;
    setInterest(String(nextLump));
  };

  const save = async () => {
    setError('');
    const n = parseFloat(interest);
    if (interest.trim() !== '' && (!Number.isFinite(n) || n < 0)) {
      setError('ยอดดอกต้องไม่ติดลบ');
      return;
    }
    try {
      if (lump) {
        await editLoan.mutateAsync({
          id: loanId,
          input: {
            interestDueDate: dueDate,
            interestDueAmount:
              interest.trim() === '' || !Number.isFinite(n) ? lump.total : n,
          },
        });
        toast('นัดเก็บดอกแล้ว');
      } else {
        const input: {
          dueDate?: string;
          interestOverride?: number;
          clearOverride?: boolean;
        } = {};
        if (dueDate !== cycle.dueDate) input.dueDate = dueDate;
        if (interest.trim() === '' || n === cycle.computedInterest) {
          if (cycle.interestOverride != null) input.clearOverride = true;
        } else if (n !== (cycle.interestOverride ?? cycle.computedInterest)) {
          input.interestOverride = n;
        }
        if (hadAppointment) {
          await editLoan.mutateAsync({
            id: loanId,
            input: { clearInterestDue: true },
          });
        }
        if (Object.keys(input).length > 0) {
          await update.mutateAsync({ loanId, cycleId: cycle.cycleId, input });
        }
        toast('บันทึกรอบดอกแล้ว');
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    }
  };

  const saving = update.isPending || editLoan.isPending;
  const shortcuts = [7, 10, 14];

  return (
    <ModalShell title="นัดเก็บดอก" onClose={onClose}>
      <Field label="ไปเก็บวันที่">
        <DatePicker value={dueDate} onChange={setDate} />
      </Field>
      {step && (
        <div className="flex flex-wrap gap-2">
          {shortcuts.map((n) => {
            const d = addDaysISO(cycle.dueDate, n);
            const active = dueDate === d;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setDate(d)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  active
                    ? 'bg-primary text-white'
                    : 'border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'
                }`}
              >
                {n} วัน
              </button>
            );
          })}
        </div>
      )}
      {lump && lump.rows.length > 1 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 dark:border-gray-700 dark:bg-gray-950/60">
          <p className="text-xs font-medium text-slate-500 dark:text-gray-400">
            ดอกเพิ่มของแต่ละรอบ · รวม {lump.rows.length} รอบ
          </p>
          <ul className="mt-2 space-y-1">
            {lump.rows.map((r) => (
              <li
                key={r.dueDate}
                className="flex justify-between text-sm text-slate-700 dark:text-gray-200"
              >
                <span>{thaiDate(r.dueDate)}</span>
                <span className="tabular-nums">฿{baht(r.remaining)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 border-t border-slate-200 pt-2 text-sm font-semibold text-slate-900 dark:border-gray-700 dark:text-white">
            รวมที่ระบบคำนวณ ฿{baht(lump.total)}
          </p>
        </div>
      )}
      <Field
        label={`ยอดที่ตกลงเก็บ (ระบบคำนวณ ฿${baht(computed)})`}
      >
        <TextInput
          type="number"
          inputMode="decimal"
          align="right"
          value={interest}
          onChange={(e) => setInterest(e.target.value)}
        />
      </Field>
      <p className="text-xs text-slate-500 dark:text-gray-400">
        {lump
          ? 'รอบดอกยังคิดตามเดิม วันนัดคือวันที่ไปเก็บก้อนนี้ — กรอกมือได้ถ้าตกลงคนละยอด'
          : 'เลือกวันก่อนรอบถัดไป = เลื่อนรอบนี้ตามเดิม · ข้ามรอบถัดไป = รวมดอกหลายรอบให้อัตโนมัติ'}
      </p>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <ModalButtons onClose={onClose} onSave={save} saving={saving} />
    </ModalShell>
  );
}
