'use client';

import { useState } from 'react';
import { Field, ModalButtons, TextInput } from '@/components/form';
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
  const [hasInstallment, setHasInstallment] = useState(false);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const convert = useConvertDead();
  const frozen = loan.outstandingPrincipal + loan.arrears;

  const save = async () => {
    const n = parseFloat(amount);
    if (hasInstallment && (!n || n <= 0)) {
      setError('กรอกงวดผ่อน');
      return;
    }
    setError('');
    try {
      await convert.mutateAsync({
        id: loan.id,
        installmentAmount: hasInstallment ? n : undefined,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    }
  };

  return (
    <ModalShell title="แปลงเป็นยอดตาย" onClose={onClose}>
      <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
        หยุดคิดดอกทันที ยอดจะถูกตรึงที่ <b>฿{baht(frozen)}</b> (ต้น{' '}
        {baht(loan.outstandingPrincipal)} + ค้าง {baht(loan.arrears)})
        แล้วให้ลูกหนี้ทยอยคืน
      </p>

      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        <input
          type="checkbox"
          checked={hasInstallment}
          onChange={(e) => setHasInstallment(e.target.checked)}
        />
        ตกลงงวดผ่อนไว้ (ทุก 10 วัน)
      </label>

      {hasInstallment ? (
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
      ) : (
        <p className="rounded-lg bg-slate-100 p-3 text-xs leading-relaxed text-slate-600 dark:bg-gray-800 dark:text-gray-300">
          ไม่ตกลงงวด = ทยอยคืนเมื่อไหร่ก็ได้ ยอดนี้จะไม่ขึ้นในหน้าเก็บวันนี้
          แต่ดูได้ที่หน้า &ldquo;ยอดค้าง&rdquo;
        </p>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
      <ModalButtons
        onClose={onClose}
        onSave={save}
        saving={convert.isPending}
        saveLabel="ยืนยันแปลง"
      />
    </ModalShell>
  );
}
