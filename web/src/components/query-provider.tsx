'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

/**
 * ตัวจัดการ cache ของ react-query ทั้งแอป — วางไว้ครอบ Shell ใน layout
 * แอปใช้คนเดียว ข้อมูลไม่แข่งกันแก้ จึงตั้ง staleTime พอสมควรลด refetch ซ้ำ
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // ใช้ทั้งมือถือหน้างานและคอมที่บ้าน — กลับมาที่แอปแล้วข้อมูลต้องสด
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}
