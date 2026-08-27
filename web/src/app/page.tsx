'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AuthGate } from '@/components/auth-gate';
import { DayStrip } from '@/components/day-strip';
import { Button, TextInput, buttonClassName } from '@/components/form';
import {
  IconAlert,
  IconBanknote,
  IconBill,
  IconCheck,
  IconClock,
  IconOut,
  IconOverdue,
  IconReceive,
  IconUsers,
} from '@/components/icons';
import { CombinedReceiveModal } from '@/components/combined-receive-modal';
import { PaymentModal } from '@/components/payment-modal';
import { PageSkeleton } from '@/components/skeleton';
import { baht, cycleLabel, thaiDateLong, todayISO } from '@/lib/format';
import { useToday } from '@/lib/hooks/useDashboard';
import { PaymentType, type TodayDebtor, type TodayItem } from '@/lib/types';

export default function TodayPage() {
  return (
    <AuthGate>
      <TodayView />
    </AuthGate>
  );
}

/** ยอดกู้ที่กำลังจะรับเงิน — เก็บชื่อลูกหนี้ไว้โชว์ในหน้ารับเงิน */
interface PayTarget {
  item: TodayItem;
  debtorName: string;
}

function TodayView() {
  const [date, setDate] = useState(todayISO());
  const { data, error, isFetching } = useToday(date);
  const [paying, setPaying] = useState<PayTarget | null>(null);
  const [combining, setCombining] = useState<TodayDebtor | null>(null);
  const [q, setQ] = useState('');

  if (error)
    return (
      <p className="py-10 text-center font-medium text-red-600">
        {error.message}
      </p>
    );

  const totals = data?.totals;
  const match = (g: TodayDebtor) =>
    g.debtorName.toLowerCase().includes(q.trim().toLowerCase());
  const groups = data?.debtors ?? [];
  const unpaid = groups.filter((g) => g.remainingToday > 0).filter(match);
  const paid = groups.filter((g) => g.remainingToday <= 0).filter(match);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900 md:text-[1.75rem] dark:text-white">
          เก็บวันนี้
        </h1>
        <p className="text-sm leading-relaxed text-slate-500 dark:text-gray-400">
          {thaiDateLong(date)}
          {data && !data.isToday && ' · ดูล่วงหน้า/ย้อนหลัง'} — ยอดค้างสะสมดูแยกที่หน้า
          <Link href="/arrears" className="ml-1 font-medium text-primary">
            ยอดค้าง
          </Link>
        </p>
      </div>

      <DayStrip value={date} onChange={setDate} />

      {!data ? (
        <PageSkeleton />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-200/80 dark:border-gray-800 dark:bg-gray-800">
            <div className="grid grid-cols-2 gap-px lg:grid-cols-4">
              <StatCell
                icon={
                  <IconClock className="size-5 text-amber-600 dark:text-amber-400" />
                }
                chip="bg-amber-50 dark:bg-amber-500/10"
                label="ต้องเก็บอีก"
                value={`฿${baht(totals?.remainingToday ?? 0)}`}
                sub={`${totals?.unpaidCount ?? 0} ราย`}
                emphasize
              />
              <StatCell
                icon={
                  <IconCheck className="size-5 text-emerald-600 dark:text-emerald-400" />
                }
                chip="bg-emerald-50 dark:bg-emerald-500/10"
                label="เก็บได้แล้ว"
                value={`฿${baht(totals?.paidToday ?? 0)}`}
                sub={`${totals?.paidCount ?? 0} ราย`}
              />
              <StatCell
                icon={<IconUsers className="size-5 text-primary" />}
                chip="bg-primary/10"
                label="ลูกหนี้วันนี้"
                value={`${totals?.debtorCount ?? 0}`}
                sub={`ยอดถึงกำหนดรวม ฿${baht(totals?.dueTotal ?? 0)}`}
              />
              <StatCell
                icon={
                  <IconAlert className="size-5 text-red-600 dark:text-red-400" />
                }
                chip="bg-red-50 dark:bg-red-500/10"
                label="ยอดค้างของกลุ่มนี้"
                value={`฿${baht(totals?.arrears ?? 0)}`}
                sub="ไม่รวมในยอดต้องเก็บ"
                href="/arrears"
              />
            </div>
          </div>

          {groups.length > 0 && (
            <TextInput
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหาชื่อลูกหนี้…"
              aria-label="ค้นหาชื่อลูกหนี้"
            />
          )}

          {groups.length === 0 && !isFetching && <EmptyDay />}

          {q.trim() !== '' &&
            unpaid.length === 0 &&
            paid.length === 0 &&
            groups.length > 0 && (
              <p className="py-8 text-center text-sm text-slate-500 dark:text-gray-400">
                ไม่พบ &ldquo;{q}&rdquo; ในรายการวันนี้
              </p>
            )}

          {unpaid.length > 0 && (
            <DebtorSection
              title="ยังไม่จ่าย"
              count={unpaid.length}
              groups={unpaid}
              date={date}
              onPay={setPaying}
              onCombined={setCombining}
            />
          )}

          {paid.length > 0 && (
            <DebtorSection
              title="จ่ายแล้ว"
              count={paid.length}
              groups={paid}
              date={date}
              onPay={setPaying}
              onCombined={setCombining}
              done
            />
          )}
        </>
      )}

      {paying && (
        <PaymentModal
          loanId={paying.item.loanId}
          debtorName={paying.debtorName}
          frozen={
            paying.item.status === 'DEAD' ||
            paying.item.status === 'INSTALLMENT'
          }
          defaultAmount={paying.item.remainingToday}
          defaultType={
            paying.item.duePrincipal > 0
              ? PaymentType.BOTH
              : PaymentType.INTEREST
          }
          quickAmounts={[
            { label: 'ยอดวันนี้', amount: paying.item.remainingToday },
          ]}
          onClose={() => setPaying(null)}
          onSaved={() => setPaying(null)}
        />
      )}

      {combining && (
        <CombinedReceiveModal
          group={combining}
          paidDate={date}
          onClose={() => setCombining(null)}
          onSaved={() => setCombining(null)}
        />
      )}
    </div>
  );
}

function EmptyDay() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center dark:border-gray-800 dark:bg-gray-900">
      <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
        <IconCheck className="size-6" />
      </span>
      <p className="text-[15px] font-semibold text-slate-900 dark:text-white">
        วันนี้ไม่มีรายการต้องเก็บ
      </p>
      <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-slate-500 dark:text-gray-400">
        กดเลือกวันอื่นด้านบนเพื่อดูว่าวันไหนมีใครต้องส่งบ้าง
      </p>
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
  href,
}: {
  icon: React.ReactNode;
  chip: string;
  label: string;
  value: string;
  sub: string;
  emphasize?: boolean;
  href?: string;
}) {
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
        className={`mt-3 font-bold tracking-tight text-slate-900 tabular-nums dark:text-white ${
          emphasize ? 'text-[1.625rem] md:text-3xl' : 'text-2xl md:text-[1.75rem]'
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[12px] text-slate-500 md:text-[13px] dark:text-gray-400">
        {sub}
      </p>
    </>
  );
  const cls = 'block bg-white p-4 lg:p-6 dark:bg-gray-900';
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:bg-slate-50 dark:hover:bg-gray-800`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function DebtorSection({
  title,
  count,
  groups,
  date,
  onPay,
  onCombined,
  done,
}: {
  title: string;
  count: number;
  groups: TodayDebtor[];
  date: string;
  onPay: (t: PayTarget) => void;
  onCombined: (g: TodayDebtor) => void;
  done?: boolean;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold text-slate-900 md:text-lg dark:text-white">
          {title}
        </h2>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-gray-800 dark:text-gray-300">
          {count} ราย
        </span>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {groups.map((g) => (
          <DebtorCard
            key={g.debtorId}
            group={g}
            date={date}
            onPay={onPay}
            onCombined={onCombined}
            done={done}
          />
        ))}
      </div>
    </section>
  );
}

/** การ์ดหนึ่งใบ = ลูกหนี้หนึ่งคน — เห็นยอดรวมของวันก่อน แล้วค่อยลงรายยอดกู้ */
function DebtorCard({
  group,
  date,
  onPay,
  onCombined,
  done,
}: {
  group: TodayDebtor;
  date: string;
  onPay: (t: PayTarget) => void;
  onCombined: (g: TodayDebtor) => void;
  done?: boolean;
}) {
  const single = group.items.length === 1;
  // มีหลายยอดกู้และยังเก็บไม่ครบ — เปิดรับรวมทีเดียวได้
  const canCombine =
    !single && group.items.filter((it) => it.remainingToday > 0).length > 1;
  // ถึงกำหนดวันนี้แต่จ่ายมาก่อนหน้าแล้ว — ต้องบอกให้ชัด ไม่งั้นเห็นเป็น ฿0 แล้วงง
  const prepaid = !!done && group.paidToday === 0 && group.dueTotal > 0;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-gray-800 dark:bg-gray-900">
      <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5 dark:border-gray-800">
        <Link
          href={`/debtors/${group.debtorId}`}
          className="group min-w-0 rounded-lg text-left"
        >
          <span className="flex items-center gap-1.5">
            <span className="min-w-0 truncate text-base font-semibold text-slate-900 group-hover:text-primary dark:text-white">
              {group.debtorName}
            </span>
            <IconOut className="size-4 shrink-0 stroke-[1.5] text-slate-400" />
          </span>
          <span className="mt-0.5 block text-xs text-slate-500 dark:text-gray-400">
            ต้นรวม{' '}
            <span data-money className="tabular-nums">
              ฿{baht(group.outstandingPrincipal + group.deadBalance)}
            </span>
            {' · '}
            {group.items.length} ยอดกู้
          </span>
        </Link>
        <StatusBadge paid={!!done} prepaid={prepaid} />
      </header>

      <div className="space-y-3 p-4">
        <div className="rounded-xl bg-slate-50 px-3.5 py-3 dark:bg-gray-800/60">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[13px] text-slate-500 dark:text-gray-400">
              {prepaid
                ? 'ส่งล่วงหน้าไว้แล้ว'
                : done
                  ? 'รับแล้ววันนี้'
                  : 'ต้องส่งวันนี้'}
            </p>
            <p
              data-money
              className={`text-2xl font-bold tabular-nums ${
                done
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              ฿
              {baht(
                prepaid
                  ? group.dueTotal
                  : done
                    ? group.paidToday
                    : group.remainingToday,
              )}
            </p>
          </div>
          {!done && group.paidToday > 0 && (
            <p className="mt-1 text-xs leading-relaxed font-medium text-emerald-600 dark:text-emerald-400">
              ส่งมาแล้ว ฿{baht(group.paidToday)}
            </p>
          )}
        </div>

        {group.arrears > 0 && (
          <Link
            href="/arrears"
            className="flex items-center justify-between gap-2 rounded-xl border border-red-100 bg-red-50/60 px-3.5 py-2.5 text-sm transition-colors hover:bg-red-50 dark:border-red-500/20 dark:bg-red-500/10"
          >
            <span className="inline-flex items-center gap-1.5 text-red-700 dark:text-red-400">
              <IconOverdue className="size-4 shrink-0 stroke-[1.75]" />
              มียอดค้างเก่า
              <span className="text-red-600/70 dark:text-red-400/70">
                (ไม่รวมยอดวันนี้)
              </span>
            </span>
            <span
              data-money
              className="font-semibold text-red-700 tabular-nums dark:text-red-400"
            >
              ฿{baht(group.arrears)}
            </span>
          </Link>
        )}

        {!single && (
          <ul className="divide-y divide-slate-100 dark:divide-gray-800">
            {group.items.map((item) => (
              <LoanRow
                key={item.loanId}
                item={item}
                onPay={() => onPay({ item, debtorName: group.debtorName })}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="mt-auto flex gap-2 border-t border-slate-100 p-4 dark:border-gray-800">
        {single && (
          <Button
            onClick={() =>
              onPay({ item: group.items[0], debtorName: group.debtorName })
            }
            variant={done ? 'secondary' : 'primary'}
            className="flex-1"
          >
            <IconReceive className="size-[1.125rem] stroke-[1.5]" />
            {done ? 'รับเพิ่ม' : 'รับเงิน'}
          </Button>
        )}
        {canCombine && (
          <Button
            onClick={() => onCombined(group)}
            variant="primary"
            className="flex-1"
          >
            <IconReceive className="size-[1.125rem] stroke-[1.5]" />
            รับรวม
          </Button>
        )}
        <Link
          href={`/bill/${group.debtorId}?date=${date}`}
          className={buttonClassName({
            variant: 'secondary',
            className: single ? '' : 'flex-1',
          })}
        >
          <IconBill className="size-[1.125rem] stroke-[1.5]" />
          ออกบิล
        </Link>
      </div>
    </article>
  );
}

function LoanRow({ item, onPay }: { item: TodayItem; onPay: () => void }) {
  const frozen = item.status === 'DEAD' || item.status === 'INSTALLMENT';
  const settled = item.remainingToday <= 0;
  const prepaid = settled && item.paidToday === 0 && item.dueTotal > 0;

  return (
    <li className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-700 dark:text-gray-200">
          {cycleLabel[item.cycle]}
          {item.status === 'DEAD' && ' · ยอดตาย'}
          {item.status === 'INSTALLMENT' && ' · ผ่อนงวด'}
        </p>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-gray-400">
          {frozen ? 'ผ่อนเหลือ' : 'ต้นเหลือ'} ฿
          {baht(frozen ? item.deadBalance : item.outstandingPrincipal)}
          {item.duePrincipal > 0 && (
            <span className="text-primary"> · นัดคืนวันนี้</span>
          )}
          {prepaid && (
            <span className="text-sky-700 dark:text-sky-400">
              {' '}
              · ส่งล่วงหน้าไว้แล้ว
            </span>
          )}
          {item.arrears > 0 && (
            <span className="font-medium text-red-600 dark:text-red-400">
              {' '}
              · ค้าง ฿{baht(item.arrears)}
            </span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          data-money
          className={`text-base font-bold tabular-nums ${
            settled
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-slate-900 dark:text-white'
          }`}
        >
          ฿
          {baht(
            prepaid
              ? item.dueTotal
              : settled
                ? item.paidToday
                : item.remainingToday,
          )}
        </span>
        <Button
          size="sm"
          variant={settled ? 'secondary' : 'primary'}
          onClick={onPay}
          aria-label={`รับเงิน ${cycleLabel[item.cycle]}`}
        >
          <IconBanknote className="size-4 stroke-[1.5]" />
          รับ
        </Button>
      </div>
    </li>
  );
}

function StatusBadge({
  paid,
  prepaid,
}: {
  paid: boolean;
  prepaid?: boolean;
}) {
  if (prepaid)
    return (
      <span className="shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-400">
        ส่งล่วงหน้า
      </span>
    );
  return paid ? (
    <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
      จ่ายแล้ว
    </span>
  ) : (
    <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-400">
      ยังไม่จ่าย
    </span>
  );
}
