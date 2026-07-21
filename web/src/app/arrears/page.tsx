'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AuthGate } from '@/components/auth-gate';
import { TextInput } from '@/components/form';
import {
  IconAlert,
  IconBan,
  IconCoins,
  IconOut,
} from '@/components/icons';
import { PageSkeleton } from '@/components/skeleton';
import { baht, thaiDate } from '@/lib/format';
import { useArrears } from '@/lib/hooks/useDashboard';
import type { ArrearsDebtor, ArrearsRow, ArrearsSection } from '@/lib/types';

export default function ArrearsPage() {
  return (
    <AuthGate>
      <ArrearsView />
    </AuthGate>
  );
}

/**
 * หน้ายอดค้าง — แยกจากหน้าเก็บวันนี้ตามที่ตกลง
 * ส่วนบน = ค้างจ่าย (ดอกที่ถึงกำหนดแล้วไม่ได้จ่าย + งวดผ่อนค้าง)
 * ส่วนล่าง = ยอดตาย (ตรึงยอด ทยอยคืนแบบไม่มีกำหนดตายตัว)
 */
function ArrearsView() {
  const { data, error } = useArrears();
  const [q, setQ] = useState('');

  if (error)
    return (
      <p className="py-10 text-center font-medium text-red-600">
        {error.message}
      </p>
    );
  if (!data) return <PageSkeleton />;

  const filter = (s: ArrearsSection) =>
    s.debtors.filter((d) =>
      d.debtorName.toLowerCase().includes(q.trim().toLowerCase()),
    );
  const empty = data.arrears.debtorCount === 0 && data.dead.debtorCount === 0;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900 md:text-[1.75rem] dark:text-white">
          ยอดค้าง
        </h1>
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
          />
          <Stat
            icon={
              <IconBan className="size-5 text-slate-600 dark:text-gray-400" />
            }
            chip="bg-slate-100 dark:bg-gray-800"
            label="ยอดตายคงเหลือ"
            value={data.dead.total}
            sub={`${data.dead.debtorCount} ราย`}
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
        <TextInput
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหาชื่อลูกหนี้…"
          aria-label="ค้นหาชื่อลูกหนี้"
        />
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

      {data.arrears.debtorCount > 0 && (
        <Section
          title="ค้างจ่าย"
          hint="ดอกที่ถึงกำหนดแล้วยังไม่ได้จ่าย + งวดผ่อนที่ค้าง"
          total={data.arrears.total}
          debtors={filter(data.arrears)}
          tone="danger"
        />
      )}

      {data.dead.debtorCount > 0 && (
        <Section
          title="ยอดตาย"
          hint="ตรึงยอดไว้ ไม่คิดดอกเพิ่ม — ลูกหนี้ทยอยคืนได้ตามสะดวก"
          total={data.dead.total}
          debtors={filter(data.dead)}
          tone="neutral"
        />
      )}
    </div>
  );
}

function Stat({
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
  value: number;
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
    </div>
  );
}

function Section({
  title,
  hint,
  total,
  debtors,
  tone,
}: {
  title: string;
  hint: string;
  total: number;
  debtors: ArrearsDebtor[];
  tone: 'danger' | 'neutral';
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900 md:text-lg dark:text-white">
            {title}
          </h2>
          <p className="mt-0.5 text-[13px] text-slate-500 dark:text-gray-400">
            {hint}
          </p>
        </div>
        <p
          data-money
          className={`text-lg font-bold tabular-nums ${
            tone === 'danger'
              ? 'text-red-700 dark:text-red-400'
              : 'text-slate-900 dark:text-white'
          }`}
        >
          รวม ฿{baht(total)}
        </p>
      </div>

      {debtors.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500 dark:text-gray-400">
          ไม่พบลูกหนี้ที่ค้นหาในกลุ่มนี้
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {debtors.map((d) => (
            <DebtorCard key={d.debtorId} debtor={d} tone={tone} />
          ))}
        </div>
      )}
    </section>
  );
}

function DebtorCard({
  debtor,
  tone,
}: {
  debtor: ArrearsDebtor;
  tone: 'danger' | 'neutral';
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-gray-800 dark:bg-gray-900">
      <Link
        href={`/debtors/${debtor.debtorId}`}
        className="group flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 transition-colors hover:bg-slate-50 dark:border-gray-800 dark:hover:bg-gray-800/60"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate text-base font-semibold text-slate-900 group-hover:text-primary dark:text-white">
            {debtor.debtorName}
          </span>
          <IconOut className="size-4 shrink-0 stroke-[1.5] text-slate-400" />
        </span>
        <span
          data-money
          className={`shrink-0 text-xl font-bold tabular-nums ${
            tone === 'danger'
              ? 'text-red-700 dark:text-red-400'
              : 'text-slate-900 dark:text-white'
          }`}
        >
          ฿{baht(debtor.total)}
        </span>
      </Link>

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
