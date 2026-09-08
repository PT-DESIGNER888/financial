'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AuthGate } from '@/components/auth-gate';
import { CombinedArrearsModal } from '@/components/combined-arrears-modal';
import { SelectMenu, TextInput } from '@/components/form';
import { IconAlert, IconBan, IconCoins, IconOut } from '@/components/icons';
import { PageError } from '@/components/page-error';
import { PageSkeleton } from '@/components/skeleton';
import type { ArrearsReceiveItem } from '@/lib/arrears-receive';
import { baht, thaiDate, todayISO } from '@/lib/format';
import { useArrears } from '@/lib/hooks/useDashboard';
import type { ArrearsDebtor, ArrearsRow, ArrearsSection } from '@/lib/types';

export default function ArrearsPage() {
  return (
    <AuthGate>
      <ArrearsView />
    </AuthGate>
  );
}

type ArrearsTab = 'ARREARS' | 'DEAD';
type ArrearsSort = 'TOTAL_DESC' | 'TOTAL_ASC' | 'NAME_ASC';

const tabs: { key: ArrearsTab; label: string; hint: string }[] = [
  {
    key: 'ARREARS',
    label: 'ค้างจ่าย',
    hint: 'ดอกที่ถึงกำหนดแล้วยังไม่ได้จ่าย + งวดผ่อนที่ค้าง',
  },
  {
    key: 'DEAD',
    label: 'ยอดตาย',
    hint: 'ตรึงยอดไว้ ไม่คิดดอกเพิ่ม — ลูกหนี้ทยอยคืนได้ตามสะดวก',
  },
];

const sortOptions: { value: ArrearsSort; label: string }[] = [
  { value: 'TOTAL_DESC', label: 'เรียง: ยอดมาก → น้อย' },
  { value: 'TOTAL_ASC', label: 'เรียง: ยอดน้อย → มาก' },
  { value: 'NAME_ASC', label: 'เรียง: ชื่อลูกหนี้' },
];

/**
 * หน้ายอดค้าง — สรุปด้านบนคงแบบเดิม
 * แท็บแค่สลับรายการค้างจ่าย / ยอดตาย ไม่ดึงตัวเลขไปซ้ำ
 */
function ArrearsView() {
  const { data, error, refetch } = useArrears();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<ArrearsTab>('ARREARS');
  const [sort, setSort] = useState<ArrearsSort>('TOTAL_DESC');
  const [receiving, setReceiving] = useState<ArrearsDebtor | null>(null);

  if (error)
    return (
      <div className="space-y-6">
        <h1 className="sr-only">ยอดค้าง</h1>
        <PageError message={error.message} onRetry={() => void refetch()} />
      </div>
    );
  if (!data) return <PageSkeleton />;

  const filter = (s: ArrearsSection) =>
    sortDebtors(
      s.debtors.filter((d) => {
        const needle = q.trim().toLowerCase();
        if (!needle) return true;
        return (
          d.debtorName.toLowerCase().includes(needle) ||
          d.rows.some((row) =>
            (row.contractNumber ?? '').toLowerCase().includes(needle),
          )
        );
      }),
      sort,
    );
  const empty = data.arrears.debtorCount === 0 && data.dead.debtorCount === 0;
  const selected = tab === 'ARREARS' ? data.arrears : data.dead;
  const selectedTab = tabs.find((t) => t.key === tab)!;
  const debtors = filter(selected);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="sr-only">ยอดค้าง</h1>
        <p className="text-sm leading-relaxed text-slate-500 dark:text-gray-400">
          ใครค้างอยู่บ้าง คนละเท่าไหร่ — แยกจาก
          <Link href="/" className="mx-1 font-medium text-primary">
            หน้าเก็บวันนี้
          </Link>
          เพื่อให้ดูง่าย
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-200/80 dark:border-gray-800 dark:bg-gray-800">
        <div className="grid grid-cols-1 gap-px sm:grid-cols-3">
          <Stat
            icon={
              <IconAlert className="size-5 text-red-600 dark:text-red-400" />
            }
            chip="bg-red-50 dark:bg-red-500/10"
            label="ค้างจ่ายรวม"
            value={data.arrears.total}
            sub={`${data.arrears.debtorCount} ราย`}
            emphasize
            onClick={() => setTab('ARREARS')}
          />
          <Stat
            icon={
              <IconBan className="size-5 text-slate-600 dark:text-gray-400" />
            }
            chip="bg-slate-100 dark:bg-gray-800"
            label="ยอดตายคงเหลือ"
            value={data.dead.total}
            sub={`${data.dead.debtorCount} ราย`}
            onClick={() => setTab('DEAD')}
          />
          <Stat
            icon={<IconCoins className="size-5 text-primary" />}
            chip="bg-primary/10"
            label="รวมทั้งหมด"
            value={data.grandTotal}
            sub="ค้างจ่าย + ยอดตาย"
          />
        </div>
      </div>

      {!empty && (
        <>
          <div
            role="tablist"
            aria-label="เลือกประเภทรายการ"
            className="flex rounded-2xl bg-slate-100 p-1 dark:bg-gray-800"
          >
            {tabs.map((item) => {
              const section = item.key === 'ARREARS' ? data.arrears : data.dead;
              const active = tab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(item.key)}
                  className={`min-h-12 flex-1 rounded-xl px-3 text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-gray-900 dark:text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  {item.label}
                  <span className="ml-1.5 font-medium text-slate-400 tabular-nums dark:text-gray-500">
                    {section.debtorCount}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex-1">
              <TextInput
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ค้นหาชื่อลูกหนี้ / เลขที่สัญญา…"
                aria-label="ค้นหาลูกหนี้หรือเลขที่สัญญา"
              />
            </div>
            <div className="w-full shrink-0 sm:w-56">
              <SelectMenu
                value={sort}
                onChange={setSort}
                options={sortOptions}
              />
            </div>
          </div>

          <p className="text-[13px] leading-relaxed text-slate-500 dark:text-gray-400">
            {selectedTab.hint}
          </p>
        </>
      )}

      {empty && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="text-[15px] font-semibold text-slate-900 dark:text-white">
            ไม่มียอดค้าง
          </p>
          <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-slate-500 dark:text-gray-400">
            ลูกหนี้ทุกคนส่งครบตามรอบ
          </p>
        </div>
      )}

      {!empty &&
        (debtors.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500 dark:text-gray-400">
            ไม่พบลูกหนี้ในกลุ่มนี้
          </p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {debtors.map((d) => (
              <DebtorCard
                key={d.debtorId}
                debtor={d}
                tone={tab === 'ARREARS' ? 'danger' : 'neutral'}
                onReceive={
                  tab === 'ARREARS' ? () => setReceiving(d) : undefined
                }
              />
            ))}
          </div>
        ))}

      {receiving && (
        <CombinedArrearsModal
          debtorName={receiving.debtorName}
          items={toReceiveItems(receiving)}
          paidDate={todayISO()}
          onClose={() => setReceiving(null)}
          onSaved={() => setReceiving(null)}
        />
      )}
    </div>
  );
}

function toReceiveItems(debtor: ArrearsDebtor): ArrearsReceiveItem[] {
  return debtor.rows.map((r) => ({
    loanId: r.loanId,
    contractNumber: r.contractNumber,
    status: r.status,
    amount: r.amount,
  }));
}

function sortDebtors(debtors: ArrearsDebtor[], sort: ArrearsSort) {
  return [...debtors].sort((a, b) => {
    if (sort === 'TOTAL_ASC') return a.total - b.total;
    if (sort === 'NAME_ASC')
      return a.debtorName.localeCompare(b.debtorName, 'th');
    return b.total - a.total;
  });
}

function Stat({
  icon,
  chip,
  label,
  value,
  sub,
  emphasize,
  onClick,
}: {
  icon: React.ReactNode;
  chip: string;
  label: string;
  value: number;
  sub: string;
  emphasize?: boolean;
  onClick?: () => void;
}) {
  const cls = `bg-white p-4 text-left lg:p-6 dark:bg-gray-900 ${
    onClick
      ? 'cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-gray-800'
      : ''
  }`;
  const body = (
    <>
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
        className={`mt-3 font-bold tracking-tight tabular-nums ${
          emphasize
            ? 'text-[1.625rem] text-red-700 md:text-3xl dark:text-red-400'
            : 'text-2xl text-slate-900 md:text-[1.75rem] dark:text-white'
        }`}
      >
        ฿{baht(value)}
      </p>
      <p className="mt-0.5 text-[12px] text-slate-500 md:text-[13px] dark:text-gray-400">
        {sub}
      </p>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function DebtorCard({
  debtor,
  tone,
  onReceive,
}: {
  debtor: ArrearsDebtor;
  tone: 'danger' | 'neutral';
  onReceive?: () => void;
}) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 dark:border-gray-800">
        <Link
          href={`/debtors/${debtor.debtorId}`}
          className="group min-w-0 rounded-lg text-left"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="min-w-0 truncate text-base font-semibold text-slate-900 group-hover:text-primary dark:text-white">
              {debtor.debtorName}
            </span>
            <IconOut className="size-4 shrink-0 stroke-[1.5] text-slate-400" />
          </span>
        </Link>
        <div className="flex shrink-0 flex-col items-end">
          <span
            data-money
            className={`text-xl font-bold tabular-nums ${
              tone === 'danger'
                ? 'text-red-700 dark:text-red-400'
                : 'text-slate-900 dark:text-white'
            }`}
          >
            ฿{baht(debtor.total)}
          </span>
          {onReceive && (
            <button
              type="button"
              onClick={onReceive}
              className="mt-0.5 text-[13px] font-semibold text-primary hover:underline"
            >
              รับรวม
            </button>
          )}
        </div>
      </div>

      <ul className="divide-y divide-slate-100 px-4 dark:divide-gray-800">
        {debtor.rows.map((r) => (
          <li
            key={r.loanId}
            className="flex items-start justify-between gap-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-1.5 text-sm text-slate-600 dark:text-gray-300">
                <span className="truncate">
                  {r.contractNumber ?? 'ไม่มีเลขที่สัญญา'}
                </span>
                <KindChip status={r.status} />
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-gray-400">
                {r.status === 'ACTIVE'
                  ? `ต้นเหลือ ฿${baht(r.outstandingPrincipal)}`
                  : r.installmentAmount
                    ? `ผ่อนงวดละ ฿${baht(r.installmentAmount)}`
                    : 'ทยอยคืน ไม่มีกำหนดตายตัว'}
              </p>
              {r.principalDueDate && (
                <p className="mt-1 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  นัดคืนต้น {thaiDate(r.principalDueDate)}
                  {r.principalDueAmount != null &&
                    ` · ฿${baht(r.principalDueAmount)}`}
                </p>
              )}
              {r.note && (
                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-gray-500">
                  {r.note}
                </p>
              )}
            </div>
            <span
              data-money
              className="shrink-0 text-base font-semibold text-slate-900 tabular-nums dark:text-white"
            >
              ฿{baht(r.amount)}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}

/** ป้ายบอกชนิดยอด — กันสับสนระหว่างผ่อนงวด (จบต้นจบดอก) กับยอดตาย */
function KindChip({ status }: { status: ArrearsRow['status'] }) {
  const style: Partial<Record<ArrearsRow['status'], string>> = {
    ACTIVE: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    INSTALLMENT: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400',
    DEAD: 'bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-gray-400',
  };
  const label: Partial<Record<ArrearsRow['status'], string>> = {
    ACTIVE: 'ดอกค้าง',
    INSTALLMENT: 'ผ่อนงวด',
    DEAD: 'ยอดตาย',
  };
  if (!label[status]) return null;
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${style[status]}`}
    >
      {label[status]}
    </span>
  );
}
