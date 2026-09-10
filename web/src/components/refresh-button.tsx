'use client';

import { IconReopen } from '@/components/icons';

/** ปุ่มดึงยอดใหม่ — เบา ไม่แย่งปุ่มรับเงิน ใช้เมื่อคอม/มือถือคนละเครื่อง */
export function RefreshButton({
  onClick,
  busy,
}: {
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary disabled:opacity-50"
    >
      <IconReopen
        className={`size-3.5 stroke-[1.75] ${busy ? 'animate-spin motion-reduce:animate-none' : ''}`}
      />
      {busy ? 'กำลังดึง…' : 'รีเฟรช'}
    </button>
  );
}
