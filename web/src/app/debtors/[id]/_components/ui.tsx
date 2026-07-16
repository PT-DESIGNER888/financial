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
  children,
}: {
  onClick: () => void;
  icon: ReactNode;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
        danger
          ? 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10'
          : 'border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
      }`}
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
