'use client';

import { Button } from '@/components/form';

/** โหลดข้อมูลไม่สำเร็จ — บอกภาษาคน + มีปุ่มลองใหม่ แทนข้อความแดงลอยกลางจอ */
export function PageError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-dashed border-red-200 bg-white px-6 py-10 text-center dark:border-red-500/20 dark:bg-gray-900"
    >
      <p className="text-[15px] font-semibold text-slate-900 dark:text-white">
        โหลดข้อมูลไม่สำเร็จ
      </p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-gray-400">
        {message}
      </p>
      {onRetry && (
        <Button
          type="button"
          variant="secondary"
          className="mt-4"
          onClick={onRetry}
        >
          ลองอีกครั้ง
        </Button>
      )}
    </div>
  );
}
