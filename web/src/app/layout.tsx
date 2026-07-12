import type { Metadata } from 'next';
import { DM_Sans, Noto_Sans_Thai } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/components/query-provider';
import { Shell } from '@/components/shell';

const dmSans = DM_Sans({ variable: '--font-dm-sans', subsets: ['latin'] });
const notoThai = Noto_Sans_Thai({
  variable: '--font-noto-thai',
  subsets: ['thai', 'latin'],
});

export const metadata: Metadata = {
  title: 'ระบบติดตามเงินกู้',
  description: 'ติดตามยอดกู้ ดอกลอย รายวัน / ราย 10 วัน',
};

// โหมดสว่างเป็นค่าเริ่มต้น (ใช้กลางแจ้งบ่อย) — มืดเฉพาะเมื่อผู้ใช้เคยเลือกไว้
const themeInit = `try{if(localStorage.getItem('money-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="th"
      className={`${dmSans.variable} ${notoThai.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full bg-gray-50 text-gray-800 dark:bg-gray-950 dark:text-gray-200">
        <QueryProvider>
          <Shell>{children}</Shell>
        </QueryProvider>
      </body>
    </html>
  );
}
