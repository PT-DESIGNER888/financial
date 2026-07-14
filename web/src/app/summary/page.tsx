'use client';

import { AuthGate } from '@/components/auth-gate';
import {
  IconAlert,
  IconChart,
  IconCheck,
  IconDoc,
  IconTrendUp,
  IconWallet,
} from '@/components/icons';
import { PageSkeleton } from '@/components/skeleton';
import { baht } from '@/lib/format';
import { useSummary } from '@/lib/hooks/useDashboard';

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
      icon: <IconDoc className="size-4.5 text-gray-500 dark:text-gray-400" />,
      chip: 'bg-gray-100 dark:bg-gray-800',
      label: 'ยอดตาย + ผ่อนสินค้า',
      value: data.deadBalance + data.installmentBalance,
      sub: `${data.counts.deadLoans} ยอดตาย · ${data.counts.installmentLoans} ผ่อนสินค้า`,
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
        <h1 className="text-[1.375rem] font-bold text-slate-900 dark:text-white">
          ภาพรวมธุรกิจ
        </h1>
        <p className="text-[13px] leading-relaxed text-slate-500 dark:text-gray-400">
          สรุปเงินต้น ดอก และยอดค้างทั้งหมด
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-200/80 dark:border-gray-800 dark:bg-gray-800">
        <div className="grid grid-cols-2 gap-px lg:grid-cols-4">
          {money.map((c) => (
            <div key={c.label} className="bg-white p-4 lg:p-5 dark:bg-gray-900">
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
          <div className="flex items-center justify-between py-3">
            <dt className="text-sm text-gray-500 dark:text-gray-400">
              จำนวนยอดกู้
            </dt>
            <dd className="flex flex-wrap justify-end gap-2 text-sm">
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                ปกติ {data.counts.activeLoans}
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                ยอดตาย {data.counts.deadLoans}
              </span>
              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-500/10 dark:text-sky-400">
                ผ่อนสินค้า {data.counts.installmentLoans}
              </span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                ปิดแล้ว {data.counts.closedLoans}
              </span>
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-500/10 dark:text-red-400">
                หนี้สูญ {data.counts.badDebtLoans}
              </span>
            </dd>
          </div>
        </dl>
      </section>
    </div>
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
