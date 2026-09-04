'use client';

import { use, useState } from 'react';
import { AuthGate } from '@/components/auth-gate';
import { BackButton } from '@/components/back-button';
import { Button } from '@/components/form';
import { IconCopy, IconPrinter } from '@/components/icons';
import { PageError } from '@/components/page-error';
import { PageSkeleton } from '@/components/skeleton';
import {
  baht,
  cycleLabel,
  thaiDate,
  thaiDateLong,
  todayISO,
} from '@/lib/format';
import { useBill } from '@/lib/hooks/useDashboard';
import { toast } from '@/lib/toast-store';
import type { BillData, TodayItem } from '@/lib/types';

/**
 * ยอดของสัญญาหนึ่งเป็นตัวเลขเดียวตามที่ต้องส่งวันนี้
 * (ดอก + นัดคืนต้น + งวดผ่อน รวมกันแล้ว) — ไม่แยกบรรทัดให้อ่านยาก
 */
function dueLines(item: TodayItem): { label: string; amount: number }[] {
  if (!(item.dueTotal > 0)) return [];
  let label: string;
  if (item.status === 'DEAD') label = 'ผ่อนยอดตาย';
  else if (item.status === 'INSTALLMENT') label = 'ผ่อนงวด';
  else if (item.duePrincipal > 0) label = 'นัดคืนต้น';
  else if (item.interestDueDate) label = 'นัดเก็บดอก';
  else label = `ดอก${cycleLabel[item.cycle]}`;
  return [{ label, amount: item.dueTotal }];
}

export default function BillPage({
  params,
  searchParams,
}: {
  params: Promise<{ debtorId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { debtorId } = use(params);
  const { date } = use(searchParams);
  return (
    <AuthGate>
      <BillView debtorId={debtorId} date={date ?? todayISO()} />
    </AuthGate>
  );
}

/** บิลแจ้งยอด — จัดหน้าให้แคปหน้าจอส่งให้ลูกหนี้ได้เลย */
function BillView({ debtorId, date }: { debtorId: string; date: string }) {
  const { data, error, refetch } = useBill(debtorId, date);
  const [copying, setCopying] = useState(false);

  if (error)
    return (
      <div className="space-y-4">
        <BackButton href="/" label="เก็บวันนี้" />
        <PageError message={error.message} onRetry={() => void refetch()} />
      </div>
    );
  if (!data) return <PageSkeleton />;

  const copy = async () => {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(billText(data));
      toast('คัดลอกข้อความบิลแล้ว');
    } catch {
      toast('คัดลอกไม่สำเร็จ');
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="print:hidden">
        <BackButton href="/" label="เก็บวันนี้" />
      </div>

      <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-gray-800 dark:bg-gray-900 print:border-0">
        <header className="border-b border-dashed border-slate-200 px-5 py-5 text-center dark:border-gray-700">
          <p className="text-[13px] font-medium tracking-wide text-slate-500 dark:text-gray-400">
            แจ้งยอดชำระ
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {data.debtorName}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
            {thaiDateLong(data.date)}
          </p>
        </header>

        <section className="space-y-2.5 px-5 py-4">
          <h2 className="text-[13px] font-semibold tracking-wide text-slate-500 dark:text-gray-400">
            รายการวันนี้
          </h2>
          {data.items.length === 0 ? (
            <p className="py-2 text-sm text-slate-500 dark:text-gray-400">
              วันนี้ไม่มียอดถึงกำหนด
            </p>
          ) : (
            <ul className="space-y-3">
              {data.items.map((item) => (
                <li key={item.loanId} className="space-y-1">
                  {dueLines(item).map((line) => (
                    <div key={line.label} className="flex justify-between gap-3">
                      <p className="min-w-0 text-[15px] text-slate-700 dark:text-gray-200">
                        {line.label}
                      </p>
                      <span
                        data-money
                        className="shrink-0 text-[15px] font-semibold text-slate-900 tabular-nums dark:text-white"
                      >
                        ฿{baht(line.amount)}
                      </span>
                    </div>
                  ))}
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    {item.status === 'ACTIVE'
                      ? `ต้นเหลือ ฿${baht(item.outstandingPrincipal)}`
                      : `ยอดเหลือ ฿${baht(item.deadBalance)}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2 border-t border-dashed border-slate-200 px-5 py-4 dark:border-gray-700">
          <Line label="รวมต้องส่งวันนี้" value={data.dueTotal} />
          {data.paidToday > 0 && (
            <Line label="ส่งมาแล้ววันนี้" value={-data.paidToday} positive />
          )}
          <div className="flex items-baseline justify-between gap-3 pt-1">
            <span className="text-[15px] font-semibold text-slate-900 dark:text-white">
              ต้องส่งอีก
            </span>
            <span
              data-money
              className="text-3xl font-bold text-primary tabular-nums"
            >
              ฿{baht(data.remainingToday)}
            </span>
          </div>
        </section>

        <section className="space-y-2 border-t border-dashed border-slate-200 bg-slate-50 px-5 py-4 dark:border-gray-700 dark:bg-gray-800/60">
          <h2 className="text-[13px] font-semibold tracking-wide text-slate-500 dark:text-gray-400">
            ยอดคงเหลือทั้งหมด
          </h2>
          <Line label="เงินต้นคงเหลือ" value={data.outstandingPrincipal} muted />
          {data.arrearsTotal > 0 && (
            <Line label="ยอดค้างสะสม" value={data.arrearsTotal} danger />
          )}
          {data.installmentBalance > 0 && (
            <Line label="ยอดผ่อนคงเหลือ" value={data.installmentBalance} muted />
          )}
          {data.installmentOverdue > 0 && (
            <Line
              label="— งวดที่เลยกำหนดแล้ว"
              value={data.installmentOverdue}
              danger
            />
          )}
          {data.deadTotal > 0 && (
            <Line label="ยอดตายคงเหลือ" value={data.deadTotal} muted />
          )}
          <div className="flex items-baseline justify-between gap-3 border-t border-slate-200 pt-2 dark:border-gray-700">
            <span className="text-[15px] font-semibold text-slate-900 dark:text-white">
              รวมทั้งหมด
            </span>
            <span
              data-money
              className="text-xl font-bold text-slate-900 tabular-nums dark:text-white"
            >
              ฿{baht(data.balanceTotal)}
            </span>
          </div>
        </section>

        <footer className="border-t border-dashed border-slate-200 px-5 py-3 text-center text-xs text-slate-400 dark:border-gray-700 dark:text-gray-500">
          ออกบิล {thaiDate(todayISO())}
        </footer>
      </article>

      <div className="flex gap-2 print:hidden">
        <Button
          variant="secondary"
          onClick={() => void copy()}
          disabled={copying}
          className="flex-1"
        >
          <IconCopy className="size-[1.125rem] stroke-[1.5]" />
          คัดลอกข้อความ
        </Button>
        <Button
          variant="secondary"
          onClick={() => window.print()}
          className="flex-1"
        >
          <IconPrinter className="size-[1.125rem] stroke-[1.5]" />
          พิมพ์
        </Button>
      </div>
    </div>
  );
}

function Line({
  label,
  value,
  muted,
  danger,
  positive,
}: {
  label: string;
  value: number;
  muted?: boolean;
  danger?: boolean;
  positive?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span
        className={`text-sm ${muted ? 'text-slate-500 dark:text-gray-400' : 'text-slate-600 dark:text-gray-300'}`}
      >
        {label}
      </span>
      <span
        data-money
        className={`text-[15px] font-semibold tabular-nums ${
          danger
            ? 'text-red-600 dark:text-red-400'
            : positive
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-slate-900 dark:text-white'
        }`}
      >
        {positive ? '−' : ''}฿{baht(Math.abs(value))}
      </span>
    </div>
  );
}

/** บิลเวอร์ชันข้อความ — เผื่อส่งทางแชทแทนการแคปหน้าจอ */
function billText(b: BillData): string {
  const lines = [
    `แจ้งยอดชำระ — ${b.debtorName}`,
    thaiDateLong(b.date),
    '',
    ...b.items.flatMap((i) =>
      dueLines(i).map((l) => `- ${l.label} ฿${baht(l.amount)}`),
    ),
    '',
    `รวมต้องส่งวันนี้ ฿${baht(b.dueTotal)}`,
  ];
  if (b.paidToday > 0) lines.push(`ส่งมาแล้ว ฿${baht(b.paidToday)}`);
  lines.push(`ต้องส่งอีก ฿${baht(b.remainingToday)}`, '');
  lines.push(`เงินต้นคงเหลือ ฿${baht(b.outstandingPrincipal)}`);
  if (b.arrearsTotal > 0) lines.push(`ยอดค้างสะสม ฿${baht(b.arrearsTotal)}`);
  if (b.installmentBalance > 0)
    lines.push(`ยอดผ่อนคงเหลือ ฿${baht(b.installmentBalance)}`);
  if (b.installmentOverdue > 0)
    lines.push(`  งวดที่เลยกำหนดแล้ว ฿${baht(b.installmentOverdue)}`);
  if (b.deadTotal > 0) lines.push(`ยอดตายคงเหลือ ฿${baht(b.deadTotal)}`);
  lines.push(`รวมทั้งหมด ฿${baht(b.balanceTotal)}`);
  return lines.join('\n');
}
