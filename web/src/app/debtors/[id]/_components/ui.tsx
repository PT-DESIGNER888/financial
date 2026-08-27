'use client';

import type { ReactNode } from 'react';
import { baht } from '@/lib/format';

export function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-5 sm:rounded-2xl dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

export function ManageBtn({
  onClick,
  icon,
  danger,
  accent,
  children,
}: {
  onClick: () => void;
  icon: ReactNode;
  danger?: boolean;
  /** เน้นเป็น action สำคัญ (เช่น นำกลับเป็นหนี้ปกติ / เปิดยอดคืน) */
  accent?: boolean;
  children: ReactNode;
}) {
  const tone = accent
    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20'
    : danger
      ? 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10'
      : 'border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800';
  return (
    <button
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${tone}`}
    >
      {icon}
      {children}
    </button>
  );
}

export function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="bg-white p-3 text-left sm:p-4 dark:bg-gray-900">
      <p className="text-[12px] font-medium text-slate-500 dark:text-gray-400">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-bold tabular-nums sm:text-xl ${color ?? 'text-slate-900 dark:text-white'}`}
      >
        ฿{baht(value)}
      </p>
    </div>
  );
}

export function StatText({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-white p-3 text-left sm:p-4 dark:bg-gray-900">
      <p className="text-[12px] font-medium text-slate-500 dark:text-gray-400">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-bold tabular-nums sm:text-xl ${color ?? 'text-slate-900 dark:text-white'}`}
      >
        {value}
      </p>
    </div>
  );
}

export function SummaryChip({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p
        className={`font-bold ${danger ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}
      >
        {value}
      </p>
    </div>
  );
}
