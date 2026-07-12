'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { use, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AuthGate } from '@/components/auth-gate';
import {
  IconAdjust,
  IconBan,
  IconEdit,
  IconHistory,
  IconLock,
  IconPlus,
  IconReopen,
  IconTrash,
} from '@/components/icons';
import {
  Button,
  Field,
  ModalButtons,
  Segmented,
  SelectMenu,
  TextInput,
} from '@/components/form';
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
import {
  useAdjustLoan,
  useConvertDead,
  useCreateLoan,
  useDeleteLoan,
  useEditLoan,
  useLoanAction,
  useLoanSchedule,
  type CreateLoanInput,
} from '@/lib/hooks/useLoans';
import { useDeletePayment } from '@/lib/hooks/usePayments';
import { confirmDialog } from '@/lib/confirm-store';
import { toast } from '@/lib/toast-store';
import type {
  AttachmentKind,
  Debtor,
  InstallmentSchedule,
  Loan,
  ScheduleRowStatus,
} from '@/lib/types';


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
  const [addingLoan, setAddingLoan] = useState(false);
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
      l.status === 'ACTIVE' ||
      l.status === 'DEAD' ||
      l.status === 'INSTALLMENT',
  );
  const inactive = loans.filter(
    (l) => l.status === 'CLOSED' || l.status === 'BAD_DEBT',
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold text-gray-900 dark:text-white">
            <span className="truncate">{debtor.name}</span>
            {debtor.blacklisted && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-500/10 dark:text-red-400">
                บัญชีดำ
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {debtor.phone && (
              <a
                href={`tel:${debtor.phone}`}
                className="underline decoration-gray-300 underline-offset-2 hover:text-primary dark:decoration-gray-600"
              >
                {debtor.phone}
              </a>
            )}{' '}
            {debtor.note ? `· ${debtor.note}` : ''}
          </p>
          {(debtor.guarantorName || debtor.creditNote) && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {debtor.guarantorName && (
                <>
                  ผู้ค้ำ: {debtor.guarantorName}
                  {debtor.guarantorPhone && (
                    <>
                      {' '}
                      (
                      <a
                        href={`tel:${debtor.guarantorPhone}`}
                        className="underline decoration-gray-300 underline-offset-2 hover:text-primary dark:decoration-gray-600"
                      >
                        {debtor.guarantorPhone}
                      </a>
                      )
                    </>
                  )}
                </>
              )}
              {debtor.guarantorName && debtor.creditNote ? ' · ' : ''}
              {debtor.creditNote && `เครดิต: ${debtor.creditNote}`}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setEditingDebtor(true)}
            title="แก้ไขข้อมูลลูกหนี้"
            className="flex size-9 items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <IconEdit className="size-4" />
          </button>
          <Button onClick={() => setAddingLoan(true)}>
            <IconPlus className="size-4" />
            เปิดยอดใหม่
          </Button>
        </div>
      </div>

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
          <Button onClick={() => setAddingLoan(true)} className="mt-3">
            <IconPlus className="size-4" />
            เปิดยอดใหม่
          </Button>
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

      {addingLoan && (
        <NewLoanModal
          debtorId={id}
          onClose={() => setAddingLoan(false)}
          onSaved={() => setAddingLoan(false)}
        />
      )}
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
          frozen={paying.status === 'DEAD' || paying.status === 'INSTALLMENT'}
          quickAmounts={
            paying.status === 'DEAD' || paying.status === 'INSTALLMENT'
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
  const isInstallment = loan.status === 'INSTALLMENT';
  const isOpen =
    loan.status === 'ACTIVE' ||
    loan.status === 'DEAD' ||
    loan.status === 'INSTALLMENT';

  // โหลดเมื่อเปิดดูเท่านั้น (enabled) — mutation ที่กระทบยอดจะ invalidate ให้เอง
  const { data: schedule } = useLoanSchedule(
    loan.id,
    isInstallment && showSchedule,
  );
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
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex flex-wrap items-center gap-2 font-semibold text-gray-900 dark:text-white">
            {isInstallment
              ? `ผ่อนสินค้า · ${loan.installmentCount} งวด (${cycleLabel[loan.cycle]})`
              : `${cycleLabel[loan.cycle]} · ดอก ${loan.interestRatePercent}%/รอบ`}
            {!isInstallment && loan.interestMode === 'FLAT' && (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400">
                ดอกคงที่
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle[loan.status]}`}
            >
              {statusLabel[loan.status]}
            </span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            เปิดยอด {thaiDate(loan.startDate)} · ต้นเดิม ฿
            {baht(loan.principalOriginal)}
            {isInstallment &&
              ` · ผ่อนรวม ฿${baht(loan.installmentTotal)}`}
          </p>
        </div>
        {isOpen && onPay && (
          <Button size="sm" onClick={onPay} className="shrink-0">
            รับเงิน
          </Button>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {isInstallment ? (
          <>
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
              }/${loan.installmentCount} งวด`}
              color="text-emerald-500"
            />
          </>
        ) : loan.status === 'DEAD' ? (
          <>
            <Stat label="ยอดตายคงเหลือ" value={loan.deadBalance ?? 0} />
            <Stat label="งวดผ่อน/10วัน" value={loan.installmentAmount ?? 0} />
            <Stat
              label="ผ่อนแล้ว"
              value={payments
                .filter((p) => p.onDeadLoan)
                .reduce((s, p) => s + p.amount, 0)}
              color="text-emerald-500"
            />
          </>
        ) : (
          <>
            <Stat label="ต้นคงเหลือ" value={loan.outstandingPrincipal} />
            <Stat
              label="ค้างเก่า"
              value={loan.arrears}
              color={loan.arrears > 0 ? 'text-red-500' : undefined}
            />
            <Stat
              label="ตัดต้นแล้ว"
              value={principalCut}
              color="text-emerald-500"
            />
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="text-gray-500 underline hover:text-primary dark:text-gray-400"
        >
          ประวัติจ่าย ({payments.length})
        </button>
        {isInstallment && (
          <button
            onClick={() => setShowSchedule((v) => !v)}
            className="text-gray-500 underline hover:text-primary dark:text-gray-400"
          >
            ตารางผ่อน
          </button>
        )}
        {loan.status === 'ACTIVE' && onConvert && (
          <button
            onClick={onConvert}
            className="text-gray-500 underline hover:text-primary dark:text-gray-400"
          >
            แปลงเป็นยอดตาย
          </button>
        )}
        <button
          onClick={() => setShowManage((v) => !v)}
          className="text-gray-500 underline hover:text-primary dark:text-gray-400"
        >
          จัดการ
        </button>
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
        <ScheduleTable schedule={schedule ?? null} />
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
    <div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-800/60">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`font-bold ${color ?? 'text-gray-900 dark:text-white'}`}>
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
    <div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-800/60">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`font-bold ${color ?? 'text-gray-900 dark:text-white'}`}>
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
}: {
  schedule: InstallmentSchedule | null;
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
        className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-lg border border-gray-200 bg-white p-5 sm:rounded-lg dark:border-gray-800 dark:bg-gray-900"
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
  const [note, setNote] = useState(debtor.note ?? '');
  const [blacklisted, setBlacklisted] = useState(debtor.blacklisted);
  const [creditNote, setCreditNote] = useState(debtor.creditNote ?? '');
  const [guarantorName, setGuarantorName] = useState(
    debtor.guarantorName ?? '',
  );
  const [guarantorPhone, setGuarantorPhone] = useState(
    debtor.guarantorPhone ?? '',
  );
  const [error, setError] = useState('');
  const update = useUpdateDebtor(debtor.id);

  const save = async () => {
    if (!name.trim()) {
      setError('กรอกชื่อ');
      return;
    }
    try {
      await update.mutateAsync({
        name,
        phone,
        note,
        blacklisted,
        creditNote,
        guarantorName,
        guarantorPhone,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    }
  };

  return (
    <ModalShell title="แก้ข้อมูลลูกหนี้" onClose={onClose}>
      <Field label="ชื่อ *">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="เบอร์โทร">
        <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <label className="flex items-center gap-2 rounded-lg bg-red-50 p-2.5 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
        <input
          type="checkbox"
          checked={blacklisted}
          onChange={(e) => setBlacklisted(e.target.checked)}
        />
        ขึ้นบัญชีดำ (เตือนก่อนปล่อยกู้เพิ่ม)
      </label>
      <Field label="ประวัติเครดิต / พฤติกรรมการจ่าย">
        <TextInput
          value={creditNote}
          onChange={(e) => setCreditNote(e.target.value)}
          placeholder="เช่น จ่ายตรงเวลา, ชอบเลื่อน"
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="ผู้ค้ำประกัน">
          <TextInput
            value={guarantorName}
            onChange={(e) => setGuarantorName(e.target.value)}
          />
        </Field>
        <Field label="เบอร์ผู้ค้ำ">
          <TextInput
            value={guarantorPhone}
            onChange={(e) => setGuarantorPhone(e.target.value)}
          />
        </Field>
      </div>
      <Field label="หมายเหตุ">
        <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
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
  const [cycle, setCycle] = useState(loan.cycle);
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
            { value: 'DAILY', label: 'รายวัน' },
            { value: 'TEN_DAY', label: 'ราย 10 วัน' },
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
  const isDead = loan.status === 'DEAD' || loan.status === 'INSTALLMENT';
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
    loan.status === 'DEAD' || loan.status === 'INSTALLMENT'
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

function AttachmentsSection({ debtorId }: { debtorId: string }) {
  const [kind, setKind] = useState<AttachmentKind>('SLIP');
  const [error, setError] = useState('');
  const { data: items } = useAttachments(debtorId);
  const { data: storage } = useStorageStatus();
  const upload = useUploadAttachment(debtorId);
  const removeAttachment = useDeleteAttachment(debtorId);
  const configured = storage?.configured ?? null;
  const uploading = upload.isPending;

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', kind);
      await upload.mutateAsync(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'อัปโหลดไม่สำเร็จ');
    } finally {
      e.target.value = '';
    }
  };

  const remove = async (id: string) => {
    const ok = await confirmDialog({
      title: 'ลบไฟล์นี้?',
      confirmLabel: 'ลบไฟล์',
      danger: true,
    });
    if (!ok) return;
    await removeAttachment.mutateAsync(id);
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          ไฟล์แนบ (สลิป / บัตร)
        </h2>
        <div className="flex items-center gap-2">
          <SelectMenu
            size="sm"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'SLIP', label: 'สลิปโอน' },
              { value: 'ID_CARD', label: 'บัตรประชาชน' },
              { value: 'OTHER', label: 'อื่นๆ' },
            ]}
          />
          <label className="cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90">
            {uploading ? 'กำลังอัป…' : 'อัปโหลด'}
            <input
              type="file"
              accept="image/*"
              onChange={onFile}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {configured === false && (
        <p className="mt-2 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
          ยังไม่ได้ตั้งค่า Supabase Storage — ตั้ง SUPABASE_URL/SUPABASE_SERVICE_KEY
          ใน api/.env ก่อนจึงอัปโหลดได้
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      {items && items.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {items.map((a) => (
            <div key={a.id} className="group relative">
              <a href={a.url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.url}
                  alt={a.filename}
                  className="aspect-square w-full rounded-lg border border-gray-200 object-cover dark:border-gray-800"
                />
              </a>
              <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">
                {attachKindLabel[a.kind]}
              </span>
              <button
                onClick={() => remove(a.id)}
                className="absolute top-1 right-1 rounded bg-black/60 px-1 text-[10px] text-white opacity-0 group-hover:opacity-100"
              >
                ลบ
              </button>
            </div>
          ))}
        </div>
      )}
      {items && items.length === 0 && configured !== false && (
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
          ยังไม่มีไฟล์แนบ
        </p>
      )}
    </section>
  );
}

const loanSchema = z
  .object({
    loanType: z.enum(['REVOLVING', 'INSTALLMENT']),
    principalOriginal: z.string().min(1, 'กรอกเงินต้น'),
    interestRatePercent: z.string().optional(),
    cycle: z.enum(['DAILY', 'TEN_DAY']),
    interestMode: z.enum(['FLOATING', 'FLAT']),
    isExisting: z.boolean(),
    outstandingPrincipal: z.string().optional(),
    arrears: z.string().optional(),
    totalInterest: z.string().optional(),
    installmentCount: z.string().optional(),
    note: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    if (!(parseFloat(d.principalOriginal) > 0))
      ctx.addIssue({
        path: ['principalOriginal'],
        code: 'custom',
        message: 'ต้องมากกว่า 0',
      });
    if (d.loanType === 'REVOLVING') {
      if (!(parseFloat(d.interestRatePercent ?? '') > 0))
        ctx.addIssue({
          path: ['interestRatePercent'],
          code: 'custom',
          message: 'ต้องมากกว่า 0',
        });
    } else {
      const c = parseInt(d.installmentCount ?? '', 10);
      if (!(c >= 1))
        ctx.addIssue({
          path: ['installmentCount'],
          code: 'custom',
          message: 'อย่างน้อย 1 งวด',
        });
      const ti = parseFloat(d.totalInterest ?? '');
      if (isNaN(ti) || ti < 0)
        ctx.addIssue({
          path: ['totalInterest'],
          code: 'custom',
          message: 'กรอกดอกรวม (0 ได้)',
        });
    }
  });
type LoanForm = z.infer<typeof loanSchema>;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function NewLoanModal({
  debtorId,
  onClose,
  onSaved,
}: {
  debtorId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoanForm>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      loanType: 'REVOLVING',
      cycle: 'DAILY',
      interestMode: 'FLOATING',
      isExisting: false,
    },
  });
  const isExisting = watch('isExisting');
  const loanType = watch('loanType');
  const cycle = watch('cycle');
  const interestMode = watch('interestMode');
  const isInstallment = loanType === 'INSTALLMENT';

  // เลือกประเภทยอด — ตั้งรอบเริ่มต้นให้เหมาะกับแต่ละแบบ
  const pickType = (t: 'REVOLVING' | 'INSTALLMENT') => {
    setValue('loanType', t);
    setValue('cycle', t === 'INSTALLMENT' ? 'TEN_DAY' : 'DAILY');
  };

  // พรีวิวยอดผ่อนสินค้า
  const principalNum = parseFloat(watch('principalOriginal') || '') || 0;
  const interestNum = parseFloat(watch('totalInterest') || '') || 0;
  const countNum = parseInt(watch('installmentCount') || '', 10) || 0;
  const installmentTotal = round2(principalNum + interestNum);
  const perInstallment = countNum > 0 ? round2(installmentTotal / countNum) : 0;

  const createLoan = useCreateLoan();

  const onSubmit = async (data: LoanForm) => {
    setError('');
    try {
      const input: CreateLoanInput =
        data.loanType === 'INSTALLMENT'
          ? {
              debtorId,
              type: 'INSTALLMENT',
              principalOriginal: parseFloat(data.principalOriginal),
              installmentTotal: round2(
                parseFloat(data.principalOriginal) +
                  (parseFloat(data.totalInterest || '') || 0),
              ),
              installmentCount: parseInt(data.installmentCount || '', 10),
              cycle: data.cycle,
              note: data.note || undefined,
            }
          : {
              debtorId,
              principalOriginal: parseFloat(data.principalOriginal),
              interestRatePercent: parseFloat(data.interestRatePercent || ''),
              cycle: data.cycle,
              interestMode: data.interestMode,
              outstandingPrincipal:
                data.isExisting && data.outstandingPrincipal
                  ? parseFloat(data.outstandingPrincipal)
                  : undefined,
              arrears:
                data.isExisting && data.arrears
                  ? parseFloat(data.arrears)
                  : undefined,
              note: data.note || undefined,
            };
      await createLoan.mutateAsync(input);
      toast(
        data.loanType === 'INSTALLMENT'
          ? 'เปิดยอดผ่อนสินค้าแล้ว'
          : 'เปิดยอดใหม่แล้ว',
      );
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    }
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-lg border border-gray-200 bg-white p-5 sm:rounded-lg dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          เปิดยอดใหม่
        </h2>

        {/* เลือกประเภทยอดกู้ */}
        <Field label="ประเภทยอดกู้">
          <Segmented
            value={loanType}
            onChange={pickType}
            accent={isInstallment ? 'sky' : 'primary'}
            options={[
              { value: 'REVOLVING', label: 'ดอกลอย / คงที่' },
              { value: 'INSTALLMENT', label: 'ผ่อนสินค้า', hint: 'งวดเท่ากัน' },
            ]}
          />
        </Field>

        <div>
          <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">
            เงินต้น (บาท) *
          </label>
          <TextInput
            type="number"
            inputMode="decimal"
            align="right"
            {...register('principalOriginal')}
          />
          {errors.principalOriginal && (
            <p className="mt-1 text-sm text-red-500">
              {errors.principalOriginal.message}
            </p>
          )}
        </div>

        {isInstallment ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">
                  ดอกรวมทั้งสัญญา *
                </label>
                <TextInput
                  type="number"
                  inputMode="decimal"
                  align="right"
                  {...register('totalInterest')}
                />
                {errors.totalInterest && (
                  <p className="mt-1 text-sm text-red-500">
                    {errors.totalInterest.message}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">
                  จำนวนงวด *
                </label>
                <TextInput
                  type="number"
                  inputMode="numeric"
                  align="right"
                  {...register('installmentCount')}
                />
                {errors.installmentCount && (
                  <p className="mt-1 text-sm text-red-500">
                    {errors.installmentCount.message}
                  </p>
                )}
              </div>
            </div>

            <Field label="รอบผ่อน *">
              <Segmented
                value={cycle}
                onChange={(v) => setValue('cycle', v)}
                accent="sky"
                options={[
                  { value: 'TEN_DAY', label: 'ทุก 10 วัน' },
                  { value: 'DAILY', label: 'ทุกวัน' },
                ]}
              />
            </Field>

            {installmentTotal > 0 && countNum > 0 && (
              <div className="rounded-lg bg-sky-500/10 p-3 text-sm text-gray-700 dark:text-gray-200">
                ผ่อนรวม{' '}
                <b className="text-gray-900 dark:text-white">
                  ฿{baht(installmentTotal)}
                </b>{' '}
                ({countNum} งวด) — งวดละ{' '}
                <b className="text-sky-600 dark:text-sky-400">
                  ฿{baht(perInstallment)}
                </b>
              </div>
            )}
          </>
        ) : (
          <>
            <Field label="ดอก %/รอบ *">
              <TextInput
                type="number"
                step="0.001"
                inputMode="decimal"
                align="right"
                {...register('interestRatePercent')}
              />
              {errors.interestRatePercent && (
                <p className="mt-1 text-sm text-red-500">
                  {errors.interestRatePercent.message}
                </p>
              )}
            </Field>

            <Field label="รอบเก็บ *">
              <Segmented
                value={cycle}
                onChange={(v) => setValue('cycle', v)}
                options={[
                  { value: 'DAILY', label: 'รายวัน' },
                  { value: 'TEN_DAY', label: 'ราย 10 วัน' },
                ]}
              />
            </Field>

            <Field label="รูปแบบดอก">
              <Segmented
                value={interestMode}
                onChange={(v) => setValue('interestMode', v)}
                options={[
                  {
                    value: 'FLOATING',
                    label: 'ดอกลอย',
                    hint: 'ตัดต้นแล้วดอกลด',
                  },
                  {
                    value: 'FLAT',
                    label: 'ดอกคงที่',
                    hint: 'คิดจากต้นเดิม',
                  },
                ]}
              />
            </Field>

            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input type="checkbox" {...register('isExisting')} />
              เป็นยอดเก่าที่เดินอยู่แล้ว (กรอกยอดคงเหลือ ณ วันนี้)
            </label>

            {isExisting && (
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-amber-500/10 p-3">
                <div>
                  <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">
                    ต้นคงเหลือ
                  </label>
                  <TextInput
                    type="number"
                    inputMode="decimal"
                    align="right"
                    {...register('outstandingPrincipal')}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">
                    ดอกค้างสะสม
                  </label>
                  <TextInput
                    type="number"
                    inputMode="decimal"
                    align="right"
                    {...register('arrears')}
                  />
                </div>
              </div>
            )}
          </>
        )}

        <TextInput
          {...register('note')}
          placeholder="หมายเหตุ (ไม่บังคับ)"
          className="text-sm"
        />

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            ยกเลิก
          </Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            เปิดยอด
          </Button>
        </div>
      </form>
    </div>
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
