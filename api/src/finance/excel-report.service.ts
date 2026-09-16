import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Workbook, type Worksheet } from 'exceljs';
import { Like, Repository } from 'typeorm';
import {
  InterestMode,
  LoanCycle,
  LoanStatus,
  PaymentType,
} from '../common/enums';
import { Debtor } from '../entities/debtor.entity';
import { Payment } from '../entities/payment.entity';
import { LoansService } from '../loans/loans.service';
import { FinanceService } from './finance.service';

const PRIMARY = 'FF3758F9';
const PRIMARY_SOFT = 'FFE8ECFF';
const INK = 'FF1A222C';
const MUTED = 'FF5C6775';
const BORDER = 'FFD7DCE3';
const WHITE = 'FFFFFFFF';
const BAD_SOFT = 'FFFDECEC';
const OK_SOFT = 'FFE9F6EF';
const MONEY_FORMAT = '"฿"#,##0.00;[Red]("฿"#,##0.00);-';
const DATE_FORMAT = 'dd/mm/yyyy';

const statusLabel: Record<LoanStatus, string> = {
  ACTIVE: 'ปกติ',
  DEAD: 'ยอดตาย',
  INSTALLMENT: 'ผ่อนงวด',
  CLOSED: 'ปิดยอดแล้ว',
  BAD_DEBT: 'หนี้สูญ',
};

const cycleLabel: Record<LoanCycle, string> = {
  DAILY: 'รายวัน',
  WEEKLY: 'ราย 7 วัน',
  TEN_DAY: 'ราย 10 วัน',
  MONTHLY: 'รายเดือน',
};

const interestModeLabel: Record<InterestMode, string> = {
  FLOATING: 'ดอกลอย',
  FLAT: 'ดอกคงที่',
};

const paymentTypeLabel: Record<PaymentType, string> = {
  INTEREST: 'ชำระดอก',
  PRINCIPAL: 'ลดต้น',
  BOTH: 'ค้าง/ดอก/ต้น',
  ARREARS: 'เฉพาะค้าง',
};

type LoanReportRow = import('../loans/loans.service').LoanListItem;

function dateValue(value: string | null): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function phoneValue(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (/^0\d{9}$/.test(digits)) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return value;
}

function styleDataSheet(sheet: Worksheet, lastColumn: number) {
  sheet.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: lastColumn },
  };
  sheet.properties.defaultRowHeight = 20;

  const header = sheet.getRow(1);
  header.height = 27;
  header.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: PRIMARY },
    };
    cell.font = { bold: true, color: { argb: WHITE } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { bottom: { style: 'thin', color: { argb: BORDER } } };
  });

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.alignment = { vertical: 'top' };
    if (rowNumber % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF7F8FA' },
        };
      });
    }
  });
}

function styleStatusCells(sheet: Worksheet, column: string) {
  for (let row = 2; row <= sheet.rowCount; row += 1) {
    const cell = sheet.getCell(`${column}${row}`);
    const isBad = cell.value === 'ค้างชำระ' || cell.value === 'ขึ้นบัญชีดำ';
    if (!isBad) continue;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: BAD_SOFT },
    };
    cell.font = { bold: true, color: { argb: 'FFB33B3B' } };
  }
}

function setMoneyColumns(sheet: Worksheet, columns: string[]) {
  for (const column of columns) {
    sheet.getColumn(column).numFmt = MONEY_FORMAT;
    sheet.getColumn(column).alignment = { horizontal: 'right' };
  }
}

@Injectable()
export class ExcelReportService {
  constructor(
    private readonly finance: FinanceService,
    private readonly loans: LoansService,
    @InjectRepository(Payment)
    private readonly payments: Repository<Payment>,
    @InjectRepository(Debtor)
    private readonly debtors: Repository<Debtor>,
  ) {}

  async build(month: string): Promise<Buffer> {
    const [monthly, cash, loans, payments, debtors] = await Promise.all([
      this.finance.monthly(month),
      this.finance.cashPosition(),
      this.loans.findAll(),
      this.payments.find({
        where: { paidDate: Like(`${month}%`) },
        relations: { loan: { debtor: true } },
        relationLoadStrategy: 'query',
        order: { paidDate: 'DESC', createdAt: 'DESC' },
      }),
      this.debtors.find({
        select: {
          id: true,
          name: true,
          phone: true,
          blacklisted: true,
          creditNote: true,
          note: true,
        },
        order: { name: 'ASC' },
      }),
    ]);
    // กรองซ้ำใน memory — กัน mock/ไดรเวอร์ที่ไม่รองรับ LIKE เต็มรูปแบบ
    const monthPayments = payments.filter((payment) =>
      payment.paidDate.startsWith(month),
    );

    const workbook = new Workbook();
    workbook.creator = 'ระบบติดตามเงินกู้';
    workbook.company = 'ระบบติดตามเงินกู้';
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.calcProperties.fullCalcOnLoad = true;

    this.addSummarySheet(workbook, {
      month,
      monthly,
      cashInHand: cash.cashInHand,
      loans,
      paymentsTotal: monthPayments.reduce(
        (sum, payment) => sum + payment.amount,
        0,
      ),
      loanLastRow: Math.max(loans.length + 1, 2),
      paymentLastRow: Math.max(monthPayments.length + 1, 2),
      cashLastRow: Math.max(monthly.entries.length + 1, 2),
    });
    this.addLoansSheet(workbook, loans);
    this.addPaymentsSheet(workbook, monthPayments);
    this.addCashFlowSheet(workbook, monthly.entries);
    this.addDebtorsSheet(workbook, debtors, loans);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private addSummarySheet(
    workbook: Workbook,
    input: {
      month: string;
      monthly: Awaited<ReturnType<FinanceService['monthly']>>;
      cashInHand: number;
      loans: LoanReportRow[];
      paymentsTotal: number;
      loanLastRow: number;
      paymentLastRow: number;
      cashLastRow: number;
    },
  ) {
    const sheet = workbook.addWorksheet('ภาพรวม', {
      views: [{ showGridLines: false }],
    });
    sheet.columns = [
      { width: 25 },
      { width: 19 },
      { width: 4 },
      { width: 25 },
      { width: 19 },
      { width: 4 },
    ];

    sheet.mergeCells('A1:F1');
    sheet.getCell('A1').value = 'รายงานระบบติดตามเงินกู้';
    sheet.getCell('A1').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: PRIMARY },
    };
    sheet.getCell('A1').font = { bold: true, size: 18, color: { argb: WHITE } };
    sheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.getRow(1).height = 36;

    sheet.mergeCells('A2:F2');
    sheet.getCell('A2').value = `รอบรายงาน: ${input.month}`;
    sheet.getCell('A2').font = { bold: true, color: { argb: INK } };
    sheet.mergeCells('A3:F3');
    sheet.getCell('A3').value =
      `สร้างเมื่อ ${new Date().toLocaleString('th-TH')}`;
    sheet.getCell('A3').font = { color: { argb: MUTED }, size: 10 };

    this.addSectionTitle(sheet, 'A5:F5', 'ผลการดำเนินงานตามเดือนที่เลือก');
    const monthlyItems = [
      [
        'A6',
        'เงินเข้า',
        'B6',
        `SUM('กระแสเงินสด'!D2:D${input.cashLastRow})`,
        input.monthly.cashIn,
      ],
      [
        'A7',
        'เงินออก',
        'B7',
        `SUM('กระแสเงินสด'!E2:E${input.cashLastRow})`,
        input.monthly.cashOut,
      ],
      ['A8', 'สุทธิ', 'B8', 'B6-B7', input.monthly.net],
      [
        'D6',
        'รับชำระรวม',
        'E6',
        `SUM('รับชำระ'!D2:D${input.paymentLastRow})`,
        input.paymentsTotal,
      ],
      [
        'D7',
        'ดอกเบี้ยและยอดค้าง',
        'E7',
        `SUM('รับชำระ'!E2:F${input.paymentLastRow})`,
        input.monthly.interestEarned,
      ],
      [
        'D8',
        'เงินต้นคืน',
        'E8',
        `SUM('รับชำระ'!G2:G${input.paymentLastRow})`,
        input.monthly.principalBack,
      ],
    ] as const;
    for (const [labelCell, label, valueCell, formula, result] of monthlyItems) {
      sheet.getCell(labelCell).value = label;
      sheet.getCell(valueCell).value = { formula, result };
      this.styleMetric(sheet, labelCell, valueCell);
    }

    this.addSectionTitle(sheet, 'A10:F10', 'สถานะพอร์ตปัจจุบัน ณ วันที่ส่งออก');
    const openStatuses = new Set<LoanStatus>([
      LoanStatus.ACTIVE,
      LoanStatus.DEAD,
      LoanStatus.INSTALLMENT,
    ]);
    const remaining = input.loans.reduce(
      (sum, loan) => sum + loan.remaining,
      0,
    );
    const openCount = input.loans.filter((loan) =>
      openStatuses.has(loan.status),
    ).length;
    const overdueCount = input.loans.filter((loan) => loan.overdue).length;
    const portfolioItems = [
      ['A11', 'เงินสดในมือ', 'B11', input.cashInHand],
      [
        'A12',
        'ยอดคงเหลือในพอร์ต',
        'B12',
        {
          formula: `SUM('สัญญาเงินกู้'!K2:K${input.loanLastRow})`,
          result: remaining,
        },
      ],
      ['A13', 'สัญญาเปิดอยู่', 'B13', openCount],
      ['D11', 'สัญญาทั้งหมด', 'E11', input.loans.length],
      ['D12', 'ค้างชำระ', 'E12', overdueCount],
      ['D13', 'ปิดแล้ว/หนี้สูญ', 'E13', input.loans.length - openCount],
    ] as const;
    for (const [labelCell, label, valueCell, value] of portfolioItems) {
      sheet.getCell(labelCell).value = label;
      sheet.getCell(valueCell).value = value;
      this.styleMetric(sheet, labelCell, valueCell);
    }
    sheet.getCell('B11').numFmt = MONEY_FORMAT;
    sheet.getCell('B12').numFmt = MONEY_FORMAT;
    sheet.getCell('B13').numFmt = '#,##0';
    sheet.getCell('E11').numFmt = '#,##0';
    sheet.getCell('E12').numFmt = '#,##0';
    sheet.getCell('E13').numFmt = '#,##0';

    sheet.mergeCells('A15:F15');
    sheet.getCell('A15').value =
      'หมายเหตุ: ตัวเลขรายเดือนอ้างอิงเดือนที่เลือก ส่วนสถานะพอร์ตเป็นยอดปัจจุบัน ณ เวลาส่งออก';
    sheet.getCell('A15').font = {
      italic: true,
      size: 10,
      color: { argb: MUTED },
    };
    sheet.getCell('A15').alignment = { wrapText: true };
  }

  private addLoansSheet(workbook: Workbook, loans: LoanReportRow[]) {
    const sheet = workbook.addWorksheet('สัญญาเงินกู้');
    sheet.columns = [
      { header: 'เลขที่สัญญา', key: 'contract', width: 18 },
      { header: 'ลูกหนี้', key: 'debtor', width: 24 },
      { header: 'สถานะ', key: 'status', width: 14 },
      { header: 'รอบเก็บ', key: 'cycle', width: 13 },
      { header: 'รูปแบบดอก', key: 'interestMode', width: 15 },
      { header: 'วันเปิดยอด', key: 'startDate', width: 14 },
      { header: 'เงินต้นเดิม', key: 'principalOriginal', width: 16 },
      { header: 'ต้นคงเหลือ', key: 'outstandingPrincipal', width: 16 },
      { header: 'ยอดค้าง', key: 'arrears', width: 14 },
      { header: 'รับแล้ว', key: 'paidTotal', width: 16 },
      { header: 'คงเหลือ', key: 'remaining', width: 16 },
      { header: 'ต้องชำระรวม', key: 'totalDue', width: 17 },
      { header: 'งวดถัดไป', key: 'nextDueDate', width: 14 },
      { header: 'การชำระ', key: 'overdue', width: 13 },
      { header: 'หมายเหตุ', key: 'note', width: 30 },
    ];
    sheet.addRows(
      loans.map((loan) => ({
        contract: loan.contractNumber ?? '-',
        debtor: loan.debtorName,
        status: statusLabel[loan.status],
        cycle: cycleLabel[loan.cycle],
        interestMode: loan.isInstallment
          ? loan.amortized
            ? 'ลดต้นลดดอก'
            : 'ผ่อนดอกคงที่'
          : interestModeLabel[loan.interestMode],
        startDate: dateValue(loan.startDate),
        principalOriginal: loan.principalOriginal,
        outstandingPrincipal: loan.outstandingPrincipal,
        arrears: loan.arrears,
        paidTotal: loan.paidTotal,
        remaining: loan.remaining,
        totalDue: loan.totalDue,
        nextDueDate: dateValue(loan.nextDueDate),
        overdue: loan.overdue ? 'ค้างชำระ' : 'ปกติ',
        note: loan.note ?? null,
      })),
    );
    styleDataSheet(sheet, 15);
    sheet.getColumn('startDate').numFmt = DATE_FORMAT;
    sheet.getColumn('nextDueDate').numFmt = DATE_FORMAT;
    setMoneyColumns(sheet, [
      'principalOriginal',
      'outstandingPrincipal',
      'arrears',
      'paidTotal',
      'remaining',
      'totalDue',
    ]);
    styleStatusCells(sheet, 'N');
    return sheet;
  }

  private addPaymentsSheet(workbook: Workbook, payments: Payment[]) {
    const sheet = workbook.addWorksheet('รับชำระ');
    sheet.columns = [
      { header: 'วันที่รับเงิน', key: 'date', width: 14 },
      { header: 'เลขที่สัญญา', key: 'contract', width: 18 },
      { header: 'ลูกหนี้', key: 'debtor', width: 24 },
      { header: 'รับรวม', key: 'amount', width: 15 },
      { header: 'หักยอดค้าง', key: 'arrears', width: 15 },
      { header: 'ดอกเบี้ย', key: 'interest', width: 15 },
      { header: 'ตัดเงินต้น', key: 'principal', width: 15 },
      { header: 'ประเภท', key: 'type', width: 16 },
      { header: 'ยอดที่ชำระ', key: 'loanKind', width: 15 },
      { header: 'หมายเหตุ', key: 'note', width: 30 },
    ];
    sheet.addRows(
      payments.map((payment) => ({
        date: dateValue(payment.paidDate),
        contract: payment.loan?.contractNumber ?? '-',
        debtor: payment.loan?.debtor?.name ?? '',
        amount: payment.amount,
        arrears: payment.arrearsPaid,
        interest: payment.interestPaid,
        principal: payment.principalPaid,
        type: payment.paymentType
          ? paymentTypeLabel[payment.paymentType]
          : 'รายการเดิม',
        loanKind: payment.onDeadLoan ? 'ยอดตาย/ผ่อนงวด' : 'ยอดปกติ',
        note: payment.note ?? null,
      })),
    );
    styleDataSheet(sheet, 10);
    sheet.getColumn('date').numFmt = DATE_FORMAT;
    setMoneyColumns(sheet, ['amount', 'arrears', 'interest', 'principal']);
    return sheet;
  }

  private addCashFlowSheet(
    workbook: Workbook,
    entries: Awaited<ReturnType<FinanceService['monthly']>>['entries'],
  ) {
    const sheet = workbook.addWorksheet('กระแสเงินสด');
    sheet.columns = [
      { header: 'วันที่', key: 'date', width: 14 },
      { header: 'ประเภท', key: 'kind', width: 16 },
      { header: 'รายละเอียด', key: 'detail', width: 42 },
      { header: 'เงินเข้า', key: 'cashIn', width: 16 },
      { header: 'เงินออก', key: 'cashOut', width: 16 },
      { header: 'สุทธิ', key: 'net', width: 16 },
    ];
    for (const entry of entries) {
      const row = sheet.addRow({
        date: dateValue(entry.date),
        kind: entry.kind,
        detail: entry.detail,
        cashIn: entry.cashIn || null,
        cashOut: entry.cashOut || null,
      });
      row.getCell('net').value = {
        formula: `D${row.number}-E${row.number}`,
        result: entry.cashIn - entry.cashOut,
      };
    }
    styleDataSheet(sheet, 6);
    sheet.getColumn('date').numFmt = DATE_FORMAT;
    setMoneyColumns(sheet, ['cashIn', 'cashOut', 'net']);
    return sheet;
  }

  private addDebtorsSheet(
    workbook: Workbook,
    debtors: Debtor[],
    loans: LoanReportRow[],
  ) {
    const sheet = workbook.addWorksheet('ลูกหนี้');
    sheet.columns = [
      { header: 'ชื่อลูกหนี้', key: 'name', width: 25 },
      { header: 'เบอร์โทร', key: 'phone', width: 18 },
      { header: 'สถานะบัญชี', key: 'status', width: 16 },
      { header: 'ยอดเปิด', key: 'openLoans', width: 12 },
      { header: 'เงินต้นรวม', key: 'principal', width: 16 },
      { header: 'คงเหลือรวม', key: 'remaining', width: 17 },
      { header: 'ประวัติเครดิต', key: 'creditNote', width: 32 },
      { header: 'หมายเหตุ', key: 'note', width: 32 },
    ];
    const byDebtor = new Map<string, LoanReportRow[]>();
    for (const loan of loans) {
      const rows = byDebtor.get(loan.debtorId) ?? [];
      rows.push(loan);
      byDebtor.set(loan.debtorId, rows);
    }
    const openStatuses = new Set<LoanStatus>([
      LoanStatus.ACTIVE,
      LoanStatus.DEAD,
      LoanStatus.INSTALLMENT,
    ]);
    sheet.addRows(
      debtors.map((debtor) => {
        const debtorLoans = byDebtor.get(debtor.id) ?? [];
        const openLoans = debtorLoans.filter((loan) =>
          openStatuses.has(loan.status),
        );
        return {
          name: debtor.name,
          phone: phoneValue(debtor.phone),
          status: debtor.blacklisted ? 'ขึ้นบัญชีดำ' : 'ปกติ',
          openLoans: openLoans.length,
          principal: debtorLoans.reduce(
            (sum, loan) => sum + loan.principalOriginal,
            0,
          ),
          remaining: openLoans.reduce((sum, loan) => sum + loan.remaining, 0),
          creditNote: debtor.creditNote ?? null,
          note: debtor.note ?? null,
        };
      }),
    );
    styleDataSheet(sheet, 8);
    sheet.getColumn('phone').numFmt = '@';
    sheet.getColumn('openLoans').numFmt = '#,##0';
    setMoneyColumns(sheet, ['principal', 'remaining']);
    styleStatusCells(sheet, 'C');
  }

  private addSectionTitle(sheet: Worksheet, range: string, label: string) {
    sheet.mergeCells(range);
    const cell = sheet.getCell(range.split(':')[0]);
    cell.value = label;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: PRIMARY_SOFT },
    };
    cell.font = { bold: true, color: { argb: PRIMARY } };
    cell.alignment = { vertical: 'middle' };
  }

  private styleMetric(sheet: Worksheet, labelCell: string, valueCell: string) {
    sheet.getCell(labelCell).font = { color: { argb: MUTED } };
    const value = sheet.getCell(valueCell);
    value.font = { bold: true, size: 13, color: { argb: INK } };
    value.numFmt = MONEY_FORMAT;
    value.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: OK_SOFT },
    };
    value.alignment = { horizontal: 'right' };
  }
}
