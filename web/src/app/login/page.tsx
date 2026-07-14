'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Field, TextInput } from '@/components/form';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

const schema = z.object({
  username: z.string().min(1, 'กรอกชื่อผู้ใช้'),
  password: z.string().min(1, 'กรอกรหัสผ่าน'),
});
type Form = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: Form) => {
    setError('');
    try {
      const res = await api<{ accessToken: string; refreshToken: string }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify(data) },
      );
      setTokens(res.accessToken, res.refreshToken);
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เข้าสู่ระบบไม่สำเร็จ');
    }
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[#eceef1] dark:bg-gray-950"
      />

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="relative w-full max-w-[22rem] space-y-5 rounded-2xl border border-[#d7dce3] bg-white p-7 dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex flex-col items-center gap-3 pb-1 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-white">
            ฿
          </span>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              ระบบติดตามเงินกู้
            </h1>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-500 dark:text-gray-400">
              เข้าสู่ระบบเพื่อดูยอดเก็บและบันทึกรับเงิน
            </p>
          </div>
        </div>

        <Field label="ชื่อผู้ใช้" error={errors.username?.message}>
          <TextInput
            {...register('username')}
            autoComplete="username"
            placeholder="เช่น admin"
          />
        </Field>
        <Field label="รหัสผ่าน" error={errors.password?.message}>
          <TextInput
            type="password"
            {...register('password')}
            autoComplete="current-password"
            placeholder="รหัสผ่านของคุณ"
          />
        </Field>

        {error && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-700 dark:bg-red-500/10 dark:text-red-400"
          >
            {error}
          </div>
        )}

        <Button type="submit" block disabled={isSubmitting}>
          {isSubmitting ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </Button>
      </form>
    </div>
  );
}
