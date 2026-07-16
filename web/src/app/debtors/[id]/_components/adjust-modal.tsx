'use client';

import { useState } from 'react';
import { Field, ModalButtons, TextInput } from '@/components/form';
import { useAdjustLoan } from '@/lib/hooks/useLoans';
import { LoanStatus } from '@/lib/types';
import type { Loan } from '@/lib/types';
import { ModalShell } from './ui';

export function AdjustModal({
  loan,
  onClose,
  onSaved,
}: {
  loan: Loan;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isDead =
    loan.status === LoanStatus.DEAD || loan.status === LoanStatus.INSTALLMENT;
  const [principal, setPrincipal] = useState(
    String(loan.outstandingPrincipal),
  );
  const [arrears, setArrears] = useState(String(loan.arrears));
  const [deadBalance, setDeadBalance] = useState(
    String(loan.deadBalance ?? 0),
  );
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const adjust = useAdjustLoan();

  const save = async () => {
    if (!reason.trim()) {
      setError('ต้องระบุเหตุผลการปรับยอด');
      return;
    }
    try {
      const input = isDead
        ? { deadBalance: parseFloat(deadBalance) || 0, reason }
        : {
            outstandingPrincipal: parseFloat(principal) || 0,
            arrears: parseFloat(arrears) || 0,
            reason,
          };
      await adjust.mutateAsync({ id: loan.id, input });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    }
  };

  return (
    <ModalShell title="ปรับยอดด้วยมือ" onClose={onClose}>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        ใช้แก้ยอดที่บันทึกผิด — ระบบจะบันทึกค่าก่อน/หลังและเหตุผลไว้ในประวัติจัดการ
      </p>
      {isDead ? (
        <Field label="ยอดผ่อนคงเหลือ">
          <TextInput
            type="number"
            inputMode="decimal"
            align="right"
            value={deadBalance}
            onChange={(e) => setDeadBalance(e.target.value)}
          />
        </Field>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Field label="ต้นคงเหลือ">
            <TextInput
              type="number"
              inputMode="decimal"
              align="right"
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
            />
          </Field>
          <Field label="ยอดค้าง">
            <TextInput
              type="number"
              inputMode="decimal"
              align="right"
              value={arrears}
              onChange={(e) => setArrears(e.target.value)}
            />
          </Field>
        </div>
      )}
      <Field label="เหตุผล *">
        <TextInput
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="เช่น คีย์ยอดผิด, ตกลงลดต้นให้"
        />
      </Field>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <ModalButtons onClose={onClose} onSave={save} saving={adjust.isPending} />
    </ModalShell>
  );
}
