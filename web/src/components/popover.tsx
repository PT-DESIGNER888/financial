'use client';

import { useLayoutEffect, useRef, useState } from 'react';

/**
 * แผงลอยยึดตำแหน่งกับ anchor ด้วย position:fixed — ไม่โดน overflow ของ modal ตัด
 * มี backdrop ปิดเมื่อแตะนอกแผง + Escape, เปิดขึ้นบนอัตโนมัติถ้าด้านล่างไม่พอ
 * z-40 (เหนือ modal z-30) — ใช้เป็นฐานของ SelectMenu / DatePicker
 */
export function Popover({
  anchor,
  onClose,
  children,
  matchWidth,
  minWidth = 0,
}: {
  anchor: HTMLElement;
  onClose: () => void;
  children: React.ReactNode;
  /** กว้างเท่าช่องที่กด (เหมาะกับ select) */
  matchWidth?: boolean;
  minWidth?: number;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width?: number;
  } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const a = anchor.getBoundingClientRect();
      const panel = panelRef.current;
      if (!panel) return;
      const w = matchWidth
        ? a.width
        : Math.max(minWidth, panel.offsetWidth);
      const h = panel.offsetHeight;
      let top = a.bottom + 4;
      if (top + h > window.innerHeight - 8) top = Math.max(8, a.top - h - 4);
      const left = Math.min(
        Math.max(8, a.left),
        window.innerWidth - w - 8,
      );
      setPos({ top, left, width: matchWidth ? a.width : undefined });
    };
    place();
    window.addEventListener('resize', place);
    // เลื่อนหน้าจอแล้ว anchor ขยับ — ปิดไปเลยกันแผงลอยหลุดตำแหน่ง
    const close = () => onClose();
    window.addEventListener('scroll', close, true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', close, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [anchor, matchWidth, minWidth, onClose]);

  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        style={
          pos
            ? { top: pos.top, left: pos.left, width: pos.width }
            : { visibility: 'hidden', top: 0, left: 0 }
        }
        className="fixed overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg motion-safe:animate-pop-in dark:border-gray-700 dark:bg-gray-800"
      >
        {children}
      </div>
    </div>
  );
}
