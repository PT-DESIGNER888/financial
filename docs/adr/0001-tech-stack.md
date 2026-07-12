# Tech stack: Next.js frontend + NestJS backend + Supabase Postgres

ระบบเป็นเว็บแอปออนไลน์ใช้คนเดียว เจ้าของโปรเจกต์เลือก stack ที่ถนัดเอง: Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui + Zustand + React Hook Form/Zod ฝั่งหน้าบ้าน, NestJS + TypeORM ฝั่งหลังบ้าน, ฐานข้อมูล Supabase (PostgreSQL) + Supabase Storage, auth แบบ JWT (access + refresh token) ทำเอง

## Considered Options

- Next.js fullstack เดี่ยว (API routes) — ถูกปัดตกเพราะเจ้าของถนัดแยก backend เป็น NestJS
- Supabase Auth — ถูกปัดตกเพราะเลือกทำ JWT เอง; Supabase ใช้เป็น Postgres + Storage เท่านั้น

## Consequences

- ต้อง deploy สองส่วน: Next.js (เช่น Vercel) และ NestJS (เช่น Railway/Render)
- ระบบใช้คนเดียว — auth มีผู้ใช้เดียว ไม่ต้องมี role/permission
