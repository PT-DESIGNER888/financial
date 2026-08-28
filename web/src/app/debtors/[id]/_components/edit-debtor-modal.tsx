'use client';

import { useState } from 'react';
import { FormInput, ModalButtons } from '@/components/form';
import { IconPlus } from '@/components/icons';
import { useUpdateDebtor } from '@/lib/hooks/useDebtors';
import type { Debtor, EmergencyContact } from '@/lib/types';
import { resolveContacts } from './helpers';
import { AttachmentsSection } from './attachments';
import { ModalShell } from './ui';

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
    <ModalShell title="แก้ข้อมูลลูกหนี้" onClose={onClose} size="xl">
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            ข้อมูลติดต่อ
          </h3>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-gray-400">
            ข้อมูลหลักสำหรับติดต่อและค้นหาลูกหนี้
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
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
        </div>
      </section>

      <section className="border-t border-slate-200 pt-5 dark:border-gray-800">
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
            <div className="grid gap-3 sm:grid-cols-2">
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
      </section>

      <section className="space-y-4 border-t border-slate-200 pt-5 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          ข้อมูลประกอบ
        </h3>
        <label className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          <input
            type="checkbox"
            checked={blacklisted}
            onChange={(e) => setBlacklisted(e.target.checked)}
          />
          ขึ้นบัญชีดำ (เตือนก่อนปล่อยกู้เพิ่ม)
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
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
        </div>
      </section>
      <details className="border-t border-slate-200 pt-5 dark:border-gray-800">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900 dark:text-white">
          รูปและเอกสาร
          <span className="ml-2 text-xs font-normal text-slate-500 dark:text-gray-400">
            เพิ่มหรือลบรูป
          </span>
        </summary>
        <AttachmentsSection debtorId={debtor.id} editable />
      </details>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <ModalButtons onClose={onClose} onSave={save} saving={update.isPending} />
    </ModalShell>
  );
}
