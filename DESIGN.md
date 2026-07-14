# Design

โทนแอปการเงินมืออาชีพ — primary `#3758F9` + พื้นเทาอ่อน อ่านง่าย

## Theme

- โหมดสว่างเป็นค่าเริ่มต้น สลับมืดได้ (class `dark` + localStorage `money-theme`)
- Light: พื้น `#eceef1`, การ์ด/sidebar ขาว, เส้น `#d7dce3`
- Dark: พื้น gray-950, การ์ด/sidebar gray-900, เส้น gray-800

## Color

- Primary: `#3758F9` — ปุ่มหลัก, เมนู active, ลิงก์เน้น
- Ink: `#1a222c` · muted: `#5c6775`
- Semantic: เขียวเข้ม `#1f6b4a` = จ่ายแล้ว/กำไร · แดง `#b33b3b` = ค้าง · น้ำตาลทอง `#9a6700` = รอเก็บ · เทา = ยอดตาย/ปิด
- พื้น badge/icon chip ใช้สีอ่อนของ semantic เท่านั้น — ไม่มี glow / blur ทับพื้นหลัง

## Typography

- DM Sans (ละติน/ตัวเลข) + Noto Sans Thai — ครอบครัวเดียว หลายน้ำหนัก
- ตัวเลขยอดเงิน: `text-2xl font-bold` + `tabular-nums` · หัวข้อหน้า ~22px bold

## Components

- **Stat row**: การ์ดเดียว คั่นเซลล์ด้วย `gap-px` บนพื้นสีเส้น — icon chip กลม + label, ตัวเลขใหญ่, sub เล็ก
- **List card**: หัวการ์ดมีเส้นคั่น รายการ `divide-y` · มุม `rounded-2xl`
- **Badge สถานะ**: pill `rounded-full` พื้นสีอ่อน
- **ไอคอน**: SVG stroke 1.8 มุมมน ชุดเดียวใน `components/icons.tsx` — ห้ามใช้ emoji
- **ปุ่มหลัก**: `bg-primary text-white` เรียบ ไม่มีเงาสี — มุม `rounded-xl` · focus-visible outline สี primary
- **Loading**: skeleton (`PageSkeleton`) ไม่ใช้ spinner

## Motion

- transition-colors สั้นๆ กับ hover เท่านั้น · รองรับ `prefers-reduced-motion` (global CSS)
