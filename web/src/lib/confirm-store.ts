'use client';

import { create } from 'zustand';

export interface ConfirmOptions {
  /** คำถามหลัก เช่น ลบรายการนี้? */
  title: string;
  /** คำอธิบายผลของการยืนยัน */
  detail?: string;
  /** ป้ายปุ่มยืนยัน (default: ยืนยัน) */
  confirmLabel?: string;
  /** true = action อันตราย ปุ่มแดง */
  danger?: boolean;
}

interface ConfirmState {
  open: ConfirmOptions | null;
  resolve: ((ok: boolean) => void) | null;
  ask: (o: ConfirmOptions) => Promise<boolean>;
  answer: (ok: boolean) => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: null,
  resolve: null,
  ask: (o) =>
    new Promise<boolean>((resolve) => {
      // ถ้ามีกล่องค้างอยู่ ให้ตอบปฏิเสธของเก่าก่อน (ไม่ให้ promise ค้าง)
      get().resolve?.(false);
      set({ open: o, resolve });
    }),
  answer: (ok) => {
    get().resolve?.(ok);
    set({ open: null, resolve: null });
  },
}));

/** แทน confirm() ของ browser — `if (!(await confirmDialog({...}))) return;` */
export function confirmDialog(o: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().ask(o);
}
