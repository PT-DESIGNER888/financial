import { LoanStatus } from '../common/enums';
import type { Loan } from '../entities/loan.entity';
import { arrearsBucket } from './dashboard.service';

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
