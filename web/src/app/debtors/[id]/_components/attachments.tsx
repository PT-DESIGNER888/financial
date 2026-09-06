'use client';

import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { IconPlus } from '@/components/icons';
import { confirmDialog } from '@/lib/confirm-store';
import { fetchAuthedBlob } from '@/lib/api';
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

export function AttachmentsSection({
  debtorId,
  editable = false,
}: {
  debtorId: string;
  /** หน้าข้อมูลใช้ดูอย่างเดียว; ปุ่มเพิ่ม/ลบอยู่ในหน้าต่างแก้ไข */
  editable?: boolean;
}) {
  const { data: items } = useAttachments(debtorId);
  const { data: storage } = useStorageStatus();
  const upload = useUploadAttachment(debtorId);
  const removeAttachment = useDeleteAttachment(debtorId);
  const configured = storage?.configured ?? null;
  const [preview, setPreview] = useState<Attachment | null>(null);

  const general = (items ?? []).filter(
    (a) => a.kind === 'OTHER' || a.kind === 'SLIP',
  );
  const identity = (items ?? []).filter((a) => a.kind === 'ID_CARD');
  const hasItems = general.length + identity.length > 0;
  // มีไว้ดู layout ระหว่างพัฒนาเท่านั้น — ไม่แสดงในระบบจริงและไม่ถูกบันทึกเป็นข้อมูลลูกหนี้
  const showSamples =
    process.env.NODE_ENV === 'development' && !editable && !hasItems;
  const sampleBase = {
    debtorId,
    url: '/demo-attachment-sample.png',
    note: null,
    createdAt: new Date(0).toISOString(),
  };
  const shownGeneral = showSamples
    ? [
        {
          ...sampleBase,
          id: 'sample-general-1',
          kind: 'OTHER' as AttachmentKind,
          filename: 'ตัวอย่างรูปเอกสาร.jpg',
        },
        {
          ...sampleBase,
          id: 'sample-general-2',
          kind: 'OTHER' as AttachmentKind,
          filename: 'ตัวอย่างหลักฐาน.jpg',
        },
      ]
    : general;
  const shownIdentity = showSamples
    ? [
        {
          ...sampleBase,
          id: 'sample-identity',
          kind: 'ID_CARD' as AttachmentKind,
          filename: 'ตัวอย่างเอกสารยืนยันตัวตน.jpg',
        },
      ]
    : identity;

  if (!editable && !hasItems && !showSamples) return null;

  return (
    <section className="mt-5 border-t border-slate-100 pt-4 dark:border-gray-800">
      {editable && configured === false && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          ยังไม่ได้ตั้งค่า Supabase Storage — ตั้ง SUPABASE_URL/SUPABASE_SERVICE_KEY
          ใน api/.env ก่อนจึงอัปโหลดได้
        </p>
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            รูปและเอกสาร
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-gray-400">
            {showSamples ? 'ตัวอย่างการแสดงผล — แตะรูปเพื่อดูขนาดใหญ่' : 'แตะรูปเพื่อดูขนาดใหญ่'}
          </p>
        </div>
      </div>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <AttachmentGallery
          title="รูปทั่วไป"
          countLabel="รูป"
          emptyHint="รูปลูกค้า สลิป หรือหลักฐานอื่น"
          items={shownGeneral}
          uploadKind="OTHER"
          uploading={upload.isPending}
          disabled={configured === false}
          editable={editable}
          onPreview={setPreview}
          onUpload={async (files) => {
            for (const file of files) {
              const form = new FormData();
              form.append('file', file);
              form.append('kind', 'OTHER');
              await upload.mutateAsync(form);
            }
          }}
          onRemove={async (id) => {
            const ok = await confirmDialog({ title: 'ลบรูปนี้?', confirmLabel: 'ลบรูป', danger: true });
            if (ok) await removeAttachment.mutateAsync(id);
          }}
        />
        <AttachmentGallery
          title="เอกสารยืนยันตัวตน"
          countLabel="เอกสาร"
          emptyHint="บัตรประชาชน / ทะเบียนบ้าน"
          items={shownIdentity}
          uploadKind="ID_CARD"
          uploading={upload.isPending}
          disabled={configured === false}
          editable={editable}
          onPreview={setPreview}
          onUpload={async (files) => {
            for (const file of files) {
              const form = new FormData();
              form.append('file', file);
              form.append('kind', 'ID_CARD');
              await upload.mutateAsync(form);
            }
          }}
          onRemove={async (id) => {
            const ok = await confirmDialog({ title: 'ลบเอกสารนี้?', confirmLabel: 'ลบเอกสาร', danger: true });
            if (ok) await removeAttachment.mutateAsync(id);
          }}
        />
      </div>
      {preview && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`ดูรูป ${preview.filename}`}
          onClick={() => setPreview(null)}
        >
          <div
            className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-gray-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-gray-800">
              <p className="min-w-0 truncate text-sm font-semibold text-slate-900 dark:text-white">
                {preview.filename}
              </p>
              <button type="button" onClick={() => setPreview(null)} className="min-h-10 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-gray-800">
                ปิด
              </button>
            </div>
            <AttachmentImage
              attachment={preview}
              alt={preview.filename}
              className="max-h-[75vh] w-full bg-slate-100 object-contain dark:bg-gray-950"
            />
          </div>
        </div>
      )}
    </section>
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
  editable,
  onPreview,
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
  editable: boolean;
  onPreview: (attachment: Attachment) => void;
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
    <section aria-labelledby={`${inputId}-heading`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3
            id={`${inputId}-heading`}
            className="text-base font-semibold text-slate-900 dark:text-white"
          >
            {title}
          </h3>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-gray-400">
            {items.length} {countLabel}
          </p>
        </div>
        {editable && (
          <>
            <label
              htmlFor={inputId}
              className={`inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 ${
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
          </>
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div
        className="mt-3 flex flex-wrap gap-2"
        aria-live="polite"
      >
        {items.map((a) => (
          <div key={a.id} className="group relative size-20 sm:size-24">
            <button type="button" onClick={() => onPreview(a)} className="block size-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <AttachmentImage
                attachment={a}
                alt={a.filename}
                className="size-full rounded-xl border border-slate-200 object-cover dark:border-gray-800"
              />
            </button>
            {(a.kind === 'SLIP' || a.kind === 'ID_CARD') && (
              <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {attachKindLabel[a.kind]}
              </span>
            )}
            {editable && (
              <button
                type="button"
                onClick={() => void onRemove(a.id)}
                className="absolute top-1.5 right-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
              >
                ลบ
              </button>
            )}
          </div>
        ))}

        {editable && (
          <label
            htmlFor={inputId}
            className={`flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-xs font-semibold text-slate-500 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary sm:size-24 dark:border-gray-700 dark:bg-gray-950/40 dark:text-gray-400 ${
              uploading || disabled ? 'pointer-events-none opacity-50' : ''
            }`}
          >
            <IconPlus className="size-5" />
            เพิ่ม{countLabel}
          </label>
        )}
      </div>

      {editable && items.length === 0 && !disabled && (
        <p className="mt-2 text-xs text-slate-400 dark:text-gray-500">
          {emptyHint}
        </p>
      )}
    </section>
  );
}

function attachmentSrcPath(attachment: Attachment): string {
  if (attachment.id.startsWith('sample-')) return attachment.url;
  return `/attachments/${attachment.id}/file`;
}

function AttachmentImage({
  attachment,
  alt,
  className,
}: {
  attachment: Attachment;
  alt: string;
  className?: string;
}) {
  const path = attachmentSrcPath(attachment);
  const local = path.startsWith('/') && !path.startsWith('/attachments/');
  const [src, setSrc] = useState<string | null>(local ? path : null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (local) {
      setSrc(path);
      setFailed(false);
      return;
    }
    let objectUrl: string | undefined;
    let cancelled = false;
    setSrc(null);
    setFailed(false);
    void fetchAuthedBlob(path)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [local, path]);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 text-center text-[11px] font-medium text-slate-500 dark:bg-gray-800 dark:text-gray-400 ${className ?? ''}`}
      >
        เปิดรูปไม่ได้
      </div>
    );
  }
  if (!src) {
    return (
      <div
        aria-hidden
        className={`animate-pulse bg-slate-100 dark:bg-gray-800 ${className ?? ''}`}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
    />
  );
}
