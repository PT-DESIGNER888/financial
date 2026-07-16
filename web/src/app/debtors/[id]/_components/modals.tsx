'use client';

import { useState } from 'react';
import { DatePicker } from '@/components/date-picker';
import {
  Field,
  FormInput,
  ModalButtons,
  Segmented,
  TextInput,
} from '@/components/form';
import { IconPlus } from '@/components/icons';
import { baht } from '@/lib/format';
import { useUpdateDebtor } from '@/lib/hooks/useDebtors';
import {
  useAdjustLoan,
  useConvertDead,
  useEditLoan,
  useLoanAction,
  useUpdateCycle,
} from '@/lib/hooks/useLoans';
import { toast } from '@/lib/toast-store';
import { LoanCycle, LoanStatus } from '@/lib/types';
import type {
  CurrentCycle,
  Debtor,
  EmergencyContact,
  Loan,
  RevolvingCycle,
} from '@/lib/types';
import { resolveContacts } from './helpers';
import { ModalShell } from './ui';

export function EditCycleModal({
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

export function EditDebtorModal({
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

export function EditLoanModal({
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

export function AdjustModal({
  loan,
  onClose,
  onSaved,
}: {
  loan: Loan;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isDead =
    loan.status === LoanStatus.DEAD || loan.status === LoanStatus.INSTALLMENT;
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

export function ReasonModal({
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
    <ModalShell title={isWriteOff ? 'ตัดหนี้สูญ' : 'ปิดยอดเอง'} onClose={onClose}>
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
        <TextInput value={reason} onChange={(e) => setReason(e.target.value)} />
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

export function ConvertDeadModal({
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
