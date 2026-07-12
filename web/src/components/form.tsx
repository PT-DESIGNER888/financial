'use client';

import React from 'react';
import { IconChevronDown } from '@/components/icons';

/**
 * ชุด form control กลางของทั้งแอป — ใช้ที่นี่ที่เดียวเพื่อให้หน้าตา/ธีมสว่าง-มืดสม่ำเสมอ
 * TextInput / Select รองรับ ref (ใช้กับ react-hook-form `{...register()}` ได้)
 */

/** คลาสพื้นฐานของช่องกรอก — export ไว้เผื่อกรณีที่ต้องใส่เอง */
export const inputCls =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white';

/** กล่อง label + ช่องกรอก + ข้อความ hint/error */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {label && (
        <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">
          {label}
        </label>
      )}
      {children}
      {hint && (
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{hint}</p>
      )}
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}

type TextInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /** จัดข้อความชิดขวา (เหมาะกับช่องจำนวนเงิน) */
  align?: 'left' | 'right';
};

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  ({ align = 'left', className, ...props }, ref) => (
    <input
      ref={ref}
      className={`${inputCls} ${align === 'right' ? 'text-right' : ''} ${className ?? ''}`}
      {...props}
    />
  ),
);
TextInput.displayName = 'TextInput';

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

/** <select> ที่ตัดลูกศร native ออกแล้วใส่ chevron เอง ให้เข้าธีมทั้งสว่าง/มืด */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={`${inputCls} cursor-pointer appearance-none pr-9 ${className ?? ''}`}
        {...props}
      >
        {children}
      </select>
      <IconChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
    </div>
  ),
);
Select.displayName = 'Select';

type ButtonVariant = 'primary' | 'secondary' | 'danger';
type ButtonSize = 'sm' | 'md';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** เต็มความกว้าง */
  block?: boolean;
};

const buttonVariant: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary/90 disabled:opacity-50',
  secondary:
    'border border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50',
};

const buttonSize: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
};

/** ปุ่มกลางของทั้งแอป — variant primary/secondary/danger, size sm/md */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', block, className, type, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors ${buttonVariant[variant]} ${buttonSize[size]} ${block ? 'w-full' : ''} ${className ?? ''}`}
      {...props}
    />
  ),
);
Button.displayName = 'Button';

/** แถวปุ่มท้าย modal: ยกเลิก + บันทึก (รูปแบบเดียวทั้งแอป) */
export function ModalButtons({
  onClose,
  onSave,
  saving,
  saveLabel = 'บันทึก',
  danger,
}: {
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  saveLabel?: string;
  danger?: boolean;
}) {
  return (
    <div className="flex gap-2 pt-1">
      <Button variant="secondary" onClick={onClose} className="flex-1">
        ยกเลิก
      </Button>
      <Button
        variant={danger ? 'danger' : 'primary'}
        onClick={onSave}
        disabled={saving}
        className="flex-1"
      >
        {saving ? 'กำลังบันทึก…' : saveLabel}
      </Button>
    </div>
  );
}

/**
 * ปุ่มเลือกแบบแบ่งช่อง (segmented control) แทน <select> สำหรับตัวเลือก 2–3 ทาง
 * เข้าธีมทั้งสว่าง/มืด และเห็นค่าที่เลือกชัดกว่า native select
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  accent = 'primary',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; hint?: string }[];
  accent?: 'primary' | 'sky';
}) {
  const activeCls =
    accent === 'sky'
      ? 'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-400'
      : 'border-primary bg-primary/10 text-primary';
  return (
    <div className="flex gap-1.5">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-lg border px-3 py-2 text-center text-sm font-medium transition-colors ${
              active
                ? activeCls
                : 'border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            <span className="block leading-tight">{o.label}</span>
            {o.hint && (
              <span
                className={`mt-0.5 block text-[11px] font-normal leading-tight ${
                  active ? 'opacity-80' : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                {o.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
