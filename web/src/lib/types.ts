// ค่าคงที่/enum ทั้งหมดนิยามที่ enums.ts — re-export ให้ import จาก types ได้เหมือนเดิม
export {
  ActivityType,
  AttachmentKind,
  CashTxType,
  InterestMode,
  LoanCycle,
  LoanKind,
  LoanStatus,
  PaymentType,
  REVOLVING_CYCLES,
  ScheduleRowStatus,
} from './enums';
export type { RevolvingCycle } from './enums';
import type {
  ActivityType,
  AttachmentKind,
  CashTxType,
  InterestMode,
  LoanCycle,
  LoanStatus,
  PaymentType,
  ScheduleRowStatus,
} from './enums';

export interface Activity {
  id: string;
  type: ActivityType;
  debtorId: string | null;
  loanId: string | null;
  debtorName: string | null;
  message: string;
  reason: string | null;
  amount: number | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export interface Debtor {
  id: string;
  name: string;
  phone: string | null;
  facebookUrl: string | null;
  lineId: string | null;
  relativeName: string | null;
  relativePhone: string | null;
  note: string | null;
  blacklisted: boolean;
  creditNote: string | null;
  guarantorName: string | null;
  guarantorPhone: string | null;
  emergencyContacts: EmergencyContact[] | null;
  loans?: Loan[];
  createdAt: string;
}

export interface EmergencyContact {
  name: string;
  phone?: string;
  line?: string;
  note?: string;
}

export interface Attachment {
  id: string;
  debtorId: string;
  kind: AttachmentKind;
  filename: string;
  url: string;
  note: string | null;
  createdAt: string;
}

export interface NotifyConfig {
  configured: boolean;
  hasToken: boolean;
  targetId: string | null;
}

export interface OverdueItem {
  loanId: string;
  debtorId: string;
  debtorName: string;
  arrears: number;
  outstandingPrincipal: number;
}

export interface Loan {
  id: string;
  contractNumber: string | null;
  debtorId: string;
  debtor?: Debtor;
  status: LoanStatus;
  cycle: LoanCycle;
  interestMode: InterestMode;
  fromCapital: boolean;
  principalOriginal: number;
  outstandingPrincipal: number;
  interestRatePercent: number;
  arrears: number;
  startDate: string;
  deadDate: string | null;
  deadBalance: number | null;
  installmentAmount: number | null;
  installmentCount: number | null;
  installmentTotal: number | null;
  amortized: boolean;
  fee: number;
  firstDueDate: string | null;
  /** นัดคืนต้น: วันที่ลูกหนี้ตกลงจะเอาเงินก้อนมาตัดต้น */
  principalDueDate: string | null;
  principalDueAmount: number | null;
  /** นัดชำระดอก: วันที่ตกลงจะมาจ่ายดอกเป็นก้อน */
  interestDueDate: string | null;
  interestDueAmount: number | null;
  roundInstallments: boolean;
  note: string | null;
  payments?: Payment[];
  createdAt: string;
}

/** แถวในหน้า "สัญญาเงินกู้" — ยอดสรุปต่อสัญญาจาก GET /loans */
export interface LoanListItem {
  id: string;
  contractNumber: string | null;
  debtorId: string;
  debtorName: string;
  status: LoanStatus;
  cycle: LoanCycle;
  interestMode: InterestMode;
  isInstallment: boolean;
  amortized: boolean;
  interestRatePercent: number;
  principalOriginal: number;
  outstandingPrincipal: number;
  arrears: number;
  paidTotal: number;
  remaining: number;
  totalDue: number;
  nextDueDate: string | null;
  overdue: boolean;
  startDate: string;
  note: string | null;
}

export interface ScheduleRow {
  n: number;
  dueDate: string;
  /** แยกต้น/ดอกเฉพาะยอดลดต้นลดดอก */
  principal: number | null;
  interest: number | null;
  scheduled: number;
  paid: number;
  status: ScheduleRowStatus;
}

/** แถวแผนผ่อนจาก POST /loans/preview (ยังไม่มีสถานะจ่าย) */
export interface PlanRow {
  n: number;
  dueDate: string;
  principal: number | null;
  interest: number | null;
  scheduled: number;
}

export interface InstallmentPlanPreview {
  rows: PlanRow[];
  principalOriginal: number;
  interestTotal: number;
  fee: number;
  installmentTotal: number;
  installmentCount: number;
  installmentAmount: number;
  firstDueDate: string;
  lastDueDate: string;
  startDate: string;
}

export interface InstallmentSchedule {
  installmentTotal: number;
  installmentCount: number;
  installmentAmount: number;
  remaining: number;
  paidTotal: number;
  paidCount: number;
  remainingCount: number;
  dueNow: number;
  nextDueDate: string | null;
  rows: ScheduleRow[];
}

export interface Payment {
  id: string;
  loanId: string;
  paidDate: string;
  amount: number;
  arrearsPaid: number;
  interestPaid: number;
  principalPaid: number;
  onDeadLoan: boolean;
  paymentType: PaymentType | null;
  note: string | null;
}

/** รอบดอกที่กำลังเดินของยอดดอกลอย/คงที่ (จาก suggest/cycles API) */
export interface CurrentCycle {
  cycleId: string;
  dueDate: string;
  /** ดอกที่ระบบคำนวณจากต้นคงเหลือล่าสุด */
  computedInterest: number;
  /** ยอดที่ตกลงเก็บจริง (null = ใช้ที่ระบบคำนวณ) */
  interestOverride: number | null;
  interestDue: number;
  interestPaid: number;
}

export interface LoanCycleRow {
  id: string;
  dueDate: string;
  interest: number;
  computedInterest: number;
  interestOverride: number | null;
  accrued: boolean;
  accruedAmount: number | null;
}

export interface LoanCyclesInfo {
  current: (CurrentCycle & { interestRemaining: number }) | null;
  appointment?: InterestAppointmentQuote | null;
  rows: LoanCycleRow[];
}

export interface InterestAppointmentQuote {
  date: string;
  cycles: { dueDate: string; interest: number; remaining: number }[];
  computedTotal: number;
  agreedAmount: number;
  paid: number;
  remaining: number;
}

/** รายการเก็บของยอดกู้หนึ่งก้อนในวันที่เลือก */
export interface TodayItem {
  loanId: string;
  contractNumber: string | null;
  status: LoanStatus;
  cycle: LoanCycle;
  outstandingPrincipal: number;
  deadBalance: number | null;
  /** ยอดค้างสะสม — วันนัดคืนต้นพับเข้า dueTotal แล้ว ช่องนี้เป็น 0 */
  arrears: number;
  dueInterest: number;
  /** นัดคืนต้นที่ถึงกำหนดวันนี้ */
  duePrincipal: number;
  dueInstallment: number;
  /** ต้องส่งวันนี้ = ดอก (รวมดอกรอบที่กำลังเดินถ้าเป็นวันนัดคืนต้น) + ต้น + งวด + ค้างที่พับเข้า */
  dueTotal: number;
  paidToday: number;
  remainingToday: number;
  principalDueDate: string | null;
  interestDueDate: string | null;
  interestCycleCount?: number | null;
  note: string | null;
}

/** ยอดรวมของลูกหนี้หนึ่งคนในวันที่เลือก — การ์ดหนึ่งใบ = ลูกหนี้หนึ่งคน */
export interface TodayDebtor {
  debtorId: string;
  debtorName: string;
  phone: string | null;
  outstandingPrincipal: number;
  deadBalance: number;
  arrears: number;
  dueInterest: number;
  duePrincipal: number;
  dueInstallment: number;
  dueTotal: number;
  paidToday: number;
  remainingToday: number;
  items: TodayItem[];
}

/** แถวยอดค้าง/ยอดตายรายสัญญาในหน้ายอดค้าง */
export interface ArrearsRow {
  loanId: string;
  contractNumber: string | null;
  status: LoanStatus;
  amount: number;
  outstandingPrincipal: number;
  installmentAmount: number | null;
  principalDueDate: string | null;
  principalDueAmount: number | null;
  note: string | null;
}

export interface ArrearsDebtor {
  debtorId: string;
  debtorName: string;
  phone: string | null;
  total: number;
  rows: ArrearsRow[];
}

export interface ArrearsSection {
  debtors: ArrearsDebtor[];
  total: number;
  debtorCount: number;
}

export interface ArrearsData {
  arrears: ArrearsSection;
  dead: ArrearsSection;
  grandTotal: number;
}

/** บิลของลูกหนี้หนึ่งคนในวันที่เลือก — สำหรับแคปส่งให้ลูกหนี้ */
export interface BillData {
  date: string;
  debtorId: string;
  debtorName: string;
  phone: string | null;
  items: TodayItem[];
  dueInterest: number;
  duePrincipal: number;
  dueInstallment: number;
  dueTotal: number;
  paidToday: number;
  remainingToday: number;
  outstandingPrincipal: number;
  arrearsTotal: number;
  /** ยอดผ่อนงวดที่เหลือทั้งหมด */
  installmentBalance: number;
  /** ส่วนของยอดผ่อนที่เลยกำหนดแล้ว (อยู่ใน installmentBalance แล้ว ไม่บวกซ้ำ) */
  installmentOverdue: number;
  deadTotal: number;
  balanceTotal: number;
}

export interface CashTx {
  id: string;
  type: CashTxType;
  amount: number;
  date: string;
  note: string | null;
  createdAt: string;
}

export interface CashPosition {
  openingCash: number;
  disbursed: number;
  collected: number;
  capitalIn: number;
  capitalOut: number;
  otherIncome: number;
  expense: number;
  cashInHand: number;
}

export interface LedgerEntry {
  date: string;
  kind: string;
  detail: string;
  cashIn: number;
  cashOut: number;
}

export interface MonthlyReport {
  month: string;
  cashIn: number;
  cashOut: number;
  net: number;
  interestEarned: number;
  principalBack: number;
  entries: LedgerEntry[];
}

export interface TrendPoint {
  date: string;
  collected: number;
  interest: number;
}

export interface Summary {
  totalPrincipalReleased: number;
  outstandingPrincipal: number;
  totalArrears: number;
  deadBalance: number;
  installmentBalance: number;
  badDebt: number;
  /** เงินที่เก็บคืนได้จากยอดที่ตัดหนี้สูญไปแล้ว */
  badDebtRecovered: number;
  interestCollected: number;
  principalCollected: number;
  netProfit: number;
  counts: {
    activeLoans: number;
    deadLoans: number;
    installmentLoans: number;
    closedLoans: number;
    badDebtLoans: number;
  };
}
