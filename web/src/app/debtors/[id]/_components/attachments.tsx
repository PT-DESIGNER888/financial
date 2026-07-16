'use client';

import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { IconPlus } from '@/components/icons';
import { confirmDialog } from '@/lib/confirm-store';
import {
  useAttachments,
  useDeleteAttachment,
  useStorageStatus,
  useUploadAttachment,
} from '@/lib/hooks/useAttachments';
import type { Attachment, AttachmentKind } from '@/lib/types';

const attachKindLabel: Record<AttachmentKind, string> = {
  SLIP: 'สลิปโอน',
  ID_CARD: 'บัตรประชาชน',
  OTHER: 'อื่นๆ',
};

export function AttachmentsSection({ debtorId }: { debtorId: string }) {
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

  const handleFiles = async (e: ChangeEvent<HTMLInputElement>) => {
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
