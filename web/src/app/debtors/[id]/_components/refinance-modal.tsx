'use client';

import { useState } from 'react';
import {
  Field,
  FormInput,
  ModalButtons,
  SelectMenu,
  Segmented,
  TextInput,
} from '@/components/form';
import { baht, cycleLabel } from '@/lib/format';
import { useRefinance } from '@/lib/hooks/useLoans';
import type { CreateLoanInput } from '@/lib/hooks/useLoans';
import { toast } from '@/lib/toast-store';
import { LoanCycle, LoanStatus, REVOLVING_CYCLES } from '@/lib/types';
import type { Loan, RevolvingCycle } from '@/lib/types';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const revolvingCycleOptions = REVOLVING_CYCLES.map((c) => ({
  value: c,
  label: cycleLabel[c],
}));

const installmentCycleOptions: { value: LoanCycle; label: string }[] = [
  { value: LoanCycle.DAILY, label: 'รายวัน' },
  { value: LoanCycle.WEEKLY, label: 'รายสัปดาห์' },
  { value: LoanCycle.TEN_DAY, label: 'ทุก 10 วัน' },
  { value: LoanCycle.MONTHLY, label: 'รายเดือน' },
];

/**
 * รียอด — ปิดสัญญาเดิม เปิดสัญญาใหม่ ยกยอดเหลือเดิมมารวมต้นใหม่
 * เงินที่ลูกหนี้รับจริง = ต้นใหม่ − ยอดเหลือเดิม (ระบบไม่บันทึกยอดปิดเต็มสัญญา)
 * ยอดใหม่เป็นได้ทั้งดอกลอย/คงที่ และจบต้นดอก (ผ่อนงวด) — เริ่มต้นตามชนิดยอดเดิม
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

  const oldIsInstallment = loan.status === LoanStatus.INSTALLMENT;
  const [kind, setKind] = useState<'REVOLVING' | 'INSTALLMENT'>(
    oldIsInstallment ? 'INSTALLMENT' : 'REVOLVING',
  );

  const [principal, setPrincipal] = useState(String(remaining));
  const [rate, setRate] = useState(
    loan.status === LoanStatus.ACTIVE ? String(loan.interestRatePercent) : '',
  );
  const [cycle, setCycle] = useState<RevolvingCycle>(
    REVOLVING_CYCLES.includes(loan.cycle as RevolvingCycle)
      ? (loan.cycle as RevolvingCycle)
      : 'DAILY',
  );
  // จบต้นดอก (ผ่อนงวด, ดอกคงที่)
  const [count, setCount] = useState(
    loan.installmentCount ? String(loan.installmentCount) : '',
  );
  // กรอกได้ทั้ง "งวดละ" (เจ้าของร้านคิดแบบนี้) และ "ดอกรวม" — อีกฝั่งคำนวณให้เอง
  const [insMode, setInsMode] = useState<'PER' | 'INTEREST'>('PER');
  const [per, setPer] = useState('');
  const [interest, setInterest] = useState('');
  const [insCycle, setInsCycle] = useState<LoanCycle>(loan.cycle);
  const [rounded, setRounded] = useState(true);
  const [error, setError] = useState('');
  const refinance = useRefinance();

  const newPrincipal = parseFloat(principal) || 0;
  const rateNum = parseFloat(rate) || 0;
  const countNum = parseInt(count, 10) || 0;
  const perNum = parseFloat(per) || 0;
  const interestNum = parseFloat(interest) || 0;
  const netCash = round2(newPrincipal - remaining);
  // โหมดงวดละ: ผ่อนรวม = งวดละ × จำนวนงวด (งวดตรงเป๊ะ ไม่มีเศษ)
  const installmentTotal =
    insMode === 'PER'
      ? round2(perNum * countNum)
      : round2(newPrincipal + interestNum);
  const totalInterest = round2(installmentTotal - newPrincipal);
  // งวดจริงที่ระบบจะหาร (ต้องตรงกับ buildInstallmentPlan ฝั่ง API)
  const perInstallment =
    countNum > 0
      ? rounded
        ? Math.floor(installmentTotal / countNum)
        : round2(installmentTotal / countNum)
      : 0;
  const lastInstallment =
    countNum > 0 ? round2(installmentTotal - perInstallment * (countNum - 1)) : 0;

  const insInvalid =
    countNum < 1 ||
    (insMode === 'PER' ? perNum <= 0 || totalInterest < 0 : interestNum < 0);
  const invalid =
    newPrincipal < remaining || (kind === 'REVOLVING' ? rateNum <= 0 : insInvalid);

  const save = async () => {
    setError('');
    if (newPrincipal < remaining)
      return setError(`ต้นใหม่ต้องไม่น้อยกว่ายอดเหลือเดิม ฿${baht(remaining)}`);
    let input: CreateLoanInput;
    if (kind === 'REVOLVING') {
      if (rateNum <= 0) return setError('อัตราดอกต้องมากกว่า 0');
      input = {
        debtorId: loan.debtorId,
        type: 'REVOLVING',
        principalOriginal: newPrincipal,
        interestRatePercent: rateNum,
        cycle,
      };
    } else {
      if (countNum < 1) return setError('จำนวนงวดต้องอย่างน้อย 1 งวด');
      if (insMode === 'PER' && perNum <= 0)
        return setError('ยอดผ่อนต่องวดต้องมากกว่า 0');
      if (totalInterest < 0)
        return setError(
          insMode === 'PER'
            ? `ผ่อนรวม ฿${baht(installmentTotal)} น้อยกว่าต้นใหม่ ฿${baht(newPrincipal)}`
            : 'ดอกเบี้ยรวมต้องไม่ติดลบ',
        );
      input = {
        debtorId: loan.debtorId,
        type: 'INSTALLMENT',
        principalOriginal: newPrincipal,
        installmentCount: countNum,
        totalInterest,
        cycle: insCycle,
        roundInstallments: rounded,
      };
    }
    try {
      await refinance.mutateAsync({ id: loan.id, input });
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

        <Field label="ยอดใหม่เป็นแบบ">
          <Segmented
            value={kind}
            onChange={setKind}
            accent={kind === 'INSTALLMENT' ? 'sky' : 'primary'}
            options={[
              {
                value: 'INSTALLMENT',
                label: 'จบต้นดอก',
                hint: 'ผ่อนเป็นงวด',
              },
              {
                value: 'REVOLVING',
                label: 'ดอกลอย / คงที่',
                hint: 'เก็บดอกต่อรอบ',
              },
            ]}
          />
        </Field>

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

        {kind === 'REVOLVING' ? (
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
              <SelectMenu
                value={cycle}
                onChange={setCycle}
                options={revolvingCycleOptions}
              />
            </Field>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <FormInput
                label="จำนวนงวด *"
                type="number"
                inputMode="numeric"
                align="right"
                value={count}
                onChange={(e) => {
                  setCount(e.target.value);
                  setError('');
                }}
              />
              <Field label="รอบผ่อน *">
                <SelectMenu
                  value={insCycle}
                  onChange={setInsCycle}
                  options={installmentCycleOptions}
                />
              </Field>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-600 md:text-[15px] dark:text-gray-300">
                  {insMode === 'PER'
                    ? 'ยอดผ่อนต่องวด (บาท) *'
                    : 'ดอกเบี้ยรวมทั้งสัญญา (บาท) *'}
                </label>
                <Segmented
                  value={insMode}
                  onChange={setInsMode}
                  options={[
                    { value: 'PER', label: 'งวดละ' },
                    { value: 'INTEREST', label: 'ดอกรวม' },
                  ]}
                />
              </div>
              <TextInput
                type="number"
                inputMode="decimal"
                align="right"
                value={insMode === 'PER' ? per : interest}
                onChange={(e) => {
                  if (insMode === 'PER') setPer(e.target.value);
                  else setInterest(e.target.value);
                  setError('');
                }}
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={rounded}
                onChange={(e) => setRounded(e.target.checked)}
              />
              ปัดยอดต่องวดเป็นบาทเต็ม (เศษไปรวมงวดสุดท้าย)
            </label>

            {countNum > 0 && installmentTotal > 0 && (
              <p className="text-xs leading-relaxed text-slate-500 dark:text-gray-400">
                ผ่อนรวม ฿{baht(installmentTotal)} (ต้น ฿{baht(newPrincipal)} +
                ดอก ฿{baht(totalInterest)}) ·{' '}
                {perInstallment === lastInstallment
                  ? `งวดละ ฿${baht(perInstallment)} × ${countNum} งวด`
                  : `${countNum - 1} งวดละ ฿${baht(perInstallment)} · งวดสุดท้าย ฿${baht(lastInstallment)}`}
              </p>
            )}
          </>
        )}

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
          disabled={invalid}
        />
      </div>
    </div>
  );
}
