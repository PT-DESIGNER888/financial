'use client';

import { IconChevronLeft, IconChevronRight } from '@/components/icons';
import {
  addDaysISO,
  mondayOf,
  thaiDate,
  todayISO,
  WEEKDAY_SHORT,
  weekdayOf,
} from '@/lib/format';

/**
 * แถบเลือกวันในสัปดาห์ (จ.–อา.) — กดดูได้ว่าวันไหนมีใครต้องส่งบ้าง
 * เลื่อนสัปดาห์ไปหน้า/ถอยหลังได้ และมีปุ่มกลับมาวันนี้เมื่อออกไปวันอื่น
 */
export function DayStrip({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const today = todayISO();
  const monday = mondayOf(value);
  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(monday, i));
  const sunday = days[6];

  return (
    <section
      aria-label="เลือกวันที่ต้องการดู"
      className="rounded-2xl border border-slate-200/80 bg-white p-2.5 dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="flex items-center justify-between gap-2 px-1 pb-2.5">
        <WeekNav
          label="สัปดาห์ก่อนหน้า"
          onClick={() => onChange(addDaysISO(value, -7))}
        >
          <IconChevronLeft className="size-5" />
        </WeekNav>
        <p className="min-w-0 truncate text-[13px] font-medium text-slate-500 md:text-sm dark:text-gray-400">
          {thaiDate(monday)} – {thaiDate(sunday)}
        </p>
        <WeekNav
          label="สัปดาห์ถัดไป"
          onClick={() => onChange(addDaysISO(value, 7))}
        >
          <IconChevronRight className="size-5" />
        </WeekNav>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const selected = d === value;
          const isToday = d === today;
          return (
            <button
              key={d}
              type="button"
              aria-current={selected ? 'date' : undefined}
              onClick={() => onChange(d)}
              className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-xl border transition-colors ${
                selected
                  ? 'border-primary bg-primary text-white'
                  : isToday
                    ? 'border-primary/40 text-primary hover:bg-primary/10'
                    : 'border-transparent text-slate-600 hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              <span
                className={`text-[11px] leading-none ${selected ? 'text-white/80' : 'text-slate-400 dark:text-gray-500'}`}
              >
                {WEEKDAY_SHORT[weekdayOf(d)]}
              </span>
              <span className="text-lg font-bold tabular-nums">
                {Number(d.slice(8, 10))}
              </span>
            </button>
          );
        })}
      </div>

      {value !== today && (
        <button
          type="button"
          onClick={() => onChange(today)}
          className="mt-2 w-full rounded-xl py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
        >
          กลับมาวันนี้
        </button>
      )}
    </section>
  );
}

function WeekNav({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800"
    >
      {children}
    </button>
  );
}
