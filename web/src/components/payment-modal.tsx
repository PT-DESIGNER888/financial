'use client';

import { useEffect, useState } from 'react';
import { ModalButtons, Segmented, TextInput } from '@/components/form';
import { baht, thaiDate } from '@/lib/format';
import { confirmDialog } from '@/lib/confirm-store';
import {
  usePrepayCycles,
  usePrepayQuote,
  useRecordPayment,
  useSuggestAllocation,
} from '@/lib/hooks/usePayments';
import { toast } from '@/lib/toast-store';
import { PaymentType } from '@/lib/types';

interface Props {
  loanId: string;
  debtorName: string;
  /** ยอดตาย/ผ่อนงวด/หนี้สูญ: รับเป็นเงินก้อนเดียว หักจากยอดคงเหลือ */
  frozen: boolean;
  /** ชื่อยอดที่หัก เมื่อ frozen — เช่น "ยอดผ่อน" (ค่าเริ่มต้น) หรือ "ยอดหนี้สูญ" */
  frozenLabel?: string;
  /** ปุ่มยอดด่วน เช่น ยอดที่ต้องเก็บวันนี้ */
  quickAmounts?: { label: string; amount: number }[];
  /** กรอกยอดเริ่มต้น (เช่น ยอดวันนี้จากหน้าเก็บ) */
  defaultAmount?: number;
  /** ประเภทการรับเงินเริ่มต้น — วันนัดคืนต้นใช้ BOTH */
  defaultType?: PaymentType;
  onClose: () => void;
  onSaved: () => void;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * รับเงิน:
 * - เลือกประเภทก่อน: ชำระดอก (ต้นคงเดิม) / ลดเงินต้น / ดอก+ลดต้น
 * - ดอกรอบนี้ระบบคำนวณให้ แต่แก้ยอดที่ตกลงเก็บจริงได้ (บันทึกลงรอบดอก)
 * - กรอกยอดรับ → จัดสรรอัตโนมัติตามประเภท แก้ตัวเลขได้ + ปุ่มคำนวณใหม่
 * - จ่ายคืนทั้งหมด / ยอดเกินถามก่อนบันทึก
 */
export function PaymentModal({
  loanId,
  debtorName,
  frozen,
  frozenLabel = 'ยอดผ่อน',
  quickAmounts,
  defaultAmount,
  defaultType,
  onClose,
  onSaved,
}: Props) {
  const [amount, setAmount] = useState(
    defaultAmount != null && defaultAmount > 0 ? String(defaultAmount) : '',
  );
  const [mode, setMode] = useState<'normal' | 'prepay'>('normal');
  const [prepayCount, setPrepayCount] = useState(2);
  const [paymentType, setPaymentType] = useState<PaymentType>(
    defaultType ?? PaymentType.INTEREST,
  );
  const [interestDueStr, setInterestDueStr] = useState(''); // '' = ใช้ที่ระบบคำนวณ
  const [arrearsPaid, setArrearsPaid] = useState(0);
  const [interestPaid, setInterestPaid] = useState(0);
  const [principalPaid, setPrincipalPaid] = useState(0);
  const [manual, setManual] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [debouncedAmount, setDebouncedAmount] = useState(0);

  const amountNum = parseFloat(amount) || 0;
  const amountEmpty = amount.trim() === '' || amountNum <= 0;
  const effType: PaymentType = frozen ? PaymentType.BOTH : paymentType;
  const interestDueNum =
    interestDueStr.trim() === '' ? undefined : parseFloat(interestDueStr) || 0;
  const [debouncedDue, setDebouncedDue] = useState<number | undefined>(
    undefined,
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedAmount(amountNum), 250);
    return () => clearTimeout(t);
  }, [amountNum]);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedDue(interestDueNum), 250);
    return () => clearTimeout(t);
  }, [interestDueNum]);

  const { data: ceiling } = useSuggestAllocation(
    loanId,
    1e12,
    true,
    effType,
    debouncedDue,
  );
  const maxReceivable = ceiling?.maxReceivable ?? 0;
  const principalBalance = ceiling?.principalBalance ?? 0;
  const cycle = ceiling?.cycle ?? null;
  const arrearsDue = ceiling?.arrearsDue ?? 0;
  // ยอดดอกลอย/คงที่ที่ยังเดินอยู่ — รองรับชำระดอกล่วงหน้าหลายรอบ
  const revolving = !frozen && !!cycle;

  const { data: prepayQuote, isFetching: prepayLoading } = usePrepayQuote(
    loanId,
    prepayCount,
    mode === 'prepay' && revolving,
  );
  const prepay = usePrepayCycles();

  const doPrepay = async () => {
    setError('');
    try {
      const rows = await prepay.mutateAsync({ loanId, count: prepayCount });
      toast(
        `ชำระดอกล่วงหน้า ${rows.length} รอบ ฿${baht(
          prepayQuote?.total ?? 0,
        )} — ${debtorName}`,
      );
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    }
  };

  const { data: suggestion, isFetching: suggesting } = useSuggestAllocation(
    loanId,
    debouncedAmount,
    !amountEmpty,
    effType,
    debouncedDue,
  );
  const suggestionPending =
    !amountEmpty &&
    (debouncedAmount !== amountNum ||
      debouncedDue !== interestDueNum ||
      suggesting);

  // เติมอัตโนมัติเมื่อยังไม่แก้เอง — ปรับ state ตอน render เมื่อ dependency เปลี่ยน
  const [prevAlloc, setPrevAlloc] = useState({ suggestion, manual, amountEmpty });
  if (
    prevAlloc.suggestion !== suggestion ||
    prevAlloc.manual !== manual ||
    prevAlloc.amountEmpty !== amountEmpty
  ) {
    setPrevAlloc({ suggestion, manual, amountEmpty });
    if (suggestion && !manual && !amountEmpty) {
      setArrearsPaid(suggestion.arrearsPaid);
      setInterestPaid(suggestion.interestPaid);
      setPrincipalPaid(suggestion.principalPaid);
    }
  }

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

  const changeType = (t: PaymentType) => {
    setPaymentType(t);
    setManual(false); // ให้ระบบจัดสรรใหม่ตามประเภท
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

    // แก้ยอดดอกรอบนี้ไว้ → บันทึกลงรอบดอกพร้อมการรับเงิน
    const overrideChanged =
      !frozen &&
      cycle &&
      interestDueNum !== undefined &&
      interestDueNum !== (cycle.interestOverride ?? cycle.computedInterest);

    try {
      await record.mutateAsync({
        loanId,
        amount: saveAmount,
        paymentType: frozen ? undefined : paymentType,
        interestDueOverride: overrideChanged ? interestDueNum : undefined,
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

        {revolving && (
          <Segmented
            value={mode}
            onChange={(m) => {
              setMode(m);
              setError('');
            }}
            options={[
              { value: 'normal', label: 'รับปกติ' },
              {
                value: 'prepay',
                label: 'จ่ายล่วงหน้า',
                hint: 'ส่งดอกหลายรอบ',
              },
            ]}
          />
        )}

        {mode === 'prepay' ? (
          <PrepayPanel
            count={prepayCount}
            setCount={setPrepayCount}
            total={prepayQuote?.total ?? 0}
            perCycle={prepayQuote?.perCycle ?? 0}
            rows={prepayQuote?.cycles ?? []}
            loading={prepayLoading}
          />
        ) : (
          <>
        {!frozen && (
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-gray-300">
              ประเภทการชำระ
            </label>
            <Segmented
              value={paymentType}
              onChange={changeType}
              options={[
                {
                  value: PaymentType.INTEREST,
                  label: 'ชำระดอก',
                  hint: 'เงินต้นคงเดิม',
                },
                { value: PaymentType.PRINCIPAL, label: 'ลดเงินต้น', hint: 'ตัดต้นอย่างเดียว' },
                { value: PaymentType.BOTH, label: 'ดอก + ลดต้น', hint: 'ดอก→ค้าง→ต้น' },
                ...(arrearsDue > 0
                  ? [
                      {
                        value: PaymentType.ARREARS,
                        label: 'เฉพาะค้าง',
                        hint: 'เก็บค้างเก่าล้วน',
                      },
                    ]
                  : []),
              ]}
            />
          </div>
        )}

        {!frozen &&
          cycle &&
          paymentType !== PaymentType.PRINCIPAL &&
          paymentType !== PaymentType.ARREARS && (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-gray-700 dark:bg-gray-950/60">
            <p className="text-sm text-slate-600 dark:text-gray-300">
              รอบนี้ครบกำหนด{' '}
              <b className="text-slate-900 dark:text-white">
                {thaiDate(cycle.dueDate)}
              </b>{' '}
              · ระบบคำนวณดอก ฿{baht(cycle.computedInterest)}
              {cycle.interestPaid > 0 && (
                <> · จ่ายแล้วในรอบ ฿{baht(cycle.interestPaid)}</>
              )}
            </p>
            <div className="flex items-center gap-3">
              <label className="shrink-0 text-sm font-medium text-slate-600 dark:text-gray-300">
                เก็บดอกจริงรอบนี้
              </label>
              <TextInput
                type="number"
                inputMode="decimal"
                align="right"
                value={
                  interestDueStr === '' ? String(cycle.interestDue) : interestDueStr
                }
                onChange={(e) => {
                  setInterestDueStr(e.target.value);
                  setManual(false);
                  setError('');
                }}
                className="h-11 text-base tabular-nums"
              />
            </div>
            {interestDueNum !== undefined &&
              interestDueNum !== cycle.computedInterest && (
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                  ตกลงเก็บ ฿{baht(interestDueNum)} แทน ฿
                  {baht(cycle.computedInterest)} — ส่วนต่างไม่ถือเป็นยอดค้าง
                </p>
              )}
          </div>
        )}

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
              {frozen || paymentType === PaymentType.BOTH
                ? 'จ่ายคืนทั้งหมด'
                : paymentType === PaymentType.INTEREST
                  ? 'ดอก + ค้างทั้งหมด'
                  : 'ปิดเงินต้นทั้งหมด'}{' '}
              ฿{baht(maxReceivable)}
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
            numField(`หัก${frozenLabel}`, principalPaid, setPrincipalPaid)
          ) : paymentType === PaymentType.ARREARS ? (
            numField('ค้างเก่า', arrearsPaid, setArrearsPaid)
          ) : paymentType === PaymentType.INTEREST ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              {numField('ดอกรอบนี้', interestPaid, setInterestPaid)}
              {numField('ค้างเก่า', arrearsPaid, setArrearsPaid)}
            </div>
          ) : paymentType === PaymentType.PRINCIPAL ? (
            numField('ตัดเงินต้น', principalPaid, setPrincipalPaid)
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
              {numField('ดอกรอบนี้', interestPaid, setInterestPaid)}
              {numField('ค้างเก่า', arrearsPaid, setArrearsPaid)}
              {numField('ตัดเงินต้น', principalPaid, setPrincipalPaid)}
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm dark:bg-gray-950/60">
            <span className="text-slate-500 dark:text-gray-400">
              {frozen ? `${frozenLabel}คงเหลือ` : 'เงินต้นคงเหลือ'}
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
          </>
        )}

        {error && (
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        {mode === 'normal' && amountEmpty && !error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            กรุณากรอกจำนวนเงินที่รับ
          </p>
        )}

        {mode === 'prepay' ? (
          <ModalButtons
            onClose={onClose}
            onSave={() => void doPrepay()}
            saving={prepay.isPending}
            saveLabel={`ชำระดอกล่วงหน้า ${prepayQuote?.count ?? 0} รอบ`}
            disabled={prepayLoading || (prepayQuote?.count ?? 0) === 0}
          />
        ) : (
          <ModalButtons
            onClose={onClose}
            onSave={() => void save()}
            saving={record.isPending}
            saveLabel="บันทึกการรับเงิน"
            disabled={
              amountEmpty || overAllocated || (!manual && suggestionPending)
            }
          />
        )}
      </div>
    </div>
  );
}

/** แผงชำระดอกล่วงหน้าหลายรอบ (รายวัน/ราย 7/10 วัน) */
function PrepayPanel({
  count,
  setCount,
  total,
  perCycle,
  rows,
  loading,
}: {
  count: number;
  setCount: (n: number) => void;
  total: number;
  perCycle: number;
  rows: { dueDate: string; interest: number }[];
  loading: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-600 dark:border-gray-700 dark:bg-gray-950/60 dark:text-gray-300">
        ส่งดอกล่วงหน้าหลายรอบในครั้งเดียว — ระบบตัดยอดให้ตรงตามวันของแต่ละรอบ
        {perCycle > 0 && <> · รอบละ ฿{baht(perCycle)}</>}
      </div>

      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-slate-600 dark:text-gray-300">
          จำนวนรอบล่วงหน้า
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="ลดจำนวนรอบ"
            onClick={() => setCount(Math.max(1, count - 1))}
            className="flex size-11 items-center justify-center rounded-xl border border-slate-200 text-xl font-bold text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            −
          </button>
          <span
            data-money
            className="w-12 text-center text-xl font-bold tabular-nums text-slate-900 dark:text-white"
          >
            {count}
          </span>
          <button
            type="button"
            aria-label="เพิ่มจำนวนรอบ"
            onClick={() => setCount(Math.min(60, count + 1))}
            className="flex size-11 items-center justify-center rounded-xl border border-slate-200 text-xl font-bold text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            +
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-primary/10 px-4 py-3.5">
        <span className="text-sm font-medium text-slate-700 dark:text-gray-200">
          รวมดอกล่วงหน้า{loading && ' …'}
        </span>
        <strong
          data-money
          className="text-2xl font-bold tabular-nums text-primary"
        >
          ฿{baht(total)}
        </strong>
      </div>

      {rows.length > 0 && (
        <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
          {rows.map((r) => (
            <li
              key={r.dueDate}
              className="flex items-center justify-between rounded-lg px-3 py-1.5 text-slate-600 odd:bg-slate-50 dark:text-gray-300 dark:odd:bg-gray-800/60"
            >
              <span>{thaiDate(r.dueDate)}</span>
              <span data-money className="tabular-nums">
                ฿{baht(r.interest)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
