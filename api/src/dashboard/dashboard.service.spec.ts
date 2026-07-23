import { LoanStatus } from '../common/enums';
import type { Loan } from '../entities/loan.entity';
import {
  appointmentDue,
  arrearsBucket,
  remainingBalanceOnDay,
  splitInstallmentDue,
} from './dashboard.service';

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

describe('splitInstallmentDue — แยกงวดค้างเก่าออกจากงวดของวันนี้', () => {
  // ผ่อนรายวัน งวดละ 100 เริ่ม 22 ก.ค.
  const rows = (paidPerRow: number[]) =>
    paidPerRow.map((paid, i) => ({
      dueDate: `2026-07-${22 + i}`,
      scheduled: 100,
      paid,
    }));

  it('ค้างมา 2 งวด — ยอดวันนี้ต้องเป็นงวดเดียว ไม่พองเป็น 3 งวด', () => {
    // 22,23 ยังไม่จ่าย · 24 = วันนี้
    const r = splitInstallmentDue(rows([0, 0, 0]), '2026-07-24');
    expect(r.dueToday).toBe(100); // เก็บตามยอดจริงของวัน
    expect(r.overdue).toBe(200); // ที่ค้างไปโชว์เป็นตัวแดงแยก
  });

  it('ไม่ค้างเลย — วันนี้เก็บงวดเดียวตามปกติ', () => {
    const r = splitInstallmentDue(rows([100, 100, 0]), '2026-07-24');
    expect(r).toMatchObject({ dueToday: 100, overdue: 0 });
  });

  it('งวดวันนี้ยังไม่ถือว่าค้าง (เหมือนดอกของยอดปกติ)', () => {
    const r = splitInstallmentDue(rows([100, 0]), '2026-07-23');
    expect(r.overdue).toBe(0);
    expect(r.dueToday).toBe(100);
  });

  it('จ่ายงวดวันนี้มาแล้วบางส่วน — เหลือเท่าที่ยังขาด', () => {
    const r = splitInstallmentDue(
      [{ dueDate: '2026-07-23', scheduled: 100, paid: 40 }],
      '2026-07-23',
    );
    expect(r.dueToday).toBe(60);
    expect(r.scheduledToday).toBe(100); // ยอดเต็มของวันยังเป็น 100
  });

  it('จ่ายล่วงหน้ามาแล้ว — ยอดเต็มของวันยังโชว์ แต่ไม่ต้องเก็บเพิ่ม', () => {
    const r = splitInstallmentDue(rows([100, 100]), '2026-07-23');
    expect(r.dueToday).toBe(0);
    expect(r.scheduledToday).toBe(100);
  });

  it('งวดในอนาคตไม่ถูกดึงมารวมกับวันนี้', () => {
    const r = splitInstallmentDue(rows([0, 0, 0]), '2026-07-22');
    expect(r).toMatchObject({ overdue: 0, dueToday: 100 });
  });
});

describe('appointmentDue — นัดคืนต้นที่ถึงกำหนดในวันนั้น', () => {
  type Appt = Parameters<typeof appointmentDue>[0];
  const withAppt = (over: Partial<Appt>): Appt => ({
    status: LoanStatus.ACTIVE,
    outstandingPrincipal: 5_000,
    deadBalance: null,
    deadDate: null,
    installmentCount: null,
    principalDueDate: '2026-07-25',
    principalDueAmount: null,
    ...over,
  });

  it('ยอดตายลงนัดคืนไว้ → ถึงวันนัดโผล่เป็นยอดที่ต้องรับ', () => {
    const l = withAppt({
      status: LoanStatus.DEAD,
      deadDate: '2026-07-20',
      deadBalance: 7_000,
      principalDueAmount: 1_000,
    });
    expect(appointmentDue(l, '2026-07-25')).toBe(1_000);
  });

  it('ยอดตายไม่ระบุยอดที่นัด → ทั้งยอดตายคงเหลือ (ไม่ใช่ต้นคงเหลือ)', () => {
    const l = withAppt({
      status: LoanStatus.DEAD,
      deadDate: '2026-07-20',
      deadBalance: 7_000,
      outstandingPrincipal: 5_000,
      principalDueAmount: null,
    });
    expect(appointmentDue(l, '2026-07-25')).toBe(7_000);
  });

  it('ยอดตายที่จ่ายครบจนปิดยอดวันนั้น → ต้องไม่เด้งยอดกลับมาให้เก็บอีก', () => {
    // ต้นคงเหลือของยอดตายถูกแช่ไว้ที่ค่าเดิม (10,000) แม้จ่ายจบแล้ว
    // ต้องอ่านจากยอดตายคงเหลือ (0) ไม่ใช่ต้นคงเหลือ
    const l = withAppt({
      status: LoanStatus.CLOSED,
      deadDate: '2026-07-21',
      deadBalance: 0,
      outstandingPrincipal: 10_000,
      principalDueAmount: null,
    });
    expect(appointmentDue(l, '2026-07-25')).toBe(0);
  });

  it('ยอดที่ตัดหนี้สูญแล้ว → ไม่ทวงตามนัด', () => {
    const l = withAppt({ status: LoanStatus.BAD_DEBT });
    expect(appointmentDue(l, '2026-07-25')).toBe(0);
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

  it('ผ่อนงวดไม่ใช้นัดคืนต้น (มีตารางงวดอยู่แล้ว)', () => {
    const l = withAppt({
      status: LoanStatus.INSTALLMENT,
      deadBalance: 1_200,
      principalDueAmount: 500,
    });
    expect(appointmentDue(l, '2026-07-25')).toBe(0);
  });
});

describe('remainingBalanceOnDay — ยอดที่ยังต้องเก็บของวันนั้น', () => {
  it('ผ่อนงวด: จ่ายมาบางส่วน ยอดที่เหลือต้องไม่กลายเป็น 0', () => {
    // งวดค้าง 2 งวด (฿200) จ่ายมา ฿100 → dueNow เหลือ 100 (หักให้แล้ว)
    // ห้ามเอา 100 ที่จ่ายวันนี้มาลบซ้ำจนเหลือ 0
    expect(
      remainingBalanceOnDay({
        status: LoanStatus.INSTALLMENT,
        duePrincipal: 0,
        dueInstallment: 200,
        installmentDueNow: 100,
        paidTowardBalance: 100,
      }),
    ).toBe(100);
  });

  it('ผ่อนงวด: จ่ายล่วงหน้ามาแล้ว → ไม่ต้องเก็บเพิ่มวันนี้', () => {
    expect(
      remainingBalanceOnDay({
        status: LoanStatus.INSTALLMENT,
        duePrincipal: 0,
        dueInstallment: 100, // งวดวันนี้ยังโชว์ให้เห็นว่ามีนัด
        installmentDueNow: 0, // แต่จ่ายมาก่อนแล้ว
        paidTowardBalance: 0,
      }),
    ).toBe(0);
  });

  it('ยอดตาย: งวดตายตัว ต้องหักเงินที่จ่ายวันนั้นเอง', () => {
    expect(
      remainingBalanceOnDay({
        status: LoanStatus.DEAD,
        duePrincipal: 0,
        dueInstallment: 500,
        installmentDueNow: 0,
        paidTowardBalance: 200,
      }),
    ).toBe(300);
  });

  it('ยอดปกติ: นัดคืนต้น ฿1,000 จ่ายมา ฿400 → เหลือ ฿600', () => {
    expect(
      remainingBalanceOnDay({
        status: LoanStatus.ACTIVE,
        duePrincipal: 1_000,
        dueInstallment: 0,
        installmentDueNow: 0,
        paidTowardBalance: 400,
      }),
    ).toBe(600);
  });

  it('จ่ายเกินยอดที่ต้องเก็บ → ไม่ติดลบ', () => {
    expect(
      remainingBalanceOnDay({
        status: LoanStatus.DEAD,
        duePrincipal: 0,
        dueInstallment: 500,
        installmentDueNow: 0,
        paidTowardBalance: 900,
      }),
    ).toBe(0);
  });
});
