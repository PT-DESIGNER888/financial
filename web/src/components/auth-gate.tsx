'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';
import { PageSkeleton } from '@/components/skeleton';
import { useAuthStore } from '@/lib/auth-store';

const noopSubscribe = () => () => {};

/** กันหน้าไว้: ยังไม่ login เด้งไปหน้า login (เช็คหลัง hydrate zustand-persist) */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  // false บน server / ครั้งแรก, true หลัง hydrate ฝั่ง client
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  useEffect(() => {
    if (hydrated && !accessToken) router.replace('/login');
  }, [hydrated, accessToken, router]);

  if (!hydrated) return <PageSkeleton />;
  if (!accessToken) return <PageSkeleton />;
  return <>{children}</>;
}
