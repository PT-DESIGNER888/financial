'use client';

import { useEffect, useState } from 'react';
import { ModalButtons, TextInput } from '@/components/form';
import { baht } from '@/lib/format';
import { confirmDialog } from '@/lib/confirm-store';
import {
  useRecordPayment,
  useSuggestAllocation,
} from '@/lib/hooks/usePayments';
import { toast } from '@/lib/toast-store';

interface Props {
  loanId: string;
  debtorName: string;
  /** ยอดตาย/ผ่อนงวด: รับเป็นเงินผ่อนก้อนเดียว หักจากยอดคงเหลือ */
  frozen: boolean;
  /** ปุ่มยอดด่วน เช่น ยอดที่ต้องเก็บวันนี้ */
  quickAmounts?: { label: string; amount: number }[];
  onClose: () => void;
  onSaved: () => void;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * รับเงิน (ตาม Codex ล่าสุด):
 * - กรอกยอดรับ → คำนวณค้าง/ดอก/ต้นให้อัตโนมัติ
 * - แก้ตัวเลขจัดสรรได้ + ปุ่มคำนวณใหม่
 * - จ่ายคืนทั้งหมด / ยอดเกินถามก่อนบันทึก
 * - การ์ดกว้าง ลำดับชัด: ยอดรับ → จัดสรร 3 ช่อง → บันทึก
 */
export function PaymentModal({
  loanId,
  debtorName,
  frozen,
  quickAmounts,
  onClose,
  onSaved,
}: Props) {
  const [amount, setAmount] = useState('');
  const [arrearsPaid, setArrearsPaid] = useState(0);
  const [interestPaid, setInterestPaid] = useState(0);
  const [principalPaid, setPrincipalPaid] = useState(0);
  const [manual, setManual] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [debouncedAmount, setDebouncedAmount] = useState(0);

  const amountNum = parseFloat(amount) || 0;
  const amountEmpty = amount.trim() === '' || amountNum <= 0;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedAmount(amountNum), 250);
    return () => clearTimeout(t);
  }, [amountNum]);

  const { data: ceiling } = useSuggestAllocation(loanId, 1e12, true);
  const maxReceivable = ceiling?.maxReceivable ?? 0;
  const principalBalance = ceiling?.principalBalance ?? 0;

  const { data: suggestion, isFetching: suggesting } = useSuggestAllocation(
    loanId,
    debouncedAmount,
    !amountEmpty,
  );
  const suggestionPending =
    !amountEmpty && (debouncedAmount !== amountNum || suggesting);

  // เติมอัตโนมัติเมื่อยังไม่แก้เอง
  useEffect(() => {
    if (!suggestion || manual || amountEmpty) return;
    setArrearsPaid(suggestion.arrearsPaid);
    setInterestPaid(suggestion.interestPaid);
    setPrincipalPaid(suggestion.principalPaid);
  }, [suggestion, manual, amountEmpty]);

  const allocated = round2(arrearsPaid + interestPaid + principalPaid);
  const remainingPrincipal = round2(
    Math.max(0, principalBalance - principalPaid),
  );
  const overAllocated = !amountEmpty && allocated > amountNum + 0.001;
  const excessReceive = amountEmpty
    ? 0
    : round2(Math.max(0, amountNum - maxReceivable));

  const record = useRecordPayment();

  const applyAmount = (n: number) => {
    setAmount(String(n));
    setManual(false);
    setError('');
  };

  const recalculate = () => {
    setManual(false);
    setError('');
    if (suggestion) {
      setArrearsPaid(suggestion.arrearsPaid);
      setInterestPaid(suggestion.interestPaid);
      setPrincipalPaid(suggestion.principalPaid);
    }
  };

  const save = async () => {
    setError('');
    if (amountEmpty) {
      setError('กรุณากรอกจำนวนเงินที่รับ');
      return;
    }
    if (!manual && suggestionPending) {
      setError('กำลังคำนวณ…');
      return;
    }
    if (allocated <= 0) {
      setError('ยอดที่จะบันทึกเป็น 0');
      return;
    }
    if (overAllocated) {
      setError(`ยอดตัดเกินยอดรับ ฿${baht(round2(allocated - amountNum))}`);
      return;
    }

    let saveAmount = allocated;
    let saveNote = note.trim();
    let alloc = { arrearsPaid, interestPaid, principalPaid };

    if (excessReceive > 0) {
      const ok = await confirmDialog({
        title: `ยอดรับเกิน ฿${baht(excessReceive)}`,
        detail: `จะบันทึกตามยอดจัดสรร ฿${baht(allocated)} ส่วนที่เกินไม่ผูกกับสัญญา`,
        confirmLabel: 'บันทึก',
      });
      if (!ok) return;
      saveNote = [saveNote, `รับเกิน ฿${baht(excessReceive)} ไม่บันทึกในสัญญา`]
        .filter(Boolean)
        .join(' · ');
    }

    if (frozen) {
      alloc = {
        arrearsPaid: 0,
        interestPaid: 0,
        principalPaid: allocated,
      };
      saveAmount = allocated;
    }

    saveAmount = allocated;

    try {
      await record.mutateAsync({
        loanId,
        amount: saveAmount,
        ...alloc,
        note: saveNote || undefined,
      });
      toast(`บันทึกรับเงิน ฿${baht(saveAmount)} — ${debtorName}`);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    }
  };

  const numField = (
    label: string,
    value: number,
    set: (n: number) => void,
  ) => (
    <div className="min-w-0">
      <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-gray-300">
        {label}
      </label>
      <TextInput
        type="number"
        inputMode="decimal"
        align="right"
        value={amountEmpty ? '' : value === 0 ? '0' : value}
        disabled={amountEmpty}
        placeholder="—"
        onChange={(e) => {
          setManual(true);
          set(parseFloat(e.target.value) || 0);
          setError('');
        }}
        className="h-12 text-base tabular-nums md:h-14 md:text-lg"
      />
    </div>
  );

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
            รับเงิน
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
            {debtorName}
            {maxReceivable > 0 && (
              <> · ยอดค้างทั้งหมด ฿{baht(maxReceivable)}</>
            )}
          </p>
        </header>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-gray-300">
            จำนวนเงินที่รับ (บาท)
          </label>
          <input
            type="number"
            inputMode="decimal"
            autoFocus
            enterKeyHint="done"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setManual(false);
              setError('');
            }}
            onKeyDown={(e) => {
              if (
                e.key === 'Enter' &&
                !record.isPending &&
                !(!manual && suggestionPending)
              )
                void save();
            }}
            className="w-full rounded-2xl border-2 border-primary bg-white px-4 py-4 text-right text-3xl font-bold text-slate-900 tabular-nums focus:outline-none md:py-5 md:text-4xl dark:bg-gray-800 dark:text-white"
            placeholder="0"
          />
        </div>

        <div className="flex flex-wrap gap-2.5">
          {maxReceivable > 0 && (
            <button
              type="button"
              onClick={() => applyAmount(maxReceivable)}
              className={`min-h-12 rounded-xl border px-4 py-3 text-base font-semibold transition-colors ${
                amountNum === maxReceivable
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'
              }`}
            >
              จ่ายคืนทั้งหมด ฿{baht(maxReceivable)}
            </button>
          )}
          {quickAmounts
            ?.filter((q) => q.amount > 0 && q.amount !== maxReceivable)
            .map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => applyAmount(q.amount)}
                className={`min-h-12 rounded-xl border px-4 py-3 text-base font-semibold transition-colors ${
                  amountNum === q.amount
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'
                }`}
              >
                {q.label} ฿{baht(q.amount)}
              </button>
            ))}
          {!amountEmpty && (
            <button
              type="button"
              onClick={recalculate}
              className="min-h-12 rounded-xl border border-slate-200 px-4 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              คำนวณใหม่
            </button>
          )}
        </div>

        <section aria-live="polite" aria-label="จัดสรรยอดรับ" className="space-y-3">
          <h3 className="text-base font-semibold text-slate-900 md:text-lg dark:text-white">
            จัดสรรยอดรับ
          </h3>

          {frozen ? (
            numField('หักยอดผ่อน', principalPaid, setPrincipalPaid)
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
              {numField('ค้างเก่า', arrearsPaid, setArrearsPaid)}
              {numField('ดอกวันนี้', interestPaid, setInterestPaid)}
              {numField('ตัดเงินต้น', principalPaid, setPrincipalPaid)}
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm dark:bg-gray-950/60">
            <span className="text-slate-500 dark:text-gray-400">
              {frozen ? 'ยอดผ่อนคงเหลือ' : 'เงินต้นคงเหลือ'}
            </span>
            <strong className="text-base tabular-nums text-slate-900 md:text-lg dark:text-white">
              {amountEmpty ? '—' : `฿${baht(remainingPrincipal)}`}
            </strong>
          </div>
        </section>

        {(overAllocated || excessReceive > 0) && !amountEmpty && (
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            {overAllocated
              ? `ยอดตัดเกินยอดรับ ฿${baht(round2(allocated - amountNum))}`
              : `ยอดรับเกิน ฿${baht(excessReceive)}`}
          </p>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-gray-300">
            หมายเหตุ
          </label>
          <TextInput
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ไม่บังคับ"
            className="h-12 text-base"
          />
        </div>

        {error && (
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        {amountEmpty && !error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            กรุณากรอกจำนวนเงินที่รับ
          </p>
        )}

        <ModalButtons
          onClose={onClose}
          onSave={() => void save()}
          saving={record.isPending}
          saveLabel="บันทึกการรับเงิน"
          disabled={
            amountEmpty || overAllocated || (!manual && suggestionPending)
          }
        />
      </div>
    </div>
  );
}
