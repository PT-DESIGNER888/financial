import { Workbook } from 'exceljs';
import {
  InterestMode,
  LoanCycle,
  LoanStatus,
  PaymentType,
} from '../common/enums';
import { ExcelReportService } from './excel-report.service';

describe('ExcelReportService', () => {
  it('สร้างรายงาน XLSX หลายชีตและกรองรายการรับชำระตามเดือน', async () => {
    const monthly = {
      month: '2026-07',
      cashIn: 100,
      cashOut: 500,
      net: -400,
      interestEarned: 30,
      principalBack: 70,
      entries: [
        {
          date: '2026-07-15',
          kind: 'รับเงิน',
          detail: 'สมชาย — ดอก 20 / ต้น 70',
          cashIn: 100,
          cashOut: 0,
        },
        {
          date: '2026-07-01',
          kind: 'ปล่อยกู้',
          detail: 'สมชาย — ต้น ฿500',
          cashIn: 0,
          cashOut: 500,
        },
      ],
    };
    const finance = {
      monthly: jest.fn().mockResolvedValue(monthly),
      cashPosition: jest.fn().mockResolvedValue({ cashInHand: 1200 }),
    };
    const loanRows = [
      {
        id: 'loan-1',
        contractNumber: 'L-2569-0001',
        debtorId: 'debtor-1',
        debtorName: 'สมชาย',
        status: LoanStatus.ACTIVE,
        cycle: LoanCycle.DAILY,
        interestMode: InterestMode.FLOATING,
        isInstallment: false,
        amortized: false,
        interestRatePercent: 10,
        principalOriginal: 1000,
        outstandingPrincipal: 600,
        arrears: 20,
        paidTotal: 400,
        remaining: 620,
        totalDue: 1020,
        nextDueDate: '2026-07-17',
        overdue: true,
        startDate: '2026-07-01',
        note: null,
      },
      {
        id: 'loan-2',
        contractNumber: 'L-2569-0002',
        debtorId: 'debtor-1',
        debtorName: 'สมชาย',
        status: LoanStatus.CLOSED,
        cycle: LoanCycle.TEN_DAY,
        interestMode: InterestMode.FLAT,
        isInstallment: false,
        amortized: false,
        interestRatePercent: 5,
        principalOriginal: 500,
        outstandingPrincipal: 0,
        arrears: 0,
        paidTotal: 550,
        remaining: 0,
        totalDue: 550,
        nextDueDate: null,
        overdue: false,
        startDate: '2026-06-01',
        note: 'ปิดยอดแล้ว',
      },
    ];
    const loans = { findAll: jest.fn().mockResolvedValue(loanRows) };
    const paymentRepo = {
      find: jest.fn().mockResolvedValue([
        {
          paidDate: '2026-07-15',
          amount: 100,
          arrearsPaid: 10,
          interestPaid: 20,
          principalPaid: 70,
          paymentType: PaymentType.BOTH,
          onDeadLoan: false,
          note: null,
          loan: {
            contractNumber: 'L-2569-0001',
            debtor: { name: 'สมชาย' },
          },
        },
        {
          paidDate: '2026-06-20',
          amount: 50,
          arrearsPaid: 0,
          interestPaid: 50,
          principalPaid: 0,
          paymentType: PaymentType.INTEREST,
          onDeadLoan: false,
          note: null,
          loan: {
            contractNumber: 'L-2569-0001',
            debtor: { name: 'สมชาย' },
          },
        },
      ]),
    };
    const debtorRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'debtor-1',
          name: 'สมชาย',
          phone: '0800000000',
          blacklisted: false,
          creditNote: 'จ่ายตรงเวลา',
          note: null,
        },
      ]),
    };
    const service = new ExcelReportService(
      finance as never,
      loans as never,
      paymentRepo as never,
      debtorRepo as never,
    );

    const buffer = await service.build('2026-07');
    const workbook = new Workbook();
    await workbook.xlsx.load(buffer);

    expect(buffer.subarray(0, 2).toString()).toBe('PK');
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'ภาพรวม',
      'สัญญาเงินกู้',
      'รับชำระ',
      'กระแสเงินสด',
      'ลูกหนี้',
    ]);

    const summary = workbook.getWorksheet('ภาพรวม')!;
    expect(summary.getCell('B6').result).toBe(100);
    expect(summary.getCell('E6').result).toBe(100);
    expect(summary.getCell('B12').result).toBe(620);

    const payments = workbook.getWorksheet('รับชำระ')!;
    expect(payments.rowCount).toBe(2);
    expect(payments.getCell('C2').value).toBe('สมชาย');
    expect(payments.getCell('D2').value).toBe(100);
    expect(payments.getCell('A2').value).toBeInstanceOf(Date);
    expect(payments.getColumn('D').numFmt).toContain('฿');

    const cashFlow = workbook.getWorksheet('กระแสเงินสด')!;
    expect(cashFlow.rowCount).toBe(3);
    expect(cashFlow.getCell('F2').result).toBe(100);

    const loansSheet = workbook.getWorksheet('สัญญาเงินกู้')!;
    expect(loansSheet.getCell('N2').value).toBe('ค้างชำระ');
    expect(loansSheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });

    for (const sheet of workbook.worksheets) {
      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          const value = cell.value;
          const text =
            typeof value === 'string'
              ? value
              : value && typeof value === 'object' && 'formula' in value
                ? value.formula
                : '';
          expect(text).not.toMatch(/#REF!|#DIV\/0!|#VALUE!/);
        });
      });
    }
  });
});
