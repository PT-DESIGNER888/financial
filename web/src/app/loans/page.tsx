'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AuthGate } from '@/components/auth-gate';
import { Button, SelectMenu, TextInput } from '@/components/form';
import { IconPlus } from '@/components/icons';
import { NewLoanModal } from '@/components/new-loan-modal';
import { PageSkeleton } from '@/components/skeleton';
import { baht, cycleLabel, statusLabel, thaiDate } from '@/lib/format';
import { useAllLoans } from '@/lib/hooks/useLoans';
import type { LoanListItem, LoanStatus } from '@/lib/types';

export default function LoansPage() {
  return (
    <AuthGate>
      <LoansView />
    </AuthGate>
  );
}

type Filter = 'ALL' | 'OVERDUE' | LoanStatus;

const filterOptions: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'ทุกสถานะ' },
  { value: 'ACTIVE', label: 'ปกติ' },
  { value: 'OVERDUE', label: 'ค้างชำระ' },
  { value: 'DEAD', label: 'ยอดตาย' },
  { value: 'INSTALLMENT', label: 'ผ่อนสินค้า' },
  { value: 'CLOSED', label: 'ปิดยอดแล้ว' },
  { value: 'BAD_DEBT', label: 'หนี้สูญ' },
];

const statusStyle: Record<LoanStatus, string> = {
  ACTIVE:
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  DEAD: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  INSTALLMENT: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400',
  CLOSED: 'bg-primary/10 text-primary',
  BAD_DEBT: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
};

function interestLabel(l: LoanListItem): string {
  if (l.isInstallment) return `ผ่อนสินค้า (${cycleLabel[l.cycle]})`;
  const mode = l.interestMode === 'FLAT' ? 'ดอกคงที่' : 'ดอกลอย';
  return `${mode} ${l.interestRatePercent}%/${cycleLabel[l.cycle]}`;
}

function LoansView() {
  const { data: loans, error } = useAllLoans();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [creating, setCreating] = useState(false);

  if (error)
    return <p className="py-10 text-center text-red-600">{error.message}</p>;
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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            สัญญาเงินกู้
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            ทั้งหมด {loans.length} สัญญา · เปิดอยู่ {openCount}
            {overdueCount > 0 && (
              <span className="text-red-600 dark:text-red-400">
                {' '}
                · ค้างชำระ {overdueCount}
              </span>
            )}
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <IconPlus className="size-4" />
          สร้างยอดกู้
        </Button>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <TextInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="🔍 ค้นหาชื่อลูกหนี้ / เลขที่สัญญา…"
          />
        </div>
        <div className="w-40 shrink-0">
          <SelectMenu value={filter} onChange={setFilter} options={filterOptions} />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold tracking-wider text-gray-500 uppercase dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-400">
                <th className="px-4 py-2.5 font-semibold">เลขที่สัญญา</th>
                <th className="px-3 py-2.5 font-semibold">ลูกหนี้</th>
                <th className="px-3 py-2.5 text-right font-semibold">เงินต้น</th>
                <th className="px-3 py-2.5 font-semibold">ดอกเบี้ย</th>
                <th className="px-3 py-2.5 text-right font-semibold">
                  ต้องชำระรวม
                </th>
                <th className="px-3 py-2.5 text-right font-semibold">
                  ชำระแล้ว
                </th>
                <th className="px-3 py-2.5 text-right font-semibold">
                  คงเหลือ
                </th>
                <th className="px-3 py-2.5 font-semibold">งวดถัดไป</th>
                <th className="px-4 py-2.5 text-right font-semibold">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map((l) => (
                <tr
                  key={l.id}
                  className="text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/50"
                >
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <Link
                      href={`/debtors/${l.debtorId}`}
                      className="font-medium text-gray-900 hover:text-primary hover:underline dark:text-white"
                    >
                      {l.contractNumber ?? '—'}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/debtors/${l.debtorId}`}
                      className="hover:text-primary hover:underline"
                    >
                      {l.debtorName}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    ฿{baht(l.principalOriginal)}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                    {interestLabel(l)}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    ฿{baht(l.totalDue)}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap text-emerald-600 dark:text-emerald-400">
                    ฿{baht(l.paidTotal)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap text-gray-900 dark:text-white">
                    ฿{baht(l.remaining)}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                    {l.nextDueDate ? thaiDate(l.nextDueDate) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle[l.status]}`}
                    >
                      {statusLabel[l.status]}
                    </span>
                    {l.overdue && (
                      <span className="ml-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-500/10 dark:text-red-400">
                        ค้างชำระ
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
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

      {creating && (
        <NewLoanModal
          onClose={() => setCreating(false)}
          onSaved={() => setCreating(false)}
        />
      )}
    </div>
  );
}
