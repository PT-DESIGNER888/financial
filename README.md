# ระบบติดตามเงินกู้ (Money)

เว็บแอปใช้คนเดียว สำหรับติดตามยอดปล่อยกู้แบบดอกลอย — เก็บดอกรายวัน/ราย 10 วัน ตัดต้น ยอดค้าง และยอดตาย

ดูนิยามศัพท์ใน [CONTEXT.md](./CONTEXT.md) และการตัดสินใจใน [docs/adr/](./docs/adr/)

## โครงสร้าง

- `web/` — Next.js (หน้าเว็บ)
- `api/` — NestJS (API + ฐานข้อมูล)

## การติดตั้งครั้งแรก

1. สร้างโปรเจกต์ที่ [supabase.com](https://supabase.com) (ฟรี) แล้วคัดลอก **Connection string** (Transaction pooler)
2. คัดลอก `api/.env.example` เป็น `api/.env` แล้วกรอก:
   - `DATABASE_URL` — connection string จาก Supabase
   - `JWT_SECRET` / `JWT_REFRESH_SECRET` — ตั้งเป็นข้อความสุ่มยาวๆ
   - `ADMIN_USERNAME` / `ADMIN_PASSWORD` — ชื่อ/รหัสผ่านสำหรับ login (ระบบสร้างผู้ใช้ให้อัตโนมัติตอนสตาร์ทครั้งแรก)
3. คัดลอก `web/.env.example` เป็น `web/.env.local` (ชี้ไปที่ API)

## รันบนเครื่อง

```bash
# terminal 1
cd api && npm install && npm run start:dev   # http://localhost:3001

# terminal 2
cd web && npm install && npm run dev         # http://localhost:3000
```

## Deploy

- `web/` → Vercel (ตั้ง `NEXT_PUBLIC_API_URL` ชี้ไปที่ API ที่ deploy แล้ว)
- `api/` → Railway / Render (ตั้ง env ตาม `.env.example` และ `PORT`)
