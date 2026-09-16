'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

/**
 * ตัวจัดการ cache ของ react-query ทั้งแอป — วางไว้ครอบ Shell ใน layout
 *
 * มือถือ (โดยเฉพาะ iOS) มักไม่ยิง window focus ตอนกลับมาที่แอป
 * จึง refetch แดชบอร์ดเมื่อหน้ากลับมาโชว์ — แต่เฉพาะ query ที่ stale แล้ว
 * เพื่อไม่ยิง API หนักซ้ำทุกครั้งสลับแอป
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 45_000,
            // visibility bump ด้านล่างครอบคลุมมือถือแล้ว — กันยิงซ้ำกับ focus
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            retry: 1,
          },
        },
      }),
  );

  useEffect(() => {
    let last = 0;
    const bump = () => {
      const now = Date.now();
      if (now - last < 5_000) return;
      last = now;
      // refetch เฉพาะที่ stale — ไม่ invalidate บังคับ (ลด egress)
      void client.refetchQueries({
        queryKey: ['dashboard'],
        type: 'active',
        stale: true,
      });
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
