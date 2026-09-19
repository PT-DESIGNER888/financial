'use client';

import { useMemo, useState } from 'react';
import { ModalButtons } from '@/components/form';
import { baht, cycleLabel } from '@/lib/format';
import { usePayoff, usePayoffQuote } from '@/lib/hooks/usePayments';
import { toast } from '@/lib/toast-store';
import type { Loan } from '@/lib/types';

export function PayoffModal({
  debtorName,
  loans,
  onClose,
  onSaved,
}: {
  debtorName: string;
  loans: Loan[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(loans.map((loan) => loan.id)),
  );
  const [error, setError] = useState('');
  const loanIds = useMemo(
    () => loans.filter((loan) => selected.has(loan.id)).map((loan) => loan.id),
    [loans, selected],
  );
  const { data: quote, isFetching } = usePayoffQuote(
    loanIds,
    loanIds.length > 0,
  );
  const payoff = usePayoff();
  const allSelected = selected.size === loans.length && loans.length > 0;

  const toggle = (id: string) => {
    setSelected((before) => {
      const next = new Set(before);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setError('');
  };

  const save = async () => {
    if (!quote || quote.items.length === 0) {
      setError('เลือกอย่างน้อย 1 สัญญา');
      return;
    }
    setError('');
    try {
      const result = await payoff.mutateAsync({ loanIds });
      toast(
        `รับปิดยอด ฿${baht(result.total)} — ${debtorName} (${result.items.length} สัญญา)`,
      );
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    }
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-xl space-y-5 overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-5 sm:rounded-2xl sm:p-7 dark:border-gray-800 dark:bg-gray-900"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            ยืนยันรับปิดยอด
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-gray-400">
            {debtorName} · เลือกหนึ่ง หลาย หรือทุกสัญญาปกติที่ยังเปิดอยู่
          </p>
        </header>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() =>
              setSelected(
                allSelected ? new Set() : new Set(loans.map((loan) => loan.id)),
              )
            }
            className="text-sm font-semibold text-primary"
          >
            {allSelected ? 'ล้างที่เลือก' : 'เลือกทั้งหมด'}
          </button>
          <span className="text-sm text-slate-500 dark:text-gray-400">
            เลือก {selected.size}/{loans.length} สัญญา
          </span>
        </div>

        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 dark:divide-gray-800 dark:border-gray-800">
          {loans.map((loan) => {
            const item = quote?.items.find((row) => row.loanId === loan.id);
            return (
              <li key={loan.id}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-3.5">
                  <input
                    type="checkbox"
                    checked={selected.has(loan.id)}
                    onChange={() => toggle(loan.id)}
                    className="size-5 shrink-0 accent-primary"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-800 dark:text-gray-100">
                      {loan.contractNumber ?? cycleLabel[loan.cycle]}
                    </span>
                    {item && (
                      <span className="mt-0.5 block text-xs text-slate-500 dark:text-gray-400">
                        ดอก ฿{baht(item.interestRemaining)} · ค้าง ฿
                        {baht(item.arrearsDue)} · ต้น ฿
                        {baht(item.principalBalance)}
                      </span>
                    )}
                  </span>
                  <strong className="shrink-0 text-base tabular-nums text-slate-900 dark:text-white">
                    {selected.has(loan.id)
                      ? isFetching && !item
                        ? '…'
                        : `฿${baht(item?.total ?? 0)}`
                      : '—'}
                  </strong>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-between rounded-xl bg-primary/10 px-4 py-3.5">
          <span className="text-sm font-semibold text-slate-700 dark:text-gray-200">
            ยอดปิดที่ยืนยันรับ
          </span>
          <strong className="text-2xl font-bold tabular-nums text-primary">
            {isFetching ? 'กำลังคำนวณ…' : `฿${baht(quote?.total ?? 0)}`}
          </strong>
        </div>

        <p className="text-xs leading-relaxed text-slate-500 dark:text-gray-400">
          ระบบจะบันทึกประวัติรับเงินจริง
          และปิดเฉพาะสัญญาที่เลือกเมื่อชำระครบเท่านั้น
        </p>

        {error && (
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <ModalButtons
          onClose={onClose}
          onSave={() => void save()}
          saving={payoff.isPending}
          saveLabel={`ยืนยันรับปิดยอด ฿${baht(quote?.total ?? 0)}`}
          disabled={loanIds.length === 0 || isFetching || !quote}
        />
      </div>
    </div>
  );
}
