/**
 * enum กลางฝั่งเว็บ — ค่าตรงกับ api/src/common/enums.ts (สัญญา API เดียวกัน)
 * ใช้แบบ const object: value = LoanStatus.ACTIVE, type = LoanStatus
 */

export const LoanStatus = {
  ACTIVE: 'ACTIVE',
  DEAD: 'DEAD',
  INSTALLMENT: 'INSTALLMENT',
  CLOSED: 'CLOSED',
  BAD_DEBT: 'BAD_DEBT',
} as const;
export type LoanStatus = (typeof LoanStatus)[keyof typeof LoanStatus];

export const LoanCycle = {
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  TEN_DAY: 'TEN_DAY',
  MONTHLY: 'MONTHLY',
} as const;
export type LoanCycle = (typeof LoanCycle)[keyof typeof LoanCycle];

/** รอบเก็บที่ยอดดอกลอย/คงที่รองรับ */
export const REVOLVING_CYCLES = [
  LoanCycle.DAILY,
  LoanCycle.WEEKLY,
  LoanCycle.TEN_DAY,
] as const;
export type RevolvingCycle = (typeof REVOLVING_CYCLES)[number];

export const LoanKind = {
  REVOLVING: 'REVOLVING',
  INSTALLMENT: 'INSTALLMENT',
} as const;
export type LoanKind = (typeof LoanKind)[keyof typeof LoanKind];

export const InterestMode = {
  FLOATING: 'FLOATING',
  FLAT: 'FLAT',
} as const;
export type InterestMode = (typeof InterestMode)[keyof typeof InterestMode];

/** ประเภทการรับชำระ: ชำระดอก (ต้นคงเดิม) / ลดเงินต้น / ดอก+ลดต้น */
export const PaymentType = {
  INTEREST: 'INTEREST',
  PRINCIPAL: 'PRINCIPAL',
  BOTH: 'BOTH',
} as const;
export type PaymentType = (typeof PaymentType)[keyof typeof PaymentType];

export const ActivityType = {
  ADJUST: 'ADJUST',
  CLOSE: 'CLOSE',
  REOPEN: 'REOPEN',
  WRITE_OFF: 'WRITE_OFF',
  EDIT_LOAN: 'EDIT_LOAN',
  EDIT_CYCLE: 'EDIT_CYCLE',
  DELETE_LOAN: 'DELETE_LOAN',
  CONVERT_DEAD: 'CONVERT_DEAD',
  EDIT_DEBTOR: 'EDIT_DEBTOR',
  DELETE_DEBTOR: 'DELETE_DEBTOR',
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

export type ScheduleRowStatus = 'PAID' | 'PARTIAL' | 'DUE' | 'PENDING';
export const ScheduleRowStatus = {
  PAID: 'PAID',
  PARTIAL: 'PARTIAL',
  DUE: 'DUE',
  PENDING: 'PENDING',
} as const;
