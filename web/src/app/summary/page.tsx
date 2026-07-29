'use client';

import Link from 'next/link';
import { AuthGate } from '@/components/auth-gate';
import {
  IconAlert,
  IconChart,
  IconDoc,
  IconTrendUp,
  IconWallet,
} from '@/components/icons';
import { PageSkeleton } from '@/components/skeleton';
import { baht } from '@/lib/format';
import { useSummary } from '@/lib/hooks/useDashboard';
import type { LoanStatus } from '@/lib/types';

export default function SummaryPage() {
  return (
    <AuthGate>
      <SummaryView />
    </AuthGate>
  );
}

function SummaryView() {
  const { data, error } = useSummary();

  if (error)
    return (
      <p className="py-10 text-center text-red-600">{error.message}</p>
    );
  if (!data) return <PageSkeleton />;

  const money = [
    {
      icon: <IconWallet className="size-4.5 text-primary" />,
      chip: 'bg-primary/10',
      label: 'ต้นคงเหลือในตลาด',
      value: data.outstandingPrincipal,
      sub: `${data.counts.activeLoans} ยอดปกติ`,
      wide: true,
    },
    {
      icon: (
        <IconAlert className="size-4.5 text-red-600 dark:text-red-400" />
      ),
      chip: 'bg-red-50 dark:bg-red-500/10',
      label: 'ยอดค้างรวม',
      value: data.totalArrears,
      sub: 'ดอกที่ยังไม่ได้เก็บ',
      color: 'text-red-600 dark:text-red-400',
    },
    {
      icon: <IconDoc className="size-4.5 text-sky-600 dark:text-sky-400" />,
      chip: 'bg-sky-50 dark:bg-sky-500/10',
      label: 'ผ่อนงวดคงเหลือ',
      value: data.installmentBalance,
      sub: `${data.counts.installmentLoans} สัญญา · ยอดเป็น`,
    },
    {
      icon: <IconDoc className="size-4.5 text-gray-500 dark:text-gray-400" />,
      chip: 'bg-gray-100 dark:bg-gray-800',
      label: 'ยอดตายคงเหลือ',
      value: data.deadBalance,
      sub: `${data.counts.deadLoans} ยอดตาย`,
    },
    {
      icon: (
        <IconTrendUp
          className={`size-4.5 ${data.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
        />
      ),
      chip:
        data.netProfit >= 0
          ? 'bg-emerald-50 dark:bg-emerald-500/10'
          : 'bg-red-50 dark:bg-red-500/10',
      label: 'กำไรสุทธิ',
      value: data.netProfit,
      sub: 'ดอกเก็บได้ − หนี้สูญ',
      color:
        data.netProfit >= 0
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-red-600 dark:text-red-400',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900 md:text-[1.75rem] dark:text-white">
          ภาพรวมธุรกิจ
        </h1>
        <p className="text-sm leading-relaxed text-slate-500 dark:text-gray-400">
          สรุปเงินต้น ดอก และยอดค้างทั้งหมด
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-200/80 dark:border-gray-800 dark:bg-gray-800">
        <div className="grid grid-cols-2 gap-px lg:grid-cols-5">
          {money.map((c) => (
            <div
              key={c.label}
              className={`bg-white p-4 lg:p-5 dark:bg-gray-900 ${
                c.wide ? 'col-span-2 lg:col-span-1' : ''
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`flex size-9 items-center justify-center rounded-full ${c.chip}`}
                >
                  {c.icon}
                </span>
                <p className="text-[13px] leading-snug text-slate-500 dark:text-gray-400">
                  {c.label}
                </p>
              </div>
              <p
                data-money
                className={`mt-3 text-2xl font-bold tabular-nums tracking-tight ${c.color ?? 'text-slate-900 dark:text-white'}`}
              >
                ฿{baht(c.value)}
              </p>
              <p className="mt-0.5 text-[12px] text-slate-500 dark:text-gray-400">
                {c.sub}
              </p>
            </div>
          ))}
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200/80 bg-white dark:border-gray-800 dark:bg-gray-900">
        <h2 className="flex items-center gap-2 border-b border-slate-100 px-4 py-3.5 text-[13px] font-semibold text-slate-800 dark:border-gray-800 dark:text-white">
          <IconChart className="size-4.5 text-slate-400" />
          เงินหมุนเวียนสะสม
        </h2>
        <dl className="divide-y divide-slate-100 px-4 dark:divide-gray-800">
          <Row label="ต้นปล่อยออกไปทั้งหมด" value={data.totalPrincipalReleased} />
          <Row label="ต้นที่ได้คืนสะสม" value={data.principalCollected} />
          <Row label="ดอกเก็บได้สะสม" value={data.interestCollected} />
          <Row label="หนี้สูญ (ขาดทุน)" value={data.badDebt} danger />
          {data.badDebtRecovered > 0 && (
            <Row label="เก็บคืนได้จากหนี้สูญ" value={data.badDebtRecovered} />
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 py-3">
            <dt className="text-sm text-gray-500 dark:text-gray-400">
              จำนวนยอดกู้
              <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">
                (แตะเพื่อดูรายการ)
              </span>
            </dt>
            <dd className="flex flex-wrap justify-end gap-2 text-sm">
              <CountChip
                status="ACTIVE"
                label="ปกติ"
                count={data.counts.activeLoans}
                cls="bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
              />
              <CountChip
                status="DEAD"
                label="ยอดตาย"
                count={data.counts.deadLoans}
                cls="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
              />
              <CountChip
                status="INSTALLMENT"
                label="ผ่อนงวด"
                count={data.counts.installmentLoans}
                cls="bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400"
              />
              <CountChip
                status="CLOSED"
                label="ปิดแล้ว"
                count={data.counts.closedLoans}
                cls="bg-primary/10 text-primary"
              />
              <CountChip
                status="BAD_DEBT"
                label="หนี้สูญ"
                count={data.counts.badDebtLoans}
                cls="bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
              />
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

/**
 * ชิปจำนวนยอดกู้ — แตะแล้วไปหน้าสัญญาพร้อมกรองสถานะนั้นให้เลย
 * ไม่มียอดในกลุ่มนั้นก็ไม่ต้องกด (โชว์เป็นตัวเลขเฉยๆ)
 */
function CountChip({
  status,
  label,
  count,
  cls,
}: {
  status: LoanStatus;
  label: string;
  count: number;
  cls: string;
}) {
  const base = `rounded-full px-2 py-0.5 text-xs font-medium ${cls}`;
  if (count === 0)
    return (
      <span className={`${base} opacity-60`}>
        {label} {count}
      </span>
    );
  return (
    <Link
      href={`/loans?status=${status}`}
      className={`${base} transition-opacity hover:opacity-80`}
      aria-label={`ดูรายการยอดกู้สถานะ${label} ${count} รายการ`}
    >
      {label} {count}
    </Link>
  );
}

function Row({
  label,
  value,
  danger,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <dt className="text-sm text-gray-500 dark:text-gray-400">{label}</dt>
      <dd
        className={`font-semibold ${danger && value > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}
      >
        {danger && value > 0 ? '−' : ''}฿{baht(value)}
      </dd>
    </div>
  );
}
