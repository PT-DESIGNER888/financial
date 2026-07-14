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
import { ConfirmHost } from '@/components/confirm-host';
import { Toaster } from '@/components/toaster';
import { useAuthStore } from '@/lib/auth-store';

const menu = [
  {
    group: 'ประจำวัน',
    items: [{ href: '/', label: 'เก็บวันนี้', Icon: IconList }],
  },
  {
    group: 'จัดการ',
    items: [
      { href: '/debtors', label: 'ลูกหนี้', Icon: IconUsers },
      { href: '/loans', label: 'สัญญาเงินกู้', Icon: IconDoc },
    ],
  },
  {
    group: 'รายงาน',
    items: [
      { href: '/summary', label: 'ภาพรวมธุรกิจ', Icon: IconChart },
      { href: '/finance', label: 'การเงิน & รายงาน', Icon: IconCoins },
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
      <main className="p-4">
        {children}
        <Toaster />
      </main>
    );

  const active = flat.find((t) =>
    t.href === '/' ? pathname === '/' : pathname.startsWith(t.href),
  );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — desktop */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-gray-200 bg-white md:flex print:hidden dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-lg font-bold text-white">
            ฿
          </span>
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              ระบบเงินกู้
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              ดอกลอย · รายวัน / 10 วัน
            </p>
          </div>
        </div>
        <nav className="flex-1 space-y-5 px-3 py-2">
          {menu.map((g) => (
            <div key={g.group}>
              <p className="mb-1 px-2 text-[11px] font-semibold tracking-wider text-gray-400 uppercase dark:text-gray-500">
                {g.group}
              </p>
              {g.items.map((t) => {
                const isActive = active?.href === t.href;
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                    }`}
                  >
                    <t.Icon className="size-5" />
                    {t.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex min-h-screen flex-1 flex-col md:pl-60 print:pl-0">
        {/* Topbar */}
        <header className="sticky top-0 z-10 border-b border-gray-200 bg-white print:hidden dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between px-4 py-3 md:px-6">
            <span className="font-bold text-gray-900 md:hidden dark:text-white">
              {active?.label ?? 'ระบบเงินกู้'}
            </span>
            <span className="hidden text-sm text-gray-500 md:block dark:text-gray-400">
              {new Date().toLocaleDateString('th-TH', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
            <div className="flex items-center gap-2">
              <Link
                href="/settings"
                title="ตั้งค่า"
                aria-label="ตั้งค่า"
                className="flex size-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <IconSettings className="size-4.5" />
              </Link>
              <button
                onClick={toggle}
                title="สลับโหมดสว่าง/มืด"
                aria-label="สลับโหมดสว่าง/มืด"
                className="flex size-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {dark ? (
                  <IconSun className="size-4.5" />
                ) : (
                  <IconMoon className="size-4.5" />
                )}
              </button>
              {accessToken && (
                <button
                  onClick={() => {
                    clear();
                    router.push('/login');
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <IconLogout className="size-4" />
                  ออกจากระบบ
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-24 md:px-6 md:pb-8">
          {children}
        </main>
      </div>

      <ConfirmHost />
      <Toaster />

      {/* Bottom nav — mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white md:hidden print:hidden dark:border-gray-800 dark:bg-gray-900">
        <div className="flex">
          {flat.map((t) => {
            const isActive = active?.href === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs ${
                  isActive
                    ? 'font-semibold text-primary'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                <t.Icon className="size-5" />
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
