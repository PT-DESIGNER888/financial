'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  IconChart,
  IconCoins,
  IconDoc,
  IconList,
  IconLogout,
  IconMoon,
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
    items: [{ href: '/', label: 'เก็บวันนี้', short: 'วันนี้', Icon: IconList }],
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

function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('money-theme', next ? 'dark' : 'light');
  };
  return { dark, toggle };
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { accessToken, clear } = useAuthStore();
  const { dark, toggle } = useTheme();

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

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — desktop */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 flex-col border-r border-[#d7dce3] bg-white md:flex print:hidden dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-3 px-5 pt-7 pb-6">
          <BrandLogo size="lg" />
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-slate-900 dark:text-white">
              ระบบเงินกู้
            </p>
            <p className="text-[13px] text-slate-500 dark:text-gray-400">
              ดอกลอย · รายวัน / 10 วัน
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
          {menu.map((g) => (
            <div key={g.group}>
              <p className="mb-1.5 px-3 text-[13px] font-medium text-slate-400 dark:text-gray-500">
                {g.group}
              </p>
              <div className="space-y-0.5">
                {g.items.map((t) => {
                  const isActive = active?.href === t.href;
                  return (
                    <Link
                      key={t.href}
                      href={t.href}
                      className={`flex items-center gap-3 rounded-xl px-3.5 py-3.5 text-base font-medium transition-colors ${
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'
                      }`}
                    >
                      <t.Icon
                        className={`size-6 shrink-0 ${isActive ? 'text-primary' : 'text-slate-400 dark:text-gray-500'}`}
                      />
                      {t.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-3 dark:border-gray-800">
          <Link
            href="/settings"
            className={`flex items-center gap-3 rounded-xl px-3.5 py-3.5 text-base font-medium transition-colors ${
              settingsActive
                ? 'bg-primary/10 text-primary'
                : 'text-slate-600 hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            <IconSettings className="size-6 text-slate-400 dark:text-gray-500" />
            ตั้งค่า
          </Link>
        </div>
      </aside>

      {/* Content */}
      <div className="flex min-h-screen flex-1 flex-col md:pl-72 print:pl-0">
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
            <div className="flex items-center gap-1.5">
              <Link
                href="/settings"
                title="ตั้งค่า"
                aria-label="ตั้งค่า"
                className="flex size-11 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 md:hidden dark:text-gray-300 dark:hover:bg-gray-800"
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

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-[calc(6.25rem+env(safe-area-inset-bottom))] md:px-10 md:pt-10 md:pb-12 lg:px-12">
          {children}
        </main>
      </div>

      <ConfirmHost />
      <Toaster />

      {/* Bottom nav — mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[#d7dce3] bg-white pb-[env(safe-area-inset-bottom)] md:hidden print:hidden dark:border-gray-800 dark:bg-gray-900">
        <div className="flex">
          {flat.map((t) => {
            const isActive = active?.href === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-1 px-0.5 pt-2.5 pb-2 text-[13px] transition-colors ${
                  isActive
                    ? 'font-semibold text-primary'
                    : 'font-medium text-slate-400 dark:text-gray-500'
                }`}
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
        </div>
      </nav>
    </div>
  );
}
