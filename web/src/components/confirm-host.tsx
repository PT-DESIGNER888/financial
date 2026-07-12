'use client';

import { Button } from '@/components/form';
import { useConfirmStore } from '@/lib/confirm-store';

/**
 * กล่องยืนยันของแอปแทน confirm() ของ browser — ปุ่มใหญ่กดง่ายบนมือถือ
 * เข้าธีมสว่าง/มืด และปุ่มแดงชัดสำหรับ action อันตราย (mount ครั้งเดียวใน Shell)
 */
export function ConfirmHost() {
  const { open, answer } = useConfirmStore();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={() => answer(false)}
    >
      <div
        role="alertdialog"
        aria-label={open.title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-2 rounded-t-lg border border-gray-200 bg-white p-5 sm:rounded-lg dark:border-gray-800 dark:bg-gray-900"
      >
        <p className="font-semibold text-gray-900 dark:text-white">
          {open.title}
        </p>
        {open.detail && (
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {open.detail}
          </p>
        )}
        <div className="flex gap-2 pt-2">
          <Button
            variant="secondary"
            onClick={() => answer(false)}
            className="flex-1"
            autoFocus
          >
            ยกเลิก
          </Button>
          <Button
            variant={open.danger ? 'danger' : 'primary'}
            onClick={() => answer(true)}
            className="flex-1"
          >
            {open.confirmLabel ?? 'ยืนยัน'}
          </Button>
        </div>
      </div>
    </div>
  );
}
