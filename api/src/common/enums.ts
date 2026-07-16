/**
 * enum กลางของทั้งระบบ — ค่าคงที่ทุกตัวอ้างจากที่นี่ที่เดียว
 * ใช้แบบ const object (ค่า string ตรงกับที่เก็บใน DB อยู่แล้ว จึงไม่ต้อง migrate)
 *   - value position: LoanStatus.ACTIVE
 *   - type position:  สถานะ: LoanStatus
 *   - validator/list: Object.values(LoanStatus)
 */

export const LoanStatus = {
  /** ยอดปกติ เดินดอกตามรอบ */
  ACTIVE: 'ACTIVE',
  /** ยอดตาย — หยุดดอก ตรึงยอด ผ่อนคืนทุก 10 วัน */
  DEAD: 'DEAD',
  /** ยอดผ่อนเป็นงวดตามแผน */
  INSTALLMENT: 'INSTALLMENT',
  /** ปิดยอดแล้ว */
  CLOSED: 'CLOSED',
  /** ตัดหนี้สูญ */
  BAD_DEBT: 'BAD_DEBT',
} as const;
export type LoanStatus = (typeof LoanStatus)[keyof typeof LoanStatus];

export const LoanCycle = {
  DAILY: 'DAILY',
  /** ทุก 7 วัน */
  WEEKLY: 'WEEKLY',
  /** ทุก 10 วัน */
  TEN_DAY: 'TEN_DAY',
  MONTHLY: 'MONTHLY',
} as const;
export type LoanCycle = (typeof LoanCycle)[keyof typeof LoanCycle];

/** รอบเก็บที่ยอดดอกลอย/คงที่ (REVOLVING) รองรับ */
export const REVOLVING_CYCLES = [
  LoanCycle.DAILY,
  LoanCycle.WEEKLY,
  LoanCycle.TEN_DAY,
] as const;
export type RevolvingCycle = (typeof REVOLVING_CYCLES)[number];

/** ประเภทการกู้ตอนเปิดยอด */
export const LoanKind = {
  /** ดอกลอย/คงที่ — เก็บดอกตามรอบ ไม่มีตารางงวดตายตัว */
  REVOLVING: 'REVOLVING',
  /** ผ่อนเป็นงวดตามแผน */
  INSTALLMENT: 'INSTALLMENT',
} as const;
export type LoanKind = (typeof LoanKind)[keyof typeof LoanKind];

export const InterestMode = {
  /** ดอกลอย — คิดจากต้นคงเหลือ (ตัดต้นแล้วดอกลด) */
  FLOATING: 'FLOATING',
  /** ดอกคงที่ — คิดจากต้นเดิมตลอด */
  FLAT: 'FLAT',
} as const;
export type InterestMode = (typeof InterestMode)[keyof typeof InterestMode];

export const PaymentType = {
  /** ชำระดอก — เงินต้นคงเดิม */
  INTEREST: 'INTEREST',
  /** ลดเงินต้นอย่างเดียว */
  PRINCIPAL: 'PRINCIPAL',
  /** ค้างเก่า → ดอก → ตัดต้น */
  BOTH: 'BOTH',
} as const;
export type PaymentType = (typeof PaymentType)[keyof typeof PaymentType];

export const ActivityType = {
  ADJUST: 'ADJUST', // ปรับยอดด้วยมือ
  CLOSE: 'CLOSE', // ปิดยอดเอง
  REOPEN: 'REOPEN', // เปิดยอดคืน
  WRITE_OFF: 'WRITE_OFF', // ตัดหนี้สูญ
  EDIT_LOAN: 'EDIT_LOAN', // แก้เงื่อนไขยอดกู้
  EDIT_CYCLE: 'EDIT_CYCLE', // แก้รอบดอก (เลื่อนวัน/ตกลงเก็บดอกจริง)
  DELETE_LOAN: 'DELETE_LOAN', // ลบยอดกู้
  CONVERT_DEAD: 'CONVERT_DEAD', // แปลงยอดตาย
  EDIT_DEBTOR: 'EDIT_DEBTOR', // แก้ข้อมูลลูกหนี้
  DELETE_DEBTOR: 'DELETE_DEBTOR', // ลบลูกหนี้
} as const;
export type ActivityType = (typeof ActivityType)[keyof typeof ActivityType];

export const AttachmentKind = {
  SLIP: 'SLIP',
  ID_CARD: 'ID_CARD',
  OTHER: 'OTHER',
} as const;
export type AttachmentKind =
  (typeof AttachmentKind)[keyof typeof AttachmentKind];

export const CashTxType = {
  CAPITAL_IN: 'CAPITAL_IN',
  CAPITAL_OUT: 'CAPITAL_OUT',
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
} as const;
export type CashTxType = (typeof CashTxType)[keyof typeof CashTxType];
