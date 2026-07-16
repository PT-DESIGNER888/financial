'use client';

import { useState } from 'react';
import { inputCls } from '@/components/form';
import { IconCalendar, IconChevronDown } from '@/components/icons';
import { Popover } from '@/components/popover';

const THAI_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];
const THAI_MONTHS_SHORT = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];
const WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

const pad = (n: number) => String(n).padStart(2, '0');
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** ปุ่มลูกศรเลื่อนเดือน/ปีในหัวปฏิทิน */
function NavBtn({
  onClick,
  dir,
  label,
}: {
  onClick: () => void;
  dir: 'prev' | 'next';
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
    >
      <IconChevronDown
        className={`size-4 ${dir === 'prev' ? 'rotate-90' : '-rotate-90'}`}
      />
    </button>
  );
}

/**
 * ปฏิทินเลือกวันที่ (แทน input type="date" ที่ปฏิทิน native แต่งธีมไม่ได้)
 * แสดงเดือนไทย + ปี พ.ศ. — ค่าเก็บเป็น ISO YYYY-MM-DD เหมือนเดิม
 */
export function DatePicker({
  value,
  onChange,
}: {
  value: string; // YYYY-MM-DD
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [y0, m0] = (value || todayISO()).split('-').map(Number);
  const [view, setView] = useState({ y: y0, m: m0 }); // m = 1-12

  const daysInMonth = new Date(view.y, view.m, 0).getDate();
  const firstWeekday = new Date(view.y, view.m - 1, 1).getDay();
  const today = todayISO();

  const shift = (delta: number) => {
    const d = new Date(view.y, view.m - 1 + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() + 1 });
  };

  const label = value
    ? `${Number(value.slice(8, 10))} ${THAI_MONTHS_SHORT[Number(value.slice(5, 7)) - 1]} ${Number(value.slice(0, 4)) + 543}`
    : 'เลือกวันที่';

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          const [yy, mm] = (value || todayISO()).split('-').map(Number);
          setView({ y: yy, m: mm });
          setAnchor(e.currentTarget);
          setOpen(true);
        }}
        className={`${inputCls} flex cursor-pointer items-center justify-between gap-2 text-left`}
      >
        <span>{label}</span>
        <IconCalendar className="size-4 shrink-0 text-gray-400 dark:text-gray-500" />
      </button>
      {open && anchor && (
        <Popover anchor={anchor} onClose={() => setOpen(false)}>
          <div className="w-72 p-3">
            <div className="flex items-center justify-between">
              <NavBtn dir="prev" label="เดือนก่อนหน้า" onClick={() => shift(-1)} />
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {THAI_MONTHS[view.m - 1]} {view.y + 543}
              </p>
              <NavBtn dir="next" label="เดือนถัดไป" onClick={() => shift(1)} />
            </div>
            <div className="mt-2 grid grid-cols-7 text-center text-xs text-gray-400 dark:text-gray-500">
              {WEEKDAYS.map((w) => (
                <span key={w} className="py-1">
                  {w}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: firstWeekday }).map((_, i) => (
                <span key={`b${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const iso = `${view.y}-${pad(view.m)}-${pad(day)}`;
                const selected = iso === value;
                const isToday = iso === today;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      onChange(iso);
                      setOpen(false);
                    }}
                    className={`flex size-9 items-center justify-center justify-self-center rounded-lg text-sm transition-colors ${
                      selected
                        ? 'bg-primary font-semibold text-white'
                        : isToday
                          ? 'border border-primary/50 font-semibold text-primary hover:bg-primary/10'
                          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => {
                onChange(today);
                setOpen(false);
              }}
              className="mt-2 w-full rounded-lg py-2 text-sm font-medium text-primary hover:bg-primary/10"
            >
              วันนี้
            </button>
          </div>
        </Popover>
      )}
    </>
  );
}

/** เลือกเดือน (แทน input type="month") — ปุ่มเลื่อนปี พ.ศ. + ตาราง 12 เดือน */
export function MonthPicker({
  value,
  onChange,
  className,
}: {
  value: string; // YYYY-MM
  onChange: (v: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [y0, m0] = value.split('-').map(Number);
  const [viewYear, setViewYear] = useState(y0);
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          setViewYear(Number(value.slice(0, 4)));
          setAnchor(e.currentTarget);
          setOpen(true);
        }}
        className={`flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-primary focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white ${className ?? ''}`}
      >
        <IconCalendar className="size-4 text-gray-400 dark:text-gray-500" />
        {THAI_MONTHS_SHORT[m0 - 1]} {y0 + 543}
      </button>
      {open && anchor && (
        <Popover anchor={anchor} onClose={() => setOpen(false)}>
          <div className="w-64 p-3">
            <div className="flex items-center justify-between">
              <NavBtn
                dir="prev"
                label="ปีก่อนหน้า"
                onClick={() => setViewYear((y) => y - 1)}
              />
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                พ.ศ. {viewYear + 543}
              </p>
              <NavBtn
                dir="next"
                label="ปีถัดไป"
                onClick={() => setViewYear((y) => y + 1)}
              />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1">
              {THAI_MONTHS_SHORT.map((m, i) => {
                const val = `${viewYear}-${pad(i + 1)}`;
                const selected = val === value;
                const isNow = val === thisMonth;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      onChange(val);
                      setOpen(false);
                    }}
                    className={`rounded-lg py-2.5 text-sm transition-colors ${
                      selected
                        ? 'bg-primary font-semibold text-white'
                        : isNow
                          ? 'border border-primary/50 font-semibold text-primary hover:bg-primary/10'
                          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
        </Popover>
      )}
    </>
  );
}
