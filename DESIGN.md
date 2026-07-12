# Design

อ้างอิงลุค TailGrids CMS dashboard (light-first) — โทนแอปการเงิน มืออาชีพ ตัวเลขเด่น

## Theme

- โหมดสว่างเป็นค่าเริ่มต้น สลับมืดได้ (class `dark` + localStorage `money-theme`)
- Light: พื้น gray-50, การ์ด/sidebar ขาว, เส้น gray-200
- Dark: พื้น gray-950, การ์ด/sidebar gray-900, เส้น gray-800

## Color

- Primary: `#3758F9` — ปุ่มหลัก, เมนู active (bg-primary/10 + text-primary), ลิงก์เน้น
- Semantic: emerald = จ่ายแล้ว/กำไร · red = ค้าง/ติดลบ · amber = รอเก็บ · gray = ยอดตาย/ปิด
- ใช้สีอ่อน (`*-50` / dark `*-500/10`) เป็นพื้น badge และ icon chip เท่านั้น ไม่ใช้ตกแต่ง

## Typography

- DM Sans (ละติน/ตัวเลข) + Noto Sans Thai — ครอบครัวเดียว หลายน้ำหนัก
- ตัวเลขยอดเงิน: `text-2xl font-bold` ในการ์ด stat · หัวข้อหน้า `text-xl font-bold`

## Components

- **Stat row**: การ์ดเดียว คั่นเซลล์ด้วย `gap-px` บนพื้นสีเส้น — icon chip กลม (`size-9 rounded-full` พื้นสีอ่อน) + label, ตัวเลขใหญ่, sub เล็ก
- **List card**: หัวการ์ดมีเส้นคั่น รายการ `divide-y`
- **Badge สถานะ**: pill `rounded-full px-2 py-0.5 text-xs font-medium` พื้นสีอ่อน
- **ไอคอน**: SVG stroke 1.8 มุมมน ชุดเดียวใน `components/icons.tsx` — ห้ามใช้ emoji
- **ปุ่มหลัก**: `bg-primary text-white rounded-lg` + hover 90% · focus-visible outline สีน้ำเงิน (global)
- **Loading**: skeleton (`PageSkeleton`) ไม่ใช้ spinner
- Radius มาตรฐาน: `rounded-lg` (8px)

## Motion

- transition-colors สั้นๆ กับ hover เท่านั้น · รองรับ `prefers-reduced-motion` (global CSS)
