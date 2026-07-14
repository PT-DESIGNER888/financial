'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Button,
  Field,
  FormInput,
  Segmented,
  SelectMenu,
  TextInput,
} from '@/components/form';
import { baht } from '@/lib/format';
import { useDebtors } from '@/lib/hooks/useDebtors';
import { useCreateLoan, type CreateLoanInput } from '@/lib/hooks/useLoans';
import { toast } from '@/lib/toast-store';

const loanSchema = z
  .object({
    loanType: z.enum(['REVOLVING', 'INSTALLMENT']),
    principalOriginal: z.string().min(1, 'กรอกเงินต้น'),
    interestRatePercent: z.string().optional(),
    cycle: z.enum(['DAILY', 'TEN_DAY']),
    interestMode: z.enum(['FLOATING', 'FLAT']),
    isExisting: z.boolean(),
    outstandingPrincipal: z.string().optional(),
    arrears: z.string().optional(),
    totalInterest: z.string().optional(),
    installmentCount: z.string().optional(),
    note: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    if (!(parseFloat(d.principalOriginal) > 0))
      ctx.addIssue({
        path: ['principalOriginal'],
        code: 'custom',
        message: 'ต้องมากกว่า 0',
      });
    if (d.loanType === 'REVOLVING') {
      if (!(parseFloat(d.interestRatePercent ?? '') > 0))
        ctx.addIssue({
          path: ['interestRatePercent'],
          code: 'custom',
          message: 'ต้องมากกว่า 0',
        });
    } else {
      const c = parseInt(d.installmentCount ?? '', 10);
      if (!(c >= 1))
        ctx.addIssue({
          path: ['installmentCount'],
          code: 'custom',
          message: 'อย่างน้อย 1 งวด',
        });
      const ti = parseFloat(d.totalInterest ?? '');
      if (isNaN(ti) || ti < 0)
        ctx.addIssue({
          path: ['totalInterest'],
          code: 'custom',
          message: 'กรอกดอกรวม (0 ได้)',
        });
    }
  });
type LoanForm = z.infer<typeof loanSchema>;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * ฟอร์มเปิดยอดใหม่ — ใช้ได้ 2 ที่:
 * หน้าลูกหนี้ (ส่ง debtorId มา) และหน้าสัญญาเงินกู้ (ไม่ส่ง — มีช่องเลือกลูกหนี้)
 */
export function NewLoanModal({
  debtorId,
  onClose,
  onSaved,
}: {
  debtorId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState('');
  const [pickedDebtorId, setPickedDebtorId] = useState('');
  const needPicker = !debtorId;
  const { data: debtors } = useDebtors();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoanForm>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      loanType: 'REVOLVING',
      cycle: 'DAILY',
      interestMode: 'FLOATING',
      isExisting: false,
    },
  });
  const isExisting = watch('isExisting');
  const loanType = watch('loanType');
  const cycle = watch('cycle');
  const interestMode = watch('interestMode');
  const isInstallment = loanType === 'INSTALLMENT';

  const pickedDebtor = debtors?.find((d) => d.id === pickedDebtorId);

  // เลือกประเภทยอด — ตั้งรอบเริ่มต้นให้เหมาะกับแต่ละแบบ
  const pickType = (t: 'REVOLVING' | 'INSTALLMENT') => {
    setValue('loanType', t);
    setValue('cycle', t === 'INSTALLMENT' ? 'TEN_DAY' : 'DAILY');
  };

  // พรีวิวยอดผ่อนงวด
  const principalNum = parseFloat(watch('principalOriginal') || '') || 0;
  const interestNum = parseFloat(watch('totalInterest') || '') || 0;
  const countNum = parseInt(watch('installmentCount') || '', 10) || 0;
  const installmentTotal = round2(principalNum + interestNum);
  const perInstallment = countNum > 0 ? round2(installmentTotal / countNum) : 0;

  const createLoan = useCreateLoan();

  const onSubmit = async (data: LoanForm) => {
    setError('');
    const targetDebtorId = debtorId ?? pickedDebtorId;
    if (!targetDebtorId) {
      setError('เลือกลูกหนี้ก่อน');
      return;
    }
    try {
      const input: CreateLoanInput =
        data.loanType === 'INSTALLMENT'
          ? {
              debtorId: targetDebtorId,
              type: 'INSTALLMENT',
              principalOriginal: parseFloat(data.principalOriginal),
              installmentTotal: round2(
                parseFloat(data.principalOriginal) +
                  (parseFloat(data.totalInterest || '') || 0),
              ),
              installmentCount: parseInt(data.installmentCount || '', 10),
              cycle: data.cycle,
              note: data.note || undefined,
            }
          : {
              debtorId: targetDebtorId,
              principalOriginal: parseFloat(data.principalOriginal),
              interestRatePercent: parseFloat(data.interestRatePercent || ''),
              cycle: data.cycle,
              interestMode: data.interestMode,
              outstandingPrincipal:
                data.isExisting && data.outstandingPrincipal
                  ? parseFloat(data.outstandingPrincipal)
                  : undefined,
              arrears:
                data.isExisting && data.arrears
                  ? parseFloat(data.arrears)
                  : undefined,
              note: data.note || undefined,
            };
      await createLoan.mutateAsync(input);
      toast(
        data.loanType === 'INSTALLMENT'
          ? 'เปิดยอดผ่อนงวดแล้ว'
          : 'เปิดยอดใหม่แล้ว',
      );
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    }
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-lg border border-gray-200 bg-white p-5 sm:rounded-lg dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          เปิดยอดใหม่
        </h2>

        {needPicker && (
          <Field label="ลูกหนี้ *">
            <SelectMenu
              value={pickedDebtorId}
              onChange={setPickedDebtorId}
              options={[
                { value: '', label: '— เลือกลูกหนี้ —' },
                ...(debtors ?? []).map((d) => ({
                  value: d.id,
                  label: d.blacklisted ? `${d.name} ⚠ บัญชีดำ` : d.name,
                })),
              ]}
            />
            {pickedDebtor?.blacklisted && (
              <p className="mt-1 rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-400">
                ลูกหนี้รายนี้ถูกขึ้นบัญชีดำ — ตรวจสอบก่อนปล่อยกู้เพิ่ม
              </p>
            )}
          </Field>
        )}

        {/* เลือกประเภทยอดกู้ */}
        <Field label="ประเภทยอดกู้">
          <Segmented
            value={loanType}
            onChange={pickType}
            accent={isInstallment ? 'sky' : 'primary'}
            options={[
              { value: 'REVOLVING', label: 'ดอกลอย / คงที่' },
              { value: 'INSTALLMENT', label: 'ผ่อนงวด', hint: 'ต้น+ดอก หาร N งวด' },
            ]}
          />
        </Field>

        <FormInput
          label="เงินต้น (บาท) *"
          error={errors.principalOriginal?.message}
          type="number"
          inputMode="decimal"
          align="right"
          {...register('principalOriginal')}
        />

        {isInstallment ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <FormInput
                label="ดอกรวมทั้งสัญญา *"
                error={errors.totalInterest?.message}
                type="number"
                inputMode="decimal"
                align="right"
                {...register('totalInterest')}
              />
              <FormInput
                label="จำนวนงวด *"
                error={errors.installmentCount?.message}
                type="number"
                inputMode="numeric"
                align="right"
                {...register('installmentCount')}
              />
            </div>

            <Field label="รอบผ่อน *">
              <Segmented
                value={cycle}
                onChange={(v) => setValue('cycle', v)}
                accent="sky"
                options={[
                  { value: 'TEN_DAY', label: 'ทุก 10 วัน' },
                  { value: 'DAILY', label: 'ทุกวัน' },
                ]}
              />
            </Field>

            {installmentTotal > 0 && countNum > 0 && (
              <div className="rounded-lg bg-sky-500/10 p-3 text-sm text-gray-700 dark:text-gray-200">
                ผ่อนรวม{' '}
                <b className="text-gray-900 dark:text-white">
                  ฿{baht(installmentTotal)}
                </b>{' '}
                ({countNum} งวด) — งวดละ{' '}
                <b className="text-sky-600 dark:text-sky-400">
                  ฿{baht(perInstallment)}
                </b>
              </div>
            )}
          </>
        ) : (
          <>
            <FormInput
              label="ดอก %/รอบ *"
              error={errors.interestRatePercent?.message}
              type="number"
              step="0.001"
              inputMode="decimal"
              align="right"
              {...register('interestRatePercent')}
            />

            <Field label="รอบเก็บ *">
              <Segmented
                value={cycle}
                onChange={(v) => setValue('cycle', v)}
                options={[
                  { value: 'DAILY', label: 'รายวัน' },
                  { value: 'TEN_DAY', label: 'ราย 10 วัน' },
                ]}
              />
            </Field>

            <Field label="รูปแบบดอก">
              <Segmented
                value={interestMode}
                onChange={(v) => setValue('interestMode', v)}
                options={[
                  {
                    value: 'FLOATING',
                    label: 'ดอกลอย',
                    hint: 'ตัดต้นแล้วดอกลด',
                  },
                  {
                    value: 'FLAT',
                    label: 'ดอกคงที่',
                    hint: 'คิดจากต้นเดิม',
                  },
                ]}
              />
            </Field>

            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input type="checkbox" {...register('isExisting')} />
              เป็นยอดเก่าที่เดินอยู่แล้ว (กรอกยอดคงเหลือ ณ วันนี้)
            </label>

            {isExisting && (
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-amber-500/10 p-3">
                <FormInput
                  label="ต้นคงเหลือ"
                  type="number"
                  inputMode="decimal"
                  align="right"
                  {...register('outstandingPrincipal')}
                />
                <FormInput
                  label="ดอกค้างสะสม"
                  type="number"
                  inputMode="decimal"
                  align="right"
                  {...register('arrears')}
                />
              </div>
            )}
          </>
        )}

        <TextInput
          {...register('note')}
          placeholder="หมายเหตุ (ไม่บังคับ)"
          className="text-sm"
        />

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            ยกเลิก
          </Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            เปิดยอด
          </Button>
        </div>
      </form>
    </div>
  );
}
