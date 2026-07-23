'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { AuthGate } from '@/components/auth-gate';
import { DatePicker } from '@/components/date-picker';
import {
  Button,
  Field,
  FormInput,
  Segmented,
  SelectMenu,
  TextInput,
} from '@/components/form';
import { RateInput } from '@/components/rate-input';
import { PageSkeleton } from '@/components/skeleton';
import { baht, cycleLabel, thaiDate } from '@/lib/format';
import {
  bahtToPercent,
  interestBaht,
  MAX_RATE_PERCENT,
  type RateUnit,
} from '@/lib/interest';
import { useDebtors } from '@/lib/hooks/useDebtors';
import {
  useCreateLoan,
  useLoanPreview,
  type CreateLoanInput,
  type PreviewLoanInput,
} from '@/lib/hooks/useLoans';
import { toast } from '@/lib/toast-store';
import { InterestMode, LoanCycle, LoanKind } from '@/lib/types';
import type { RevolvingCycle } from '@/lib/types';

export default function NewLoanPage() {
  return (
    <AuthGate>
      <Suspense fallback={<PageSkeleton />}>
        <NewLoanView />
      </Suspense>
    </AuthGate>
  );
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** หน่วงค่าไว้ก่อนยิง preview — กันยิง API ทุกตัวอักษร */
function useDebounced<T>(value: T, ms = 400): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

type Kind = LoanKind;

function NewLoanView() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: debtors } = useDebtors();
  const [debtorId, setDebtorId] = useState(params.get('debtorId') ?? '');
  const [kind, setKind] = useState<Kind>(LoanKind.INSTALLMENT);

  const debtor = debtors?.find((d) => d.id === debtorId);
  const done = () =>
    router.push(debtorId ? `/debtors/${debtorId}` : '/loans');

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/loans"
          className="text-sm text-gray-500 hover:text-primary hover:underline dark:text-gray-400"
        >
          ← สัญญาเงินกู้
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          สร้างยอดกู้
        </h1>
      </div>

      <div className="max-w-md space-y-3">
        <Field label="ลูกหนี้ *">
          <SelectMenu
            value={debtorId}
            onChange={setDebtorId}
            options={[
              { value: '', label: '— เลือกลูกหนี้ —' },
              ...(debtors ?? []).map((d) => ({
                value: d.id,
                label: d.blacklisted ? `${d.name} ⚠ บัญชีดำ` : d.name,
              })),
            ]}
          />
          {debtor?.blacklisted && (
            <p className="mt-1 rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-400">
              ลูกหนี้รายนี้ถูกขึ้นบัญชีดำ — ตรวจสอบก่อนปล่อยกู้เพิ่ม
            </p>
          )}
        </Field>

        <Field label="ประเภทการกู้">
          <Segmented
            value={kind}
            onChange={setKind}
            accent={kind === LoanKind.INSTALLMENT ? 'sky' : 'primary'}
            options={[
              {
                value: LoanKind.INSTALLMENT,
                label: 'ผ่อนเป็นงวด',
                hint: 'รายเดือน / สัปดาห์',
              },
              {
                value: LoanKind.REVOLVING,
                label: 'ดอกลอย / คงที่',
                hint: 'รายวัน / 7 / 10 วัน',
              },
              {
                value: LoanKind.DEAD,
                label: 'ยอดตาย',
                hint: 'คีย์ยอดเอง ไม่คิดดอก',
              },
            ]}
          />
        </Field>
      </div>

      {kind === LoanKind.INSTALLMENT ? (
        <InstallmentForm debtorId={debtorId} onDone={done} />
      ) : kind === LoanKind.DEAD ? (
        <DeadForm debtorId={debtorId} onDone={done} />
      ) : (
        <RevolvingForm debtorId={debtorId} onDone={done} />
      )}
    </div>
  );
}

/* ---------- ผ่อนเป็นงวด (ดอกคงที่ / ลดต้นลดดอก) ---------- */

const installmentCycles: { value: LoanCycle; label: string }[] = [
  { value: LoanCycle.MONTHLY, label: 'รายเดือน' },
  { value: LoanCycle.WEEKLY, label: 'รายสัปดาห์' },
  { value: LoanCycle.TEN_DAY, label: 'ทุก 10 วัน' },
  { value: LoanCycle.DAILY, label: 'รายวัน' },
];

function InstallmentForm({
  debtorId,
  onDone,
}: {
  debtorId: string;
  onDone: () => void;
}) {
  const [startDate, setStartDate] = useState(todayISO());
  const [principal, setPrincipal] = useState('');
  const [mode, setMode] = useState<'FLAT' | 'AMORTIZED'>('FLAT');
  const [interestUnit, setInterestUnit] = useState<'BAHT' | 'PERCENT'>('PERCENT');
  const [flatInterest, setFlatInterest] = useState('');
  const [rate, setRate] = useState('');
  const [count, setCount] = useState('');
  const [cycle, setCycle] = useState<LoanCycle>(LoanCycle.MONTHLY);
  const [firstDueAuto, setFirstDueAuto] = useState(true);
  const [firstDueDate, setFirstDueDate] = useState('');
  const [fee, setFee] = useState('');
  const [rounded, setRounded] = useState(true);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const principalNum = parseFloat(principal) || 0;
  const countNum = parseInt(count, 10) || 0;
  const feeNum = parseFloat(fee) || 0;
  // ดอกคงที่กรอกได้ทั้ง % ตลอดสัญญา และบาทตรงๆ
  const flatInterestBaht =
    interestUnit === 'PERCENT'
      ? round2((principalNum * (parseFloat(flatInterest) || 0)) / 100)
      : parseFloat(flatInterest) || 0;
  const rateNum = parseFloat(rate) || 0;

  const valid =
    principalNum > 0 &&
    countNum >= 1 &&
    (mode === 'FLAT' ? flatInterest !== '' : rateNum > 0) &&
    (firstDueAuto || firstDueDate !== '');

  const previewInput: PreviewLoanInput | null = valid
    ? {
        principalOriginal: principalNum,
        installmentCount: countNum,
        cycle,
        amortized: mode === 'AMORTIZED',
        totalInterest: mode === 'FLAT' ? flatInterestBaht : undefined,
        interestRatePercent: mode === 'AMORTIZED' ? rateNum : undefined,
        fee: feeNum || undefined,
        startDate,
        firstDueDate: firstDueAuto ? undefined : firstDueDate,
        roundInstallments: rounded,
      }
    : null;
  const debounced = useDebounced(previewInput);
  const { data: plan, error: previewError } = useLoanPreview(debounced);

  const createLoan = useCreateLoan();
  const submit = async () => {
    setError('');
    if (!debtorId) return setError('เลือกลูกหนี้ก่อน');
    if (!previewInput) return setError('กรอกข้อมูลให้ครบก่อน');
    try {
      const input: CreateLoanInput = {
        debtorId,
        type: LoanKind.INSTALLMENT,
        ...previewInput,
        note: note || undefined,
      };
      await createLoan.mutateAsync(input);
      toast('เปิดยอดผ่อนแล้ว');
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <Field label="วันที่ปล่อยกู้">
          <DatePicker value={startDate} onChange={setStartDate} />
        </Field>

        <FormInput
          label="เงินต้น (บาท) *"
          type="number"
          inputMode="decimal"
          align="right"
          value={principal}
          onChange={(e) => setPrincipal(e.target.value)}
        />

        <Field label="ประเภทการคิดดอกเบี้ย">
          <Segmented
            value={mode}
            onChange={setMode}
            accent="sky"
            options={[
              { value: InterestMode.FLAT, label: 'ดอกคงที่', hint: 'คิดครั้งเดียวทั้งสัญญา' },
              {
                value: 'AMORTIZED',
                label: 'ลดต้นลดดอก',
                hint: 'ดอกจากต้นคงเหลือ',
              },
            ]}
          />
        </Field>

        {mode === 'FLAT' ? (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-sm text-gray-600 dark:text-gray-300">
                ดอกเบี้ยตลอดสัญญา *
              </label>
              <Segmented
                value={interestUnit}
                onChange={setInterestUnit}
                options={[
                  { value: 'PERCENT', label: '%' },
                  { value: 'BAHT', label: 'บาท' },
                ]}
              />
            </div>
            <TextInput
              type="number"
              inputMode="decimal"
              align="right"
              value={flatInterest}
              onChange={(e) => setFlatInterest(e.target.value)}
            />
            {interestUnit === 'PERCENT' && principalNum > 0 && flatInterest && (
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                = ฿{baht(flatInterestBaht)}
              </p>
            )}
          </div>
        ) : (
          <FormInput
            label="ดอกเบี้ย %/งวด (จากต้นคงเหลือ) *"
            type="number"
            step="0.001"
            inputMode="decimal"
            align="right"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        )}

        <div className="grid grid-cols-2 gap-2">
          <FormInput
            label="จำนวนงวด *"
            type="number"
            inputMode="numeric"
            align="right"
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />
          <Field label="รอบการชำระ *">
            <SelectMenu value={cycle} onChange={setCycle} options={installmentCycles} />
          </Field>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={firstDueAuto}
              onChange={(e) => setFirstDueAuto(e.target.checked)}
            />
            งวดแรกอัตโนมัติ (วันปล่อยกู้ + 1 รอบ)
          </label>
          {!firstDueAuto && (
            <div className="mt-2">
              <DatePicker value={firstDueDate} onChange={setFirstDueDate} />
            </div>
          )}
        </div>

        <FormInput
          label="ค่าธรรมเนียมเพิ่มเติม (บาท)"
          hint="รวมเข้ายอดที่ต้องชำระ"
          type="number"
          inputMode="decimal"
          align="right"
          value={fee}
          onChange={(e) => setFee(e.target.value)}
        />

        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={rounded}
            onChange={(e) => setRounded(e.target.checked)}
          />
          ปัดยอดต่องวดเป็นบาทเต็ม (เศษไปรวมงวดสุดท้าย)
        </label>

        <FormInput
          label="หมายเหตุ"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {(error || previewError) && (
          <p className="text-sm text-red-500">
            {error || previewError?.message}
          </p>
        )}
        <Button onClick={submit} disabled={createLoan.isPending} className="w-full">
          เปิดยอดกู้
        </Button>
      </div>

      <div className="space-y-4">
        <PlanSummary plan={valid ? plan : undefined} cycle={cycle} />
        <PlanTable plan={valid ? plan : undefined} amortized={mode === 'AMORTIZED'} />
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span
        className={
          bold
            ? 'text-base font-bold text-primary'
            : 'font-medium text-gray-900 dark:text-white'
        }
      >
        {value}
      </span>
    </div>
  );
}

function PlanSummary({
  plan,
  cycle,
}: {
  plan?: import('@/lib/types').InstallmentPlanPreview;
  cycle: LoanCycle;
}) {
  if (!plan)
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400 dark:border-gray-700 dark:text-gray-500">
        กรอกเงินต้น ดอกเบี้ย และจำนวนงวด — ระบบจะสรุปยอดให้ทันที
      </div>
    );
  const per = plan.installmentAmount;
  const last = plan.rows[plan.rows.length - 1]?.scheduled ?? per;
  const uneven = plan.rows.some((r, i) => i < plan.rows.length - 1 && r.scheduled !== per);
  return (
    <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
        สรุปยอด
      </h2>
      <SummaryRow label="เงินต้น" value={`฿${baht(plan.principalOriginal)}`} />
      <SummaryRow label="ดอกเบี้ยรวม" value={`฿${baht(plan.interestTotal)}`} />
      {plan.fee > 0 && (
        <SummaryRow label="ค่าธรรมเนียม" value={`฿${baht(plan.fee)}`} />
      )}
      <SummaryRow
        label="ยอดรวมที่ต้องชำระ"
        value={`฿${baht(plan.installmentTotal)}`}
        bold
      />
      <SummaryRow
        label="ระยะเวลา"
        value={`${plan.installmentCount} งวด (${cycleLabel[cycle]})`}
      />
      {uneven ? (
        <SummaryRow label="ชำระต่องวด" value="ดูตารางงวด (ไม่เท่ากัน)" />
      ) : last !== per ? (
        <SummaryRow
          label="ชำระต่องวด"
          value={`${plan.installmentCount - 1} งวดละ ฿${baht(per)} · งวดสุดท้าย ฿${baht(last)}`}
        />
      ) : (
        <SummaryRow label="ชำระงวดละ" value={`฿${baht(per)}`} />
      )}
      <SummaryRow label="งวดแรก" value={thaiDate(plan.firstDueDate)} />
      <SummaryRow label="งวดสุดท้าย" value={thaiDate(plan.lastDueDate)} />
    </div>
  );
}

function PlanTable({
  plan,
  amortized,
}: {
  plan?: import('@/lib/types').InstallmentPlanPreview;
  amortized: boolean;
}) {
  if (!plan) return null;
  // คงเหลือสะสมต่องวด: ลดต้นลดดอกโชว์ต้นคงเหลือ (แบบตารางธนาคาร), ดอกคงที่โชว์ยอดผ่อนคงเหลือ
  const remains = plan.rows.reduce<{ principal: number; total: number }[]>(
    (acc, r, i) => {
      const prevP = i === 0 ? plan.principalOriginal : acc[i - 1].principal;
      const prevT = i === 0 ? plan.installmentTotal : acc[i - 1].total;
      acc.push({
        principal: round2(prevP - (r.principal ?? 0)),
        total: round2(prevT - r.scheduled),
      });
      return acc;
    },
    [],
  );
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <p className="border-b border-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-900 dark:border-gray-800 dark:text-white">
        ตารางงวดชำระ
      </p>
      <div className="max-h-96 overflow-x-auto overflow-y-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
            <tr className="text-xs text-gray-500 dark:text-gray-400">
              <th className="px-4 py-2 font-medium">งวด</th>
              <th className="px-3 py-2 font-medium">กำหนดชำระ</th>
              {amortized && (
                <>
                  <th className="px-3 py-2 text-right font-medium">เงินต้น</th>
                  <th className="px-3 py-2 text-right font-medium">ดอกเบี้ย</th>
                </>
              )}
              <th className="px-3 py-2 text-right font-medium">ยอดชำระ</th>
              <th className="px-4 py-2 text-right font-medium">คงเหลือ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {plan.rows.map((r, i) => {
              return (
                <tr key={r.n} className="text-gray-700 dark:text-gray-300">
                  <td className="px-4 py-1.5">{r.n}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-gray-500 dark:text-gray-400">
                    {thaiDate(r.dueDate)}
                  </td>
                  {amortized && (
                    <>
                      <td className="px-3 py-1.5 text-right">
                        ฿{baht(r.principal)}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        ฿{baht(r.interest)}
                      </td>
                    </>
                  )}
                  <td className="px-3 py-1.5 text-right font-medium text-gray-900 dark:text-white">
                    ฿{baht(r.scheduled)}
                  </td>
                  <td className="px-4 py-1.5 text-right">
                    ฿{baht(amortized ? remains[i].principal : remains[i].total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- ยอดตายคีย์มือ (ตรึงยอดที่กรอก ไม่คิดดอก) ---------- */

function DeadForm({
  debtorId,
  onDone,
}: {
  debtorId: string;
  onDone: () => void;
}) {
  const [startDate, setStartDate] = useState(todayISO());
  const [balance, setBalance] = useState('');
  const [hasInstallment, setHasInstallment] = useState(false);
  const [installment, setInstallment] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const balanceNum = parseFloat(balance) || 0;
  const installmentNum = parseFloat(installment) || 0;

  const createLoan = useCreateLoan();
  const submit = async () => {
    setError('');
    if (!debtorId) return setError('เลือกลูกหนี้ก่อน');
    if (!(balanceNum > 0)) return setError('ยอดตายต้องมากกว่า 0');
    if (hasInstallment && !(installmentNum > 0))
      return setError('งวดผ่อนต้องมากกว่า 0');
    try {
      await createLoan.mutateAsync({
        debtorId,
        type: LoanKind.DEAD,
        principalOriginal: balanceNum,
        cycle: LoanCycle.TEN_DAY,
        installmentAmount: hasInstallment ? installmentNum : undefined,
        startDate,
        note: note || undefined,
      });
      toast('บันทึกยอดตายแล้ว');
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <Field label="วันที่ตั้งยอด">
          <DatePicker value={startDate} onChange={setStartDate} />
        </Field>

        <FormInput
          label="ยอดตายคงเหลือ (บาท) *"
          hint="ยอดที่ตกลงกันไว้ — ระบบตรึงไว้เท่านี้ ไม่คิดดอกเพิ่ม"
          type="number"
          inputMode="decimal"
          align="right"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
        />

        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={hasInstallment}
            onChange={(e) => setHasInstallment(e.target.checked)}
          />
          ตกลงงวดผ่อนไว้ (ทุก 10 วัน)
        </label>
        {hasInstallment ? (
          <FormInput
            label="งวดละ (บาท)"
            type="number"
            inputMode="decimal"
            align="right"
            value={installment}
            onChange={(e) => setInstallment(e.target.value)}
          />
        ) : (
          <p className="rounded-lg bg-slate-100 p-3 text-xs leading-relaxed text-slate-600 dark:bg-gray-800 dark:text-gray-300">
            ไม่ตกลงงวด = ลูกหนี้ทยอยคืนเมื่อไหร่ก็ได้ ยอดนี้จะไม่ขึ้นในหน้าเก็บวันนี้
            แต่ดูได้ที่หน้า &ldquo;ยอดค้าง&rdquo; และรับเงินจากหน้าลูกหนี้
          </p>
        )}

        <FormInput
          label="หมายเหตุ"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button
          onClick={submit}
          disabled={createLoan.isPending}
          className="w-full"
        >
          บันทึกยอดตาย
        </Button>
      </div>

      <div>
        {balanceNum > 0 ? (
          <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              สรุปยอด
            </h2>
            <SummaryRow label="ยอดตายคงเหลือ" value={`฿${baht(balanceNum)}`} bold />
            <SummaryRow label="ดอกเบี้ย" value="ไม่คิดเพิ่ม" />
            <SummaryRow
              label="งวดผ่อน"
              value={
                hasInstallment && installmentNum > 0
                  ? `฿${baht(installmentNum)} ทุก 10 วัน`
                  : 'ไม่มีกำหนดตายตัว'
              }
            />
            <p className="pt-1 text-xs text-gray-400 dark:text-gray-500">
              เงินที่รับเข้ามาจะหักยอดตายตรงๆ ทุกบาท จนกว่าจะหมด
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400 dark:border-gray-700 dark:text-gray-500">
            กรอกยอดตายที่ตกลงไว้ — ระบบจะตรึงยอดนี้โดยไม่คิดดอก
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- ดอกลอย / ดอกคงที่ (รายวัน / 7 วัน / 10 วัน) ---------- */

function RevolvingForm({
  debtorId,
  onDone,
}: {
  debtorId: string;
  onDone: () => void;
}) {
  const [startDate, setStartDate] = useState(todayISO());
  const [principal, setPrincipal] = useState('');
  const [rate, setRate] = useState('');
  const [rateUnit, setRateUnit] = useState<RateUnit>('PERCENT');
  const [cycle, setCycle] = useState<RevolvingCycle>(LoanCycle.DAILY);
  const [interestMode, setInterestMode] = useState<InterestMode>(InterestMode.FLOATING);
  const [isExisting, setIsExisting] = useState(false);
  const [outstanding, setOutstanding] = useState('');
  const [arrears, setArrears] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const principalNum = parseFloat(principal) || 0;
  const base =
    interestMode === InterestMode.FLAT
      ? principalNum
      : isExisting && outstanding
        ? parseFloat(outstanding) || 0
        : principalNum;
  // กรอกเป็นบาทได้ แต่เก็บลงระบบเป็น % เสมอ
  const typedRate = parseFloat(rate) || 0;
  const rateNum =
    rateUnit === 'PERCENT' ? typedRate : bahtToPercent(base, typedRate);
  const interestPerCycle = interestBaht(base, rateNum);

  const createLoan = useCreateLoan();
  const submit = async () => {
    setError('');
    if (!debtorId) return setError('เลือกลูกหนี้ก่อน');
    if (!(principalNum > 0)) return setError('เงินต้นต้องมากกว่า 0');
    if (!(rateNum > 0)) return setError('อัตราดอกต้องมากกว่า 0');
    if (rateNum > MAX_RATE_PERCENT)
      return setError('ดอกต่อรอบสูงเกินกว่าที่ระบบเก็บได้');
    try {
      await createLoan.mutateAsync({
        debtorId,
        principalOriginal: principalNum,
        interestRatePercent: rateNum,
        cycle,
        interestMode,
        startDate,
        outstandingPrincipal:
          isExisting && outstanding ? parseFloat(outstanding) : undefined,
        arrears: isExisting && arrears ? parseFloat(arrears) : undefined,
        note: note || undefined,
      });
      toast('เปิดยอดใหม่แล้ว');
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <Field label="วันที่ปล่อยกู้">
          <DatePicker value={startDate} onChange={setStartDate} />
        </Field>

        <FormInput
          label="เงินต้น (บาท) *"
          type="number"
          inputMode="decimal"
          align="right"
          value={principal}
          onChange={(e) => setPrincipal(e.target.value)}
        />

        <RateInput
          base={base}
          unit={rateUnit}
          onUnitChange={setRateUnit}
          value={rate}
          onChange={setRate}
        />

        <Field label="รอบเก็บ *">
          <Segmented
            value={cycle}
            onChange={setCycle}
            options={[
              { value: LoanCycle.DAILY, label: 'รายวัน' },
              { value: LoanCycle.WEEKLY, label: 'ทุก 7 วัน' },
              { value: LoanCycle.TEN_DAY, label: 'ทุก 10 วัน' },
            ]}
          />
        </Field>

        <Field label="รูปแบบดอก">
          <Segmented
            value={interestMode}
            onChange={setInterestMode}
            options={[
              { value: InterestMode.FLOATING, label: 'ดอกลอย', hint: 'ตัดต้นแล้วดอกลด' },
              { value: InterestMode.FLAT, label: 'ดอกคงที่', hint: 'คิดจากต้นเดิม' },
            ]}
          />
        </Field>

        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={isExisting}
            onChange={(e) => setIsExisting(e.target.checked)}
          />
          เป็นยอดเก่าที่เดินอยู่แล้ว (กรอกยอดคงเหลือ ณ วันนี้)
        </label>
        {isExisting && (
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-amber-500/10 p-3">
            <FormInput
              label="ต้นคงเหลือ"
              type="number"
              inputMode="decimal"
              align="right"
              value={outstanding}
              onChange={(e) => setOutstanding(e.target.value)}
            />
            <FormInput
              label="ดอกค้างสะสม"
              type="number"
              inputMode="decimal"
              align="right"
              value={arrears}
              onChange={(e) => setArrears(e.target.value)}
            />
          </div>
        )}

        <FormInput
          label="หมายเหตุ"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button onClick={submit} disabled={createLoan.isPending} className="w-full">
          เปิดยอดกู้
        </Button>
      </div>

      <div>
        {principalNum > 0 && rateNum > 0 ? (
          <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              สรุปยอด
            </h2>
            <SummaryRow label="เงินต้น" value={`฿${baht(principalNum)}`} />
            <SummaryRow
              label={`ดอกเบี้ยต่อรอบ (${cycleLabel[cycle]})`}
              value={`฿${baht(interestPerCycle)}`}
              bold
            />
            <SummaryRow label="คิดเป็นอัตรา" value={`${rateNum}% ต่อรอบ`} />
            <SummaryRow
              label="รูปแบบ"
              value={
                interestMode === InterestMode.FLAT
                  ? 'ดอกคงที่ — คิดจากต้นเดิมตลอด'
                  : 'ดอกลอย — ตัดต้นแล้วดอกลดตาม'
              }
            />
            <p className="pt-1 text-xs text-gray-400 dark:text-gray-500">
              ยอดดอกลอยไม่มีตารางงวดตายตัว — เก็บดอกตามรอบจนกว่าจะตัดต้นหมด
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400 dark:border-gray-700 dark:text-gray-500">
            กรอกเงินต้นและอัตราดอก — ระบบจะสรุปดอกต่อรอบให้ทันที
          </div>
        )}
      </div>
    </div>
  );
}
