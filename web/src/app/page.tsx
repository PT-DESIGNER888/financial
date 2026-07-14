'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AuthGate } from '@/components/auth-gate';
import {
  IconAlert,
  IconBanknote,
  IconCheck,
  IconClock,
  IconCycle,
  IconDoc,
  IconOut,
  IconReceive,
  IconToday,
  IconUser,
} from '@/components/icons';
import { Button, TextInput } from '@/components/form';
import { PaymentModal } from '@/components/payment-modal';
import { PageSkeleton } from '@/components/skeleton';
import { baht, cycleLabel } from '@/lib/format';
import { useToday } from '@/lib/hooks/useDashboard';
import type { TodayItem } from '@/lib/types';

export default function TodayPage() {
  return (
    <AuthGate>
      <TodayView />
    </AuthGate>
  );
}

function TodayView() {
  const { data, error } = useToday();
  const [paying, setPaying] = useState<TodayItem | null>(null);
  const [q, setQ] = useState('');

  if (error)
    return (
      <p className="py-10 text-center font-medium text-red-600">
        {error.message}
      </p>
    );
  if (!data) return <PageSkeleton />;

  // สรุปยอดคิดจากทั้งหมด — ช่องค้นหากรองเฉพาะรายการที่แสดง
  const unpaidAll = data.items.filter((i) => i.remainingToday > 0);
  const paidAll = data.items.filter((i) => i.remainingToday <= 0);
  const totalToCollect = unpaidAll.reduce((s, i) => s + i.remainingToday, 0);
  const collectedToday = data.items.reduce((s, i) => s + i.paidToday, 0);

  const match = (i: TodayItem) =>
    i.debtorName.toLowerCase().includes(q.trim().toLowerCase());
  const unpaid = unpaidAll.filter(match);
  const paid = paidAll.filter(match);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900 md:text-[1.75rem] dark:text-white">
          เก็บวันนี้
        </h1>
        <p className="text-sm leading-relaxed text-slate-500 dark:text-gray-400">
          รายการที่ถึงกำหนดและยอดค้างของวันนี้ — แตะรับเงินได้ทันที
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-200/80 dark:border-gray-800 dark:bg-gray-800">
        <div className="grid grid-cols-2 gap-px lg:grid-cols-4">
          <StatCell
            icon={
              <IconClock className="size-5 text-amber-600 dark:text-amber-400" />
            }
            chip="bg-amber-50 dark:bg-amber-500/10"
            label="ต้องเก็บอีก"
            value={`฿${baht(totalToCollect)}`}
            sub={`${unpaidAll.length} ราย`}
            emphasize
          />
          <StatCell
            icon={
              <IconCheck className="size-5 text-emerald-600 dark:text-emerald-400" />
            }
            chip="bg-emerald-50 dark:bg-emerald-500/10"
            label="เก็บได้แล้ววันนี้"
            value={`฿${baht(collectedToday)}`}
            sub={`${paidAll.length} ราย`}
          />
          <StatCell
            icon={<IconDoc className="size-5 text-primary" />}
            chip="bg-primary/10"
            label="ยอดเปิดทั้งหมด"
            value={`${data.allOpen}`}
            sub="ยอดกู้"
          />
          <StatCell
            icon={
              <IconAlert className="size-5 text-red-600 dark:text-red-400" />
            }
            chip="bg-red-50 dark:bg-red-500/10"
            label="มียอดค้าง"
            value={`${data.items.filter((i) => i.arrears > 0).length}`}
            sub="ราย"
          />
        </div>
      </div>

      {data.items.length > 0 && (
        <TextInput
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหาชื่อลูกหนี้…"
          aria-label="ค้นหาชื่อลูกหนี้"
        />
      )}

      {unpaidAll.length === 0 && paidAll.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center dark:border-gray-800 dark:bg-gray-900">
          <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
            <IconCheck className="size-6" />
          </span>
          <p className="text-[15px] font-semibold text-slate-900 dark:text-white">
            วันนี้ไม่มีรายการต้องเก็บ
          </p>
          <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-slate-500 dark:text-gray-400">
            เมื่อมียอดถึงกำหนดหรือยอดค้าง จะโชว์ที่หน้านี้ให้ออกเก็บได้เลย
          </p>
        </div>
      )}

      {q.trim() !== '' &&
        unpaid.length === 0 &&
        paid.length === 0 &&
        data.items.length > 0 && (
          <p className="py-8 text-center text-sm text-slate-500 dark:text-gray-400">
            ไม่พบ &ldquo;{q}&rdquo; ในรายการวันนี้
          </p>
        )}

      {unpaid.length > 0 && (
        <DueTable
          title="รายการที่ยังไม่จ่าย"
          count={unpaid.length}
          items={unpaid}
          onPay={setPaying}
        />
      )}

      {paid.length > 0 && (
        <DueTable
          title="จ่ายแล้ววันนี้"
          count={paid.length}
          items={paid}
          onPay={setPaying}
          paid
        />
      )}

      {paying && (
        <PaymentModal
          loanId={paying.loanId}
          debtorName={paying.debtorName}
          frozen={paying.status === 'DEAD' || paying.status === 'INSTALLMENT'}
          quickAmounts={[
            { label: 'ยอดวันนี้', amount: paying.remainingToday },
          ]}
          onClose={() => setPaying(null)}
          onSaved={() => setPaying(null)}
        />
      )}
    </div>
  );
}

function StatCell({
  icon,
  chip,
  label,
  value,
  sub,
  emphasize,
}: {
  icon: React.ReactNode;
  chip: string;
  label: string;
  value: string;
  sub: string;
  emphasize?: boolean;
}) {
  return (
    <div className="bg-white p-4 lg:p-6 dark:bg-gray-900">
      <div className="flex items-center gap-2.5">
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-full md:size-10 ${chip}`}
        >
          {icon}
        </span>
        <p className="text-[13px] leading-snug text-slate-500 md:text-sm dark:text-gray-400">
          {label}
        </p>
      </div>
      <p
        data-money
        className={`mt-3 font-bold tracking-tight text-slate-900 tabular-nums dark:text-white ${
          emphasize
            ? 'text-[1.625rem] md:text-3xl'
            : 'text-2xl md:text-[1.75rem]'
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[12px] text-slate-500 md:text-[13px] dark:text-gray-400">
        {sub}
      </p>
    </div>
  );
}

function DueTable({
  title,
  count,
  items,
  onPay,
  paid,
}: {
  title: string;
  count: number;
  items: TodayItem[];
  onPay: (item: TodayItem) => void;
  paid?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3.5 md:px-5 dark:border-gray-800">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-slate-900 md:text-lg dark:text-white">
            {title}
          </h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-gray-800 dark:text-gray-300">
            {count} รายการ
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 dark:border-gray-700 dark:text-gray-300">
          <IconToday className="size-4 stroke-[1.5]" />
          วันนี้
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left">
          <caption className="sr-only">รายการที่ถึงกำหนดรับเงิน</caption>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100/90 text-[13px] font-semibold tracking-wide text-slate-700 md:text-sm dark:border-gray-800 dark:bg-gray-800/80 dark:text-gray-200">
              <th scope="col" className="px-4 py-3.5 md:px-5">
                <span className="inline-flex items-center gap-1.5">
                  <IconUser className="size-4 stroke-[1.5] text-slate-500" />
                  ลูกหนี้
                </span>
              </th>
              <th scope="col" className="px-3 py-3.5">
                <span className="inline-flex items-center gap-1.5">
                  <IconCycle className="size-4 stroke-[1.5] text-slate-500" />
                  รอบชำระ
                </span>
              </th>
              <th scope="col" className="px-3 py-3.5 text-right">
                <span className="inline-flex items-center justify-end gap-1.5">
                  <IconBanknote className="size-4 stroke-[1.5] text-slate-500" />
                  ยอดต้องรับ
                </span>
              </th>
              <th scope="col" className="px-4 py-3.5 text-right md:px-5">
                <span className="sr-only">การทำรายการ</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
            {items.map((item) => (
              <DueRow
                key={item.loanId}
                item={item}
                onPay={() => onPay(item)}
                paid={paid}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StatusBadge({ paid }: { paid: boolean }) {
  return paid ? (
    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
      จ่ายแล้ว
    </span>
  ) : (
    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-400">
      ยังไม่จ่าย
    </span>
  );
}

function DueRow({
  item,
  onPay,
  paid,
}: {
  item: TodayItem;
  onPay: () => void;
  paid?: boolean;
}) {
  const done = item.remainingToday <= 0;
  const frozen = item.status === 'DEAD' || item.status === 'INSTALLMENT';
  const amount = done ? item.paidToday : item.remainingToday;

  return (
    <tr className="align-middle">
      <td className="px-4 py-3.5 md:px-5">
        <Link
          href={`/debtors/${item.debtorId}`}
          className="group inline-flex max-w-full items-center gap-1.5 rounded-lg text-left transition-colors hover:text-primary"
        >
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="truncate text-[15px] font-semibold text-slate-900 group-hover:text-primary md:text-base dark:text-white">
                {item.debtorName}
              </span>
              <StatusBadge paid={!!done} />
              {item.status === 'DEAD' && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-gray-800 dark:text-gray-400">
                  ยอดตาย
                </span>
              )}
              {item.status === 'INSTALLMENT' && (
                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-400">
                  ผ่อนงวด
                </span>
              )}
            </span>
            <span className="mt-0.5 block text-[12px] text-slate-500 dark:text-gray-400">
              {frozen ? 'ผ่อนเหลือ' : 'ต้นเหลือ'}{' '}
              <span data-money className="tabular-nums">
                ฿{baht(frozen ? item.deadBalance : item.outstandingPrincipal)}
              </span>
              {!frozen && item.arrears > 0 && (
                <span className="text-red-600 dark:text-red-400">
                  {' '}
                  · ค้าง ฿{baht(item.arrears)}
                </span>
              )}
            </span>
          </span>
          <IconOut className="size-4 shrink-0 stroke-[1.5] text-slate-400 opacity-0 transition-opacity group-hover:opacity-100" />
        </Link>
      </td>
      <td className="px-3 py-3.5 text-[15px] text-slate-700 dark:text-gray-300">
        {cycleLabel[item.cycle]}
      </td>
      <td className="px-3 py-3.5 text-right">
        <p
          data-money
          className={`text-base font-bold tabular-nums ${
            paid
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-slate-900 dark:text-white'
          }`}
        >
          ฿{baht(amount)}
        </p>
        {item.paidToday > 0 && !paid && (
          <p className="mt-0.5 text-[12px] font-medium text-emerald-600 tabular-nums dark:text-emerald-400">
            จ่ายแล้ว ฿{baht(item.paidToday)}
          </p>
        )}
      </td>
      <td className="px-4 py-3.5 text-right md:px-5">
        <Button
          onClick={onPay}
          variant={paid ? 'secondary' : 'primary'}
          className="min-w-[7rem]"
        >
          <IconReceive className="size-[1.125rem] stroke-[1.5]" />
          {paid ? 'รับเพิ่ม' : 'รับเงิน'}
        </Button>
      </td>
    </tr>
  );
}
