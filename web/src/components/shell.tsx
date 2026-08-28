'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import {
  IconChart,
  IconCoins,
  IconDoc,
  IconList,
  IconLogout,
  IconMore,
  IconMoon,
  IconOverdue,
  IconSettings,
  IconSun,
  IconUsers,
} from '@/components/icons';
import { BrandLogo } from '@/components/brand-logo';
import { ConfirmHost } from '@/components/confirm-host';
import { Toaster } from '@/components/toaster';
import { useAuthStore } from '@/lib/auth-store';

const menu = [
  {
    group: 'ประจำวัน',
    items: [
      { href: '/', label: 'เก็บวันนี้', short: 'วันนี้', Icon: IconList },
      {
        href: '/arrears',
        label: 'ยอดค้าง',
        short: 'ค้าง',
        Icon: IconOverdue,
      },
    ],
  },
  {
    group: 'จัดการ',
    items: [
      { href: '/debtors', label: 'ลูกหนี้', short: 'ลูกหนี้', Icon: IconUsers },
      { href: '/loans', label: 'สัญญาเงินกู้', short: 'สัญญา', Icon: IconDoc },
    ],
  },
  {
    group: 'รายงาน',
    items: [
      {
        href: '/summary',
        label: 'ภาพรวมธุรกิจ',
        short: 'ภาพรวม',
        Icon: IconChart,
      },
      {
        href: '/finance',
        label: 'การเงิน & รายงาน',
        short: 'การเงิน',
        Icon: IconCoins,
      },
    ],
  },
];

const flat = menu.flatMap((g) => g.items);

const subscribeTheme = (cb: () => void) => {
  window.addEventListener('themechange', cb);
  return () => window.removeEventListener('themechange', cb);
};

function useTheme() {
  // อ่านสถานะจริงจาก DOM (external store) — เลี่ยง setState ใน effect
  const dark = useSyncExternalStore(
    subscribeTheme,
    () => document.documentElement.classList.contains('dark'),
    () => false,
  );
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('money-theme', next ? 'dark' : 'light');
    window.dispatchEvent(new Event('themechange'));
  };
  return { dark, toggle };
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { accessToken, clear } = useAuthStore();
  const { dark, toggle } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (pathname === '/login')
    return (
      <>
        {children}
        <Toaster />
      </>
    );

  const active = flat.find((t) =>
    t.href === '/' ? pathname === '/' : pathname.startsWith(t.href),
  );
  const settingsActive = pathname.startsWith('/settings');
  const mobileItems = flat.slice(0, 4);
  const mobileMoreActive =
    settingsActive || !mobileItems.some((item) => item.href === active?.href);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — desktop */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-[#d7dce3] bg-white md:flex print:hidden dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-2.5 px-4 pt-5 pb-4">
          <BrandLogo size="md" />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold text-slate-900 dark:text-white">
              ระบบเงินกู้
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-gray-400">
              ดอกลอย · รายวัน / 10 วัน
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-2.5 pb-4">
          {menu.map((g) => (
            <div key={g.group}>
              <p className="mb-1 px-2.5 text-xs font-medium text-slate-400 dark:text-gray-500">
                {g.group}
              </p>
              <div className="space-y-0.5">
                {g.items.map((t) => {
                  const isActive = active?.href === t.href;
                  return (
                    <Link
                      key={t.href}
                      href={t.href}
                      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[15px] font-medium transition-colors ${
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'
                      }`}
                    >
                      <t.Icon
                        className={`size-5 shrink-0 ${isActive ? 'text-primary' : 'text-slate-400 dark:text-gray-500'}`}
                      />
                      {t.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-2.5 dark:border-gray-800">
          <Link
            href="/settings"
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[15px] font-medium transition-colors ${
              settingsActive
                ? 'bg-primary/10 text-primary'
                : 'text-slate-600 hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            <IconSettings className="size-5 text-slate-400 dark:text-gray-500" />
            ตั้งค่า
          </Link>
        </div>
      </aside>

      {/* Content */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col md:pl-60 print:pl-0">
        <header className="sticky top-0 z-10 border-b border-[#d7dce3] bg-white print:hidden dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between gap-3 px-4 py-3.5 md:px-10 lg:px-12">
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-slate-900 md:hidden dark:text-white">
                {active?.label ?? (settingsActive ? 'ตั้งค่า' : 'ระบบเงินกู้')}
              </p>
              <div className="hidden md:block">
                <p className="text-xl font-bold text-slate-900 dark:text-white">
                  {active?.label ??
                    (settingsActive ? 'ตั้งค่า' : 'ระบบเงินกู้')}
                </p>
                <p className="text-[13px] text-slate-500 dark:text-gray-400">
                  {new Date().toLocaleDateString('th-TH', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
            <div className="hidden items-center gap-1.5 md:flex">
              <Link
                href="/settings"
                title="ตั้งค่า"
                aria-label="ตั้งค่า"
                className="flex size-11 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <IconSettings className="size-6" />
              </Link>
              <button
                onClick={toggle}
                title="สลับโหมดสว่าง/มืด"
                aria-label="สลับโหมดสว่าง/มืด"
                className="flex size-11 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {dark ? (
                  <IconSun className="size-6" />
                ) : (
                  <IconMoon className="size-6" />
                )}
              </button>
              {accessToken && (
                <button
                  onClick={() => {
                    clear();
                    router.push('/login');
                  }}
                  className="flex size-11 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 md:size-auto md:gap-2 md:px-4 md:py-2.5 md:text-[15px] md:font-semibold dark:text-gray-300 dark:hover:bg-gray-800"
                  aria-label="ออกจากระบบ"
                  title="ออกจากระบบ"
                >
                  <IconLogout className="size-6 md:size-5" />
                  <span className="hidden md:inline">ออกจากระบบ</span>
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 pt-6 pb-[calc(6.25rem+env(safe-area-inset-bottom))] md:px-10 md:pt-10 md:pb-12 lg:px-12">
          {children}
        </main>
      </div>

      <ConfirmHost />
      <Toaster />

      {/* Bottom nav — mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[#d7dce3] bg-white pb-[env(safe-area-inset-bottom)] md:hidden print:hidden dark:border-gray-800 dark:bg-gray-900">
        <div className="flex">
          {mobileItems.map((t) => {
            const isActive = active?.href === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-1 px-0 pt-2.5 pb-2 text-[11px] transition-colors ${
                  isActive
                    ? 'font-semibold text-primary'
                    : 'font-medium text-slate-400 dark:text-gray-500'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span
                  className={`flex size-9 items-center justify-center rounded-xl ${
                    isActive ? 'bg-primary/10' : ''
                  }`}
                >
                  <t.Icon className="size-6" />
                </span>
                <span className="max-w-full truncate leading-none">
                  {t.short}
                </span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-1 px-0 pt-2.5 pb-2 text-[11px] transition-colors ${
              mobileMoreActive
                ? 'font-semibold text-primary'
                : 'font-medium text-slate-500 dark:text-gray-400'
            }`}
          >
            <span
              className={`flex size-9 items-center justify-center rounded-xl ${
                mobileMoreActive ? 'bg-primary/10' : ''
              }`}
            >
              <IconMore className="size-6" />
            </span>
            <span className="leading-none">เพิ่มเติม</span>
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 flex items-end bg-slate-950/40 p-3 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <section
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="เมนูเพิ่มเติม"
            className="w-full rounded-2xl bg-white p-4 shadow-xl dark:bg-gray-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  เมนูเพิ่มเติม
                </h2>
                <p className="text-sm text-slate-500 dark:text-gray-400">
                  เลือกรายการที่ต้องการใช้งาน
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="min-h-11 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                ปิด
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {flat.slice(4).map((item) => {
                const isActive = active?.href === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex min-h-14 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <item.Icon className="size-5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              <Link
                href="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex min-h-14 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors ${
                  settingsActive
                    ? 'bg-primary/10 text-primary'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <IconSettings className="size-5 shrink-0" />
                ตั้งค่า
              </Link>
              <button
                type="button"
                onClick={toggle}
                className="flex min-h-14 items-center gap-2 rounded-xl bg-slate-50 px-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                {dark ? <IconSun className="size-5" /> : <IconMoon className="size-5" />}
                {dark ? 'ใช้โหมดสว่าง' : 'ใช้โหมดมืด'}
              </button>
              {accessToken && (
                <button
                  type="button"
                  onClick={() => {
                    clear();
                    setMobileMenuOpen(false);
                    router.push('/login');
                  }}
                  className="col-span-2 flex min-h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <IconLogout className="size-5" />
                  ออกจากระบบ
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
