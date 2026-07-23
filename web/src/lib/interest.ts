/**
 * ดอกเบี้ยเก็บในระบบเป็น "% ต่อรอบ" เสมอ แต่คนคีย์คิดเป็นบาทก็มี
 * (เคยมีเคสกรอก 100 ตั้งใจว่า ฿100 แต่ระบบอ่านเป็น 100% = ดอกเท่ากับต้นทั้งก้อน)
 * ไฟล์นี้เป็นตัวแปลงกลางระหว่างสองหน่วย ใช้ทั้งหน้าเปิดยอดและหน้าแก้เงื่อนไข
 */

/** หน่วยที่ใช้กรอกดอก — เก็บลงระบบเป็น % เสมอไม่ว่ากรอกแบบไหน */
export type RateUnit = 'PERCENT' | 'BAHT';

/** เพดานที่ฐานข้อมูลเก็บได้ — numeric(6,3) */
export const MAX_RATE_PERCENT = 999.999;

/** ดอกต่อรอบเป็นบาท (ปัดบาทเต็มแบบเดียวกับฝั่ง API) */
export function interestBaht(base: number, ratePercent: number): number {
  if (!(base > 0)) return 0;
  return Math.round((base * ratePercent) / 100);
}

/** ยอดดอกเป็นบาท → % ของฐาน (ปัด 3 ตำแหน่งตามที่ฐานข้อมูลเก็บ) */
export function bahtToPercent(base: number, baht: number): number {
  if (!(base > 0)) return 0;
  return Math.round((baht / base) * 100 * 1000) / 1000;
}

/**
 * เตือนเมื่อตัวเลขที่กรอกน่าจะสลับหน่วย — ดอกต่อรอบตั้งแต่ครึ่งหนึ่งของต้นขึ้นไป
 * ไม่ใช่การห้าม (ตกลงกันเท่าไหร่ก็ได้) แต่ให้ทวนก่อนบันทึก
 */
export function rateLooksWrong(base: number, ratePercent: number): boolean {
  return base > 0 && ratePercent >= 50;
}
