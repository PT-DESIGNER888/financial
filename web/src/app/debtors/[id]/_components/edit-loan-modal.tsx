'use client';

import { useState } from 'react';
import { DatePicker } from '@/components/date-picker';
import { Field, ModalButtons, Segmented, TextInput } from '@/components/form';
import { RateInput } from '@/components/rate-input';
import {
  bahtToPercent,
  MAX_RATE_PERCENT,
  type RateUnit,
} from '@/lib/interest';
import { baht } from '@/lib/format';
import { useEditLoan } from '@/lib/hooks/useLoans';
import { LoanCycle, LoanStatus } from '@/lib/types';
import type { Loan, RevolvingCycle } from '@/lib/types';
import { ModalShell } from './ui';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * แก้เงื่อนไขยอดกู้ — ฟิลด์ที่โชว์ขึ้นกับชนิดยอด
 * ยอดตายไม่มีดอกและไม่มีรอบเก็บ เหลือแค่งวดผ่อน / นัดคืนต้น / หมายเหตุ
 */
export function EditLoanModal({
  loan,
  onClose,
  onSaved,
}: {
  loan: Loan;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isDead = loan.status === LoanStatus.DEAD;
  const isInstallment = loan.status === LoanStatus.INSTALLMENT;
  // ยอดผ่อนงวด: แผนที่ตรึงไว้ตอนเปิดยอด — แก้ได้ถ้าตกลงกับลูกหนี้ไว้คนละแบบ
  const planPaid = round2(
    (loan.installmentTotal ?? 0) - (loan.deadBalance ?? 0),
  );
  const [planCount, setPlanCount] = useState(
    loan.installmentCount != null ? String(loan.installmentCount) : '',
  );
  // เริ่มที่ "ผ่อนรวม" เพราะตรงกับแผนเดิมเป๊ะ (งวดละ × จำนวนงวด อาจเพี้ยนเมื่อหารไม่ลงตัว)
  const [planMode, setPlanMode] = useState<'PER' | 'TOTAL'>('TOTAL');
  const [planPer, setPlanPer] = useState(
    loan.installmentAmount != null ? String(loan.installmentAmount) : '',
  );
  const [planTotal, setPlanTotal] = useState(
    loan.installmentTotal != null ? String(loan.installmentTotal) : '',
  );
  const [planRounded, setPlanRounded] = useState(loan.roundInstallments);
  const planCountNum = parseInt(planCount, 10) || 0;
  const newTotal =
    planMode === 'PER'
      ? round2((parseFloat(planPer) || 0) * planCountNum)
      : round2(parseFloat(planTotal) || 0);
  // งวดจริงที่ระบบจะหาร (ตรงกับ buildInstallmentPlan ฝั่ง API)
  const newPer =
    planCountNum > 0
      ? planRounded
        ? Math.floor(newTotal / planCountNum)
        : round2(newTotal / planCountNum)
      : 0;
  const newLast =
    planCountNum > 0 ? round2(newTotal - newPer * (planCountNum - 1)) : 0;
  const planChanged =
    isInstallment &&
    (newTotal !== loan.installmentTotal ||
      planCountNum !== loan.installmentCount ||
      planRounded !== loan.roundInstallments);

  const [rate, setRate] = useState(String(loan.interestRatePercent));
  const [rateUnit, setRateUnit] = useState<RateUnit>('PERCENT');
  // ฐานคำนวณดอก — ดอกคงที่คิดจากต้นเดิม ดอกลอยคิดจากต้นคงเหลือ
  const rateBase =
    loan.interestMode === 'FLAT'
      ? loan.principalOriginal
      : loan.outstandingPrincipal;
  const typedRate = parseFloat(rate) || 0;
  const ratePercent =
    rateUnit === 'PERCENT' ? typedRate : bahtToPercent(rateBase, typedRate);
  // แก้เงื่อนไขได้เฉพาะยอดดอกลอย/คงที่ (รายวัน / 7 วัน / 10 วัน)
  const [cycle, setCycle] = useState<RevolvingCycle>(
    loan.cycle === LoanCycle.MONTHLY ? LoanCycle.DAILY : loan.cycle,
  );
  const [hasInstallment, setHasInstallment] = useState(
    loan.installmentAmount != null,
  );
  const [installment, setInstallment] = useState(
    loan.installmentAmount != null ? String(loan.installmentAmount) : '',
  );
  const [dueDate, setDueDate] = useState(loan.principalDueDate ?? '');
  const [dueAmount, setDueAmount] = useState(
    loan.principalDueAmount != null ? String(loan.principalDueAmount) : '',
  );
  const [note, setNote] = useState(loan.note ?? '');
  const [error, setError] = useState('');
  const edit = useEditLoan();

  const save = async () => {
    const installmentNum = parseFloat(installment) || 0;
    if (isInstallment) {
      if (planCountNum < 1) {
        setError('จำนวนงวดต้องอย่างน้อย 1 งวด');
        return;
      }
      if (newTotal <= 0) {
        setError(
          planMode === 'PER' ? 'งวดละต้องมากกว่า 0' : 'ผ่อนรวมต้องมากกว่า 0',
        );
        return;
      }
      if (newTotal < loan.principalOriginal + loan.fee) {
        setError(
          `ผ่อนรวมต้องไม่น้อยกว่าต้น + ค่าธรรมเนียม ฿${baht(round2(loan.principalOriginal + loan.fee))}`,
        );
        return;
      }
      if (newTotal < planPaid) {
        setError(`ผ่อนรวมใหม่น้อยกว่ายอดที่เก็บมาแล้ว ฿${baht(planPaid)}`);
        return;
      }
    } else if (!isDead) {
      if (!ratePercent || ratePercent <= 0) {
        setError('อัตราดอกต้องมากกว่า 0');
        return;
      }
      if (ratePercent > MAX_RATE_PERCENT) {
        setError('ดอกต่อรอบสูงเกินกว่าที่ระบบเก็บได้');
        return;
      }
    } else if (hasInstallment && !(installmentNum > 0)) {
      setError('งวดผ่อนต้องมากกว่า 0');
      return;
    }
    const amount = dueAmount.trim() === '' ? undefined : parseFloat(dueAmount);
    if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) {
      setError('ยอดนัดคืนต้นต้องไม่ติดลบ');
      return;
    }
    try {
      await edit.mutateAsync({
        id: loan.id,
        input: {
          note,
          // ยอดตาย/ยอดผ่อนงวดไม่ส่งดอก/รอบเก็บไปเลย — ฝั่ง API ปฏิเสธถ้าส่งมา
          ...(isInstallment
            ? {
                installmentCount: planCountNum,
                // ลดต้นลดดอกคิดผ่อนรวมจากอัตราดอกเอง แก้ได้แค่จำนวนงวด/ปัดเศษ
                ...(loan.amortized ? {} : { installmentTotal: newTotal }),
                roundInstallments: planRounded,
              }
            : isDead
              ? hasInstallment
                ? { installmentAmount: installmentNum }
                : { clearInstallment: true }
              : { interestRatePercent: ratePercent, cycle }),
          ...(dueDate === ''
            ? { clearPrincipalDue: true }
            : { principalDueDate: dueDate, principalDueAmount: amount }),
        },
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    }
  };

  return (
    <ModalShell
      title={
        isInstallment
          ? 'แก้แผนผ่อน'
          : isDead
            ? 'แก้เงื่อนไขยอดตาย'
            : 'แก้เงื่อนไขยอดกู้'
      }
      onClose={onClose}
    >
      {isInstallment ? (
        <>
          <p className="rounded-lg bg-slate-100 p-3 text-xs leading-relaxed text-slate-600 dark:bg-gray-800 dark:text-gray-300">
            แผนเดิม {loan.installmentCount} งวด · งวดละ ฿
            {baht(loan.installmentAmount ?? 0)} · ผ่อนรวม ฿
            {baht(loan.installmentTotal ?? 0)}
            {planPaid > 0 && ` · เก็บมาแล้ว ฿${baht(planPaid)}`}
          </p>
          <Field label="จำนวนงวด">
            <TextInput
              type="number"
              inputMode="numeric"
              align="right"
              value={planCount}
              onChange={(e) => setPlanCount(e.target.value)}
            />
          </Field>
          {loan.amortized ? (
            <p className="text-xs leading-relaxed text-gray-400">
              ยอดลดต้นลดดอกคิดผ่อนรวมจากอัตราดอกต่องวด — แก้ได้แค่จำนวนงวด
            </p>
          ) : (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-600 md:text-[15px] dark:text-gray-300">
                  {planMode === 'PER' ? 'งวดละ (บาท)' : 'ผ่อนรวม (บาท)'}
                </label>
                <Segmented
                  value={planMode}
                  onChange={setPlanMode}
                  options={[
                    { value: 'PER', label: 'งวดละ' },
                    { value: 'TOTAL', label: 'ผ่อนรวม' },
                  ]}
                />
              </div>
              <TextInput
                type="number"
                inputMode="decimal"
                align="right"
                value={planMode === 'PER' ? planPer : planTotal}
                onChange={(e) =>
                  planMode === 'PER'
                    ? setPlanPer(e.target.value)
                    : setPlanTotal(e.target.value)
                }
              />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={planRounded}
              onChange={(e) => setPlanRounded(e.target.checked)}
            />
            ปัดยอดต่องวดเป็นบาทเต็ม (เศษไปรวมงวดสุดท้าย)
          </label>
          {!loan.amortized && planCountNum > 0 && newTotal > 0 && (
            <p className="text-xs leading-relaxed text-slate-500 dark:text-gray-400">
              แผนใหม่: ผ่อนรวม ฿{baht(newTotal)} (ต้น ฿
              {baht(loan.principalOriginal)} + ดอก ฿
              {baht(round2(newTotal - loan.principalOriginal - loan.fee))}
              {loan.fee > 0 && ` + ค่าธรรมเนียม ฿${baht(loan.fee)}`}) ·{' '}
              {newPer === newLast
                ? `งวดละ ฿${baht(newPer)} × ${planCountNum} งวด`
                : `${planCountNum - 1} งวดละ ฿${baht(newPer)} · งวดสุดท้าย ฿${baht(newLast)}`}
              {planChanged &&
                ` · ยอดคงเหลือใหม่ ฿${baht(round2(newTotal - planPaid))}`}
            </p>
          )}
        </>
      ) : isDead ? (
        <>
          <p className="rounded-lg bg-slate-100 p-3 text-xs leading-relaxed text-slate-600 dark:bg-gray-800 dark:text-gray-300">
            ยอดตายหยุดคิดดอกแล้ว — ยอดคงเหลือตรึงไว้ที่ ฿
            {loan.deadBalance?.toLocaleString('th-TH') ?? 0}
            {' '}แก้ยอดได้ที่ &ldquo;ปรับยอด&rdquo;
          </p>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={hasInstallment}
              onChange={(e) => setHasInstallment(e.target.checked)}
            />
            ตกลงงวดผ่อนไว้ (ทุก 10 วัน)
          </label>
          {hasInstallment ? (
            <Field label="งวดละ (บาท)">
              <TextInput
                type="number"
                inputMode="decimal"
                align="right"
                value={installment}
                onChange={(e) => setInstallment(e.target.value)}
              />
            </Field>
          ) : (
            <p className="text-xs leading-relaxed text-gray-400">
              ไม่ตกลงงวด = ทยอยคืนเมื่อไหร่ก็ได้
              ยอดนี้จะไม่ขึ้นในหน้าเก็บวันนี้ นอกจากวันที่ลงนัดคืนต้นไว้
            </p>
          )}
        </>
      ) : (
        <>
          <RateInput
            base={rateBase}
            unit={rateUnit}
            onUnitChange={setRateUnit}
            value={rate}
            onChange={setRate}
            label="ดอกต่อรอบ"
          />
          <Field label="รอบเก็บ">
            <Segmented
              value={cycle}
              onChange={(v) => setCycle(v)}
              options={[
                { value: LoanCycle.DAILY, label: 'รายวัน' },
                { value: LoanCycle.WEEKLY, label: 'ทุก 7 วัน' },
                { value: LoanCycle.TEN_DAY, label: 'ทุก 10 วัน' },
              ]}
            />
          </Field>
        </>
      )}

      <Field
        label="นัดคืนต้น (ถ้ามี)"
        hint={
          isDead
            ? 'ถึงวันนัดแล้วยอดนี้จะโผล่ในหน้าเก็บวันนี้ — ไม่ระบุยอด = ทั้งยอดคงเหลือ'
            : 'ถึงวันนัดแล้วยอดนี้จะโผล่ในหน้าเก็บวันนี้ — ไม่ระบุยอด = ทั้งต้นคงเหลือ'
        }
      >
        <div className="space-y-2">
          <DatePicker value={dueDate} onChange={setDueDate} />
          {dueDate !== '' && (
            <div className="flex items-center gap-2">
              <TextInput
                type="number"
                inputMode="decimal"
                align="right"
                placeholder="ยอดที่นัด (ไม่บังคับ)"
                value={dueAmount}
                onChange={(e) => setDueAmount(e.target.value)}
              />
              <button
                type="button"
                onClick={() => {
                  setDueDate('');
                  setDueAmount('');
                }}
                className="min-h-12 shrink-0 rounded-xl px-3 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                ล้างนัด
              </button>
            </div>
          )}
        </div>
      </Field>

      <Field label="หมายเหตุ">
        <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {isInstallment && (
        <p className="text-xs leading-relaxed text-gray-400">
          * เงินที่เก็บมาแล้วไม่ถูกแตะ — ยอดคงเหลือขยับตามผ่อนรวมใหม่
          และระบบบันทึกค่าก่อน/หลังไว้ในประวัติจัดการ
        </p>
      )}
      {!isDead && !isInstallment && (
        <p className="text-xs leading-relaxed text-gray-400">
          * แก้อัตราดอกมีผลกับรอบถัดไป ยอดค้างเดิมไม่เปลี่ยน — ถ้ารอบที่กำลังเดิน
          คิดดอกผิดไปแล้ว แก้ที่ &ldquo;เลื่อนวัน / แก้ดอก&rdquo; ของรอบนั้น
        </p>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
      <ModalButtons onClose={onClose} onSave={save} saving={edit.isPending} />
    </ModalShell>
  );
}
