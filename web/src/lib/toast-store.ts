'use client';

import { create } from 'zustand';

export interface Toast {
  id: number;
  title: string;
  variant: 'success' | 'error';
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    // ยืนยันผลสั้นๆ แล้วหายเอง — ไม่ต้องกดปิด (ใช้มือเดียวหน้างาน)
    setTimeout(
      () => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
      2600,
    );
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

/** เรียกจากที่ไหนก็ได้ (นอก component ก็ได้) */
export function toast(title: string, variant: 'success' | 'error' = 'success') {
  useToastStore.getState().push({ title, variant });
}
