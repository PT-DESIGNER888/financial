'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AuthGate } from '@/components/auth-gate';
import {
  IconAlert,
  IconCheck,
  IconClock,
  IconDoc,
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
      <p className="py-10 text-center text-red-600">{error.message}</p>
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
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          เก็บวันนี้
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          รายการที่ถึงกำหนดและยอดค้างของวันนี้
        </p>
      </div>

      {/* แถว stat เดียวคั่นเส้นแบบ reference (gap-px บนพื้นสีเส้น) */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-200 dark:border-gray-800 dark:bg-gray-800">
        <div className="grid grid-cols-2 gap-px lg:grid-cols-4">
          <StatCell
            icon={<IconClock className="size-4.5 text-amber-600 dark:text-amber-400" />}
            chip="bg-amber-50 dark:bg-amber-500/10"
            label="ต้องเก็บอีก"
            value={`฿${baht(totalToCollect)}`}
            sub={`${unpaidAll.length} ราย`}
          />
          <StatCell
            icon={<IconCheck className="size-4.5 text-emerald-600 dark:text-emerald-400" />}
            chip="bg-emerald-50 dark:bg-emerald-500/10"
            label="เก็บได้แล้ววันนี้"
            value={`฿${baht(collectedToday)}`}
            sub={`${paidAll.length} ราย`}
          />
          <StatCell
            icon={<IconDoc className="size-4.5 text-primary" />}
            chip="bg-primary/10"
            label="ยอดเปิดทั้งหมด"
            value={`${data.allOpen}`}
            sub="ยอดกู้"
          />
          <StatCell
            icon={<IconAlert className="size-4.5 text-red-600 dark:text-red-400" />}
            chip="bg-red-50 dark:bg-red-500/10"
            label="มียอดค้าง"
            value={`${data.items.filter((i) => i.arrears > 0).length}`}
            sub="ราย"
          />
        </div>
      </div>

      {/* ค้นหาเร็วระหว่างออกเก็บ — เจอคนตรงหน้าไม่ต้องไล่เลื่อน */}
      {data.items.length > 0 && (
        <TextInput
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหาชื่อลูกหนี้…"
        />
      )}

      {unpaidAll.length === 0 && paidAll.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white py-10 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="font-medium text-gray-900 dark:text-white">
            วันนี้ไม่มีรายการต้องเก็บ
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            เมื่อมียอดถึงกำหนดหรือยอดค้าง จะแสดงที่หน้านี้
          </p>
        </div>
      )}

      {q.trim() !== '' && unpaid.length === 0 && paid.length === 0 && data.items.length > 0 && (
        <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
          ไม่พบ &ldquo;{q}&rdquo; ในรายการวันนี้
        </p>
      )}

      {unpaid.length > 0 && (
        <ListCard title={`ยังไม่จ่าย (${unpaid.length})`}>
          {unpaid.map((item) => (
            <ItemRow
              key={item.loanId}
              item={item}
              onPay={() => setPaying(item)}
            />
          ))}
        </ListCard>
      )}

      {paid.length > 0 && (
        <ListCard title={`จ่ายแล้ววันนี้ (${paid.length})`}>
          {paid.map((item) => (
            <ItemRow
              key={item.loanId}
              item={item}
              onPay={() => setPaying(item)}
            />
          ))}
        </ListCard>
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
}: {
  icon: React.ReactNode;
  chip: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-white p-4 lg:p-5 dark:bg-gray-900">
      <div className="flex items-center gap-2.5">
        <span
          className={`flex size-9 items-center justify-center rounded-full ${chip}`}
        >
          {icon}
        </span>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{sub}</p>
    </div>
  );
}

function ListCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <h2 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900 dark:border-gray-800 dark:text-white">
        {title}
      </h2>
      <div className="divide-y divide-gray-100 px-4 dark:divide-gray-800">
        {children}
      </div>
    </section>
  );
}

function StatusBadge({ paid }: { paid: boolean }) {
  return paid ? (
    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
      จ่ายแล้ว
    </span>
  ) : (
    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-500/10 dark:text-red-400">
      ยังไม่จ่าย
    </span>
  );
}

function ItemRow({ item, onPay }: { item: TodayItem; onPay: () => void }) {
  const done = item.remainingToday <= 0;
  const frozen = item.status === 'DEAD' || item.status === 'INSTALLMENT';
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <Link href={`/debtors/${item.debtorId}`} className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 font-medium text-gray-900 dark:text-white">
          <span className="truncate">{item.debtorName}</span>
          <StatusBadge paid={done} />
          {item.status === 'DEAD' && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              ยอดตาย
            </span>
          )}
          {item.status === 'INSTALLMENT' && (
            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-500/10 dark:text-sky-400">
              ผ่อนสินค้า
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {cycleLabel[item.cycle]} · {frozen ? 'ผ่อนเหลือ' : 'ต้นเหลือ'} ฿
          {baht(frozen ? item.deadBalance : item.outstandingPrincipal)}
        </p>
      </Link>
      <div className="text-right text-sm">
        {frozen ? (
          <p className="text-gray-600 dark:text-gray-300">
            งวดนี้{' '}
            <b className="text-gray-900 dark:text-white">
              ฿{baht(item.dueInstallment)}
            </b>
          </p>
        ) : (
          <>
            {item.dueInterest > 0 && (
              <p className="text-gray-600 dark:text-gray-300">
                ดอกวันนี้{' '}
                <b className="text-gray-900 dark:text-white">
                  ฿{baht(item.dueInterest)}
                </b>
              </p>
            )}
            {item.arrears > 0 && (
              <p className="text-xs text-red-600 dark:text-red-400">
                ค้างเก่า ฿{baht(item.arrears)}
              </p>
            )}
          </>
        )}
        {item.paidToday > 0 && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            จ่ายแล้ว ฿{baht(item.paidToday)}
          </p>
        )}
      </div>
      <Button size="sm" onClick={onPay}>
        รับเงิน
      </Button>
    </div>
  );
}
