'use client';

import { useEffect, useState } from 'react';
import { ModalButtons, TextInput } from '@/components/form';
import { baht } from '@/lib/format';
import {
  useRecordPayment,
  useSuggestAllocation,
} from '@/lib/hooks/usePayments';
import { toast } from '@/lib/toast-store';

interface Props {
  loanId: string;
  debtorName: string;
  /** ยอดตาย/ผ่อนสินค้า: รับเป็นเงินผ่อนก้อนเดียว หักจากยอดคงเหลือ */
  frozen: boolean;
  /** ปุ่มยอดด่วน — แตะครั้งเดียวเติมจำนวนเงิน (เช่น ยอดที่ต้องเก็บวันนี้) */
  quickAmounts?: { label: string; amount: number }[];
  onClose: () => void;
  onSaved: () => void;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * บันทึกรับเงิน: พิมพ์จำนวนเดียว ระบบจัดสรรให้ตามลำดับ
 *   1) ค้างเก่า  2) ดอกวันนี้  3) ถ้ามีเงินเหลือ → ถามว่าจะตัดต้นไหม
 * แก้ค้างเก่า/ดอกได้ก่อนบันทึก ส่วนเงินเหลือเลือก "ตัดต้น" หรือ "ไม่ตัด"
 * ยอดที่บันทึกจริง = ค้าง + ดอก + (ตัดต้นถ้าเลือก)
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
  const [cutPrincipal, setCutPrincipal] = useState(true);
  const [touched, setTouched] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [debouncedAmount, setDebouncedAmount] = useState(0);

  const amountNum = parseFloat(amount) || 0;

  // เงินที่เหลือหลังหักค้างเก่า + ดอกวันนี้ → เป็นก้อนที่จะถามว่าตัดต้นไหม
  const leftover = round2(Math.max(0, amountNum - arrearsPaid - interestPaid));
  const principalPaid = frozen ? amountNum : cutPrincipal ? leftover : 0;
  const recordedAmount = frozen
    ? amountNum
    : round2(arrearsPaid + interestPaid + principalPaid);

  // ดีเลย์ก่อนขอการจัดสรร กันยิงทุกตัวอักษร
  useEffect(() => {
    const t = setTimeout(() => setDebouncedAmount(amountNum), 300);
    return () => clearTimeout(t);
  }, [amountNum]);

  const { data: suggestion, isFetching: suggesting } = useSuggestAllocation(
    loanId,
    debouncedAmount,
    !frozen && !touched,
  );
  // การจัดสรรอัตโนมัติยังไม่นิ่ง (รอ debounce/รอ API) — กัน Enter บันทึกแซง
  const allocationPending =
    !frozen && !touched && (debouncedAmount !== amountNum || suggesting);

  // เติมค้างเก่า/ดอกที่ระบบแนะนำ (ถ้ายังไม่แก้เอง)
  useEffect(() => {
    if (suggestion && !touched) {
      setArrearsPaid(suggestion.arrearsPaid);
      setInterestPaid(suggestion.interestPaid);
    }
  }, [suggestion, touched]);

  const record = useRecordPayment();

  const save = async () => {
    setError('');
    if (amountNum <= 0) {
      setError('กรอกจำนวนเงิน');
      return;
    }
    if (recordedAmount <= 0) {
      setError('ยอดที่จะบันทึกเป็น 0 — ปรับการจัดสรร');
      return;
    }
    const alloc = frozen
      ? { arrearsPaid: 0, interestPaid: 0, principalPaid: amountNum }
      : { arrearsPaid, interestPaid, principalPaid };
    try {
      await record.mutateAsync({
        loanId,
        amount: recordedAmount,
        ...alloc,
        note: note || undefined,
      });
      toast(`บันทึกรับเงิน ฿${baht(recordedAmount)} — ${debtorName}`);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    }
  };

  const numInput = (value: number, set: (n: number) => void) => (
    <TextInput
      type="number"
      inputMode="decimal"
      align="right"
      value={value === 0 ? '' : value}
      placeholder="0"
      onChange={(e) => {
        setTouched(true);
        set(parseFloat(e.target.value) || 0);
      }}
    />
  );

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md space-y-3 rounded-t-lg border border-gray-200 bg-white p-5 sm:rounded-lg dark:border-gray-800 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          รับเงิน — {debtorName}
        </h2>

        <div>
          <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">
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
              setTouched(false);
              setCutPrincipal(true);
            }}
            onKeyDown={(e) => {
              // กด Enter/Go จากแป้นตัวเลข = บันทึกเลย (ใช้มือเดียวหน้างาน)
              // รอการจัดสรรอัตโนมัตินิ่งก่อน กันเงินลงตัดต้นหมดโดยไม่ตั้งใจ
              if (e.key === 'Enter' && !record.isPending && !allocationPending)
                save();
            }}
            className="w-full rounded-lg border-2 border-primary bg-white px-3 py-3 text-right text-2xl font-bold text-gray-900 focus:outline-none dark:bg-gray-800 dark:text-white"
          />
        </div>

        {/* ยอดด่วน — เคสที่บ่อยที่สุดคือเก็บตามยอดพอดี ให้จบในแตะเดียว */}
        {quickAmounts && quickAmounts.some((q) => q.amount > 0) && (
          <div className="flex flex-wrap gap-2">
            {quickAmounts
              .filter((q) => q.amount > 0)
              .map((q) => {
                const selected = amountNum === q.amount;
                return (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => {
                      setAmount(String(q.amount));
                      setTouched(false);
                      setCutPrincipal(true);
                    }}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                      selected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'
                    }`}
                  >
                    {q.label} ฿{baht(q.amount)}
                  </button>
                );
              })}
          </div>
        )}

        {frozen ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            เงินผ่อน — เงินทั้งก้อนหักจากยอดผ่อนคงเหลือ
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
                  หักค้างเก่า
                </label>
                {numInput(arrearsPaid, setArrearsPaid)}
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
                  ดอกวันนี้
                </label>
                {numInput(interestPaid, setInterestPaid)}
              </div>
            </div>

            {/* ข้อ 3: มีเงินเหลือ → ถามว่าจะตัดต้นไหม */}
            {amountNum > 0 && leftover > 0 && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p className="text-sm text-gray-700 dark:text-gray-200">
                  เหลือจากค้าง+ดอกอีก{' '}
                  <b className="text-gray-900 dark:text-white">
                    ฿{baht(leftover)}
                  </b>{' '}
                  — นำไปตัดต้นไหม?
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCutPrincipal(true)}
                    className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
                      cutPrincipal
                        ? 'bg-primary text-white'
                        : 'border border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-300'
                    }`}
                  >
                    ตัดต้น ฿{baht(leftover)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCutPrincipal(false)}
                    className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
                      !cutPrincipal
                        ? 'bg-gray-700 text-white dark:bg-gray-600'
                        : 'border border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-300'
                    }`}
                  >
                    ไม่ตัด (รับแค่ดอก+ค้าง)
                  </button>
                </div>
                {!cutPrincipal && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    บันทึกเฉพาะ ฿{baht(recordedAmount)} — เงินเหลือ ฿
                    {baht(leftover)} ไม่ถูกบันทึก
                  </p>
                )}
              </div>
            )}
          </>
        )}

        <TextInput
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="หมายเหตุ (ไม่บังคับ)"
          className="text-sm"
        />

        {!frozen && amountNum > 0 && (
          <p className="text-right text-sm text-gray-600 dark:text-gray-300">
            ยอดที่บันทึก{' '}
            <b className="text-gray-900 dark:text-white">
              ฿{baht(recordedAmount)}
            </b>
          </p>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <ModalButtons
          onClose={onClose}
          onSave={save}
          saving={record.isPending}
        />
      </div>
    </div>
  );
}
