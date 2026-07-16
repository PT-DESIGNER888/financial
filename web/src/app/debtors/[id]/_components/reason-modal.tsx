'use client';

import { useState } from 'react';
import { Field, ModalButtons, TextInput } from '@/components/form';
import { baht } from '@/lib/format';
import { useLoanAction } from '@/lib/hooks/useLoans';
import { LoanStatus } from '@/lib/types';
import type { Loan } from '@/lib/types';
import { ModalShell } from './ui';

export function ReasonModal({
  loan,
  kind,
  onClose,
  onSaved,
}: {
  loan: Loan;
  kind: 'close' | 'write-off';
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const isWriteOff = kind === 'write-off';
  const action = useLoanAction(kind);
  const loss =
    loan.status === LoanStatus.DEAD || loan.status === LoanStatus.INSTALLMENT
      ? (loan.deadBalance ?? 0)
      : loan.outstandingPrincipal + loan.arrears;

  const save = async () => {
    try {
      await action.mutateAsync({ id: loan.id, reason });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    }
  };

  return (
    <ModalShell title={isWriteOff ? 'ตัดหนี้สูญ' : 'ปิดยอดเอง'} onClose={onClose}>
      {isWriteOff ? (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          ยอดคงเหลือ <b className="text-red-600">฿{baht(loss)}</b>{' '}
          จะถูกบันทึกเป็นผลขาดทุน หยุดคิดดอกและไม่ติดตามต่อ (เปิดยอดคืนได้ภายหลัง)
        </p>
      ) : (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          ปิดยอดนี้ถือว่าจบ ไม่ว่ายอดจะเหลือหรือไม่ (เปิดคืนได้ภายหลัง)
        </p>
      )}
      <Field label="เหตุผล (ไม่บังคับ)">
        <TextInput value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <ModalButtons
        onClose={onClose}
        onSave={save}
        saving={action.isPending}
        danger={isWriteOff}
        saveLabel={isWriteOff ? 'ยืนยันตัดหนี้สูญ' : 'ยืนยันปิดยอด'}
      />
    </ModalShell>
  );
}
