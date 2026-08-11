'use client';

import { useState } from 'react';
import { Button } from '@/components/form';
import {
  IconAdjust,
  IconBan,
  IconEdit,
  IconHistory,
  IconLock,
  IconReceive,
  IconReopen,
  IconSettings,
  IconTrash,
} from '@/components/icons';
import {
  baht,
  cycleLabel,
  statusLabel,
  thaiDate,
  thaiDateTime,
} from '@/lib/format';
import { useActivities } from '@/lib/hooks/useActivities';
import {
  useDeleteLoan,
  useLoanAction,
  useLoanCycles,
  useLoanSchedule,
} from '@/lib/hooks/useLoans';
import { useDeletePayment } from '@/lib/hooks/usePayments';
import { confirmDialog } from '@/lib/confirm-store';
import { toast } from '@/lib/toast-store';
import { LoanStatus } from '@/lib/types';
import type {
  InstallmentSchedule,
  Loan,
  ScheduleRowStatus,
} from '@/lib/types';
import { EditCycleModal } from './edit-cycle-modal';
import { ManageBtn, Stat, StatText } from './ui';

const statusStyle: Record<Loan['status'], string> = {
  ACTIVE:
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  DEAD: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  INSTALLMENT: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400',
  CLOSED: 'bg-primary/10 text-primary',
  BAD_DEBT: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
};

const scheduleRowStyle: Record<
  ScheduleRowStatus,
  { label: string; cls: string }
> = {
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

export function LoanCard({
  loan,
  onPay,
  onConvert,
  onRefinance,
  onEdit,
  onAdjust,
  onClose,
  onWriteOff,
}: {
  loan: Loan;
  onPay?: () => void;
  onConvert?: () => void;
  onRefinance?: () => void;
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
  const isBadDebt = loan.status === LoanStatus.BAD_DEBT;
  // ยอดขาดทุนที่ยังเก็บไม่ได้ — คิดแบบเดียวกับฝั่ง API (lossOf)
  const badDebtLoss =
    loan.deadDate != null || loan.installmentCount != null
      ? (loan.deadBalance ?? 0)
      : loan.outstandingPrincipal + loan.arrears;
  const recovered = payments
    .filter((p) => p.onDeadLoan)
    .reduce((s, p) => s + p.amount, 0);

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
          {loan.principalDueDate && (
            <p className="mt-1.5 inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              นัดคืนต้น {thaiDate(loan.principalDueDate)}
              {loan.principalDueAmount != null &&
                ` · ฿${baht(loan.principalDueAmount)}`}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowManage((v) => !v)}
            className="inline-flex min-h-12 items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-[15px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <IconSettings className="size-5" />
            จัดการ
          </button>
          {onPay && (isOpen || isBadDebt) && (
            <Button onClick={onPay}>
              <IconReceive className="size-5" />
              {isBadDebt ? 'รับเงินคืน' : 'รับเงิน'}
            </Button>
          )}
        </div>
      </div>

      <div
        className={`mt-4 grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 dark:border-gray-800 dark:bg-gray-800 ${
          isInstallment ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'
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
                      ((loan.installmentTotal ?? 0) - (loan.deadBalance ?? 0)) /
                        (loan.installmentAmount || 1),
                    )
              } / ${loan.installmentCount} งวด`}
              color="text-emerald-700 dark:text-emerald-400"
            />
          </>
        ) : loan.status === LoanStatus.DEAD ? (
          <>
            <Stat label="ยอดตายคงเหลือ" value={loan.deadBalance ?? 0} />
            {loan.installmentAmount ? (
              <Stat label="งวดผ่อน/10วัน" value={loan.installmentAmount} />
            ) : (
              <StatText label="งวดผ่อน" value="ทยอยคืน ไม่มีกำหนด" />
            )}
            <Stat
              label="ผ่อนแล้ว"
              value={payments
                .filter((p) => p.onDeadLoan)
                .reduce((s, p) => s + p.amount, 0)}
              color="text-emerald-700 dark:text-emerald-400"
            />
          </>
        ) : isBadDebt ? (
          <>
            <Stat
              label="ยอดหนี้สูญคงเหลือ"
              value={badDebtLoss}
              color="text-red-600 dark:text-red-400"
            />
            <Stat
              label="เก็บคืนได้แล้ว"
              value={recovered}
              color="text-emerald-700 dark:text-emerald-400"
            />
            <Stat label="ต้นเดิม" value={loan.principalOriginal} />
          </>
        ) : (
          <>
            <Stat label="ต้นคงเหลือ" value={loan.outstandingPrincipal} />
            <Stat
              label="ค้างเก่า"
              value={loan.arrears}
              color={
                loan.arrears > 0 ? 'text-red-600 dark:text-red-400' : undefined
              }
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
          {isOpen && onEdit && (
            <ManageBtn onClick={onEdit} icon={<IconEdit className="size-3.5" />}>
              {isInstallment ? 'แก้แผนผ่อน' : 'แก้เงื่อนไข'}
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
          {isOpen && onRefinance && (
            <ManageBtn
              onClick={onRefinance}
              icon={<IconReopen className="size-3.5" />}
            >
              รียอด
            </ManageBtn>
          )}
          {isOpen && onClose && (
            <ManageBtn onClick={onClose} icon={<IconLock className="size-3.5" />}>
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
            <p className="text-gray-400 dark:text-gray-500">
              ยังไม่มีประวัติจัดการ
            </p>
          )}
          {log.map((a) => (
            <div key={a.id} className="flex justify-between gap-2">
              <span className="text-gray-700 dark:text-gray-300">
                {a.message}
                {a.reason && <span className="text-gray-400"> — {a.reason}</span>}
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
