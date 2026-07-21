'use client';

import { useState } from 'react';
import { Field, ModalButtons, TextInput } from '@/components/form';
import { baht } from '@/lib/format';
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
  const isBadDebt = loan.status === LoanStatus.BAD_DEBT;
  // ยอดขาดทุนที่ยังเก็บไม่ได้ — คิดแบบเดียวกับฝั่ง API (lossOf)
  const currentLoss =
    loan.deadDate != null || loan.installmentCount != null
      ? (loan.deadBalance ?? 0)
      : loan.outstandingPrincipal + loan.arrears;

  const [principal, setPrincipal] = useState(
    String(loan.outstandingPrincipal),
  );
  const [arrears, setArrears] = useState(String(loan.arrears));
  const [deadBalance, setDeadBalance] = useState(
    String(loan.deadBalance ?? 0),
  );
  const [badDebtLoss, setBadDebtLoss] = useState(String(currentLoss));
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const adjust = useAdjustLoan();

  const save = async () => {
    if (!reason.trim()) {
      setError('ต้องระบุเหตุผลการปรับยอด');
      return;
    }
    try {
      const input = isBadDebt
        ? { badDebtLoss: parseFloat(badDebtLoss) || 0, reason }
        : isDead
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
    <ModalShell
      title={isBadDebt ? 'แก้ยอดหนี้สูญ' : 'ปรับยอดด้วยมือ'}
      onClose={onClose}
    >
      <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
        {isBadDebt
          ? 'ยอดนี้คือผลขาดทุนที่ใช้คิดในหน้าภาพรวม — กรอก 0 ถ้าสุดท้ายไม่ได้เสียหายเลย'
          : 'ใช้แก้ยอดที่บันทึกผิด — ระบบจะบันทึกค่าก่อน/หลังและเหตุผลไว้ในประวัติจัดการ'}
      </p>
      {isBadDebt ? (
        <Field
          label="ยอดหนี้สูญ (บาท)"
          hint={`ตอนนี้ ฿${baht(currentLoss)} — ถ้าลูกหนี้ทยอยคืนมา ใช้ปุ่ม "รับเงินคืน" แทนจะได้มีประวัติ`}
        >
          <TextInput
            type="number"
            inputMode="decimal"
            align="right"
            autoFocus
            value={badDebtLoss}
            onChange={(e) => setBadDebtLoss(e.target.value)}
          />
        </Field>
      ) : isDead ? (
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
