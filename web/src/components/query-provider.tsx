'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

/**
 * ตัวจัดการ cache ของ react-query ทั้งแอป — วางไว้ครอบ Shell ใน layout
 * แอปใช้คนเดียว ข้อมูลไม่แข่งกันแก้ จึงตั้ง staleTime พอสมควรลด refetch ซ้ำ
 *
 * มือถือ (โดยเฉพาะ iOS) มักไม่ยิง window focus ตอนกลับมาที่แอป
 * จึงดึงแดชบอร์ดใหม่เมื่อหน้ากลับมาโชว์ — ไม่ล้าง cache ทั้งระบบเพราะจะช้า
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            retry: 2,
          },
        },
      }),
  );

  useEffect(() => {
    let last = 0;
    const bump = () => {
      const now = Date.now();
      if (now - last < 1_500) return;
      last = now;
      void client.invalidateQueries({ queryKey: ['dashboard'] });
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') bump();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) bump();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [client]);

  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}
