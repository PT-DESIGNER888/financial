'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AuthGate } from '@/components/auth-gate';
import { buttonClassName, SelectMenu, TextInput } from '@/components/form';
import { IconPlus } from '@/components/icons';
import { PageError } from '@/components/page-error';
import { PageSkeleton } from '@/components/skeleton';
import { baht, cycleLabel, statusLabel, thaiDate } from '@/lib/format';
import { useAllLoans } from '@/lib/hooks/useLoans';
import type { LoanListItem, LoanStatus } from '@/lib/types';

export default function LoansPage() {
  return (
    <AuthGate>
      <Suspense fallback={<PageSkeleton />}>
        <LoansView />
      </Suspense>
    </AuthGate>
  );
}

type Filter = 'ALL' | 'OVERDUE' | LoanStatus;

const filterOptions: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'ทุกสถานะ' },
  { value: 'ACTIVE', label: 'ปกติ' },
  { value: 'OVERDUE', label: 'ค้างชำระ' },
  { value: 'DEAD', label: 'ยอดตาย' },
  { value: 'INSTALLMENT', label: 'ผ่อนงวด' },
  { value: 'CLOSED', label: 'ปิดยอดแล้ว' },
  { value: 'BAD_DEBT', label: 'หนี้สูญ' },
];

const isFilter = (v: string | null): v is Filter =>
  filterOptions.some((o) => o.value === v);

const statusStyle: Record<LoanStatus, string> = {
  ACTIVE:
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  DEAD: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  INSTALLMENT: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400',
  CLOSED: 'bg-primary/10 text-primary',
  BAD_DEBT: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
};

function interestLabel(l: LoanListItem): string {
  if (l.isInstallment)
    return l.amortized
      ? `ลดต้นลดดอก ${l.interestRatePercent}%/งวด (${cycleLabel[l.cycle]})`
      : `ผ่อนดอกคงที่ (${cycleLabel[l.cycle]})`;
  const mode = l.interestMode === 'FLAT' ? 'ดอกคงที่' : 'ดอกลอย';
  return `${mode} ${l.interestRatePercent}%/${cycleLabel[l.cycle]}`;
}

function LoansView() {
  const { data: loans, error, refetch } = useAllLoans();
  const [q, setQ] = useState('');
  // เปิดหน้านี้พร้อมกรองสถานะได้จาก ?status= (มาจากชิปในหน้าภาพรวม)
  const initial = useSearchParams().get('status');
  const [filter, setFilter] = useState<Filter>(
    isFilter(initial) ? initial : 'ALL',
  );

  if (error)
    return (
      <div className="space-y-6">
        <h1 className="sr-only">สัญญาเงินกู้</h1>
        <PageError message={error.message} onRetry={() => void refetch()} />
      </div>
    );
  if (!loans) return <PageSkeleton />;

  const needle = q.trim().toLowerCase();
  const filtered = loans.filter((l) => {
    if (filter === 'OVERDUE' && !l.overdue) return false;
    if (filter !== 'ALL' && filter !== 'OVERDUE' && l.status !== filter)
      return false;
    if (!needle) return true;
    return (
      l.debtorName.toLowerCase().includes(needle) ||
      (l.contractNumber ?? '').toLowerCase().includes(needle)
    );
  });

  const openCount = loans.filter(
    (l) =>
      l.status === 'ACTIVE' ||
      l.status === 'DEAD' ||
      l.status === 'INSTALLMENT',
  ).length;
  const overdueCount = loans.filter((l) => l.overdue).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="sr-only">สัญญาเงินกู้</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400">
            ทั้งหมด {loans.length} สัญญา · เปิดอยู่ {openCount}
            {overdueCount > 0 && (
              <span className="text-red-600 dark:text-red-400">
                {' '}
                · ค้างชำระ {overdueCount}
              </span>
            )}
          </p>
        </div>
        <Link
          href="/loans/new"
          className={buttonClassName({
            size: 'sm',
            className: 'w-full sm:w-auto',
          })}
        >
          <IconPlus className="size-4" />
          สร้างยอดกู้
        </Link>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <div className="min-w-0 flex-1">
          <TextInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาชื่อลูกหนี้ / เลขที่สัญญา…"
            type="search"
            aria-label="ค้นหาสัญญา"
          />
        </div>
        <div className="w-full shrink-0 sm:w-52">
          <SelectMenu
            value={filter}
            onChange={setFilter}
            options={filterOptions}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="grid grid-cols-1 gap-3 p-3 xl:hidden lg:grid-cols-2">
          {filtered.map((l) => (
            <Link
              key={l.id}
              href={`/debtors/${l.debtorId}`}
              className="block space-y-4 rounded-xl border border-slate-200 p-4 transition-colors hover:border-primary/30 hover:bg-slate-50 active:bg-slate-100 dark:border-gray-800 dark:hover:border-primary/40 dark:hover:bg-gray-800/50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900 dark:text-white">
                    {l.debtorName}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-gray-400">
                    เลขที่สัญญา {l.contractNumber ?? '—'}
                  </p>
                </div>
                <div className="flex max-w-[9.5rem] shrink-0 flex-wrap justify-end gap-1">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle[l.status]}`}
                  >
                    {statusLabel[l.status]}
                  </span>
                  {l.overdue && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-500/10 dark:text-red-400">
                      ค้างชำระ
                    </span>
                  )}
                </div>
              </div>

              <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-slate-200 dark:bg-gray-800">
                <MoneyCell label="ต้องชำระ" value={l.totalDue} />
                <MoneyCell label="รับแล้ว" value={l.paidTotal} tone="paid" />
                <MoneyCell label="คงเหลือ" value={l.remaining} tone="remaining" />
              </dl>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Detail label="เงินต้น" value={`฿${baht(l.principalOriginal)}`} />
                <Detail
                  label="งวดถัดไป"
                  value={l.nextDueDate ? thaiDate(l.nextDueDate) : '—'}
                />
                <Detail
                  className="col-span-2"
                  label="ดอกเบี้ย"
                  value={interestLabel(l)}
                />
              </dl>
            </Link>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full py-8 text-center text-gray-500 dark:text-gray-400">
              ไม่พบสัญญา
            </p>
          )}
        </div>

        <div className="hidden overflow-x-auto xl:block">
          <table className="w-full table-fixed text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[13px] font-semibold text-slate-600 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-300">
                <th className="w-[25%] px-5 py-3.5 font-semibold">สัญญา / ลูกหนี้</th>
                <th className="w-[31%] px-4 py-3.5 font-semibold">ยอดชำระ</th>
                <th className="w-[29%] px-4 py-3.5 font-semibold">รายละเอียดสัญญา</th>
                <th className="w-[15%] px-5 py-3.5 font-semibold">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map((l) => (
                <tr
                  key={l.id}
                  className="align-top text-gray-700 transition-colors hover:bg-slate-50 dark:text-gray-300 dark:hover:bg-gray-800/50"
                >
                  <td className="max-w-0 px-5 py-4">
                    <Link
                      href={`/debtors/${l.debtorId}`}
                      className="block truncate font-semibold text-slate-900 hover:text-primary hover:underline dark:text-white"
                    >
                      {l.contractNumber ?? '—'}
                    </Link>
                    <Link
                      href={`/debtors/${l.debtorId}`}
                      className="mt-1 block truncate font-medium text-slate-600 hover:text-primary hover:underline dark:text-gray-300"
                    >
                      {l.debtorName}
                    </Link>
                  </td>
                  <td className="px-4 py-4">
                    <div className="grid min-w-0 grid-cols-3 gap-2 xl:gap-3">
                      <TableMoney label="ต้องชำระ" value={l.totalDue} />
                      <TableMoney label="รับแล้ว" value={l.paidTotal} tone="paid" />
                      <TableMoney label="คงเหลือ" value={l.remaining} tone="remaining" />
                    </div>
                  </td>
                  <td className="min-w-0 px-4 py-4">
                    <p className="font-medium text-slate-800 tabular-nums dark:text-gray-200">
                      เงินต้น ฿{baht(l.principalOriginal)}
                    </p>
                    <p className="mt-1 text-[13px] leading-snug break-words text-slate-500 dark:text-gray-400">
                      {interestLabel(l)}
                    </p>
                    <p className="mt-1.5 text-[13px] font-medium text-slate-600 dark:text-gray-300">
                      งวดถัดไป {l.nextDueDate ? thaiDate(l.nextDueDate) : '—'}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle[l.status]}`}
                      >
                        {statusLabel[l.status]}
                      </span>
                    {l.overdue && (
                      <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-400">
                        ค้างชำระ
                      </span>
                    )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="py-8 text-center text-gray-500 dark:text-gray-400"
                  >
                    ไม่พบสัญญา
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

function MoneyCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'paid' | 'remaining';
}) {
  const color =
    tone === 'paid'
      ? 'text-emerald-700 dark:text-emerald-400'
      : tone === 'remaining'
        ? 'text-slate-900 dark:text-white'
        : 'text-slate-700 dark:text-gray-200';
  return (
    <div className="min-w-0 bg-white px-1.5 py-2.5 sm:px-2.5 sm:py-3 dark:bg-gray-900">
      <dt className="text-[11px] leading-tight text-slate-500 dark:text-gray-400">
        {label}
      </dt>
      <dd
        className={`mt-1 text-[13px] font-bold leading-tight break-words tabular-nums sm:text-[15px] ${color}`}
      >
        ฿{baht(value)}
      </dd>
    </div>
  );
}

function Detail({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs text-slate-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-0.5 font-medium leading-snug text-slate-700 dark:text-gray-300">{value}</dd>
    </div>
  );
}

function TableMoney({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'paid' | 'remaining';
}) {
  const color =
    tone === 'paid'
      ? 'text-emerald-700 dark:text-emerald-400'
      : tone === 'remaining'
        ? 'text-slate-900 dark:text-white'
        : 'text-slate-700 dark:text-gray-200';
  return (
    <div className="min-w-0">
      <p className="text-[12px] text-slate-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 text-[13px] font-bold leading-tight break-words tabular-nums xl:text-sm ${color}`}>
        ฿{baht(value)}
      </p>
    </div>
  );
}
