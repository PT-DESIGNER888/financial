'use client';

import { useState } from 'react';
import { AuthGate } from '@/components/auth-gate';
import {
  IconDownload,
  IconIn,
  IconOut,
  IconPlus,
  IconPrinter,
  IconWallet,
} from '@/components/icons';
import { DatePicker, MonthPicker } from '@/components/date-picker';
import {
  Button,
  ModalButtons,
  SelectMenu,
  TextInput,
} from '@/components/form';
import { PageSkeleton } from '@/components/skeleton';
import { downloadFile } from '@/lib/api';
import { baht, thaiDate } from '@/lib/format';
import {
  useAddCashTx,
  useCashPosition,
  useCashTxList,
  useDeleteCashTx,
  useMonthly,
  useSetOpening,
  useTrend,
} from '@/lib/hooks/useFinance';
import { confirmDialog } from '@/lib/confirm-store';
import { toast } from '@/lib/toast-store';
import type { CashTxType, LedgerEntry, TrendPoint } from '@/lib/types';

export default function FinancePage() {
  return (
    <AuthGate>
      <FinanceView />
    </AuthGate>
  );
}

function thisMonth() {
  return new Date().toISOString().slice(0, 7);
}

function FinanceView() {
  const [month, setMonth] = useState(thisMonth());
  const [editingOpening, setEditingOpening] = useState(false);
  const [addingTx, setAddingTx] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { data: cash, error } = useCashPosition();
  const { data: txs } = useCashTxList();
  const { data: trend = [] } = useTrend(30);
  // รายงานรายเดือน — โหลดใหม่อัตโนมัติเมื่อเปลี่ยนเดือน (query key ผูกกับ month)
  const { data: report } = useMonthly(month);
  const removeTx = useDeleteCashTx();

  const exportExcel = async () => {
    setIsExporting(true);
    try {
      await downloadFile(
        `/finance/export.xlsx?month=${month}`,
        `money-report-${month}.xlsx`,
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : 'ดาวน์โหลด Excel ไม่สำเร็จ', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  if (error)
    return (
      <p className="py-10 text-center text-red-600">{error.message}</p>
    );
  if (!cash || !txs) return <PageSkeleton />;

  const deleteTx = async (id: string) => {
    const ok = await confirmDialog({
      title: 'ลบรายการเงินสดนี้?',
      confirmLabel: 'ลบรายการ',
      danger: true,
    });
    if (!ok) return;
    try {
      await removeTx.mutateAsync(id);
      toast('ลบรายการแล้ว');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'ลบไม่สำเร็จ', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900 md:text-[1.75rem] dark:text-white">
            การเงิน & รายงาน
          </h1>
          <p className="text-[13px] leading-relaxed text-slate-500 dark:text-gray-400">
            เงินสดในมือ กระแสเงิน และสมุดธุรกรรม
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button
            variant="secondary"
            size="sm"
            onClick={exportExcel}
            disabled={isExporting}
          >
            <IconDownload className="size-4" />
            {isExporting ? 'กำลังสร้าง…' : 'Excel'}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <IconPrinter className="size-4" />
            PDF
          </Button>
        </div>
      </div>

      {/* เงินสดในมือ */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary/10">
              <IconWallet className="size-5 text-primary" />
            </span>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                เงินสดในมือตอนนี้
              </p>
              <p
                className={`text-3xl font-bold ${cash.cashInHand < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}
              >
                ฿{baht(cash.cashInHand)}
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEditingOpening(true)}
            className="print:hidden"
          >
            ตั้งเงินทุน
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Mini label="เงินทุนตั้งต้น" value={cash.openingCash} />
          <Mini label="เก็บเข้าสะสม" value={cash.collected} pos />
          <Mini label="ปล่อยกู้สะสม" value={cash.disbursed} neg />
          <Mini label="เติมทุน" value={cash.capitalIn} pos />
          <Mini label="ถอน+จ่าย" value={cash.capitalOut + cash.expense} neg />
          <Mini label="รายรับอื่น" value={cash.otherIncome} pos />
        </div>
      </section>

      {/* กราฟแนวโน้ม */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
          เก็บเงินได้ 30 วันล่าสุด
        </h2>
        <TrendChart data={trend} />
      </section>

      {/* รายงานรายเดือน */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            สรุปรายเดือน
          </h2>
          <MonthPicker
            value={month}
            onChange={setMonth}
            className="print:hidden"
          />
        </div>
        {report && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Mini label="เงินเข้า" value={report.cashIn} pos />
            <Mini label="เงินออก" value={report.cashOut} neg />
            <Mini
              label="สุทธิ"
              value={report.net}
              pos={report.net >= 0}
              neg={report.net < 0}
            />
            <Mini label="ดอกที่ได้" value={report.interestEarned} pos />
          </div>
        )}
      </section>

      {/* รายรับรายจ่าย */}
      <section className="rounded-2xl border border-slate-200/80 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            รายรับ-รายจ่าย & เงินทุน
          </h2>
          <Button
            size="sm"
            onClick={() => setAddingTx(true)}
            className="print:hidden"
          >
            <IconPlus className="size-4" />
            เพิ่ม
          </Button>
        </div>
        <div className="divide-y divide-gray-100 px-4 dark:divide-gray-800">
          {txs.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
              ยังไม่มีรายการ
            </p>
          )}
          {txs.map((t) => {
            const isIn = t.type === 'CAPITAL_IN' || t.type === 'INCOME';
            return (
              <div key={t.id} className="flex items-center gap-3 py-3">
                <span
                  className={`flex size-8 items-center justify-center rounded-full ${isIn ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-red-50 dark:bg-red-500/10'}`}
                >
                  {isIn ? (
                    <IconIn className="size-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <IconOut className="size-4 text-red-600 dark:text-red-400" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {cashTxLabel[t.type]}
                  </p>
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                    {thaiDate(t.date)}
                    {t.note ? ` · ${t.note}` : ''}
                  </p>
                </div>
                <span
                  className={`font-semibold ${isIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
                >
                  {isIn ? '+' : '−'}฿{baht(t.amount)}
                </span>
                <button
                  onClick={() => deleteTx(t.id)}
                  className="text-xs text-red-400 hover:text-red-500 print:hidden"
                >
                  ลบ
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* สมุดธุรกรรม */}
      <section className="rounded-2xl border border-slate-200/80 bg-white dark:border-gray-800 dark:bg-gray-900">
        <h2 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900 dark:border-gray-800 dark:text-white">
          สมุดธุรกรรม — {month}
        </h2>
        <Ledger entries={report?.entries ?? []} />
      </section>

      {editingOpening && (
        <OpeningModal
          current={cash.openingCash}
          onClose={() => setEditingOpening(false)}
          onSaved={() => setEditingOpening(false)}
        />
      )}
      {addingTx && (
        <CashTxModal
          onClose={() => setAddingTx(false)}
          onSaved={() => setAddingTx(false)}
        />
      )}
    </div>
  );
}

const cashTxLabel: Record<CashTxType, string> = {
  CAPITAL_IN: 'เติมทุน',
  CAPITAL_OUT: 'ถอนทุน',
  INCOME: 'รายรับอื่น',
  EXPENSE: 'รายจ่าย',
};

function Mini({
  label,
  value,
  pos,
  neg,
}: {
  label: string;
  value: number;
  pos?: boolean;
  neg?: boolean;
}) {
  const color = neg
    ? 'text-red-600 dark:text-red-400'
    : pos
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-gray-900 dark:text-white';
  return (
    <div className="rounded-lg bg-gray-50 p-2.5 dark:bg-gray-800/60">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-0.5 font-bold ${color}`}>฿{baht(value)}</p>
    </div>
  );
}

function TrendChart({ data }: { data: TrendPoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.collected));
  const W = 100;
  const barW = W / Math.max(data.length, 1);
  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} 40`}
        preserveAspectRatio="none"
        className="h-32 w-full min-w-[500px]"
      >
        {data.map((d, i) => {
          const h = (d.collected / max) * 36;
          return (
            <rect
              key={d.date}
              x={i * barW + barW * 0.15}
              y={38 - h}
              width={barW * 0.7}
              height={Math.max(h, d.collected > 0 ? 0.5 : 0)}
              rx={0.4}
              className="fill-primary"
            >
              <title>{`${thaiDate(d.date)}: ฿${baht(d.collected)}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-gray-400">
        <span>{data[0] ? thaiDate(data[0].date) : ''}</span>
        <span>{data.length ? thaiDate(data[data.length - 1].date) : ''}</span>
      </div>
    </div>
  );
}

function Ledger({ entries }: { entries: LedgerEntry[] }) {
  if (entries.length === 0)
    return (
      <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
        ไม่มีรายการในเดือนนี้
      </p>
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
            <th className="px-4 py-2 font-medium">วันที่</th>
            <th className="px-4 py-2 font-medium">ประเภท</th>
            <th className="px-4 py-2 font-medium">รายละเอียด</th>
            <th className="px-4 py-2 text-right font-medium">เข้า</th>
            <th className="px-4 py-2 text-right font-medium">ออก</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {entries.map((e, i) => (
            <tr key={i}>
              <td className="px-4 py-2 whitespace-nowrap text-gray-500 dark:text-gray-400">
                {thaiDate(e.date)}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-gray-900 dark:text-white">
                {e.kind}
              </td>
              <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                {e.detail}
              </td>
              <td className="px-4 py-2 text-right text-emerald-600 dark:text-emerald-400">
                {e.cashIn ? `฿${baht(e.cashIn)}` : ''}
              </td>
              <td className="px-4 py-2 text-right text-red-600 dark:text-red-400">
                {e.cashOut ? `฿${baht(e.cashOut)}` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OpeningModal({
  current,
  onClose,
  onSaved,
}: {
  current: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [cash, setCash] = useState(String(current));
  const [date] = useState('');
  const [error, setError] = useState('');
  const setOpening = useSetOpening();

  const save = async () => {
    try {
      await setOpening.mutateAsync({
        openingCash: parseFloat(cash) || 0,
        openingDate: date || undefined,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    }
  };

  return (
    <Modal title="ตั้งเงินทุนตั้งต้น" onClose={onClose}>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        เงินสดที่มีในมือ ณ วันเริ่มใช้ระบบ (ก่อนรวมเงินที่ปล่อยกู้/เก็บเข้ามา)
      </p>
      <div>
        <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">
          เงินทุน (บาท)
        </label>
        <TextInput
          type="number"
          inputMode="decimal"
          align="right"
          value={cash}
          onChange={(e) => setCash(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <ModalButtons
        onClose={onClose}
        onSave={save}
        saving={setOpening.isPending}
      />
    </Modal>
  );
}

function CashTxModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<CashTxType>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const addTx = useAddCashTx();

  const save = async () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) {
      setError('กรอกจำนวนเงิน');
      return;
    }
    try {
      await addTx.mutateAsync({ type, amount: n, date, note: note || undefined });
      toast('บันทึกรายการแล้ว');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    }
  };

  return (
    <Modal title="เพิ่มรายการเงินสด" onClose={onClose}>
      <div>
        <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">
          ประเภท
        </label>
        <SelectMenu
          value={type}
          onChange={setType}
          options={[
            { value: 'EXPENSE', label: 'รายจ่าย' },
            { value: 'INCOME', label: 'รายรับอื่น' },
            { value: 'CAPITAL_IN', label: 'เติมทุน' },
            { value: 'CAPITAL_OUT', label: 'ถอนทุน' },
          ]}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">
            จำนวน (บาท)
          </label>
          <TextInput
            type="number"
            inputMode="decimal"
            align="right"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">
            วันที่
          </label>
          <DatePicker value={date} onChange={setDate} />
        </div>
      </div>
      <TextInput
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="หมายเหตุ (ไม่บังคับ)"
        className="text-sm"
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <ModalButtons onClose={onClose} onSave={save} saving={addTx.isPending} />
    </Modal>
  );
}

function Modal({
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
        className="w-full max-w-md space-y-3 rounded-t-lg border border-gray-200 bg-white p-5 sm:rounded-lg dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
