import { LoanStatus } from '../common/enums';
import type { Loan } from '../entities/loan.entity';
import { appointmentDue, arrearsBucket } from './dashboard.service';

type BucketInput = Pick<Loan, 'status' | 'arrears' | 'deadBalance'>;

const loan = (over: Partial<BucketInput>): BucketInput => ({
  status: LoanStatus.ACTIVE,
  arrears: 0,
  deadBalance: null,
  ...over,
});

describe('arrearsBucket — จัดยอดเข้าช่องในหน้ายอดค้าง', () => {
  it('ยอดปกติที่มีดอกค้าง → ค้างจ่าย', () => {
    expect(arrearsBucket(loan({ arrears: 1_200 }), 0)).toEqual({
      bucket: 'ARREARS',
      amount: 1_200,
    });
  });

  it('ยอดปกติที่ไม่ค้าง → ไม่เข้าหน้านี้', () => {
    expect(arrearsBucket(loan({ arrears: 0 }), 0)).toBeNull();
  });

  it('ผ่อนงวด (จบต้นจบดอก) ที่ค้างงวด → ค้างจ่าย ไม่ใช่ยอดตาย', () => {
    const l = loan({ status: LoanStatus.INSTALLMENT, deadBalance: 2_160 });
    expect(arrearsBucket(l, 200)).toEqual({ bucket: 'ARREARS', amount: 200 });
  });

  it('ผ่อนงวดที่ส่งตรงเวลา → ไม่โผล่ในหน้ายอดค้างเลย (ยอดผ่อนที่เหลือไม่ใช่ยอดค้าง)', () => {
    const l = loan({ status: LoanStatus.INSTALLMENT, deadBalance: 2_160 });
    expect(arrearsBucket(l, 0)).toBeNull();
  });

  it('ยอดตาย → ช่องยอดตาย ทั้งก้อน', () => {
    const l = loan({ status: LoanStatus.DEAD, deadBalance: 10_000 });
    expect(arrearsBucket(l, 0)).toEqual({ bucket: 'DEAD', amount: 10_000 });
  });

  it('ยอดตายที่ผ่อนหมดแล้ว → ไม่เข้าหน้านี้', () => {
    const l = loan({ status: LoanStatus.DEAD, deadBalance: 0 });
    expect(arrearsBucket(l, 0)).toBeNull();
  });

  it('ยอดที่ปิด/ตัดหนี้สูญแล้ว → ไม่เข้าหน้านี้', () => {
    expect(
      arrearsBucket(loan({ status: LoanStatus.CLOSED, arrears: 500 }), 0),
    ).toBeNull();
    expect(
      arrearsBucket(
        loan({ status: LoanStatus.BAD_DEBT, arrears: 500, deadBalance: 900 }),
        0,
      ),
    ).toBeNull();
  });
});

describe('appointmentDue — นัดคืนต้นที่ถึงกำหนดในวันนั้น', () => {
  type Appt = Parameters<typeof appointmentDue>[0];
  const withAppt = (over: Partial<Appt>): Appt => ({
    status: LoanStatus.ACTIVE,
    outstandingPrincipal: 5_000,
    deadBalance: null,
    principalDueDate: '2026-07-25',
    principalDueAmount: null,
    ...over,
  });

  it('ยอดตายลงนัดคืนไว้ → ถึงวันนัดโผล่เป็นยอดที่ต้องรับ', () => {
    const l = withAppt({
      status: LoanStatus.DEAD,
      deadBalance: 7_000,
      principalDueAmount: 1_000,
    });
    expect(appointmentDue(l, '2026-07-25')).toBe(1_000);
  });

  it('ยอดตายไม่ระบุยอดที่นัด → ทั้งยอดตายคงเหลือ (ไม่ใช่ต้นคงเหลือ)', () => {
    const l = withAppt({
      status: LoanStatus.DEAD,
      deadBalance: 7_000,
      outstandingPrincipal: 5_000,
      principalDueAmount: null,
    });
    expect(appointmentDue(l, '2026-07-25')).toBe(7_000);
  });

  it('ยอดปกติไม่ระบุยอดที่นัด → ทั้งต้นคงเหลือ', () => {
    expect(appointmentDue(withAppt({}), '2026-07-25')).toBe(5_000);
  });

  it('นัดไว้เกินยอดคงเหลือ → ไม่เกินยอดที่เหลือจริง', () => {
    const l = withAppt({ principalDueAmount: 9_999 });
    expect(appointmentDue(l, '2026-07-25')).toBe(5_000);
  });

  it('ยังไม่ถึงวันนัด / เลยวันนัดแล้ว → ไม่นับ', () => {
    expect(appointmentDue(withAppt({}), '2026-07-24')).toBe(0);
    expect(appointmentDue(withAppt({}), '2026-07-26')).toBe(0);
  });

  it('ไม่ได้ลงนัดไว้ → ไม่นับ', () => {
    expect(
      appointmentDue(withAppt({ principalDueDate: null }), '2026-07-25'),
    ).toBe(0);
  });

  it('ยอดตายที่ผ่อนหมดแล้ว → ไม่ทวงซ้ำ', () => {
    const l = withAppt({ status: LoanStatus.DEAD, deadBalance: 0 });
    expect(appointmentDue(l, '2026-07-25')).toBe(0);
  });
});
