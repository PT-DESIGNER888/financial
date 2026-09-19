'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { AuthGate } from '@/components/auth-gate';
import { BackButton } from '@/components/back-button';
import { Button } from '@/components/form';
import {
  IconEdit,
  IconFacebook,
  IconMessage,
  IconPhone,
  IconPlus,
  IconReceive,
  IconTrash,
} from '@/components/icons';
import { PaymentModal } from '@/components/payment-modal';
import { PageError } from '@/components/page-error';
import { PageSkeleton } from '@/components/skeleton';
import { confirmDialog } from '@/lib/confirm-store';
import { useDebtor, useDeleteDebtor } from '@/lib/hooks/useDebtors';
import { LoanStatus } from '@/lib/types';
import type { Loan } from '@/lib/types';
import { AdjustModal } from './_components/adjust-modal';
import { AttachmentsSection } from './_components/attachments';
import { ConvertDeadModal } from './_components/convert-dead-modal';
import { EditDebtorModal } from './_components/edit-debtor-modal';
import { EditLoanModal } from './_components/edit-loan-modal';
import { facebookDisplayName, resolveContacts } from './_components/helpers';
import { LoanCard } from './_components/loan-card';
import { PayoffModal } from './_components/payoff-modal';
import { ReasonModal } from './_components/reason-modal';
import { RefinanceModal } from './_components/refinance-modal';
import { DebtorSummaryStrip } from './_components/summary-strip';

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
  const { data: debtor, error, refetch } = useDebtor(id);
  const removeDebtor = useDeleteDebtor();
  const [editingDebtor, setEditingDebtor] = useState(false);
  const [paying, setPaying] = useState<Loan | null>(null);
  const [converting, setConverting] = useState<Loan | null>(null);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [adjusting, setAdjusting] = useState<Loan | null>(null);
  const [refinancing, setRefinancing] = useState<Loan | null>(null);
  const [payoffOpen, setPayoffOpen] = useState(false);
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
      <div className="space-y-4">
        <BackButton href="/debtors" label="ลูกหนี้" />
        <PageError message={error.message} onRetry={() => void refetch()} />
      </div>
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
  const activeLoans = loans.filter((l) => l.status === LoanStatus.ACTIVE);

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
                onClick={deleteDebtor}
                title="ลบลูกหนี้รายนี้"
                aria-label="ลบลูกหนี้รายนี้"
                className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-red-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:border-gray-700 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                <IconTrash className="size-5" />
              </button>
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
          <AttachmentsSection debtorId={id} />
        </section>
      </div>

      {debtor.financialSummary && (
        <DebtorSummaryStrip summary={debtor.financialSummary} />
      )}

      {activeLoans.length > 0 && (
        <div className="flex justify-end">
          <Button variant="secondary" onClick={() => setPayoffOpen(true)}>
            <IconReceive className="size-5" />
            รับปิดยอด ({activeLoans.length})
          </Button>
        </div>
      )}

      {open.map((loan) => (
        <LoanCard
          key={loan.id}
          loan={loan}
          onPay={() => setPaying(loan)}
          onConvert={() => setConverting(loan)}
          onRefinance={() => setRefinancing(loan)}
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
                onPay={() => setPaying(loan)}
                onAdjust={() => setAdjusting(loan)}
              />
            ))}
          </div>
        </details>
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
          frozen={
            paying.status === LoanStatus.DEAD ||
            paying.status === LoanStatus.INSTALLMENT ||
            paying.status === LoanStatus.BAD_DEBT
          }
          frozenLabel={
            paying.status === LoanStatus.BAD_DEBT ? 'ยอดหนี้สูญ' : 'ยอดผ่อน'
          }
          quickAmounts={
            paying.status === LoanStatus.DEAD ||
            paying.status === LoanStatus.INSTALLMENT
              ? [
                  {
                    label: 'งวดละ',
                    amount: Math.min(
                      paying.installmentAmount ?? 0,
                      paying.deadBalance ?? 0,
                    ),
                  },
                ]
              : paying.status === LoanStatus.BAD_DEBT
                ? []
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
      {refinancing && (
        <RefinanceModal
          loan={refinancing}
          onClose={() => setRefinancing(null)}
          onSaved={() => setRefinancing(null)}
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
      {payoffOpen && (
        <PayoffModal
          debtorName={debtor.name}
          loans={activeLoans}
          onClose={() => setPayoffOpen(false)}
          onSaved={() => setPayoffOpen(false)}
        />
      )}
    </div>
  );
}
