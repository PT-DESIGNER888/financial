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
import { uploadForm } from '@/lib/api';
import { useCreateDebtor, useDebtors } from '@/lib/hooks/useDebtors';
import type { EmergencyContact } from '@/lib/types';
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

const emptyContact = (): EmergencyContact => ({
  name: '',
  phone: '',
  line: '',
  note: '',
});

function DebtorsView() {
  const router = useRouter();
  const { data: debtors, error } = useDebtors();
  const createDebtor = useCreateDebtor();
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [contacts, setContacts] = useState<EmergencyContact[]>([
    emptyContact(),
  ]);
  const [generalFiles, setGeneralFiles] = useState<File[]>([]);
  const [identityFiles, setIdentityFiles] = useState<File[]>([]);
  const [formError, setFormError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const closeAdd = () => {
    setAdding(false);
    setContacts([emptyContact()]);
    setGeneralFiles([]);
    setIdentityFiles([]);
    setFormError('');
    reset();
  };

  const setContact = (
    index: number,
    key: keyof EmergencyContact,
    value: string,
  ) => {
    setContacts((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [key]: value } : c)),
    );
  };

  const onAdd = async (data: Form) => {
    setFormError('');
    try {
      const created = await createDebtor.mutateAsync({
        ...data,
        emergencyContacts: contacts,
      });

      const uploads: Array<{ file: File; kind: 'OTHER' | 'ID_CARD' }> = [
        ...generalFiles.map((file) => ({ file, kind: 'OTHER' as const })),
        ...identityFiles.map((file) => ({ file, kind: 'ID_CARD' as const })),
      ];
      for (const item of uploads) {
        const form = new FormData();
        form.append('file', item.file);
        form.append('kind', item.kind);
        await uploadForm(`/debtors/${created.id}/attachments`, form);
      }

      closeAdd();
      toast(`เพิ่ม "${created.name}" แล้ว — เปิดยอดต่อได้เลย`);
      router.push(`/debtors/${created.id}`);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    }
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
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900 md:text-[1.75rem] dark:text-white">
            ลูกหนี้
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400">
            ทั้งหมด {debtors.length} คน
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setAdding(true)}
          className="w-full sm:w-auto"
        >
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
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center sm:p-6"
          onClick={closeAdd}
        >
          <form
            onSubmit={handleSubmit(onAdd)}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-5 sm:rounded-2xl sm:p-6 dark:border-gray-800 dark:bg-gray-900"
          >
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              เพิ่มลูกหนี้
            </h2>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormInput
                label="ชื่อลูกหนี้ *"
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
                placeholder="mylineid หรือ https://line.me/…"
                {...register('lineId')}
              />
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                รูปและเอกสาร
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-[13px] font-medium text-slate-600 dark:text-gray-300">
                    รูปทั่วไป
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) =>
                      setGeneralFiles(Array.from(e.target.files ?? []))
                    }
                    className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white dark:text-gray-300"
                  />
                  {generalFiles.length > 0 && (
                    <p className="text-xs text-slate-500">
                      เลือกแล้ว {generalFiles.length} ไฟล์
                    </p>
                  )}
                </label>
                <label className="block space-y-1.5">
                  <span className="text-[13px] font-medium text-slate-600 dark:text-gray-300">
                    เอกสารยืนยันตัวตน
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) =>
                      setIdentityFiles(Array.from(e.target.files ?? []))
                    }
                    className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white dark:text-gray-300"
                  />
                  {identityFiles.length > 0 && (
                    <p className="text-xs text-slate-500">
                      เลือกแล้ว {identityFiles.length} ไฟล์
                    </p>
                  )}
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  ผู้ติดต่อคนสนิท
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    setContacts((c) => [...c, emptyContact()])
                  }
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-200"
                >
                  <IconPlus className="size-3.5" />
                  เพิ่มผู้ติดต่อ
                </button>
              </div>
              {contacts.map((c, i) => (
                <section
                  key={i}
                  className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-gray-700"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-700 dark:text-gray-200">
                      ผู้ติดต่อ {i + 1}
                    </p>
                    {contacts.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setContacts((list) =>
                            list.filter((_, j) => j !== i),
                          )
                        }
                        className="text-xs font-medium text-red-600"
                      >
                        ลบ
                      </button>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <FormInput
                      label="ชื่อ"
                      value={c.name}
                      onChange={(e) => setContact(i, 'name', e.target.value)}
                    />
                    <FormInput
                      label="เบอร์โทร"
                      value={c.phone ?? ''}
                      onChange={(e) => setContact(i, 'phone', e.target.value)}
                    />
                    <FormInput
                      label="LINE"
                      value={c.line ?? ''}
                      onChange={(e) => setContact(i, 'line', e.target.value)}
                    />
                    <FormInput
                      label="หมายเหตุ"
                      value={c.note ?? ''}
                      onChange={(e) => setContact(i, 'note', e.target.value)}
                    />
                  </div>
                </section>
              ))}
            </div>

            <FormInput label="หมายเหตุลูกหนี้" {...register('note')} />

            {formError && (
              <p className="text-sm font-medium text-red-600">{formError}</p>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                onClick={closeAdd}
                className="flex-1"
              >
                ยกเลิก
              </Button>
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? 'กำลังบันทึก…' : 'บันทึกลูกหนี้'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
