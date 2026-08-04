'use client';

import { useState } from 'react';
import {
  Field,
  FormInput,
  ModalButtons,
  SelectMenu,
} from '@/components/form';
import { baht, cycleLabel } from '@/lib/format';
import { useRefinance } from '@/lib/hooks/useLoans';
import { toast } from '@/lib/toast-store';
import { LoanStatus, REVOLVING_CYCLES } from '@/lib/types';
import type { Loan, RevolvingCycle } from '@/lib/types';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const cycleOptions = REVOLVING_CYCLES.map((c) => ({
  value: c,
  label: cycleLabel[c],
}));

/**
 * รียอด — ปิดสัญญาเดิม เปิดสัญญาใหม่ (ดอกลอย/คงที่) ยกยอดเหลือเดิมมารวมต้นใหม่
 * เงินที่ลูกหนี้รับจริง = ต้นใหม่ − ยอดเหลือเดิม (ระบบไม่บันทึกยอดปิดเต็มสัญญา)
 */
export function RefinanceModal({
  loan,
  onClose,
  onSaved,
}: {
  loan: Loan;
  onClose: () => void;
  onSaved: () => void;
}) {
  // ยอดเหลือเดิม = ต้น + ค้าง (ยอดปกติ) หรือ ยอดตรึง (ยอดตาย/ผ่อนงวด)
  const remaining =
    loan.status === LoanStatus.ACTIVE
      ? round2(loan.outstandingPrincipal + loan.arrears)
      : (loan.deadBalance ?? 0);

  const [principal, setPrincipal] = useState(String(remaining));
  const [rate, setRate] = useState(
    loan.status === LoanStatus.ACTIVE ? String(loan.interestRatePercent) : '',
  );
  const [cycle, setCycle] = useState<RevolvingCycle>(
    REVOLVING_CYCLES.includes(loan.cycle as RevolvingCycle)
      ? (loan.cycle as RevolvingCycle)
      : 'DAILY',
  );
  const [error, setError] = useState('');
  const refinance = useRefinance();

  const newPrincipal = parseFloat(principal) || 0;
  const rateNum = parseFloat(rate) || 0;
  const netCash = round2(newPrincipal - remaining);

  const save = async () => {
    setError('');
    if (newPrincipal < remaining) {
      setError(
        `ต้นใหม่ต้องไม่น้อยกว่ายอดเหลือเดิม ฿${baht(remaining)}`,
      );
      return;
    }
    if (rateNum <= 0) {
      setError('อัตราดอกต้องมากกว่า 0');
      return;
    }
    try {
      await refinance.mutateAsync({
        id: loan.id,
        input: {
          debtorId: loan.debtorId,
          type: 'REVOLVING',
          principalOriginal: newPrincipal,
          interestRatePercent: rateNum,
          cycle,
        },
      });
      toast(
        `รียอดสำเร็จ — ต้นใหม่ ฿${baht(newPrincipal)} · จ่ายเพิ่ม ฿${baht(netCash)}`,
      );
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'รียอดไม่สำเร็จ');
    }
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-md space-y-5 overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-5 sm:rounded-2xl sm:p-7 dark:border-gray-800 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl dark:text-white">
            รียอด
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
            ปิดสัญญาเดิม {loan.contractNumber ?? ''} แล้วเปิดสัญญาใหม่
            ยกยอดเหลือมารวมต้น
          </p>
        </header>

        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm dark:bg-gray-950/60">
          <span className="text-slate-500 dark:text-gray-400">ยอดเหลือเดิม</span>
          <strong className="text-base tabular-nums text-slate-900 dark:text-white">
            ฿{baht(remaining)}
          </strong>
        </div>

        <FormInput
          label="ต้นใหม่ (บาท) *"
          type="number"
          inputMode="decimal"
          align="right"
          value={principal}
          onChange={(e) => {
            setPrincipal(e.target.value);
            setError('');
          }}
        />

        <div className="grid grid-cols-2 gap-2">
          <FormInput
            label="อัตราดอก (%/รอบ) *"
            type="number"
            inputMode="decimal"
            align="right"
            value={rate}
            onChange={(e) => {
              setRate(e.target.value);
              setError('');
            }}
          />
          <Field label="รอบเก็บ *">
            <SelectMenu value={cycle} onChange={setCycle} options={cycleOptions} />
          </Field>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-primary/10 px-4 py-3.5">
          <span className="text-sm font-medium text-slate-700 dark:text-gray-200">
            เงินที่ลูกหนี้รับจริง
          </span>
          <strong
            data-money
            className="text-2xl font-bold tabular-nums text-primary"
          >
            ฿{baht(Math.max(0, netCash))}
          </strong>
        </div>
        <p className="text-xs leading-relaxed text-slate-500 dark:text-gray-400">
          = ต้นใหม่ ฿{baht(newPrincipal)} − ยอดเหลือเดิม ฿{baht(remaining)} ·
          ระบบหักเงินสดในมือแค่ส่วนที่จ่ายเพิ่ม ไม่นับยอดที่ยกมาซ้ำ
        </p>

        {error && (
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <ModalButtons
          onClose={onClose}
          onSave={() => void save()}
          saving={refinance.isPending}
          saveLabel="ยืนยันรียอด"
          disabled={newPrincipal < remaining || rateNum <= 0}
        />
      </div>
    </div>
  );
}
