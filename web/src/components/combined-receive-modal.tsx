'use client';

import { useMemo, useState } from 'react';
import { ModalButtons } from '@/components/form';
import { baht, cycleLabel } from '@/lib/format';
import {
  useRecordPayment,
  type RecordPaymentInput,
} from '@/lib/hooks/usePayments';
import { toast } from '@/lib/toast-store';
import { PaymentType, type TodayDebtor, type TodayItem } from '@/lib/types';

interface Props {
  group: TodayDebtor;
  paidDate: string;
  onClose: () => void;
  onSaved: () => void;
}

/** ยอดที่จะเก็บของแต่ละยอดกู้ = ยอดวันนี้ที่ยังไม่จ่าย */
function itemDue(item: TodayItem): number {
  return Math.max(0, item.remainingToday);
}

/**
 * จัดสรรเงินของยอดกู้หนึ่งก้อนตามชนิด — ให้ API จัดสรรดอก → ค้างเก่า → ต้น เอง
 *  - ยอดตาย/ผ่อนงวด: หักยอดผ่อน (ก้อนเดียว)
 *  - ยอดปกติมีนัดคืนต้นวันนี้: ดอก+ค้าง+ตัดต้นเป็นก้อนเดียว (BOTH)
 *  - ยอดปกติทั่วไป: ชำระดอกล้วน
 */
function buildPayment(item: TodayItem, paidDate: string): RecordPaymentInput {
  const amount = itemDue(item);
  const frozen = item.status === 'DEAD' || item.status === 'INSTALLMENT';
  if (frozen) {
    return { loanId: item.loanId, amount, paidDate };
  }
  if (item.duePrincipal > 0) {
    return {
      loanId: item.loanId,
      amount,
      paidDate,
      paymentType: PaymentType.BOTH,
    };
  }
  return {
    loanId: item.loanId,
    amount,
    paidDate,
    paymentType: PaymentType.INTEREST,
  };
}

/**
 * รับเงินหลายยอดของลูกหนี้คนเดียวในครั้งเดียว — เลือกทีละรายการ / หลายรายการ / ทั้งหมด
 * บันทึกทีละยอดกู้ให้ยอดตัดตรงชนิด แล้วปิดทีเดียว ไม่ต้องเด้งหน้าไปมา
 */
export function CombinedReceiveModal({ group, paidDate, onClose, onSaved }: Props) {
  const payable = useMemo(
    () => group.items.filter((it) => itemDue(it) > 0),
    [group.items],
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(payable.map((it) => it.loanId)),
  );
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const record = useRecordPayment();

  const chosen = payable.filter((it) => selected.has(it.loanId));
  const total = Math.round(
    chosen.reduce((s, it) => s + itemDue(it), 0) * 100,
  ) / 100;

  const toggle = (loanId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(loanId)) next.delete(loanId);
      else next.add(loanId);
      return next;
    });
    setError('');
  };
  const allOn = chosen.length === payable.length;
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
        await record.mutateAsync(buildPayment(it, paidDate));
        setProgress((p) => p + 1);
      }
      toast(
        `รับเงินรวม ฿${baht(total)} — ${group.debtorName} (${chosen.length} ยอดกู้)`,
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
            รับเงินรวม
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
            {group.debtorName} · เลือกยอดที่จะรับ แล้วบันทึกทีเดียว
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
            const frozen = it.status === 'DEAD' || it.status === 'INSTALLMENT';
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
                      {cycleLabel[it.cycle]}
                      {it.status === 'DEAD' && ' · ยอดตาย'}
                      {it.status === 'INSTALLMENT' && ' · ผ่อนงวด'}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500 dark:text-gray-400">
                      {it.duePrincipal > 0
                        ? 'นัดคืนวันนี้'
                        : frozen
                          ? 'ผ่อนยอด'
                          : 'ยอดวันนี้'}
                    </span>
                  </span>
                  <span
                    data-money
                    className="shrink-0 text-base font-bold tabular-nums text-slate-900 dark:text-white"
                  >
                    ฿{baht(itemDue(it))}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-between rounded-xl bg-primary/10 px-4 py-3.5">
          <span className="text-sm font-medium text-slate-700 dark:text-gray-200">
            รวมที่จะรับ
          </span>
          <strong
            data-money
            className="text-2xl font-bold tabular-nums text-primary"
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
          saveLabel={`บันทึกรับเงิน ฿${baht(total)}`}
          disabled={chosen.length === 0}
        />
      </div>
    </div>
  );
}
