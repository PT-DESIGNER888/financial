'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AuthGate } from '@/components/auth-gate';
import { Button, FormInput, TextInput } from '@/components/form';
import { IconPlus } from '@/components/icons';
import { PageSkeleton } from '@/components/skeleton';
import { baht } from '@/lib/format';
import { useCreateDebtor, useDebtors } from '@/lib/hooks/useDebtors';
import { toast } from '@/lib/toast-store';

export default function DebtorsPage() {
  return (
    <AuthGate>
      <DebtorsView />
    </AuthGate>
  );
}

const schema = z.object({
  name: z.string().min(1, 'กรอกชื่อ'),
  phone: z.string().optional(),
  facebookUrl: z.string().optional(),
  lineId: z.string().optional(),
  note: z.string().optional(),
});
type Form = z.infer<typeof schema>;

function DebtorsView() {
  const router = useRouter();
  const { data: debtors, error } = useDebtors();
  const createDebtor = useCreateDebtor();
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const onAdd = async (data: Form) => {
    const created = await createDebtor.mutateAsync(data);
    reset();
    setAdding(false);
    toast(`เพิ่ม "${created.name}" แล้ว — เปิดยอดต่อได้เลย`);
    // ขั้นถัดไปของงานจริงคือเปิดยอด — พาไปหน้าลูกหนี้เลย ไม่ต้องกลับมาหาในรายชื่อ
    router.push(`/debtors/${created.id}`);
  };

  if (error)
    return (
      <p className="py-10 text-center text-red-600">{error.message}</p>
    );
  if (!debtors) return <PageSkeleton />;

  const filtered = debtors.filter((d) =>
    d.name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-[1.375rem] font-bold text-slate-900 md:text-2xl dark:text-white">
            ลูกหนี้
          </h1>
          <p className="text-[13px] text-slate-500 dark:text-gray-400">
            ทั้งหมด {debtors.length} คน
          </p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <IconPlus className="size-4" />
          เพิ่มลูกหนี้
        </Button>
      </div>

      <TextInput
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ค้นหาชื่อ…"
        type="search"
        aria-label="ค้นหาชื่อลูกหนี้"
      />

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="hidden grid-cols-[1fr_auto_auto] gap-4 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-[12px] font-semibold text-slate-500 sm:grid dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-400">
          <span>ชื่อ</span>
          <span className="w-24 text-right">ยอดเปิด</span>
          <span className="w-32 text-right">ยอดคงเหลือรวม</span>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-gray-800">
          {filtered.map((d) => {
            const open = (d.loans ?? []).filter(
              (l) =>
                l.status === 'ACTIVE' ||
                l.status === 'DEAD' ||
                l.status === 'INSTALLMENT',
            );
            const totalOutstanding = open.reduce(
              (s, l) =>
                s +
                (l.status === 'DEAD' || l.status === 'INSTALLMENT'
                  ? (l.deadBalance ?? 0)
                  : l.outstandingPrincipal + l.arrears),
              0,
            );
            return (
              <Link
                key={d.id}
                href={`/debtors/${d.id}`}
                className="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-3.5 transition-colors hover:bg-slate-50 sm:grid-cols-[1fr_auto_auto] dark:hover:bg-gray-800/50"
              >
                <div>
                  <p className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
                    <span className="truncate text-[15px]">{d.name}</span>
                    {d.blacklisted && (
                      <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-500/10 dark:text-red-400">
                        บัญชีดำ
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {d.phone ?? '—'}
                  </p>
                </div>
                <span className="hidden w-24 text-right text-sm text-gray-600 sm:block dark:text-gray-300">
                  {open.length} ยอด
                </span>
                <span className="w-32 text-right font-semibold text-gray-900 dark:text-white">
                  ฿{baht(totalOutstanding)}
                </span>
              </Link>
            );
          })}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-gray-500 dark:text-gray-400">
              ไม่พบลูกหนี้
            </p>
          )}
        </div>
      </div>

      {adding && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => setAdding(false)}
        >
          <form
            onSubmit={handleSubmit(onAdd)}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-3 rounded-t-lg border border-gray-200 bg-white p-5 sm:rounded-lg dark:border-gray-800 dark:bg-gray-900"
          >
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              เพิ่มลูกหนี้
            </h2>
            <FormInput
              label="ชื่อ *"
              error={errors.name?.message}
              {...register('name')}
            />
            <FormInput label="เบอร์โทร" {...register('phone')} />
            <FormInput
              label="ลิงก์ Facebook"
              placeholder="https://facebook.com/…"
              {...register('facebookUrl')}
            />
            <FormInput
              label="LINE ID หรือลิงก์"
              placeholder="เช่น mylineid หรือ https://line.me/ti/p/…"
              {...register('lineId')}
            />
            <FormInput label="หมายเหตุ" {...register('note')} />
            <div className="flex gap-2 pt-1">
              <Button
                variant="secondary"
                onClick={() => setAdding(false)}
                className="flex-1"
              >
                ยกเลิก
              </Button>
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                บันทึก
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
