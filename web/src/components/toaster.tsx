'use client';

import { IconAlert, IconCheck } from '@/components/icons';
import { useToastStore } from '@/lib/toast-store';

/**
 * แถบยืนยันผลลอยล่างจอ — เหนือ bottom nav บนมือถือ
 * แตะเพื่อปิดก่อนเวลาได้ (พื้นที่แตะใหญ่ ใช้กลางแดดสะดวก)
 */
export function Toaster() {
  const { toasts, dismiss } = useToastStore();
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6 print:hidden">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg transition-opacity motion-safe:animate-toast-in ${
            t.variant === 'success'
              ? 'border-emerald-200 bg-white text-emerald-800 dark:border-emerald-500/30 dark:bg-gray-900 dark:text-emerald-300'
              : 'border-red-200 bg-white text-red-700 dark:border-red-500/30 dark:bg-gray-900 dark:text-red-400'
          }`}
        >
          {t.variant === 'success' ? (
            <IconCheck className="size-5 shrink-0 text-emerald-500" />
          ) : (
            <IconAlert className="size-5 shrink-0 text-red-500" />
          )}
          <span className="text-left">{t.title}</span>
        </button>
      ))}
    </div>
  );
}
