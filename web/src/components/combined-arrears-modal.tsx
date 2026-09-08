'use client';

import { useMemo, useState } from 'react';
import { ModalButtons } from '@/components/form';
import { baht, cycleLabel } from '@/lib/format';
import {
  buildArrearsPayment,
  type ArrearsReceiveItem,
} from '@/lib/arrears-receive';
import { useRecordPayment } from '@/lib/hooks/usePayments';
import { toast } from '@/lib/toast-store';
import { LoanStatus } from '@/lib/types';

interface Props {
  debtorName: string;
  items: ArrearsReceiveItem[];
  paidDate: string;
  onClose: () => void;
  onSaved: () => void;
}

function kindLabel(status: LoanStatus): string {
  if (status === LoanStatus.INSTALLMENT) return 'งวดค้าง';
  return 'ดอกค้าง';
}

/**
 * รับยอดค้างหลายสัญญาของลูกหนี้คนเดียวในครั้งเดียว
 * คนละปุ่มกับ «รับรวม» หน้าเก็บวันนี้ — อันนั้นคือยอดวันนี้ ไม่แตะค้างเก่า
 */
export function CombinedArrearsModal({
  debtorName,
  items,
  paidDate,
  onClose,
  onSaved,
}: Props) {
  const payable = useMemo(
    () => items.filter((it) => it.amount > 0),
    [items],
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(payable.map((it) => it.loanId)),
  );
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const record = useRecordPayment();

  const chosen = payable.filter((it) => selected.has(it.loanId));
  const total =
    Math.round(chosen.reduce((s, it) => s + it.amount, 0) * 100) / 100;

  const toggle = (loanId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(loanId)) next.delete(loanId);
      else next.add(loanId);
      return next;
    });
    setError('');
  };
  const allOn = chosen.length === payable.length && payable.length > 0;
  const toggleAll = () =>
    setSelected(allOn ? new Set() : new Set(payable.map((it) => it.loanId)));

  const save = async () => {
    if (chosen.length === 0) {
      setError('เลือกอย่างน้อย 1 รายการ');
      return;
    }
    setError('');
    setProgress(0);
    try {
      for (const it of chosen) {
        await record.mutateAsync(buildArrearsPayment(it, paidDate));
        setProgress((p) => p + 1);
      }
      toast(
        `รับยอดค้างรวม ฿${baht(total)} — ${debtorName} (${chosen.length} ยอดกู้)`,
      );
      onSaved();
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ') +
          ` (สำเร็จแล้ว ${progress}/${chosen.length} รายการ)`,
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-xl space-y-5 overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-5 sm:rounded-2xl sm:p-7 md:p-8 dark:border-gray-800 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl dark:text-white">
            รับรวมยอดค้าง
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-gray-400">
            {debtorName} · หักเฉพาะค้างเก่า ไม่แตะยอดวันนี้และเงินต้น
          </p>
        </header>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={toggleAll}
            className="text-sm font-semibold text-primary"
          >
            {allOn ? 'ล้างที่เลือก' : 'เลือกทั้งหมด'}
          </button>
          <span className="text-sm text-slate-500 dark:text-gray-400">
            เลือก {chosen.length}/{payable.length} รายการ
          </span>
        </div>

        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 dark:divide-gray-800 dark:border-gray-800">
          {payable.map((it) => {
            const on = selected.has(it.loanId);
            return (
              <li key={it.loanId}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(it.loanId)}
                    className="size-5 shrink-0 accent-primary"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-700 dark:text-gray-200">
                      {it.contractNumber ??
                        (it.cycle ? cycleLabel[it.cycle] : 'ยอดกู้')}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500 dark:text-gray-400">
                      {kindLabel(it.status)}
                      {it.cycle && it.contractNumber
                        ? ` · ${cycleLabel[it.cycle]}`
                        : ''}
                    </span>
                  </span>
                  <span
                    data-money
                    className="shrink-0 text-base font-bold tabular-nums text-red-700 dark:text-red-400"
                  >
                    ฿{baht(it.amount)}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-between rounded-xl bg-red-50 px-4 py-3.5 dark:bg-red-500/10">
          <span className="text-sm font-medium text-red-800 dark:text-red-300">
            รวมยอดค้างที่จะรับ
          </span>
          <strong
            data-money
            className="text-2xl font-bold tabular-nums text-red-700 dark:text-red-400"
          >
            ฿{baht(total)}
          </strong>
        </div>

        {error && (
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <ModalButtons
          onClose={onClose}
          onSave={() => void save()}
          saving={record.isPending}
          saveLabel={`บันทึกรับยอดค้าง ฿${baht(total)}`}
          disabled={chosen.length === 0}
        />
      </div>
    </div>
  );
}
