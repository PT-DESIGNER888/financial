export type LoanStatus =
  | 'ACTIVE'
  | 'DEAD'
  | 'INSTALLMENT'
  | 'CLOSED'
  | 'BAD_DEBT';
export type LoanCycle = 'DAILY' | 'TEN_DAY';
export type InterestMode = 'FLOATING' | 'FLAT';

export type ActivityType =
  | 'ADJUST'
  | 'CLOSE'
  | 'REOPEN'
  | 'WRITE_OFF'
  | 'EDIT_LOAN'
  | 'DELETE_LOAN'
  | 'CONVERT_DEAD'
  | 'EDIT_DEBTOR'
  | 'DELETE_DEBTOR';

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

export type AttachmentKind = 'SLIP' | 'ID_CARD' | 'OTHER';

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
  interestRatePercent: number;
  principalOriginal: number;
  paidTotal: number;
  remaining: number;
  totalDue: number;
  nextDueDate: string | null;
  overdue: boolean;
  startDate: string;
  note: string | null;
}

export type ScheduleRowStatus = 'PAID' | 'PARTIAL' | 'DUE' | 'PENDING';

export interface ScheduleRow {
  n: number;
  dueDate: string;
  scheduled: number;
  paid: number;
  status: ScheduleRowStatus;
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
  note: string | null;
}

export interface TodayItem {
  loanId: string;
  debtorId: string;
  debtorName: string;
  status: LoanStatus;
  cycle: LoanCycle;
  outstandingPrincipal: number;
  arrears: number;
  deadBalance: number | null;
  isDueToday: boolean;
  dueInterest: number;
  dueInstallment: number;
  paidToday: number;
  remainingToday: number;
}

export type CashTxType = 'CAPITAL_IN' | 'CAPITAL_OUT' | 'INCOME' | 'EXPENSE';

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
