'use client';

import { useRouter } from 'next/navigation';
import { IconChevronLeft } from '@/components/icons';

/**
 * ปุ่มกลับหน้าก่อน — ใช้ history ถ้ามาจากในแอป
 * ไม่งั้นไป fallback (เช่น รายชื่อลูกหนี้)
 */
export function BackButton({
  href,
  label = 'กลับ',
}: {
  /** หน้าสำรองเมื่อไม่มีประวัติในแอป */
  href: string;
  /** ข้อความหลังลูกศร เช่น "ลูกหนี้" */
  label?: string;
}) {
  const router = useRouter();

  const goBack = () => {
    try {
      const ref = document.referrer;
      if (ref) {
        const url = new URL(ref);
        if (url.origin === window.location.origin) {
          router.back();
          return;
        }
      }
    } catch {
      /* ignore */
    }
    router.push(href);
  };

  return (
    <button
      type="button"
      onClick={goBack}
      className="-ml-1.5 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
    >
      <IconChevronLeft className="size-6 shrink-0" />
      <span>{label}</span>
    </button>
  );
}
