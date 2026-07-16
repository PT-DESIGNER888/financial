'use client';

import { useState } from 'react';
import { Field, TextInput } from '@/components/form';
import { baht } from '@/lib/format';
import { useConvertDead } from '@/lib/hooks/useLoans';
import type { Loan } from '@/lib/types';
import { ModalShell } from './ui';

export function ConvertDeadModal({
  loan,
  onClose,
  onSaved,
}: {
  loan: Loan;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const convert = useConvertDead();
  const frozen = loan.outstandingPrincipal + loan.arrears;
  const saving = convert.isPending;

  const save = async () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) {
      setError('กรอกงวดผ่อน');
      return;
    }
    setError('');
    try {
      await convert.mutateAsync({ id: loan.id, installmentAmount: n });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    }
  };

  return (
    <ModalShell title="แปลงเป็นยอดตาย" onClose={onClose}>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        หยุดคิดดอกทันที ยอดจะถูกตรึงที่ <b>฿{baht(frozen)}</b> (ต้น{' '}
        {baht(loan.outstandingPrincipal)} + ค้าง {baht(loan.arrears)})
        แล้วผ่อนคืนทุก 10 วันจนหมด
      </p>
      <Field label="งวดผ่อน (บาท / 10 วัน) *">
        <TextInput
          type="number"
          inputMode="decimal"
          autoFocus
          align="right"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Field>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 rounded-lg border border-gray-300 py-2.5 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          ยกเลิก
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 rounded-lg bg-gray-800 py-2.5 font-semibold text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600"
        >
          ยืนยันแปลง
        </button>
      </div>
    </ModalShell>
  );
}
