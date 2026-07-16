'use client';

import { use, useState } from 'react';
import { AuthGate } from '@/components/auth-gate';
import { BackButton } from '@/components/back-button';
import {
  IconAdjust,
  IconBan,
  IconEdit,
  IconFacebook,
  IconHistory,
  IconLock,
  IconMessage,
  IconPhone,
  IconPlus,
  IconReceive,
  IconReopen,
  IconSettings,
  IconTrash,
} from '@/components/icons';
import {
  Button,
  Field,
  FormInput,
  ModalButtons,
  Segmented,
  TextInput,
} from '@/components/form';
import Link from 'next/link';
import { PaymentModal } from '@/components/payment-modal';
import { PageSkeleton } from '@/components/skeleton';
import {
  baht,
  cycleLabel,
  statusLabel,
  thaiDate,
  thaiDateTime,
} from '@/lib/format';
import { useActivities } from '@/lib/hooks/useActivities';
import {
  useAttachments,
  useDeleteAttachment,
  useStorageStatus,
  useUploadAttachment,
} from '@/lib/hooks/useAttachments';
import {
  useDebtor,
  useDeleteDebtor,
  useUpdateDebtor,
} from '@/lib/hooks/useDebtors';
import { DatePicker } from '@/components/date-picker';
import {
  useAdjustLoan,
  useAllLoans,
  useConvertDead,
  useDeleteLoan,
  useEditLoan,
  useLoanAction,
  useLoanCycles,
  useLoanSchedule,
  useUpdateCycle,
} from '@/lib/hooks/useLoans';
import { useDeletePayment } from '@/lib/hooks/usePayments';
import { confirmDialog } from '@/lib/confirm-store';
import { toast } from '@/lib/toast-store';
import { LoanCycle, LoanStatus } from '@/lib/types';
import type {
  Attachment,
  AttachmentKind,
  CurrentCycle,
  Debtor,
  EmergencyContact,
  InstallmentSchedule,
  Loan,
  RevolvingCycle,
  ScheduleRowStatus,
} from '@/lib/types';

function resolveContacts(debtor: Debtor): EmergencyContact[] {
  if (debtor.emergencyContacts?.length) return debtor.emergencyContacts;
  const out: EmergencyContact[] = [];
  if (debtor.relativeName || debtor.relativePhone) {
    out.push({
      name: debtor.relativeName ?? '',
      phone: debtor.relativePhone ?? undefined,
      note: 'ญาติ',
    });
  }
  if (debtor.guarantorName || debtor.guarantorPhone) {
    out.push({
      name: debtor.guarantorName ?? '',
      phone: debtor.guarantorPhone ?? undefined,
      note: 'ผู้ค้ำ',
    });
  }
  return out;
}

export default function DebtorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <AuthGate>
      <DebtorView id={id} />
    </AuthGate>
  );
}

function DebtorView({ id }: { id: string }) {
  const { data: debtor, error } = useDebtor(id);
  const removeDebtor = useDeleteDebtor();
  const [editingDebtor, setEditingDebtor] = useState(false);
  const [paying, setPaying] = useState<Loan | null>(null);
  const [converting, setConverting] = useState<Loan | null>(null);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [adjusting, setAdjusting] = useState<Loan | null>(null);
  const [reasonAction, setReasonAction] = useState<{
    loan: Loan;
    kind: 'close' | 'write-off';
  } | null>(null);

  const deleteDebtor = async () => {
    const n = debtor?.loans?.length ?? 0;
    const ok = await confirmDialog({
      title: `ลบลูกหนี้ "${debtor?.name}"?`,
      detail: `${n ? `ยอดกู้ ${n} ก้อนและประวัติทั้งหมดจะถูกลบด้วย — ` : ''}ลบแล้วกู้คืนไม่ได้`,
      confirmLabel: 'ลบลูกหนี้',
      danger: true,
    });
    if (!ok) return;
    await removeDebtor.mutateAsync(id);
    window.location.href = '/debtors';
  };

  if (error)
    return (
      <p className="py-10 text-center text-red-600">{error.message}</p>
    );
  if (!debtor) return <PageSkeleton />;

  const loans = debtor.loans ?? [];
  const open = loans.filter(
    (l) =>
      l.status === LoanStatus.ACTIVE ||
      l.status === LoanStatus.DEAD ||
      l.status === LoanStatus.INSTALLMENT,
  );
  const inactive = loans.filter(
    (l) => l.status === LoanStatus.CLOSED || l.status === LoanStatus.BAD_DEBT,
  );

  const lineHref = debtor.lineId
    ? debtor.lineId.startsWith('http')
      ? debtor.lineId
      : `https://line.me/ti/p/~${debtor.lineId}`
    : null;
  const lineLabel = debtor.lineId
    ? debtor.lineId.startsWith('http')
      ? 'LINE'
      : `LINE · ${debtor.lineId}`
    : null;
  const facebookLabel = debtor.facebookUrl
    ? `Facebook · ${facebookDisplayName(debtor.facebookUrl, debtor.name)}`
    : null;
  const hasContact = !!(debtor.phone || debtor.facebookUrl || debtor.lineId);

  return (
    <div className="space-y-5">
      <div>
        <BackButton href="/debtors" label="ลูกหนี้" />
        <section className="mt-2 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-[1.75rem] dark:text-white">
                  <span className="truncate">{debtor.name}</span>
                </h1>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-gray-800 dark:text-gray-300">
                  ลูกหนี้
                </span>
                {debtor.blacklisted && (
                  <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-500/10 dark:text-red-400">
                    บัญชีดำ
                  </span>
                )}
              </div>
              {debtor.note && (
                <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
                  {debtor.note}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingDebtor(true)}
                className="inline-flex min-h-12 items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-[15px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <IconEdit className="size-5" />
                แก้ไขข้อมูล
              </button>
              <Link
                href={`/loans/new?debtorId=${id}`}
                className="inline-flex min-h-12 items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-[15px] font-semibold text-white hover:bg-primary/90"
              >
                <IconPlus className="size-4" />
                เปิดยอดใหม่
              </Link>
            </div>
          </div>

          {hasContact && (
            <div className="mt-4 space-y-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                ติดต่อ
              </h2>
              <div className="flex flex-wrap gap-2">
                {debtor.phone && (
                  <a
                    href={`tel:${debtor.phone}`}
                    className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-800 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary dark:border-gray-700 dark:bg-gray-950/50 dark:text-gray-100 dark:hover:border-primary"
                  >
                    <IconPhone className="size-4 shrink-0" />
                    {debtor.phone}
                  </a>
                )}
                {lineHref && lineLabel && (
                  <a
                    href={lineHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-800 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary dark:border-gray-700 dark:bg-gray-950/50 dark:text-gray-100 dark:hover:border-primary"
                  >
                    <IconMessage className="size-4 shrink-0" />
                    {lineLabel}
                  </a>
                )}
                {debtor.facebookUrl && facebookLabel && (
                  <a
                    href={debtor.facebookUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-800 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary dark:border-gray-700 dark:bg-gray-950/50 dark:text-gray-100 dark:hover:border-primary"
                  >
                    <IconFacebook className="size-4 shrink-0" />
                    {facebookLabel}
                  </a>
                )}
              </div>
            </div>
          )}
          {(() => {
            const contacts = resolveContacts(debtor);
            if (contacts.length === 0 && !debtor.creditNote) return null;
            return (
              <div className="mt-4 space-y-2">
                {contacts.length > 0 && (
                  <>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                      ผู้ติดต่อคนสนิท
                    </h2>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {contacts.map((c, i) => (
                        <div
                          key={`${c.name}-${i}`}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 dark:border-gray-700 dark:bg-gray-950/50"
                        >
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {c.name || `ผู้ติดต่อ ${i + 1}`}
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600 dark:text-gray-300">
                            {c.phone && (
                              <a
                                href={`tel:${c.phone}`}
                                className="font-medium text-primary hover:underline"
                              >
                                {c.phone}
                              </a>
                            )}
                            {c.line && <span>LINE · {c.line}</span>}
                            {c.note && (
                              <span className="text-slate-500 dark:text-gray-400">
                                {c.note}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {debtor.creditNote && (
                  <p className="text-sm text-slate-500 dark:text-gray-400">
                    เครดิต: {debtor.creditNote}
                  </p>
                )}
              </div>
            );
          })()}
        </section>
      </div>

      <DebtorSummaryStrip debtorId={id} />

      {open.map((loan) => (
        <LoanCard
          key={loan.id}
          loan={loan}
          onPay={() => setPaying(loan)}
          onConvert={() => setConverting(loan)}
          onEdit={() => setEditingLoan(loan)}
          onAdjust={() => setAdjusting(loan)}
          onClose={() => setReasonAction({ loan, kind: 'close' })}
          onWriteOff={() => setReasonAction({ loan, kind: 'write-off' })}
        />
      ))}
      {open.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white py-8 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="text-gray-500 dark:text-gray-400">ไม่มียอดเปิดอยู่</p>
          <Link
            href={`/loans/new?debtorId=${id}`}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            <IconPlus className="size-4" />
            เพิ่มยอดกู้ใหม่
          </Link>
        </div>
      )}

      {inactive.length > 0 && (
        <details className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <summary className="cursor-pointer text-sm font-semibold text-gray-600 dark:text-gray-300">
            ยอดที่ปิด/หนี้สูญ ({inactive.length})
          </summary>
          <div className="mt-3 space-y-3">
            {inactive.map((loan) => (
              <LoanCard
                key={loan.id}
                loan={loan}
                onAdjust={() => setAdjusting(loan)}
              />
            ))}
          </div>
        </details>
      )}

      <AttachmentsSection debtorId={id} />

      <button
        onClick={deleteDebtor}
        className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 hover:underline"
      >
        <IconTrash className="size-4" />
        ลบลูกหนี้รายนี้
      </button>

      {editingDebtor && (
        <EditDebtorModal
          debtor={debtor}
          onClose={() => setEditingDebtor(false)}
          onSaved={() => setEditingDebtor(false)}
        />
      )}
      {paying && (
        <PaymentModal
          loanId={paying.id}
          debtorName={debtor.name}
          frozen={paying.status === LoanStatus.DEAD || paying.status === LoanStatus.INSTALLMENT}
          quickAmounts={
            paying.status === LoanStatus.DEAD || paying.status === LoanStatus.INSTALLMENT
              ? [
                  {
                    label: 'งวดละ',
                    amount: Math.min(
                      paying.installmentAmount ?? 0,
                      paying.deadBalance ?? 0,
                    ),
                  },
                ]
              : [{ label: 'ค้างเก่า', amount: paying.arrears }]
          }
          onClose={() => setPaying(null)}
          onSaved={() => setPaying(null)}
        />
      )}
      {converting && (
        <ConvertDeadModal
          loan={converting}
          onClose={() => setConverting(null)}
          onSaved={() => setConverting(null)}
        />
      )}
      {editingLoan && (
        <EditLoanModal
          loan={editingLoan}
          onClose={() => setEditingLoan(null)}
          onSaved={() => setEditingLoan(null)}
        />
      )}
      {adjusting && (
        <AdjustModal
          loan={adjusting}
          onClose={() => setAdjusting(null)}
          onSaved={() => setAdjusting(null)}
        />
      )}
      {reasonAction && (
        <ReasonModal
          loan={reasonAction.loan}
          kind={reasonAction.kind}
          onClose={() => setReasonAction(null)}
          onSaved={() => setReasonAction(null)}
        />
      )}
    </div>
  );
}

/** แถบสรุปรวมทุกสัญญาของลูกหนี้ — ใช้ข้อมูลคำนวณจาก GET /loans (ตัวเดียวกับหน้าสัญญาเงินกู้) */
function DebtorSummaryStrip({ debtorId }: { debtorId: string }) {
  const { data: loans } = useAllLoans();
  if (!loans) return null;
  const mine = loans.filter((l) => l.debtorId === debtorId);
  const open = mine.filter(
    (l) =>
      l.status === LoanStatus.ACTIVE ||
      l.status === LoanStatus.DEAD ||
      l.status === LoanStatus.INSTALLMENT,
  );
  if (mine.length === 0) return null;
  const remaining = open.reduce((s, l) => s + l.remaining, 0);
  const arrears = open.reduce((s, l) => s + l.arrears, 0);
  const overdueCount = open.filter((l) => l.overdue).length;
  const nextDue = open
    .map((l) => l.nextDueDate)
    .filter((d): d is string => !!d)
    .sort()[0];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <SummaryChip
        label="สัญญาเปิดอยู่"
        value={`${open.length}/${mine.length}`}
      />
      <SummaryChip label="ยอดคงเหลือรวม" value={`฿${baht(remaining)}`} />
      <SummaryChip
        label="ดอกค้างรวม"
        value={`฿${baht(arrears)}`}
        danger={arrears > 0 || overdueCount > 0}
      />
      <SummaryChip
        label="เก็บครั้งถัดไป"
        value={nextDue ? thaiDate(nextDue) : '—'}
      />
    </div>
  );
}

function SummaryChip({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p
        className={`font-bold ${danger ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}
      >
        {value}
      </p>
    </div>
  );
}

const statusStyle: Record<Loan['status'], string> = {
  ACTIVE:
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  DEAD: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  INSTALLMENT:
    'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400',
  CLOSED: 'bg-primary/10 text-primary',
  BAD_DEBT: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
};

function LoanCard({
  loan,
  onPay,
  onConvert,
  onEdit,
  onAdjust,
  onClose,
  onWriteOff,
}: {
  loan: Loan;
  onPay?: () => void;
  onConvert?: () => void;
  onEdit?: () => void;
  onAdjust?: () => void;
  onClose?: () => void;
  onWriteOff?: () => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const payments = loan.payments ?? [];
  const principalCut = payments.reduce(
    (s, p) => s + (p.onDeadLoan ? 0 : p.principalPaid),
    0,
  );
  const isInstallment = loan.status === LoanStatus.INSTALLMENT;
  const isOpen =
    loan.status === LoanStatus.ACTIVE ||
    loan.status === LoanStatus.DEAD ||
    loan.status === LoanStatus.INSTALLMENT;

  // โหลดตารางผ่อนของยอด INSTALLMENT เพื่อโชว์จำนวนงวดที่จ่ายแล้ว
  const { data: schedule } = useLoanSchedule(loan.id, isInstallment);
  const { data: log } = useActivities(loan.id, showLog);
  const removePayment = useDeletePayment();
  const reopenLoan = useLoanAction('reopen');
  const removeLoan = useDeleteLoan();

  const deletePayment = async (pid: string) => {
    const ok = await confirmDialog({
      title: 'ลบรายการจ่ายนี้?',
      detail: 'ยอดเงินจะคืนกลับตามเดิมเหมือนไม่เคยบันทึก',
      confirmLabel: 'ลบรายการ',
      danger: true,
    });
    if (!ok) return;
    try {
      await removePayment.mutateAsync(pid);
      toast('ลบรายการแล้ว — คืนยอดกลับตามเดิม');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'ลบไม่สำเร็จ', 'error');
    }
  };

  const reopen = async () => {
    const ok = await confirmDialog({
      title: 'เปิดยอดคืน?',
      detail: 'ยอดจะกลับมาเดินดอกจากวันนี้',
      confirmLabel: 'เปิดยอดคืน',
    });
    if (!ok) return;
    try {
      await reopenLoan.mutateAsync({ id: loan.id });
      toast('เปิดยอดคืนแล้ว');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'เปิดยอดคืนไม่สำเร็จ', 'error');
    }
  };

  const deleteLoan = async () => {
    const ok = await confirmDialog({
      title: 'ลบยอดกู้นี้?',
      detail: 'ประวัติจ่ายทั้งหมดจะถูกลบด้วย — ลบแล้วกู้คืนไม่ได้',
      confirmLabel: 'ลบยอดกู้',
      danger: true,
    });
    if (!ok) return;
    try {
      await removeLoan.mutateAsync(loan.id);
      toast('ลบยอดกู้แล้ว');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'ลบไม่สำเร็จ', 'error');
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-slate-900 md:text-lg dark:text-white">
            {isInstallment
              ? `${loan.amortized ? 'ผ่อนลดต้นลดดอก' : 'ผ่อนดอกคงที่'} · ${loan.installmentCount} งวด (${cycleLabel[loan.cycle]})`
              : `${cycleLabel[loan.cycle]} · ดอก ${loan.interestRatePercent}%/รอบ`}
            {!isInstallment && loan.interestMode === 'FLAT' && (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400">
                ดอกคงที่
              </span>
            )}
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle[loan.status]}`}
            >
              {isInstallment ? cycleLabel[loan.cycle] : statusLabel[loan.status]}
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">
            {loan.contractNumber && `สัญญา ${loan.contractNumber} · `}
            เปิดยอด {thaiDate(loan.startDate)} · ต้นเดิม ฿
            {baht(loan.principalOriginal)}
            {isInstallment && ` · ผ่อนรวม ฿${baht(loan.installmentTotal)}`}
          </p>
        </div>
        {isOpen && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowManage((v) => !v)}
              className="inline-flex min-h-12 items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-[15px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <IconSettings className="size-5" />
              จัดการ
            </button>
            {onPay && (
              <Button onClick={onPay}>
                <IconReceive className="size-5" />
                รับเงิน
              </Button>
            )}
          </div>
        )}
      </div>

      <div
        className={`mt-4 grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 dark:border-gray-800 dark:bg-gray-800 ${
          isInstallment
            ? 'grid-cols-2 sm:grid-cols-4'
            : 'grid-cols-3'
        }`}
      >
        {isInstallment ? (
          <>
            <Stat label="ยอดเงินต้นคงเหลือ" value={loan.outstandingPrincipal} />
            <Stat label="ยอดผ่อนคงเหลือ" value={loan.deadBalance ?? 0} />
            <Stat label="งวดละ" value={loan.installmentAmount ?? 0} />
            <StatText
              label="ผ่อนแล้ว"
              value={`${
                schedule
                  ? schedule.paidCount
                  : Math.round(
                      ((loan.installmentTotal ?? 0) -
                        (loan.deadBalance ?? 0)) /
                        (loan.installmentAmount || 1),
                    )
              } / ${loan.installmentCount} งวด`}
              color="text-emerald-700 dark:text-emerald-400"
            />
          </>
        ) : loan.status === LoanStatus.DEAD ? (
          <>
            <Stat label="ยอดตายคงเหลือ" value={loan.deadBalance ?? 0} />
            <Stat label="งวดผ่อน/10วัน" value={loan.installmentAmount ?? 0} />
            <Stat
              label="ผ่อนแล้ว"
              value={payments
                .filter((p) => p.onDeadLoan)
                .reduce((s, p) => s + p.amount, 0)}
              color="text-emerald-700 dark:text-emerald-400"
            />
          </>
        ) : (
          <>
            <Stat label="ต้นคงเหลือ" value={loan.outstandingPrincipal} />
            <Stat
              label="ค้างเก่า"
              value={loan.arrears}
              color={loan.arrears > 0 ? 'text-red-600 dark:text-red-400' : undefined}
            />
            <Stat
              label="ตัดต้นแล้ว"
              value={principalCut}
              color="text-emerald-700 dark:text-emerald-400"
            />
          </>
        )}
      </div>

      {loan.status === LoanStatus.ACTIVE && <NextCycleRow loanId={loan.id} />}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          className="rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-primary dark:text-gray-400 dark:hover:bg-gray-800"
        >
          ประวัติการจ่าย ({payments.length})
        </button>
        {isInstallment && (
          <button
            type="button"
            onClick={() => setShowSchedule((v) => !v)}
            className="rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-primary dark:text-gray-400 dark:hover:bg-gray-800"
          >
            ตารางผ่อน
          </button>
        )}
        {loan.status === LoanStatus.ACTIVE && onConvert && (
          <button
            type="button"
            onClick={onConvert}
            className="rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-primary dark:text-gray-400 dark:hover:bg-gray-800"
          >
            แปลงเป็นยอดตาย
          </button>
        )}
      </div>

      {showManage && (
        <div className="mt-2 flex flex-wrap gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
          {isOpen && !isInstallment && onEdit && (
            <ManageBtn onClick={onEdit} icon={<IconEdit className="size-3.5" />}>
              แก้เงื่อนไข
            </ManageBtn>
          )}
          {onAdjust && (
            <ManageBtn
              onClick={onAdjust}
              icon={<IconAdjust className="size-3.5" />}
            >
              ปรับยอด
            </ManageBtn>
          )}
          {isOpen && onClose && (
            <ManageBtn
              onClick={onClose}
              icon={<IconLock className="size-3.5" />}
            >
              ปิดยอด
            </ManageBtn>
          )}
          {isOpen && onWriteOff && (
            <ManageBtn
              onClick={onWriteOff}
              icon={<IconBan className="size-3.5" />}
              danger
            >
              ตัดหนี้สูญ
            </ManageBtn>
          )}
          {!isOpen && (
            <ManageBtn
              onClick={reopen}
              icon={<IconReopen className="size-3.5" />}
            >
              เปิดยอดคืน
            </ManageBtn>
          )}
          <ManageBtn
            onClick={() => setShowLog((v) => !v)}
            icon={<IconHistory className="size-3.5" />}
          >
            ประวัติจัดการ
          </ManageBtn>
          <ManageBtn
            onClick={deleteLoan}
            icon={<IconTrash className="size-3.5" />}
            danger
          >
            ลบยอด
          </ManageBtn>
        </div>
      )}

      {showLog && log && (
        <div className="mt-2 space-y-1.5 border-t border-gray-100 pt-2 text-xs dark:border-gray-800">
          {log.length === 0 && (
            <p className="text-gray-400 dark:text-gray-500">ยังไม่มีประวัติจัดการ</p>
          )}
          {log.map((a) => (
            <div key={a.id} className="flex justify-between gap-2">
              <span className="text-gray-700 dark:text-gray-300">
                {a.message}
                {a.reason && (
                  <span className="text-gray-400"> — {a.reason}</span>
                )}
              </span>
              <span className="shrink-0 text-gray-400 dark:text-gray-500">
                {thaiDateTime(a.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}

      {showSchedule && isInstallment && (
        <ScheduleTable schedule={schedule ?? null} amortized={loan.amortized} />
      )}

      {showHistory && (
        <div className="mt-2 space-y-1 border-t border-gray-100 pt-2 dark:border-gray-800">
          {payments.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              ยังไม่มีรายการ
            </p>
          )}
          {payments.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-gray-500 dark:text-gray-400">
                {thaiDate(p.paidDate)}
              </span>
              <span className="text-gray-900 dark:text-white">
                ฿{baht(p.amount)}
                <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">
                  {p.onDeadLoan
                    ? '(ผ่อนยอดตาย)'
                    : [
                        p.arrearsPaid > 0 ? `ค้าง ${baht(p.arrearsPaid)}` : '',
                        p.interestPaid > 0 ? `ดอก ${baht(p.interestPaid)}` : '',
                        p.principalPaid > 0
                          ? `ต้น ${baht(p.principalPaid)}`
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' / ')}
                </span>
              </span>
              <button
                onClick={() => deletePayment(p.id)}
                className="text-xs text-red-400 hover:text-red-500"
              >
                ลบ
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** รอบดอกถัดไปของยอดดอกลอย/คงที่ — ระบบคำนวณให้ แต่เลื่อนวัน/แก้ยอดดอกได้ */
function NextCycleRow({ loanId }: { loanId: string }) {
  const { data } = useLoanCycles(loanId, true);
  const [editing, setEditing] = useState(false);
  const cur = data?.current;
  if (!cur) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-gray-700 dark:bg-gray-950/60">
      <p className="text-sm text-slate-600 dark:text-gray-300">
        รอบดอกถัดไป{' '}
        <b className="text-slate-900 dark:text-white">{thaiDate(cur.dueDate)}</b>
        {' · '}ดอก{' '}
        <b className="text-slate-900 dark:text-white">
          ฿{baht(cur.interestDue)}
        </b>
        {cur.interestOverride != null && (
          <span className="ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
            ตกลงพิเศษ (ระบบคำนวณ ฿{baht(cur.computedInterest)})
          </span>
        )}
        {cur.interestPaid > 0 && (
          <span className="ml-1.5 text-emerald-700 dark:text-emerald-400">
            จ่ายแล้ว ฿{baht(cur.interestPaid)}
          </span>
        )}
      </p>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        <IconEdit className="size-3.5" />
        เลื่อนวัน / แก้ดอก
      </button>
      {editing && (
        <EditCycleModal
          loanId={loanId}
          cycle={cur}
          onClose={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      )}
    </div>
  );
}

function EditCycleModal({
  loanId,
  cycle,
  onClose,
  onSaved,
}: {
  loanId: string;
  cycle: CurrentCycle;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [dueDate, setDueDate] = useState(cycle.dueDate);
  const [interest, setInterest] = useState(String(cycle.interestDue));
  const [error, setError] = useState('');
  const update = useUpdateCycle();

  const save = async () => {
    setError('');
    const n = parseFloat(interest);
    if (interest.trim() !== '' && (!Number.isFinite(n) || n < 0)) {
      setError('ยอดดอกต้องไม่ติดลบ');
      return;
    }
    const input: {
      dueDate?: string;
      interestOverride?: number;
      clearOverride?: boolean;
    } = {};
    if (dueDate !== cycle.dueDate) input.dueDate = dueDate;
    if (interest.trim() === '' || n === cycle.computedInterest) {
      // เท่ากับที่ระบบคำนวณ = ไม่ต้อง override (ดอกลดตามต้นอัตโนมัติต่อ)
      if (cycle.interestOverride != null) input.clearOverride = true;
    } else if (n !== (cycle.interestOverride ?? cycle.computedInterest)) {
      input.interestOverride = n;
    }
    if (Object.keys(input).length === 0) {
      onSaved();
      return;
    }
    try {
      await update.mutateAsync({ loanId, cycleId: cycle.cycleId, input });
      toast('บันทึกรอบดอกแล้ว');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    }
  };

  return (
    <ModalShell title="แก้รอบดอกรอบนี้" onClose={onClose}>
      <Field label="วันครบกำหนด">
        <DatePicker value={dueDate} onChange={setDueDate} />
      </Field>
      <Field label={`ยอดดอกที่ตกลงเก็บ (ระบบคำนวณ ฿${baht(cycle.computedInterest)})`}>
        <TextInput
          type="number"
          inputMode="decimal"
          align="right"
          value={interest}
          onChange={(e) => setInterest(e.target.value)}
        />
      </Field>
      <p className="text-xs text-gray-400 dark:text-gray-500">
        * แก้เฉพาะรอบนี้ — รอบถัดไปกลับไปคำนวณจากต้นคงเหลือตามปกติ
        ใส่เท่ากับที่ระบบคำนวณเพื่อยกเลิกยอดตกลงพิเศษ
      </p>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <ModalButtons onClose={onClose} onSave={save} saving={update.isPending} />
    </ModalShell>
  );
}

function ManageBtn({
  onClick,
  icon,
  danger,
  children,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
        danger
          ? 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10'
          : 'border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="bg-white p-3 text-left sm:p-4 dark:bg-gray-900">
      <p className="text-[12px] font-medium text-slate-500 dark:text-gray-400">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-bold tabular-nums sm:text-xl ${color ?? 'text-slate-900 dark:text-white'}`}
      >
        ฿{baht(value)}
      </p>
    </div>
  );
}

function StatText({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-white p-3 text-left sm:p-4 dark:bg-gray-900">
      <p className="text-[12px] font-medium text-slate-500 dark:text-gray-400">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-bold tabular-nums sm:text-xl ${color ?? 'text-slate-900 dark:text-white'}`}
      >
        {value}
      </p>
    </div>
  );
}

const scheduleRowStyle: Record<ScheduleRowStatus, { label: string; cls: string }> =
  {
    PAID: {
      label: 'จ่ายแล้ว',
      cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    },
    PARTIAL: {
      label: 'จ่ายบางส่วน',
      cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    },
    DUE: {
      label: 'ค้างชำระ',
      cls: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
    },
    PENDING: {
      label: 'ยังไม่ถึง',
      cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
    },
  };

function ScheduleTable({
  schedule,
  amortized,
}: {
  schedule: InstallmentSchedule | null;
  amortized: boolean;
}) {
  if (!schedule)
    return (
      <div className="mt-2 border-t border-gray-100 pt-2 text-sm text-gray-400 dark:border-gray-800 dark:text-gray-500">
        กำลังโหลดตารางผ่อน…
      </div>
    );
  return (
    <div className="mt-2 border-t border-gray-100 pt-2 dark:border-gray-800">
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        <span>
          ผ่อนแล้ว{' '}
          <b className="text-gray-900 dark:text-white">
            {schedule.paidCount}/{schedule.installmentCount}
          </b>{' '}
          งวด
        </span>
        <span>
          เหลืออีก{' '}
          <b className="text-gray-900 dark:text-white">
            {schedule.remainingCount}
          </b>{' '}
          งวด · ฿{baht(schedule.remaining)}
        </span>
        {schedule.dueNow > 0 && (
          <span className="text-red-600 dark:text-red-400">
            ถึงกำหนดแล้ว ฿{baht(schedule.dueNow)}
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-gray-400 dark:text-gray-500">
              <th className="py-1 pr-2 font-medium">งวด</th>
              <th className="py-1 pr-2 font-medium">กำหนด</th>
              {amortized && (
                <>
                  <th className="py-1 pr-2 text-right font-medium">ต้น</th>
                  <th className="py-1 pr-2 text-right font-medium">ดอก</th>
                </>
              )}
              <th className="py-1 pr-2 text-right font-medium">ต้องผ่อน</th>
              <th className="py-1 pr-2 text-right font-medium">จ่ายแล้ว</th>
              <th className="py-1 text-right font-medium">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {schedule.rows.map((r) => {
              const st = scheduleRowStyle[r.status];
              return (
                <tr key={r.n} className="text-gray-700 dark:text-gray-300">
                  <td className="py-1.5 pr-2">{r.n}</td>
                  <td className="py-1.5 pr-2 text-gray-500 dark:text-gray-400">
                    {thaiDate(r.dueDate)}
                  </td>
                  {amortized && (
                    <>
                      <td className="py-1.5 pr-2 text-right">
                        ฿{baht(r.principal)}
                      </td>
                      <td className="py-1.5 pr-2 text-right">
                        ฿{baht(r.interest)}
                      </td>
                    </>
                  )}
                  <td className="py-1.5 pr-2 text-right">฿{baht(r.scheduled)}</td>
                  <td className="py-1.5 pr-2 text-right text-emerald-600 dark:text-emerald-400">
                    {r.paid > 0 ? `฿${baht(r.paid)}` : '-'}
                  </td>
                  <td className="py-1.5 text-right">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}
                    >
                      {st.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-5 sm:rounded-2xl dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

function EditDebtorModal({
  debtor,
  onClose,
  onSaved,
}: {
  debtor: Debtor;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(debtor.name);
  const [phone, setPhone] = useState(debtor.phone ?? '');
  const [facebookUrl, setFacebookUrl] = useState(debtor.facebookUrl ?? '');
  const [lineId, setLineId] = useState(debtor.lineId ?? '');
  const [note, setNote] = useState(debtor.note ?? '');
  const [blacklisted, setBlacklisted] = useState(debtor.blacklisted);
  const [creditNote, setCreditNote] = useState(debtor.creditNote ?? '');
  const [contacts, setContacts] = useState<EmergencyContact[]>(() => {
    const existing = resolveContacts(debtor);
    return existing.length
      ? existing
      : [{ name: '', phone: '', line: '', note: '' }];
  });
  const [error, setError] = useState('');
  const update = useUpdateDebtor(debtor.id);

  const setContact = (
    index: number,
    key: keyof EmergencyContact,
    value: string,
  ) => {
    setContacts((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [key]: value } : c)),
    );
  };

  const save = async () => {
    if (!name.trim()) {
      setError('กรอกชื่อ');
      return;
    }
    try {
      await update.mutateAsync({
        name,
        phone,
        facebookUrl,
        lineId,
        note,
        blacklisted,
        creditNote,
        emergencyContacts: contacts,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    }
  };

  return (
    <ModalShell title="แก้ข้อมูลลูกหนี้" onClose={onClose}>
      <FormInput
        label="ชื่อ *"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <FormInput
        label="เบอร์โทร"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <FormInput
        label="ลิงก์ Facebook"
        value={facebookUrl}
        onChange={(e) => setFacebookUrl(e.target.value)}
        placeholder="https://facebook.com/…"
      />
      <FormInput
        label="LINE ID หรือลิงก์"
        value={lineId}
        onChange={(e) => setLineId(e.target.value)}
        placeholder="เช่น mylineid หรือ https://line.me/ti/p/…"
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            ผู้ติดต่อคนสนิท
          </h3>
          <button
            type="button"
            onClick={() =>
              setContacts((c) => [
                ...c,
                { name: '', phone: '', line: '', note: '' },
              ])
            }
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-200"
          >
            <IconPlus className="size-3.5" />
            เพิ่มผู้ติดต่อ
          </button>
        </div>
        {contacts.map((c, i) => (
          <div
            key={i}
            className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-gray-700"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700 dark:text-gray-200">
                ผู้ติดต่อ {i + 1}
              </p>
              {contacts.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setContacts((list) => list.filter((_, j) => j !== i))
                  }
                  className="text-xs font-medium text-red-600"
                >
                  ลบ
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FormInput
                label="ชื่อ"
                value={c.name}
                onChange={(e) => setContact(i, 'name', e.target.value)}
              />
              <FormInput
                label="เบอร์โทร"
                value={c.phone ?? ''}
                onChange={(e) => setContact(i, 'phone', e.target.value)}
              />
              <FormInput
                label="LINE"
                value={c.line ?? ''}
                onChange={(e) => setContact(i, 'line', e.target.value)}
              />
              <FormInput
                label="หมายเหตุ"
                value={c.note ?? ''}
                onChange={(e) => setContact(i, 'note', e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>

      <label className="flex items-center gap-2 rounded-lg bg-red-50 p-2.5 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
        <input
          type="checkbox"
          checked={blacklisted}
          onChange={(e) => setBlacklisted(e.target.checked)}
        />
        ขึ้นบัญชีดำ (เตือนก่อนปล่อยกู้เพิ่ม)
      </label>
      <FormInput
        label="ประวัติเครดิต / พฤติกรรมการจ่าย"
        value={creditNote}
        onChange={(e) => setCreditNote(e.target.value)}
        placeholder="เช่น จ่ายตรงเวลา, ชอบเลื่อน"
      />
      <FormInput
        label="หมายเหตุลูกหนี้"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <ModalButtons onClose={onClose} onSave={save} saving={update.isPending} />
    </ModalShell>
  );
}

function EditLoanModal({
  loan,
  onClose,
  onSaved,
}: {
  loan: Loan;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rate, setRate] = useState(String(loan.interestRatePercent));
  // แก้เงื่อนไขได้เฉพาะยอดดอกลอย/คงที่ (รายวัน / 7 วัน / 10 วัน)
  const [cycle, setCycle] = useState<RevolvingCycle>(
    loan.cycle === LoanCycle.MONTHLY ? LoanCycle.DAILY : loan.cycle,
  );
  const [note, setNote] = useState(loan.note ?? '');
  const [error, setError] = useState('');
  const edit = useEditLoan();

  const save = async () => {
    const r = parseFloat(rate);
    if (!r || r <= 0) {
      setError('อัตราดอกต้องมากกว่า 0');
      return;
    }
    try {
      await edit.mutateAsync({
        id: loan.id,
        input: { interestRatePercent: r, cycle, note },
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    }
  };

  return (
    <ModalShell title="แก้เงื่อนไขยอดกู้" onClose={onClose}>
      <Field label="ดอก %/รอบ">
        <TextInput
          type="number"
          step="0.001"
          inputMode="decimal"
          align="right"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
        />
      </Field>
      <Field label="รอบเก็บ">
        <Segmented
          value={cycle}
          onChange={(v) => setCycle(v)}
          options={[
            { value: LoanCycle.DAILY, label: 'รายวัน' },
            { value: LoanCycle.WEEKLY, label: 'ทุก 7 วัน' },
            { value: LoanCycle.TEN_DAY, label: 'ทุก 10 วัน' },
          ]}
        />
      </Field>
      <Field label="หมายเหตุ">
        <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <p className="text-xs text-gray-400">
        * แก้อัตราดอกมีผลกับรอบถัดไป ยอดค้างเดิมไม่เปลี่ยน
      </p>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <ModalButtons onClose={onClose} onSave={save} saving={edit.isPending} />
    </ModalShell>
  );
}

function AdjustModal({
  loan,
  onClose,
  onSaved,
}: {
  loan: Loan;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isDead = loan.status === LoanStatus.DEAD || loan.status === LoanStatus.INSTALLMENT;
  const [principal, setPrincipal] = useState(
    String(loan.outstandingPrincipal),
  );
  const [arrears, setArrears] = useState(String(loan.arrears));
  const [deadBalance, setDeadBalance] = useState(
    String(loan.deadBalance ?? 0),
  );
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const adjust = useAdjustLoan();

  const save = async () => {
    if (!reason.trim()) {
      setError('ต้องระบุเหตุผลการปรับยอด');
      return;
    }
    try {
      const input = isDead
        ? { deadBalance: parseFloat(deadBalance) || 0, reason }
        : {
            outstandingPrincipal: parseFloat(principal) || 0,
            arrears: parseFloat(arrears) || 0,
            reason,
          };
      await adjust.mutateAsync({ id: loan.id, input });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    }
  };

  return (
    <ModalShell title="ปรับยอดด้วยมือ" onClose={onClose}>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        ใช้แก้ยอดที่บันทึกผิด — ระบบจะบันทึกค่าก่อน/หลังและเหตุผลไว้ในประวัติจัดการ
      </p>
      {isDead ? (
        <Field label="ยอดผ่อนคงเหลือ">
          <TextInput
            type="number"
            inputMode="decimal"
            align="right"
            value={deadBalance}
            onChange={(e) => setDeadBalance(e.target.value)}
          />
        </Field>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Field label="ต้นคงเหลือ">
            <TextInput
              type="number"
              inputMode="decimal"
              align="right"
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
            />
          </Field>
          <Field label="ยอดค้าง">
            <TextInput
              type="number"
              inputMode="decimal"
              align="right"
              value={arrears}
              onChange={(e) => setArrears(e.target.value)}
            />
          </Field>
        </div>
      )}
      <Field label="เหตุผล *">
        <TextInput
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="เช่น คีย์ยอดผิด, ตกลงลดต้นให้"
        />
      </Field>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <ModalButtons onClose={onClose} onSave={save} saving={adjust.isPending} />
    </ModalShell>
  );
}

function ReasonModal({
  loan,
  kind,
  onClose,
  onSaved,
}: {
  loan: Loan;
  kind: 'close' | 'write-off';
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const isWriteOff = kind === 'write-off';
  const action = useLoanAction(kind);
  const loss =
    loan.status === LoanStatus.DEAD || loan.status === LoanStatus.INSTALLMENT
      ? (loan.deadBalance ?? 0)
      : loan.outstandingPrincipal + loan.arrears;

  const save = async () => {
    try {
      await action.mutateAsync({ id: loan.id, reason });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    }
  };

  return (
    <ModalShell
      title={isWriteOff ? 'ตัดหนี้สูญ' : 'ปิดยอดเอง'}
      onClose={onClose}
    >
      {isWriteOff ? (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          ยอดคงเหลือ <b className="text-red-600">฿{baht(loss)}</b>{' '}
          จะถูกบันทึกเป็นผลขาดทุน หยุดคิดดอกและไม่ติดตามต่อ (เปิดยอดคืนได้ภายหลัง)
        </p>
      ) : (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          ปิดยอดนี้ถือว่าจบ ไม่ว่ายอดจะเหลือหรือไม่ (เปิดคืนได้ภายหลัง)
        </p>
      )}
      <Field label="เหตุผล (ไม่บังคับ)">
        <TextInput
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <ModalButtons
        onClose={onClose}
        onSave={save}
        saving={action.isPending}
        danger={isWriteOff}
        saveLabel={isWriteOff ? 'ยืนยันตัดหนี้สูญ' : 'ยืนยันปิดยอด'}
      />
    </ModalShell>
  );
}

const attachKindLabel: Record<AttachmentKind, string> = {
  SLIP: 'สลิปโอน',
  ID_CARD: 'บัตรประชาชน',
  OTHER: 'อื่นๆ',
};

function facebookDisplayName(url: string, fallback: string): string {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, '');
    const last = path.split('/').filter(Boolean).pop();
    if (last && last !== 'profile.php') return decodeURIComponent(last);
  } catch {
    /* ignore */
  }
  return fallback;
}

function AttachmentsSection({ debtorId }: { debtorId: string }) {
  const { data: items } = useAttachments(debtorId);
  const { data: storage } = useStorageStatus();
  const upload = useUploadAttachment(debtorId);
  const removeAttachment = useDeleteAttachment(debtorId);
  const configured = storage?.configured ?? null;

  const general = (items ?? []).filter(
    (a) => a.kind === 'OTHER' || a.kind === 'SLIP',
  );
  const identity = (items ?? []).filter((a) => a.kind === 'ID_CARD');

  return (
    <div className="space-y-4">
      {configured === false && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          ยังไม่ได้ตั้งค่า Supabase Storage — ตั้ง SUPABASE_URL/SUPABASE_SERVICE_KEY
          ใน api/.env ก่อนจึงอัปโหลดได้
        </p>
      )}
      <AttachmentGallery
        title="รูปทั่วไป"
        countLabel="รูป"
        emptyHint="รูปลูกค้า สลิป หรือหลักฐานอื่น — เพิ่มได้ไม่จำกัด"
        items={general}
        uploadKind="OTHER"
        uploading={upload.isPending}
        disabled={configured === false}
        onUpload={async (files) => {
          for (const file of files) {
            const form = new FormData();
            form.append('file', file);
            form.append('kind', 'OTHER');
            await upload.mutateAsync(form);
          }
        }}
        onRemove={async (id) => {
          const ok = await confirmDialog({
            title: 'ลบรูปนี้?',
            confirmLabel: 'ลบรูป',
            danger: true,
          });
          if (!ok) return;
          await removeAttachment.mutateAsync(id);
        }}
      />
      <AttachmentGallery
        title="เอกสารยืนยันตัวตน"
        countLabel="เอกสาร"
        emptyHint="บัตรประชาชน / ทะเบียนบ้าน — แยกจากรูปทั่วไป"
        items={identity}
        uploadKind="ID_CARD"
        uploading={upload.isPending}
        disabled={configured === false}
        onUpload={async (files) => {
          for (const file of files) {
            const form = new FormData();
            form.append('file', file);
            form.append('kind', 'ID_CARD');
            await upload.mutateAsync(form);
          }
        }}
        onRemove={async (id) => {
          const ok = await confirmDialog({
            title: 'ลบเอกสารนี้?',
            confirmLabel: 'ลบเอกสาร',
            danger: true,
          });
          if (!ok) return;
          await removeAttachment.mutateAsync(id);
        }}
      />
    </div>
  );
}

function AttachmentGallery({
  title,
  countLabel,
  emptyHint,
  items,
  uploadKind,
  uploading,
  disabled,
  onUpload,
  onRemove,
}: {
  title: string;
  countLabel: string;
  emptyHint: string;
  items: Attachment[];
  uploadKind: AttachmentKind;
  uploading: boolean;
  disabled: boolean;
  onUpload: (files: File[]) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [error, setError] = useState('');
  const inputId = `attach-${uploadKind}`;

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list?.length) return;
    setError('');
    try {
      await onUpload(Array.from(list));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'อัปโหลดไม่สำเร็จ');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <section
      aria-labelledby={`${inputId}-heading`}
      className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id={`${inputId}-heading`}
            className="text-base font-semibold text-slate-900 dark:text-white"
          >
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-gray-400">
            {items.length} {countLabel}
          </p>
        </div>
        <label
          htmlFor={inputId}
          className={`inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 ${
            uploading || disabled ? 'pointer-events-none opacity-60' : ''
          }`}
        >
          <IconPlus className="size-4" />
          {uploading ? 'กำลังอัป…' : `เพิ่ม${countLabel}`}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          multiple
          disabled={uploading || disabled}
          onChange={(e) => void handleFiles(e)}
          className="sr-only"
        />
      </div>

      {error && (
        <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div
        className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4"
        aria-live="polite"
      >
        {items.map((a) => (
          <div key={a.id} className="group relative">
            <a href={a.url} target="_blank" rel="noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.url}
                alt={a.filename}
                className="aspect-square w-full rounded-xl border border-slate-200 object-cover dark:border-gray-800"
              />
            </a>
            {(a.kind === 'SLIP' || a.kind === 'ID_CARD') && (
              <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {attachKindLabel[a.kind]}
              </span>
            )}
            <button
              type="button"
              onClick={() => void onRemove(a.id)}
              className="absolute top-1.5 right-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
            >
              ลบ
            </button>
          </div>
        ))}

        <label
          htmlFor={inputId}
          className={`flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm font-semibold text-slate-500 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary dark:border-gray-700 dark:bg-gray-950/40 dark:text-gray-400 ${
            uploading || disabled ? 'pointer-events-none opacity-50' : ''
          }`}
        >
          <IconPlus className="size-5" />
          เพิ่ม{countLabel}
        </label>
      </div>

      {items.length === 0 && !disabled && (
        <p className="mt-3 text-sm text-slate-400 dark:text-gray-500">
          {emptyHint}
        </p>
      )}
    </section>
  );
}

function ConvertDeadModal({
  loan,
  onClose,
  onSaved,
}: {
  loan: Loan;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const convert = useConvertDead();
  const frozen = loan.outstandingPrincipal + loan.arrears;
  const saving = convert.isPending;

  const save = async () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) {
      setError('กรอกงวดผ่อน');
      return;
    }
    setError('');
    try {
      await convert.mutateAsync({ id: loan.id, installmentAmount: n });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    }
  };

  return (
    <ModalShell title="แปลงเป็นยอดตาย" onClose={onClose}>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        หยุดคิดดอกทันที ยอดจะถูกตรึงที่ <b>฿{baht(frozen)}</b> (ต้น{' '}
        {baht(loan.outstandingPrincipal)} + ค้าง {baht(loan.arrears)})
        แล้วผ่อนคืนทุก 10 วันจนหมด
      </p>
      <Field label="งวดผ่อน (บาท / 10 วัน) *">
        <TextInput
          type="number"
          inputMode="decimal"
          autoFocus
          align="right"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Field>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 rounded-lg border border-gray-300 py-2.5 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          ยกเลิก
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 rounded-lg bg-gray-800 py-2.5 font-semibold text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600"
        >
          ยืนยันแปลง
        </button>
      </div>
    </ModalShell>
  );
}
