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
    <div className="flex min-h-[85vh] items-center justify-center">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-sm space-y-4 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex flex-col items-center gap-2 pb-2">
          <span className="flex size-12 items-center justify-center rounded-lg bg-primary text-2xl text-white">
            ฿
          </span>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            ระบบติดตามเงินกู้
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            เข้าสู่ระบบเพื่อใช้งาน
          </p>
        </div>
        <Field label="ชื่อผู้ใช้" error={errors.username?.message}>
          <TextInput {...register('username')} autoComplete="username" />
        </Field>
        <Field label="รหัสผ่าน" error={errors.password?.message}>
          <TextInput
            type="password"
            {...register('password')}
            autoComplete="current-password"
          />
        </Field>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button type="submit" block disabled={isSubmitting}>
          {isSubmitting ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </Button>
      </form>
    </div>
  );
}
