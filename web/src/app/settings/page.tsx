'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { AuthGate } from '@/components/auth-gate';
import { BackButton } from '@/components/back-button';
import {
  IconAlert,
  IconBell,
  IconDownload,
  IconLock,
  IconSend,
} from '@/components/icons';
import { Button, TextInput } from '@/components/form';
import { PageSkeleton } from '@/components/skeleton';
import { api, downloadFile } from '@/lib/api';
import { confirmDialog } from '@/lib/confirm-store';
import { baht } from '@/lib/format';
import {
  useNotifyConfig,
  useOverdue,
  usePreviewDailySummary,
  useSaveNotifyConfig,
  useSendDailySummary,
} from '@/lib/hooks/useNotify';

export default function SettingsPage() {
  return (
    <AuthGate>
      <SettingsView />
    </AuthGate>
  );
}

function SettingsView() {
  const { data: config } = useNotifyConfig();
  const { data: overdue = [] } = useOverdue();
  const saveConfigMutation = useSaveNotifyConfig();
  const previewMutation = usePreviewDailySummary();
  const sendMutation = useSendDailySummary();
  const [token, setToken] = useState('');
  const [targetId, setTargetId] = useState('');
  const [msg, setMsg] = useState('');
  const [preview, setPreview] = useState('');
  const [sendResult, setSendResult] = useState('');
  const saving = saveConfigMutation.isPending;

  // เติม targetId เดิมจาก config ครั้งแรก
  useEffect(() => {
    if (config?.targetId) setTargetId((v) => v || config.targetId!);
  }, [config?.targetId]);

  if (!config) return <PageSkeleton />;

  const saveConfig = async () => {
    setMsg('');
    try {
      await saveConfigMutation.mutateAsync({ token, targetId });
      setToken('');
      setMsg('บันทึกแล้ว');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    }
  };

  const doPreview = async () => {
    const r = await previewMutation.mutateAsync();
    setPreview(r.message);
  };

  const doSend = async () => {
    setSendResult('');
    const r = await sendMutation.mutateAsync();
    setSendResult(
      r.sent ? '✅ ส่งเข้า LINE แล้ว' : `❌ ${r.reason ?? 'ส่งไม่สำเร็จ'}`,
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <BackButton href="/" label="กลับ" />
        <div className="mt-1 space-y-1">
          <h1 className="text-2xl font-bold text-slate-900 md:text-[1.75rem] dark:text-white">
            ตั้งค่า
          </h1>
          <p className="text-sm leading-relaxed text-slate-500 dark:text-gray-400">
            แจ้งเตือน LINE และการติดตามยอดค้าง
          </p>
        </div>
      </div>

      {/* LINE */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-3 flex items-center gap-2">
          <IconBell className="size-5 text-primary" />
          <h2 className="font-semibold text-gray-900 dark:text-white">
            แจ้งเตือน LINE
          </h2>
          <span
            className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${
              config.configured
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
            }`}
          >
            {config.configured ? 'เชื่อมแล้ว' : 'ยังไม่เชื่อม'}
          </span>
        </div>

        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          สร้าง LINE Official Account → Messaging API แล้วนำ Channel access token
          + User ID ผู้รับมาใส่ (เว้นว่าง token ไว้ได้ถ้าไม่ต้องการเปลี่ยน)
        </p>

        <div className="space-y-2">
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">
              Channel access token
            </label>
            <TextInput
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={config.hasToken ? '•••• (ตั้งไว้แล้ว)' : ''}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">
              User ID ผู้รับ
            </label>
            <TextInput
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={saveConfig}
              disabled={saving || !token || !targetId}
            >
              บันทึกการเชื่อมต่อ
            </Button>
            {msg && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {msg}
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={doPreview}>
              ดูตัวอย่างสรุปวันนี้
            </Button>
            <Button variant="secondary" size="sm" onClick={doSend}>
              <IconSend className="size-4" />
              ส่งสรุปเข้า LINE ตอนนี้
            </Button>
          </div>
          {preview && (
            <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs whitespace-pre-wrap text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {preview}
            </pre>
          )}
          {sendResult && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {sendResult}
            </p>
          )}
        </div>
      </section>

      {/* ยอดค้าง */}
      <section className="rounded-2xl border border-slate-200/80 bg-white dark:border-gray-800 dark:bg-gray-900">
        <h2 className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900 dark:border-gray-800 dark:text-white">
          <IconAlert className="size-4.5 text-red-500" />
          ยอดค้างที่ต้องตาม ({overdue.length})
        </h2>
        <div className="divide-y divide-gray-100 px-4 dark:divide-gray-800">
          {overdue.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
              ไม่มียอดค้าง 🎉
            </p>
          )}
          {overdue.map((o) => (
            <Link
              key={o.loanId}
              href={`/debtors/${o.debtorId}`}
              className="flex items-center justify-between py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
              <span className="font-medium text-gray-900 dark:text-white">
                {o.debtorName}
              </span>
              <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                ค้าง ฿{baht(o.arrears)}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <ChangePassword />
      <BackupRestore />
    </div>
  );
}

function ChangePassword() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const save = async () => {
    setMsg('');
    if (next.length < 6) {
      setMsg('รหัสใหม่ต้องอย่างน้อย 6 ตัว');
      return;
    }
    setSaving(true);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      setCurrent('');
      setNext('');
      setMsg('✅ เปลี่ยนรหัสแล้ว');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'เปลี่ยนไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3 flex items-center gap-2">
        <IconLock className="size-5 text-primary" />
        <h2 className="font-semibold text-gray-900 dark:text-white">
          เปลี่ยนรหัสผ่าน
        </h2>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <TextInput
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="รหัสเดิม"
        />
        <TextInput
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="รหัสใหม่ (≥ 6 ตัว)"
        />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Button onClick={save} disabled={saving || !current || !next}>
          เปลี่ยนรหัส
        </Button>
        {msg && (
          <span className="text-sm text-gray-500 dark:text-gray-400">{msg}</span>
        )}
      </div>
    </section>
  );
}

function BackupRestore() {
  const [msg, setMsg] = useState('');
  const [importing, setImporting] = useState(false);
  const qc = useQueryClient();

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ok = await confirmDialog({
      title: 'กู้คืนข้อมูลจากไฟล์นี้?',
      detail: 'ข้อมูลปัจจุบันทั้งหมดจะถูกลบแล้วแทนที่ด้วยข้อมูลในไฟล์',
      confirmLabel: 'กู้คืนข้อมูล',
      danger: true,
    });
    if (!ok) {
      e.target.value = '';
      return;
    }
    setMsg('');
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await api('/backup/import', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      // ข้อมูลถูกแทนที่ทั้งหมด — ล้าง cache ทุก query
      qc.clear();
      setMsg('✅ กู้คืนสำเร็จ');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'กู้คืนไม่สำเร็จ');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3 flex items-center gap-2">
        <IconDownload className="size-5 text-primary" />
        <h2 className="font-semibold text-gray-900 dark:text-white">
          สำรอง & กู้คืนข้อมูล
        </h2>
      </div>
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
        สำรองข้อมูลทั้งหมดเป็นไฟล์ JSON เก็บไว้ (ยกเว้นรหัสผ่าน) — กู้คืนจะแทนที่ข้อมูลปัจจุบันทั้งหมด
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            downloadFile(
              '/backup/export',
              `money-backup-${new Date().toISOString().slice(0, 10)}.json`,
            )
          }
        >
          <IconDownload className="size-4" />
          ดาวน์โหลดสำรอง
        </Button>
        <label className="cursor-pointer rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10">
          {importing ? 'กำลังกู้คืน…' : 'กู้คืนจากไฟล์'}
          <input
            type="file"
            accept="application/json,.json"
            onChange={onImport}
            disabled={importing}
            className="hidden"
          />
        </label>
        {msg && (
          <span className="text-sm text-gray-500 dark:text-gray-400">{msg}</span>
        )}
      </div>
    </section>
  );
}
