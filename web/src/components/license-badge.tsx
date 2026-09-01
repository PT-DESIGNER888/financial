'use client';

import { useEffect, useId, useState } from 'react';
import { Button } from '@/components/form';
import { IconCalendar } from '@/components/icons';
import {
  dismissLicenseNotice,
  getLicenseStatus,
  wasLicenseNoticeDismissed,
  type LicenseStatus,
} from '@/lib/license';
import { thaiDateFull, todayISO } from '@/lib/format';

function chipLabel(status: LicenseStatus, compact: boolean): string {
  if (status.expired) return compact ? 'หมดอายุ' : 'ระบบหมดอายุแล้ว';
  if (status.daysLeft === 0) return compact ? 'หมดวันนี้' : 'หมดอายุวันนี้';
  if (compact) return `${status.daysLeft.toLocaleString('th-TH')} วัน`;
  return `ใช้ได้อีก ${status.daysLeft.toLocaleString('th-TH')} วัน`;
}

function dialogCopy(status: LicenseStatus): { title: string; detail: string } {
  const until = thaiDateFull(status.expires);
  if (status.expired) {
    return {
      title: 'ระบบหมดอายุแล้ว',
      detail: `สิ้นสุดวันที่ ${until} กรุณาต่ออายุกับผู้พัฒนาเพื่อใช้งานต่อได้ไม่สะดุด`,
    };
  }
  if (status.daysLeft === 0) {
    return {
      title: 'ระบบหมดอายุวันนี้',
      detail: `วันนี้เป็นวันสุดท้ายของรอบใช้งาน (ถึง ${until}) กรุณาต่ออายุกับผู้พัฒนา`,
    };
  }
  if (status.urgent) {
    return {
      title: 'ระบบใกล้หมดอายุ',
      detail: `เหลืออีก ${status.daysLeft.toLocaleString('th-TH')} วัน หมดอายุวันที่ ${until} — ต่ออายุกับผู้พัฒนาก่อนครบกำหนด`,
    };
  }
  return {
    title: 'อายุการใช้งานระบบ',
    detail: `จ่ายเมื่อ ${thaiDateFull(status.start)} ใช้ได้ 1 ปี หมดอายุวันที่ ${until} เหลืออีก ${status.daysLeft.toLocaleString('th-TH')} วัน`,
  };
}

export function LicenseBadge() {
  const titleId = useId();
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [open, setOpen] = useState(false);

  const close = () => {
    setOpen(false);
    if (status?.urgent) dismissLicenseNotice(todayISO());
  };

  useEffect(() => {
    const today = todayISO();
    const next = getLicenseStatus(today);
    setStatus(next);
    if (next.urgent && !wasLicenseNoticeDismissed(today)) {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      if (status?.urgent) dismissLicenseNotice(todayISO());
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, status]);

  if (!status) {
    return (
      <span
        aria-hidden
        className="inline-flex min-h-11 min-w-[5.5rem] rounded-full bg-slate-100 dark:bg-gray-800"
      />
    );
  }

  const urgent = status.urgent;
  const copy = dialogCopy(status);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={chipLabel(status, false)}
        title={copy.detail}
        className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-left transition-colors md:px-4 ${
          urgent
            ? 'bg-[#b33b3b]/10 text-[#b33b3b] hover:bg-[#b33b3b]/15 dark:bg-[#b33b3b]/20 dark:text-[#f0b6b6]'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
        }`}
      >
        <IconCalendar className="size-[18px] shrink-0" aria-hidden />
        <span className="text-[13px] leading-none md:text-sm" aria-hidden>
          <span className="font-semibold tabular-nums md:hidden">
            {chipLabel(status, true)}
          </span>
          <span className="hidden md:inline">
            {status.expired || status.daysLeft === 0 ? (
              <span className="font-semibold">{chipLabel(status, false)}</span>
            ) : (
              <>
                ใช้ได้อีก{' '}
                <span className="font-semibold tabular-nums">
                  {status.daysLeft.toLocaleString('th-TH')} วัน
                </span>
              </>
            )}
          </span>
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={close}
        >
          <div
            role="alertdialog"
            aria-labelledby={titleId}
            aria-describedby={`${titleId}-detail`}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm space-y-3 rounded-t-2xl border border-[#d7dce3] bg-white p-5 sm:rounded-2xl dark:border-gray-800 dark:bg-gray-900"
          >
            <div
              className={`flex size-12 items-center justify-center rounded-full ${
                urgent
                  ? 'bg-[#b33b3b]/10 text-[#b33b3b]'
                  : 'bg-primary/10 text-primary'
              }`}
            >
              <IconCalendar className="size-6" aria-hidden />
            </div>
            <div>
              <p
                id={titleId}
                className={`text-lg font-bold ${
                  urgent
                    ? 'text-[#b33b3b] dark:text-[#f0b6b6]'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                {copy.title}
              </p>
              <p
                id={`${titleId}-detail`}
                className="mt-1.5 text-[15px] leading-relaxed text-slate-600 dark:text-gray-300"
              >
                {copy.detail}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-[#d7dce3] dark:bg-gray-800">
              <div className="bg-white px-3 py-2.5 dark:bg-gray-900">
                <dt className="text-[12px] text-slate-500 dark:text-gray-400">
                  วันเริ่มใช้
                </dt>
                <dd className="text-sm font-semibold text-slate-800 dark:text-gray-100">
                  {thaiDateFull(status.start)}
                </dd>
              </div>
              <div className="bg-white px-3 py-2.5 dark:bg-gray-900">
                <dt className="text-[12px] text-slate-500 dark:text-gray-400">
                  วันหมดอายุ
                </dt>
                <dd
                  className={`text-sm font-semibold ${
                    urgent
                      ? 'text-[#b33b3b] dark:text-[#f0b6b6]'
                      : 'text-slate-800 dark:text-gray-100'
                  }`}
                >
                  {thaiDateFull(status.expires)}
                </dd>
              </div>
            </dl>
            <Button variant={urgent ? 'danger' : 'primary'} onClick={close} block>
              รับทราบ
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
