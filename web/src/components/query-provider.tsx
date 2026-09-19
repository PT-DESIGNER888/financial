'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

/**
 * ตัวจัดการ cache ของ react-query ทั้งแอป — วางไว้ครอบ Shell ใน layout
 *
 * มือถือ (โดยเฉพาะ iOS) มักไม่ยิง window focus ตอนกลับมาที่แอป
 * จึง refetch ข้อมูลที่กำลังแสดงเมื่อหน้ากลับมาโชว์ เพื่อให้รายการที่บันทึก
 * จากคอม/มือถืออีกเครื่องตามกันทัน โดยไม่แตะ query ที่ไม่ได้เปิดอยู่
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            refetchOnMount: 'always',
            // ใช้ handler เดียวด้านล่าง ครอบคลุมทั้ง desktop focus และ iOS visibility
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
      // Safari/iOS อาจไม่ส่ง focus event เมื่อกลับจากหน้าจอล็อกหรือสลับแอป
      void client.refetchQueries({
        type: 'active',
      });
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') bump();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) bump();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', bump);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', bump);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [client]);

  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}
