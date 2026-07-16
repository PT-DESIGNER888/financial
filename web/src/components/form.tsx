'use client';

import React, { useState } from 'react';
import { IconCheck, IconChevronDown } from '@/components/icons';
import { Popover } from '@/components/popover';

/**
 * ชุด form control กลางของทั้งแอป — ใช้ที่นี่ที่เดียวเพื่อให้หน้าตา/ธีมสว่าง-มืดสม่ำเสมอ
 * TextInput / Select รองรับ ref (ใช้กับ react-hook-form `{...register()}` ได้)
 */

/** คลาสพื้นฐานของช่องกรอก — export ไว้เผื่อกรณีที่ต้องใส่เอง */
export const inputCls =
  'w-full min-h-12 rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 transition-colors focus:border-primary focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500 md:min-h-[3.25rem] md:text-[17px]';

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
        <label className="mb-1.5 block text-sm font-medium text-slate-600 md:text-[15px] dark:text-gray-300">
          {label}
        </label>
      )}
      {children}
      {hint && (
        <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500 dark:text-gray-500">
          {hint}
        </p>
      )}
      {error && (
        <p className="mt-1.5 text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
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

type FormInputProps = TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
};

/** Field + TextInput ในตัวเดียว — โยน props ของ input มาได้เลย (รองรับ `{...register()}`) */
export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, hint, error, ...props }, ref) => (
    <Field label={label} hint={hint} error={error}>
      <TextInput ref={ref} {...props} />
    </Field>
  ),
);
FormInput.displayName = 'FormInput';

/**
 * dropdown ที่วาดรายการเอง (แทน <select> native ที่แต่ง option ไม่ได้)
 * แผงรายการเข้าธีมสว่าง/มืด มี check ที่ตัวเลือกปัจจุบัน เปิดใน modal ได้ไม่โดนตัด
 */
export function SelectMenu<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  size?: 'sm' | 'md';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const current = options.find((o) => o.value === value);

  return (
    <>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(e) => {
          setAnchor(e.currentTarget);
          setOpen(true);
        }}
        className={`${size === 'md' ? inputCls : 'min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white'} flex cursor-pointer items-center justify-between gap-2 text-left ${className ?? ''}`}
      >
        <span className="truncate">{current?.label ?? '—'}</span>
        <IconChevronDown
          className={`size-5 shrink-0 text-gray-400 transition-transform dark:text-gray-500 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && anchor && (
        <Popover
          anchor={anchor}
          onClose={() => setOpen(false)}
          matchWidth={size === 'md'}
          minWidth={144}
        >
          <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
            {options.map((o) => {
              const selected = o.value === value;
              return (
                <li key={o.value} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-2 px-3.5 py-3 text-left ${size === 'sm' ? 'text-sm' : 'text-base'} ${
                      selected
                        ? 'bg-primary/10 font-semibold text-primary'
                        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {o.label}
                    {selected && <IconCheck className="size-4 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </Popover>
      )}
    </>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger';
type ButtonSize = 'sm' | 'md';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** เต็มความกว้าง */
  block?: boolean;
};

const buttonVariant: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white hover:brightness-95 disabled:opacity-50',
  secondary:
    'border border-[#d7dce3] bg-white text-[#1a222c] hover:bg-[#f4f5f7] dark:border-gray-700 dark:bg-transparent dark:text-gray-300 dark:hover:bg-gray-800',
  danger: 'bg-[#b33b3b] text-white hover:brightness-95 disabled:opacity-50',
};

const buttonSize: Record<ButtonSize, string> = {
  sm: 'min-h-11 px-4 py-2.5 text-sm md:min-h-12 md:text-[15px]',
  md: 'min-h-12 px-5 py-3 text-base md:min-h-[3.25rem] md:px-6 md:text-[17px]',
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
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-colors ${buttonVariant[variant]} ${buttonSize[size]} ${block ? 'w-full' : ''} ${className ?? ''}`}
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
  disabled,
}: {
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  saveLabel?: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-2 pt-1">
      <Button variant="secondary" onClick={onClose} className="flex-1">
        ยกเลิก
      </Button>
      <Button
        variant={danger ? 'danger' : 'primary'}
        onClick={onSave}
        disabled={saving || disabled}
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
            className={`flex-1 rounded-xl border px-3 py-3.5 text-center text-[15px] font-semibold transition-colors md:text-base ${
              active
                ? activeCls
                : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            <span className="block leading-tight">{o.label}</span>
            {o.hint && (
              <span
                className={`mt-0.5 block text-xs font-normal leading-tight ${
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
